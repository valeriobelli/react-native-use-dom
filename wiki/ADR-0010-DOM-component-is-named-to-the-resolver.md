## Status

Accepted (2026-10-20)

## Context

A release build writes one page per DOM component, and the pages import much of the same code: React, React DOM and the library's own runtime. The bundler has to be told which component a page is built for. Metro stores the result of transforming a module under a key made of the file, its content and the transform options of the request, among them `customTransformOptions` ([`Transformer.js`](https://github.com/facebook/metro/blob/v0.87.1/packages/metro/src/DeltaBundler/Transformer.js)). It does not use `customResolverOptions` for that key; those options select the resolution and the graph instead (`getGraphId.js`, `ModuleResolution.js`). The library first sent the component in `customTransformOptions`, so every module a page imported was transformed and minified once per component. With 11 components on the example apps, a cold `react-native bundle` spent about 530 transforms on the web pages instead of about 65, and took 13 to 21 seconds instead of 5 to 10.

## Decision

The component is named to Metro's resolver, as the resolver option `dom`, and never to its transformer. Every page then has the same entry module, which imports a fixed specifier that the web resolver answers with the component of the build. The resolver first checks that the component is inside the project, its watch folders or Metro's server root, then resolves its path like any other import, so the project's resolver and `browser` fields still choose the file. The first page of a release build is built alone, so the others find the shared modules in the cache.

## Consequences

- The cost of a release build grows with the code the components add, not with the number of components times the code they share.
- Metro's resolver options are not an extension point it documents as a cache boundary. If a Metro release keyed the transform cache on them, the cost would return; a test reads Metro's source to catch that.
- Other tools read `customTransformOptions.dom` too: Expo's Babel transformer treats it as a DOM component and applies its WebView preset. The library keeps it constant (`dom: 'true'` for every component), mirroring Expo's CLI, so Expo's output is unchanged and the transform cache stays shared between components.
- Dev server URLs carry the component in `resolver.dom`, and `transform.dom` is always `true`. The native view only sends `file=`, so only tools that build those URLs themselves, such as the e2e warm-up, have to follow.
