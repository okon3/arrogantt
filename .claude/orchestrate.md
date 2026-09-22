# Orchestrate binding — gantt

Project facts for the orchestrate-v2 protocol. The skill defines the process;
this file binds it to this repo.

- **Checks**: `npm test`, `npm run build`, `npm run lint` — the hub runs all
  three after every implementer report.
- **Deep-lane triggers**: any task touching `src/scheduler/` or an invariant
  listed in CLAUDE.md (_Invariants_, _Day-boundary rule_) → `implementer-deep`,
  and the critic stays on its default (opus/xhigh). Everything else: critic
  with `model: "sonnet"`.
- **Verification doctrine**: `docs/verification.md` — user-visible behaviour
  is verified in the running app (embedded browser), never asserted from code.
  Restart the dev server after structural CSS changes or `npm install` before
  trusting any negative verdict (stale HMR, see CLAUDE.md).
- **Serial constraints**: one shared Browser pane — only one worker may drive
  it at a time; tasks stay serial unless truly disjoint AND worktree-isolated.
- **Goal & plan**: `PLAN.md` at the repo root; the goal is its `## Goal`
  section. Goal-review bar = that section plus the Accept lines of the goal's
  tasks.
- **Closure ritual**: on `ship`, propose the release — rename CHANGELOG.md's
  `## Unreleased` heading to `## v<next-minor> — <today>`; the user always
  confirms before the rename.
- **Plan hygiene, with a number**: at every end-of-task checkpoint **delete
  before adding**. A durable lesson graduates to `CLAUDE.md` or `docs/` first,
  then leaves the plan; a spent one is deleted. Hard caps: `## Log` ≤ 40
  lines, one to two lines per entry, and **no list of finished tasks** — a
  commit sha is the record. A checkpoint that leaves the Log over the cap is
  not finished. "Prune continuously" was ignored for three days; a number is
  the forcing function.
- **Git is the archive for the plan and the binding, and for nothing else
  under `.claude`.** `PLAN.md` and this file are tracked; `.claude/*` is
  ignored by default with a negation for this file, so briefs, specs and the
  `orchestrator.lock` stay out of history on purpose. Pruning the plan is
  therefore recoverable with `git show` — it was not until 2026-09-08, and
  the Accept lines of T12-T15 and T19 were destroyed that way, along with
  every brief of T12-T31.
  The rule that came out of it stands regardless of recoverability: **never
  prune a done task's Accept lines before that goal's review has run** — they
  are half the goal-review bar. Done tasks collapse to one line _after_
  `ship`, never before.
  Riproposto il 2026-09-09 se tracciare anche `settings.local.json` e
  `.claude/specs/T33-report.md`: risposta **no**, la regola vale come scritta.
  Chiusa, non riproporre. `T33-report.md` resta non tracciato e **non va
  cancellato** dallo sweep degli orfani finche' il piano lo elenca sotto
  _Analisi in giacenza_: e' materiale di decisione, non la spec di un task
  chiuso.
- **"Read-only" restricts Write/Edit, not Bash — and no hook stops a worker
  committing here.** `.claude/hooks/` is empty and `settings.local.json`
  declares no `hooks` key, so **none** of the protocol's hooks fire in this
  repo: not `deny-agent-commit`, not `require-brief`, and not the lock
  heartbeat.
  On 2026-09-08 the goal-reviewer — briefed "you do not fix, you do not
  commit" — wrote `docs/verification.md` and committed it (`929ebd9`) through
  Bash, and its report said nothing about it. The note was good and was kept;
  the lesson is that agent commits must be _detected_, not assumed impossible.
  **Read `git log` at every checkpoint and compare against the commits you
  made yourself**: a report's CHANGES list is not the diff, and a read-only
  agent is read-only by convention only.
  **E non e' solo un agente a poterlo fare**: il 2026-09-16, mentre F1 era in
  corsia, una sessione sorella dell'utente (che non aveva preso il lock) ha
  committato `PLAN.md` — `3868bf7`, scoping di T64/T65 — inglobando il `[>]`
  che l'hub aveva appena scritto. Disgiunto, quindi innocuo, ma il lock non
  protegge il piano da chi non lo legge: la regola vale per **ogni** scrittore,
  e un `git log` a ogni checkpoint e' l'unico modo di accorgersene.
- **The lock is hand-written here, and its shape is load-bearing.** With no
  heartbeat hook, whatever the hub writes into `.claude/orchestrator.lock` is
  what the next generation reads — and invocation parses it as JSON,
  `{"session":"<id>","at":"<ISO timestamp>"}`, comparing `at` against a
  45-minute liveness window. Free-form text or a date without a time makes
  staleness uncomputable and the successor has to guess whether the previous
  hub is alive. Write that shape, and **refresh `at` at your own
  checkpoints**: nothing else will.
- **The port is the mutex**: `strictPort` on 5173 means two lanes restarting
  the dev server kill each other's listener and each other's fixtures, with
  no error. A completion notification is not proof a lane is done (the same
  agent can notify again) — check before touching the origin or the port.
  **Check the port itself, not the lane's status**: a lane `ListAgents` calls
  `completed` can still own the listener through the dev server it spawned
  (T49: the implementer was `completed` while its server held 5173; the
  critic's `dev:fresh` killed it, harmless only because the measuring was
  over).
