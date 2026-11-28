#!/usr/bin/env node
/**
 * Drives the running app through `agent-browser` for a verification.
 *
 * Each rule below was a line in docs/verification.md that agents kept
 * breaking; here the call cannot be made the wrong way:
 *
 * - a named session is mandatory: the default one shares localStorage with
 *   every other agent on the origin;
 * - a page script always travels as base64, never through a pipe or a quoted
 *   argument, and its result comes back ASCII-escaped, because the daemon
 *   drops or chokes on a non-ASCII character inside a structured value;
 * - a transient daemon error is retried once on a read, and never on a page
 *   script of the caller's: that error can arrive after the script has done
 *   its work, and a second run would do it twice;
 * - `open` returns once `window.arrogantt` exists, not once the page loaded;
 * - a screenshot is taken with the pointer parked and nothing under hover.
 *
 * Usage: node scripts/ab.mjs --session <name> <command> [args]
 * `node scripts/ab.mjs help` lists the commands.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = 'http://localhost:5173'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRANSIENT = /os error 10060|daemon may be busy|EOF while parsing/
const READY_TIMEOUT_MS = 20_000

const HELP = `node scripts/ab.mjs --session <name> <command> [args]

  open [--demo] [--scheme dark|light] [--viewport <w>x<h>[@<scale>]]
        Open ${ORIGIN} and wait for window.arrogantt. --demo loads
        docs/demo.gantt and leaves the page clean.
  demo  Load docs/demo.gantt into the page already open.
  eval <file.js> [--retry]
  eval -e "<js>" [--retry]
        Run a script in the page; prints its value (a promise is awaited).
        --retry declares it read-only, so a transient error may run it again.
  style <selector> <property>... [--pseudo ::before] [--limit <n>]
        Computed style of every match, and how many matched.
  probe [taskId...]
        scripts/probe-rows.js: grid row, timeline row and bar per task.
  shot <path.png>
        Park the pointer, check nothing is hovered, take the screenshot.
  <anything else>
        Passed to agent-browser in the session, retried once when transient.
`

function fail(message) {
  console.error(`ab: ${message}`)
  process.exit(1)
}

// The npm shim is a .cmd on Windows, which Node refuses to spawn without a
// shell; the native binary beside it takes arguments untouched.
function binary() {
  if (process.env.AGENT_BROWSER_BIN) return process.env.AGENT_BROWSER_BIN
  if (process.platform !== 'win32') return 'agent-browser'
  const exe = 'node_modules/agent-browser/bin/agent-browser-win32-x64.exe'
  const roots = [dirname(process.execPath), join(process.env.APPDATA ?? '', 'npm')]
  const found = roots.map((root) => join(root, exe)).find(existsSync)
  if (!found) fail(`agent-browser binary not found; set AGENT_BROWSER_BIN (looked under ${roots.join(', ')})`)
  return found
}

const argv = process.argv.slice(2)
let session = process.env.AGENT_BROWSER_SESSION
const sessionAt = argv.indexOf('--session')
if (sessionAt !== -1) [, session] = argv.splice(sessionAt, 2)
const [command, ...rest] = argv

if (!command || command === 'help' || command === '--help') {
  console.log(HELP)
  process.exit(0)
}
if (!session || session === 'default') {
  fail('a named --session is required: the default session shares storage with every other agent on this origin')
}

const BIN = binary()

function takeFlag(args, name) {
  const at = args.indexOf(name)
  if (at === -1) return false
  args.splice(at, 1)
  return true
}

function takeOption(args, name) {
  const at = args.indexOf(name)
  if (at === -1) return undefined
  const [, value] = args.splice(at, 2)
  if (value === undefined) fail(`${name} needs a value`)
  return value
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function once(args) {
  const run = spawnSync(BIN, ['--session', session, ...args], { encoding: 'utf8' })
  if (run.error) fail(`cannot run ${BIN}: ${run.error.message}`)
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim()
  return { ok: run.status === 0, output }
}

/** One agent-browser call; `retry` only where a second run cannot do harm. */
function ab(args, { retry = true } = {}) {
  let result = once(args)
  if (!result.ok && retry && TRANSIENT.test(result.output)) {
    sleep(1500)
    result = once(args)
  }
  return result
}

function must(args, options) {
  const result = ab(args, options)
  if (!result.ok) fail(`agent-browser ${args.join(' ')}\n${result.output}`)
  return result.output
}

/**
 * Runs `source` in the page and returns its value.
 *
 * The page side stringifies and ASCII-escapes the value so that only a plain
 * string crosses the daemon, and reports a thrown error as data: a script
 * that throws would otherwise read as an empty result.
 */
