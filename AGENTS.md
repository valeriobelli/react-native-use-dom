# Working in this repository

This is the source of `react-native-use-dom`. To use the library in an app, read
[packages/react-native-use-dom/AGENTS.md](./packages/react-native-use-dom/AGENTS.md) instead.

## Layout

- `packages/react-native-use-dom/src`: `babel` (the plugin), `metro` (`withDom`, dev server routes, release
  pages), `native` (the native-side proxy and types), `web` (the runtime in the web view), `runtime` (shared by
  both sides: errors, protocol, serialization).
- `packages/react-native-use-dom/ios` and `android`: the Nitro hybrid view, with `nitrogen/generated` produced by
  Nitrogen from `src/native/specs`.
- `examples/bare` and `examples/expo`: the same DOM components in both apps.
- `docs`: the user guide. `docs/errors.md` is generated.

## Before committing

Run, from the repository root, and fix everything they report:

```sh
pnpm lint            # zero warnings
pnpm format:check    # pnpm format fixes it
pnpm typecheck       # also checks the tests and src/__tests__/types
pnpm test
zizmor .github
```

## Conventions

- Commits follow Conventional Commits, with a lower-case subject and body lines of at most 100 characters.
- Every public export has TSDoc that says what it does, its constraints and an example. `src/public-api.test.ts`
  fails on an export without it.
- Every error the library throws is a `DomError` with a `DomErrorCode`. Add a new code to
  `src/docs/errors.ts` and run `pnpm docs:errors`.
- The docs describe behaviour and contracts, not how the library implements them.
- A DOM bundle can never import `react-native`: keep `src/web` free of it.
