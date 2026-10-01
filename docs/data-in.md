# Data in

Every prop native code passes, except functions and `dom`, is sent to the DOM component. When the props change,
the component re-renders with the new values, keeping its state, as any React component does.

## What a prop may contain

Props are sent as JSON, so they must be:

- strings, booleans, `null`, and finite numbers;
- arrays and plain objects of those values, nested to any reasonable depth.

`undefined` is allowed. As in JSON, an object member whose value is `undefined` is left out.

Anything that JSON would lose or change is refused. Rendering throws a `DomError` with the code
`ERR_USE_DOM_NON_SERIALIZABLE_PROP`, naming the prop and the path to the value, such as `user.tags[2]`. That includes:

- `Date`, `Map`, `Set`, `RegExp` and class instances: convert them first, for example a `Date` to
  `date.toISOString()`;
- `NaN`, `Infinity`, bigints and symbols;
- objects that refer to themselves.

A function is allowed only as a top-level prop, where it becomes a [native action](./actions-out.md). A function
nested inside an object or array throws `ERR_USE_DOM_NESTED_FUNCTION_PROP`.

`children` is not supported, and throws `ERR_USE_DOM_CHILDREN_UNSUPPORTED`: pass the content as data, and build the markup
inside the DOM component.

## Types

`Serializable`, from `react-native-use-dom`, is the type of a value that crosses unchanged:

```ts
import type { Serializable } from 'react-native-use-dom';
```

## Cost

The props are sent again whenever they change. Large values, such as long lists, cost time to send on every
change. Keep stable values stable with `useMemo`, and send what changed rather than rebuilding everything.
