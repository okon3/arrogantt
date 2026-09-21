import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

describe('parseChangelog', () => {
  it('parses entries newest first, as declared', () => {
    const text = `# Changelog

## v1.1 — 2026-10-01

- Seconda voce.
- Un'altra voce.

## v1.0 — 2026-09-04

- Prima versione pubblica.
`;
    const entries = parseChangelog(text);
    expect(entries).toEqual([
      { version: 'v1.1', date: '2026-10-01', notes: ['Seconda voce.', "Un'altra voce."] },
      { version: 'v1.0', date: '2026-09-04', notes: ['Prima versione pubblica.'] },
    ]);
  });

  it('attaches bullets to the entry they follow', () => {
    const text = `## v2.0 — 2026-11-01

- Nota A.

## v1.0 — 2026-09-04

- Nota B.
- Nota C.
`;
    const entries = parseChangelog(text);
    expect(entries[0].notes).toEqual(['Nota A.']);
    expect(entries[1].notes).toEqual(['Nota B.', 'Nota C.']);
  });

  // The release workflow parks upcoming bullets under a top `## Unreleased`
  // heading: it must stay invisible (badge, popup, dialog) until renamed.
  it('ignores a leading Unreleased section and its bullets', () => {
    const text = `# Changelog

## Unreleased

- Pending feature.

## v1.0 — 2026-09-04

- Released feature.
`;
    expect(parseChangelog(text)).toEqual([
      { version: 'v1.0', date: '2026-09-04', notes: ['Released feature.'] },
    ]);
  });

  // A CRLF working copy (`core.autocrlf` leaves the checkout alone, an editor
  // rewrites the file) used to parse headings and drop every bullet: the dialog
  // showed release dates with nothing under them.
  it('reads a CRLF document', () => {
    const text = ['# Changelog', '', '## v1.0 — 2026-09-04', '', '- Nota A.', '- Nota B.', ''].join(
      '\r\n',
    );
    expect(parseChangelog(text)).toEqual([
      { version: 'v1.0', date: '2026-09-04', notes: ['Nota A.', 'Nota B.'] },
    ]);
  });

  // The file wraps its bullets at the margin. Reading only the first line cut
  // every note of every release short, mid-sentence, and no fixture here wrapped.
  it('joins the indented lines a wrapped bullet continues on', () => {
    const text = `## v1.0 — 2026-09-04

- Una nota che va a capo
  perche' la riga era piena,
  e poi ancora.
- Nota corta.
`;
    expect(parseChangelog(text)[0].notes).toEqual([
      "Una nota che va a capo perche' la riga era piena, e poi ancora.",
      'Nota corta.',
    ]);
  });

  it('wraps bullets in a CRLF document too', () => {
    const text = ['## v1.0 — 2026-09-04', '', '- Una nota', '  che va a capo.', ''].join('\r\n');
    expect(parseChangelog(text)[0].notes).toEqual(['Una nota che va a capo.']);
  });

  // Otherwise any indented line later in the section would glue itself onto the
  // last note it happened to follow.
  it('a blank line ends a bullet', () => {
    const text = `## v1.0 — 2026-09-04

- Una nota.

  Un blocco rientrato che non le appartiene.
`;
    expect(parseChangelog(text)[0].notes).toEqual(['Una nota.']);
  });

  it('drops the continuation of a bullet that has no entry to hang on', () => {
    const text = `- Nota orfana
  e la sua continuazione.

## v1.0 — 2026-09-04

- Nota vera.
`;
    expect(parseChangelog(text)).toEqual([
      { version: 'v1.0', date: '2026-09-04', notes: ['Nota vera.'] },
    ]);
  });

  it('returns an empty array for empty or garbage text', () => {
    expect(parseChangelog('')).toEqual([]);
    expect(parseChangelog('just some\nrandom text\nwith no headings')).toEqual([]);
  });
});
