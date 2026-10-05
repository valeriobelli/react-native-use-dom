# Compatibility

`react-native-use-dom` is tested against these React Native versions and Expo SDKs. The table lists what is
tested. It does not show whether the tests pass.

| Version                         | Support level               | Example folder       | Tested       |
| ------------------------------- | --------------------------- | -------------------- | ------------ |
| React Native 0.85               | End of Cycle                | `examples/bare-0.85` | every change |
| React Native 0.86               | Active                      | `examples/bare-0.86` | every change |
| React Native 0.87               | Active                      | `examples/bare-0.87` | every change |
| React Native 0.88               | Future (release candidate)  | `examples/bare-0.88` | every change |
| Expo SDK 56 (React Native 0.85) | End of Cycle                | `examples/expo-56`   | every change |
| Expo SDK 57 (React Native 0.86) | Active                      | `examples/expo-57`   | every change |
| Expo SDK 58 (React Native 0.88) | Future (release candidate)  | `examples/expo-58`   | every change |
| React Native 0.81               | Unsupported by React Native | `examples/bare-0.81` | nightly      |

- **Support level** is the level of the React Native version in the
  [React Native releases overview](https://reactnative.dev/releases/overview).
- **Example folder** is the app in this repository that runs the tests for that row.
- **Tested** is `every change` for a version tested on every pull request, and `nightly` for a version tested
  once a night.

## Versions that are not in the table

- React Native versions below 0.81 are not supported.
- React Native 0.81 to 0.84 are covered only by the nightly floor check, which runs the oldest supported
  version, 0.81.
