# Contributing

## Setup

Requires Node.js 22.12 or later, pnpm (the version in `package.json`'s `packageManager`) and
[zizmor](https://docs.zizmor.sh/installation/) (for example `brew install zizmor` or `uv tool install zizmor`).

```sh
pnpm install
pnpm exec lefthook install
```

Dependencies' install scripts are disabled in this workspace, so the git hooks are not installed by
`pnpm install`: run `pnpm exec lefthook install` once after cloning.

## Git hooks

- **pre-commit** checks the staged files with `oxlint` and `oxfmt --check`, and audits
  `.github` with `zizmor` when a file there is staged.
- **commit-msg** checks the message follows [Conventional Commits](https://www.conventionalcommits.org/)
  with commitlint's `@commitlint/config-conventional`.

## Checks

These are the checks CI runs:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
zizmor .github
```
