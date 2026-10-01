# Actions out

A top-level function prop is a native action: the DOM component calls it, the function runs in the native
runtime, and the call resolves with what it returned.

```tsx
'use dom'

import type { DomProps } from 'react-native-use-dom'

interface ShareButtonProps {
	title: string
	onShare(title: string): Promise<boolean>
	dom?: DomProps
}

export default function ShareButton({ title, onShare }: ShareButtonProps) {
	const share = async () => {
		const shared = await onShare(title)
		console.log(shared ? 'Shared.' : 'Cancelled.')
	}
	return <button onClick={share}>Share</button>
}
```

```tsx
import { Share } from 'react-native'

;<ShareButton
	title="Hello"
	onShare={async (title) => {
		const result = await Share.share({ message: title })
		return result.action === Share.sharedAction
	}}
/>
```

## The contract

- Every call is asynchronous on the DOM side: it returns a Promise, even when the native function returns a
  plain value. Declare action props as returning a `Promise`.
- Arguments and the result must be [serializable](./data-in.md#what-a-prop-may-contain). A bad argument rejects
  the call with `ERR_USE_DOM_NON_SERIALIZABLE_ARGUMENT` before it is sent; a bad result rejects it with
  `ERR_USE_DOM_NON_SERIALIZABLE_RESULT`.
- A native function that returns nothing resolves with `null`.
- When the native function throws or rejects, the call rejects with an `Error` that has the same `message` and
  `name`, and the thrown error's own serializable properties, such as a `code`.
- Calls run concurrently, and each resolves on its own.
- The call reaches the function from the latest render. Passing a new function on every render is fine.
- Calling an action the component is no longer rendered with rejects with `ERR_USE_DOM_UNKNOWN_ACTION`.
- When the component unmounts, calls still pending reject with `ERR_USE_DOM_BRIDGE_CLOSED`.

## Using native capabilities

A DOM component can't import React Native or native modules. To reach a native capability, such as the camera,
haptics or navigation, wrap it in a function prop on the native side and call that from the DOM component.
