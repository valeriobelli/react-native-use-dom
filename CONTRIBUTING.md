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

## End-to-end tests

[`.argent/flows`](./.argent/flows) holds [Argent](https://github.com/software-mansion/argent) flows that drive
each example app on a simulator or emulator. They cover the first render, native actions, prop changes, refs, a
blocked navigation, scrolling and Fast Refresh, and compare screenshots of the DOM components with the baselines in
`__baselines__`.

Each example app has its own directory, `.argent/flows/<app>`, named after the example (`bare-0.87`, `expo-57`).
It splits the flows by the build they need. Every flow is a small wrapper, `<slug>-<scenario>.yaml`, that launches
the app and runs the scenario in `.argent/flows/shared`.

| Directory                      | Scenarios                                                                     | Build                               |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------- |
| `.argent/flows/<app>/release/` | first-render, prop-change, refs, scroll, native-action and navigation-blocked | A Release build, with no dev server |
| `.argent/flows/<app>/dev/`     | fast-refresh                                                                  | A Debug build, with the dev server  |

The Debug build loads from the example's own dev server, on port 8081, so run one example at a time: start its
dev server and install its app as its README says. Then, from the repository root, run one directory:

```sh
pnpm e2e bare-0.87 release --device <simulator udid or emulator serial>
pnpm e2e expo-57 dev --device <simulator udid or emulator serial>
```

`pnpm e2e <app> <release|dev>` runs `argent flow run .argent/flows/<app>/<release|dev>` and passes `--device` and
`--update-baselines` on to it. `pnpm exec argent flow list` shows every wrapper.

On Android, run `adb reverse tcp:8081 tcp:8081` first. The Fast Refresh flow edits and restores
`e2e/example-app/src/Greeting.tsx`, the greeting every example renders, so don't edit it while the flows run.

The baselines live next to the wrappers, in `.argent/flows/<app>/<release|dev>/__baselines__`, so every app and
every kind of build has its own. They are keyed by platform and screen size: they were taken on an iPhone 16 Pro
(iOS 18) and a 1080x2400 Android emulator, from a Debug build. On another device, with a Release build, or after
changing what a DOM component looks like, write new ones with `--update-baselines`, check them, and run the flows
again to compare.

On iOS a flow can't find text inside a WebView, so the flows tap the native views that hold the DOM components
and check the results in native text and screenshots. On Android they also check the text of the pages.

## Decisions (wiki)

The repository's [wiki](https://github.com/valeriobelli/react-native-use-dom/wiki) holds the library's product and
architecture decisions, one page per decision, and the [`wiki` folder](./wiki) in the repository is its source of
truth: the [Publish wiki workflow](./.github/workflows/publish-wiki.yml) mirrors it to the wiki on every push to
`main` that changes it. One direction only — edits made in the wiki's editor are overwritten by the next publish.

Write a decision page when the change is about what the library is or guarantees, and update
[docs](./docs/README.md) when it changes user-facing behaviour. Pages reach the wiki through pull requests, like
any other change.

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
