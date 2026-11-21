---
name: changelog
description: Write or revise CHANGELOG.md entries for this app, and cut a release. Use when a commit adds a user-visible feature, when asked to write, shorten, tidy or review the changelog, or when a release is proposed.
---

# Changelog

`CHANGELOG.md` is what the app shows under its version badge ("What's new").
Its reader is a user skimming to see what changed, not a developer.

## What goes in

- What a user can now do. Never a fix, plumbing, an internal or a refactor.
- One bullet per capability. A feature and its gestures are one bullet, not
  one each.
- Small visual changes of a release share **one** bullet, last in the list
  ("Smaller touches."). Drop the ones nobody would miss.
- How it works belongs to the help (`agentApi.help.md`, `HelpDialog`), not
  here.

## How a bullet is written

- **Two lines at most** (160 characters once joined; `changelog.test.ts`
  fails past it).
- Opens with a short name in `**bold**`, then one or two plain sentences
  saying what it gives you and where to find it.
- `**bold**` is the only markup the dialog renders. No links, code spans,
  lists or images.
- An emoji only on the two or three headline features of a release, before
  the bold name. Never on every bullet.
- English, the words the UI uses for the thing (End, Pace, People).

## Order

- Headline features first.
- Related bullets next to each other (scheduling together, people together),
  never scattered.
- The grouped small touches last.

## Releasing

- Bullets accumulate under `## Unreleased`, first in the file.
- Releasing renames that heading to `## v<next-minor> — <today>`. Propose it
  at a natural wrap-up; the user confirms before the rename.
- Major bump only for a breaking change to the `.gantt` file format.
- Recent releases only: git is the full record.

## Before committing

Read the release top to bottom as a user would: if two bullets say related
things apart from each other, or one needs a second reading, rewrite it.
Then `npm test`.