function pageEval(source, { retry }) {
  const wrapped = `(async () => {
    const ascii = (text) => text.replace(/[^\\x20-\\x7e]/g, (c) => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    try {
      const value = await (0, eval)(${JSON.stringify(source)})
      const json = JSON.stringify({ value })
      return ascii(json === undefined ? '{}' : json)
    } catch (error) {
      return ascii(JSON.stringify({ error: String(error && error.stack || error) }))
    }
  })()`
  const encoded = Buffer.from(wrapped, 'utf8').toString('base64')
  const result = ab(['eval', '-b', encoded, '--json'], { retry })
  let envelope
  try {
    envelope = JSON.parse(result.output)
  } catch {
    envelope = undefined
  }
  if (!result.ok || !envelope?.success) {
    const landed = TRANSIENT.test(result.output) && !retry
    fail(
      `page script failed to report\n${result.output}` +
        (landed ? '\nThe script may have run all the same: read the state back before running it again.' : ''),
    )
  }
  const payload = JSON.parse(envelope.data.result)
  if (payload.error) fail(`page script threw\n${payload.error}`)
  return payload.value
}

function print(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

function waitForApp() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const probe = ab(['eval', 'typeof window.arrogantt', '--json'])
    if (probe.ok && probe.output.includes('"object"')) return
    sleep(400)
  }
  fail(`window.arrogantt did not appear within ${READY_TIMEOUT_MS / 1000}s — is the dev server up on ${ORIGIN}?`)
}

function loadDemo() {
  return pageEval(
    `fetch('/docs/demo.gantt').then((r) => r.text()).then((text) => {
      window.arrogantt.loadText(text, 'demo.gantt')
      return window.arrogantt.getPlan().tasks.length + ' tasks loaded'
    })`,
    { retry: false },
  )
}

const HOVERED = '.gantt_row:hover, .gantt_task_row:hover, .gantt_task_line:hover, button:hover, [role="button"]:hover'

/**
 * Leaves the pointer where nothing reacts to it. A resize or a reflow can
 * slide a row under a pointer that never moved, and one move onto the pixel
 * already under it fires no event — hence two moves a pixel apart.
 */
function parkPointer() {
  const { w, h } = pageEval('({ w: innerWidth, h: innerHeight })', { retry: true })
  const spots = [
    [w - 3, h - 3],
    [Math.round(w / 2), h - 3],
    [3, h - 3],
    [3, 3],
  ]
  for (const [x, y] of spots) {
    must(['mouse', 'move', String(x - 1), String(y)])
    must(['mouse', 'move', String(x), String(y)])
    const hovered = pageEval(`document.querySelectorAll(${JSON.stringify(HOVERED)}).length`, { retry: true })
    if (hovered === 0) return
  }
  fail('no place to park the pointer: something is hovered at every corner tried')
}

const commands = {
  open(args) {
    const demo = takeFlag(args, '--demo')
    const scheme = takeOption(args, '--scheme')
    const viewport = takeOption(args, '--viewport')
    if (viewport) {
      const match = /^(\d+)x(\d+)(?:@(\d+))?$/.exec(viewport)
      if (!match) fail('--viewport is <w>x<h> or <w>x<h>@<scale>')
      must(['set', 'viewport', ...match.slice(1).filter(Boolean)])
    }
    // Before the load, not after: under Auto the app reads the scheme once.
    if (scheme) must(['set', 'media', scheme])
    must(['open', ORIGIN])
    waitForApp()
    print(demo ? loadDemo() : 'app ready')
  },

  demo() {
    print(loadDemo())
  },

  eval(args) {
    const retry = takeFlag(args, '--retry')
    const inline = takeOption(args, '-e')
    if (inline === undefined && args.length !== 1) fail('eval takes one file, or -e "<js>"')
    const source = inline ?? readFileSync(resolve(args[0]), 'utf8')
    print(pageEval(source, { retry }))
  },

  style(args) {
    const pseudo = takeOption(args, '--pseudo') ?? null
    const limit = Number(takeOption(args, '--limit') ?? 5)
    const [selector, ...props] = args
    if (!selector || props.length === 0) fail('style takes a selector and at least one property')
    print(
      pageEval(
        `(() => {
          const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
          const props = ${JSON.stringify(props)}
          return {
            matched: nodes.length,
            styles: nodes.slice(0, ${limit}).map((node) => {
              const style = getComputedStyle(node, ${JSON.stringify(pseudo)})
              return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]))
            }),
          }
        })()`,
        { retry: true },
      ),
    )
  },

  probe(ids) {
    const probe = readFileSync(join(ROOT, 'scripts/probe-rows.js'), 'utf8')
    print(pageEval(`globalThis.__probeRowIds = ${JSON.stringify(ids)};\n${probe}`, { retry: true }))
  },

  shot(args) {
    if (args.length !== 1) fail('shot takes the path of the PNG to write')
    parkPointer()
    print(must(['screenshot', resolve(args[0])]))
  },
}

if (commands[command]) {
  commands[command](rest)
} else {
  const result = ab([command, ...rest])
  if (result.output) console.log(result.output)
  process.exit(result.ok ? 0 : 1)
}
