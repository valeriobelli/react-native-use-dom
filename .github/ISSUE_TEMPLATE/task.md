---
name: Task
about: One self-contained unit of work that an agent or a contributor can pick up without extra context.
title: ''
labels: [enhancement]
---

## Goal

<!-- One or two sentences: what exists when this is done. -->

## Context

<!-- Why this task exists. Link the parent issue and the issues this one is blocked by. -->

## Read before starting

<!-- Files to read first, with their paths. -->

## Decisions already made (do not change them)

<!-- The decisions this task relies on, each with its source. If one looks wrong, comment on the issue
and stop. -->

## Steps

<!-- One concrete action per step: exact paths, exact commands. -->

## Out of scope

<!-- What a reader might think belongs here, but does not. -->

## Acceptance criteria

<!-- Checkable with a command, a file, or a visible behaviour. -->

## Verify before opening the PR

<!-- Run these from the repository root. All must pass, with zero warnings: -->

```sh
pnpm lint
pnpm format:check   # `pnpm format` fixes formatting
pnpm typecheck
pnpm test
zizmor .github
```

## Rules

- Never rely on memory for external tools, versions or APIs. Open the sources linked in the issue
  (or the official docs) and cite them in the PR description. If a source does not settle a
  question, comment on the issue and stop.
- Do not change the decisions listed in the issue. If one looks wrong, comment on the issue and stop.
- Commits follow Conventional Commits, with a lower-case subject and body lines of at most 100
  characters.
- Needs a booted iOS simulator / Android emulator: <yes/no>

## Open questions

<!-- What to check before or while working, and what to do with each possible answer. -->

## Sources

<!-- Links that back the external facts this task depends on. -->
