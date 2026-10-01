import { createContext, useContext } from 'react'

import { DomError, DomErrorCode } from '../runtime/errors'
import type { DomBridge } from './bridge'

const BridgeContext = createContext<DomBridge | null>(null)

export const DomBridgeProvider = BridgeContext.Provider

/**
 * The bridge belonging to the DOM component currently rendering.
 *
 * Throws rather than returning `null`, so a hook used outside a `'use dom'` module fails where the
 * mistake is instead of silently doing nothing.
 */
export function useDomBridge(hookName: string): DomBridge {
	const bridge = useContext(BridgeContext)
	if (!bridge) {
		throw new DomError(DomErrorCode.BridgeClosed, `\`${hookName}\` was called outside a DOM component.`, {
			fix: "Hooks from 'react-native-use-dom/dom' only work inside a module whose first statement is 'use dom', and only while that module is being rendered by the native side.",
		})
	}
	return bridge
}
