# react-native-use-dom documentation

`react-native-use-dom` lets a React Native app render React DOM components. Mark a module with `'use dom'` and
import its component from native code: on iOS and Android it renders inside a native web view, with its props
sent across, its function props callable as native actions, and its methods reachable through a `ref`. On web,
the same module is an ordinary React component.

It needs no Expo package. It works in bare React Native apps and in Expo apps that use development builds.

1. [Installation](./installation.md): bare React Native and Expo.
2. [Authoring](./authoring.md): writing a DOM component and rendering it.
3. [Data in](./data-in.md): props, and what they may contain.
4. [Actions out](./actions-out.md): calling native code from a DOM component.
5. [Refs](./refs.md): calling a DOM component from native code.
6. [Sizing](./sizing.md): fill the parent, or size to the content.
7. [Assets](./assets.md): stylesheets, and files from the `public` folder.
8. [Development and release builds](./builds.md): Fast Refresh, debugging, offline pages.
9. [Limitations](./limitations.md).
10. [Troubleshooting](./troubleshooting.md).
11. [Errors](./errors.md): every error code, what it means and how to fix it.
12. [Compatibility](./compatibility.md): the React Native versions and Expo SDKs that are tested.
