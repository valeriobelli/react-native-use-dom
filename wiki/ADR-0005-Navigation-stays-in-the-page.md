## Status

Accepted (2026-10-03)

## Context

A DOM component is one page of the app, loaded from the app itself. A link that sends the web view to another origin would replace the component with an arbitrary site inside the app, with no way back and no decision by the app. Where a link goes is an app concern, such as opening the system browser or a screen of the app.

## Decision

Navigating the page to another origin is blocked and reported to the app, and the app decides where links go.

## Consequences

- The component cannot be taken over by an external site, and the app stays in control of the user's navigation.
- Apps that want to follow links handle the report, for example by opening them with the system's link handling.
- A DOM component cannot work as a general-purpose browser.
