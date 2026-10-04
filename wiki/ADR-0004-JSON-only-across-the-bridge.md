## Status

Accepted (2026-10-03)

## Context

Props, action calls and ref calls cross between two separate JavaScript runtimes, so every value has to be sent as text. Silently converting values that do not survive, such as dates, maps, class instances or non-finite numbers, would give the two sides different data without any sign of it. Functions cannot be sent, but a function prop can stand for a call back to native code.

## Decision

Props, action arguments and results are JSON. A value that JSON would change is refused with an error that names where it is. A function is allowed only as a top-level prop, where it becomes a native action.

## Consequences

- Both sides always see the same data, and a bad value fails at the call site with a precise message.
- Users convert dates, maps and class instances themselves before sending them.
- Functions nested in objects or arrays are not supported, and neither is `children`.
- Every call across the boundary is asynchronous.
