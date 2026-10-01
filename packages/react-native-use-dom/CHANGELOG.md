# react-native-use-dom

## 0.0.1

### Patch Changes

- [`d47a096`](https://github.com/valeriobelli/react-native-use-dom/commit/d47a09691ee2b9e75c1d2d1f0b29a41599d5e769) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Rendering a DOM component in Expo Go now throws `ERR_USE_DOM_EXPO_GO_UNSUPPORTED`, which says to run the app as
  a development build, instead of Nitro's error on import. The rest of the app keeps working.

- [`b9c6ebc`](https://github.com/valeriobelli/react-native-use-dom/commit/b9c6ebcb8f46ba297f9c5e66e4c6bd59762103ce) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Fix native actions, ref calls and prop updates that stopped reaching a DOM component after a Fast Refresh, and in
  Strict Mode from the first render.

- [`18f7b51`](https://github.com/valeriobelli/react-native-use-dom/commit/18f7b517cb2526ccdea7bd917860f8aa684a1228) Thanks [@valeriobelli](https://github.com/valeriobelli)! - In development, a DOM component that lays out with a height of 0 now logs a warning with the likely cause and the
  fixes, and is outlined in red with a minimum height, so that it can be found.