- **A completion notification is not a completion — and a hub is not exempt
  from the rule above.** Gen 7 broke it as the hub, not as a lane: two of its
  three turns ended on a stated intention ("now I write the brief and spawn")
  with the lock frozen, the tree clean and **nothing in flight**. From outside
  that is indistinguishable from a dead agent, and only the lock's `at` tells
  the two apart. The turn that produced (F4a, closed clean) is the one that
  followed an imperative prompt: a narrative handoff produces a summary, an
  imperative one produces work. **Never end a turn announcing the next step —
  do it, or say in one paragraph what blocks you.**
- **Verify a spawn with `ListAgents`, always.** The Agent tool answers
  "launched successfully" for a lane that never starts — an interrupt landing
  on the same turn kills it, the transcript stays 0 bytes, and the hub
  reports progress that does not exist (T49, twice, before the user caught
  it). One `ListAgents` call after every spawn is the whole fix.
  **E cattura anche la corsia che ri-delega**: su F7 (2026-09-16) l'agente
  invocato come `implementer` non ha implementato — ha spawnato un
  `implementer-deep` con un brief di seconda mano, da un padre che si era
  gia' chiuso, quindi senza canale di notifica verso l'hub. Il `ListAgents`
  l'ha mostrato subito. Fermato con tree pulito, rispawnato col **divieto
  esplicito di delegare scritto nel prompt** — mettilo in ogni spawn.
- **Una cella di tabella in un brief e' codice che la corsia scrive alla
  lettera — quindi copiare il predicato piu' stretto, non la forma.** Su F1
  (2026-09-16) il brief dettava la regola del tasso di un periodo come «non un
  numero, o `NaN`», copiando la forma della regola gemella
  dell'availability; ma quella gemella si permette `NaN` solo perche' la riga
  dopo (`> 1`) intercetta gli infiniti, e la regola del tasso di default tre
  righe sopra usa `Number.isFinite`. Risultato: un `Infinity` passava il gate,
  e `JSON.stringify` lo scrive `null` — cioe' un progetto il cui **stesso testo
  di input questo parser rifiuta**, portandosi giu' Save, undo e draft. La
  corsia ha implementato la lettera del brief, correttamente. L'ha trovato il
  critic, non i 473 test. Quando un brief riusa la forma di una regola vicina,
  verificare **perche'** quella vicina puo' essere piu' debole.
- **Come si briefa il critic qui** (promosso dal Log il 2026-09-22, pratica
  stabilita su G2, I1 e K1). Le domande si danno **in ordine di paura**, e gli
  si **vieta di dare entrambe le mani**: su G2 ha scelto, ribaltando
  l'esitazione dell'hub con un argomento di *tipo*, non di gusto. Se la posta
  sono i test, si chiede esplicitamente **«questi test mordono?»** e li misura
  mutando il codice — su I1, quattro mutazioni in un worktree usa-e-getta
  (`git worktree add --detach` piu' `git apply` del diff non committato),
  ognuna col fallimento atteso. E' la domanda che trasforma una suite verde in
  una prova, e costa poco.
  **E gli si chiede di leggere le ragioni, non solo le regole**: su K1 il
  critic ha misurato tutto cio' che gli era stato chiesto e non ha visto una
  regola CSS inerte giustificata da un meccanismo inesistente, scritta in due
  case. L'ha trovata l'hub leggendo il diff — che e' il motivo per cui il
  diff si legge comunque.
  **Ma «questa ragione e' vera?» non basta: fatti dire il controfattuale che
  ha provato.** Su K11 la domanda era fra le quattro, in ordine di paura, e
  il critic ha risposto che tutti e tre i commenti reggevano. Uno diceva
  «`--line-strong`, non `--surface-hover`, o hover e pressed dipingerebbero
  lo stesso colore»: l'hover era `--line`, quindi il valore che pareggia era
  `--line` e il controfattuale scritto era falso. Il critic ha misurato che
  hover e pressed **oggi** differiscono — il **conseguente** — e ha dichiarato
  vera la condizionale. E' la trappola di `CLAUDE.md` (*a conditional premise
  loses its condition on the way*) vista dal lato di chi verifica: il
  conseguente e' misurabile nel browser e la condizionale no, quindi misura
  quello. Il rimedio e' una riga nel brief: **per ogni ragione, scrivi il
  controfattuale che hai provato e come l'hai provato** — non «regge».

- **Come si briefa la goal review qui.** Dirle che un terzo `fix-first` non
  e' gratis le fa rendere COHERENCE invece di ACTIONS (terza di F, 128k: due
  difetti veri sotto il bar, non tre task in piu').

- **Docs duty**: a commit changing behaviour described in `docs/` updates the
  affected file in the same commit (map in CLAUDE.md); significant features
  add a CHANGELOG bullet under `## Unreleased` in the same commit.
