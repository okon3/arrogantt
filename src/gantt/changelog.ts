export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

const HEADING = /^##\s+(v\S+)\s+—\s+(\S+)/;
const BULLET = /^-\s+(.*)$/;
const CONTINUATION = /^\s+(\S.*)$/;

/**
 * Parses `CHANGELOG.md`'s own format: `## v<version> — <date>` headings
 * followed by `- ` bullets, in declared order. A bullet may wrap onto indented
 * lines, which join it with a single space; a blank line ends it. Never throws
 * — a malformed or empty document yields `[]`, and the caller shows nothing
 * rather than crash.
 */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  // Whether the last note may still absorb an indented line. A blank line, a
  // heading or a bullet with no entry to hang on all close it.
  let open = false;

  // CRLF too: the document arrives through a `?raw` import of the working copy,
  // whose line endings follow the checkout rather than the repo. A trailing `\r`
  // survives HEADING but kills BULLET — `.` never crosses a line terminator, so
  // `$` has nothing left to match.
  for (const line of text.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    if (heading) {
      current = { version: heading[1], date: heading[2], notes: [] };
      entries.push(current);
      open = false;
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      open = current !== null;
      if (current) current.notes.push(bullet[1].trim());
      continue;
    }
    // The file wraps its bullets at the margin, so most of a note lives on
    // indented lines that match neither pattern above; dropping them cut every
    // note of every release short, mid-sentence.
    if (open && current) {
      const continuation = CONTINUATION.exec(line);
      if (continuation) {
        current.notes[current.notes.length - 1] += ` ${continuation[1].trim()}`;
        continue;
      }
    }
    open = false;
  }

  return entries;
}
