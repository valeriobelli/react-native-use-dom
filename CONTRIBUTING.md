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

`pnpm typecheck` checks the tests as well as the library. That includes the type tests in
`packages/react-native-use-dom/src/__tests__/types`, which are never run. Each `@ts-expect-error` in them
marks code that must not compile, so an expectation that stops failing is itself an error.

[`docs/errors.md`](./docs/errors.md) is generated. To add or change an error code, document it in
`packages/react-native-use-dom/src/docs/errors.ts` and run `pnpm docs:errors`. `pnpm test` fails when
the two differ.

## Releasing

Releases are made with [Changesets](https://changesets.dev) and published from GitHub Actions with
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers): no npm token is stored, and
every version carries a provenance attestation.

1. A pull request that changes the library adds a changeset: run `pnpm changeset`, pick the bump,
   and describe the change for the changelog. CI fails a pull request without one; add an empty
   one (`pnpm changeset --empty`) for changes that need no release.
2. On every push to `main`, the [Release workflow](./.github/workflows/release.yml) opens or
   updates the **Version Packages** pull request, which bumps the version and writes the
   changelog from the pending changesets.
3. Merging that pull request publishes nothing. To publish, run the Release workflow by hand
   (Actions → Release → Run workflow) on `main`. It checks, builds and packs the package, then
   publishes it, tags the commit and creates the GitHub release.

The Version Packages pull request is opened with the workflow's own token, so GitHub doesn't run
CI on it: close and reopen it to get the checks.

One-time setup:

- In the repository settings, under Actions → General, allow GitHub Actions to create and approve
  pull requests.
- Trusted publishers are configured in a package's settings on npmjs.com, so the first version is
  published by hand. Then, in the package's settings, add a trusted publisher for GitHub Actions
  with the repository `valeriobelli/react-native-use-dom`, the workflow `release.yml` and the
  environment `npm`, and disallow publishing with tokens.

To see what a release would publish without publishing it, build and pack locally:

```sh
pnpm build
pnpm changeset publish-plan
pnpm changeset pack --out-dir /tmp/use-dom-pack
npm publish --dry-run /tmp/use-dom-pack/packages/react-native-use-dom-*.tgz
```
