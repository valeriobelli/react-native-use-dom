## Status

Accepted (2026-10-03)

## Context

In development, pages load from the app's dev server. A shipped app has no dev server, and users may have no network connection, but a DOM component has to show the same way native screens do.

## Decision

Release builds embed every page the app renders, with the stylesheets it imports and the files of the `public` folder, so they work without a dev server or a network.

## Consequences

- A released app shows its DOM components at once and offline, with nothing to host or keep available.
- Pages and their assets add to the size of the app.
- A page cannot be updated without a new release of the app.
- The setup is the same for development and release: the app's normal release bundle step produces the pages.
