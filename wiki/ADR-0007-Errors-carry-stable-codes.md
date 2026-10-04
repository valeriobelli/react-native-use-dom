## Status

Accepted (2026-10-03)

## Context

Problems can show up at build time, in native code or in the page, and the person who sees the message is often not the one who knows the library. A message alone is hard to search for, and its wording may change. Code that handles an error needs something steadier than text to compare.

## Decision

Every error the library throws has a stable code that is documented, with what it means and how to fix it.

## Consequences

- Users can find the cause and the fix of an error by its code in the error reference, and can handle errors in code by comparing the code.
- A code is part of the public contract: renaming or removing one is a breaking change.
- Every new error needs a documented code before it can be thrown.
