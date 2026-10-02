import { StrictMode, useMemo, useSyncExternalStore } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'

import { DomError, DomErrorCode } from '../runtime/errors'
import type { Serializable } from '../runtime/serializable'
import type { DomBridge } from './bridge'
import { createDomBridge, readInjectedPayload } from './bridge'
import { DomBridgeProvider } from './context'
import { forwardConsole, reportContentSize, reportUncaughtErrors } from './instrument'

/** The element the DOM component renders into. Created if the HTML shell did not provide one. */
const ROOT_ELEMENT_ID = 'root'

/**
 * A `'use dom'` module's default export, seen from the runtime's side. Its real props are checked
 * where the component is used from native code; here they are only forwarded.
 */
export type DomComponent = ComponentType<Record<string, unknown>>

/** How {@link mountDomComponent} renders a DOM component. */
export interface MountOptions {
	/** Overrides the element to render into. Defaults to `#root`. */
	container?: HTMLElement
	/** Whether to render inside `StrictMode`. Defaults to `true` in development. */
	strict?: boolean
}

/**
 * Renders a DOM component into the page and connects it to the native side.
 *
 * This is called by the entry module the bundler generates for each `'use dom'` file. Application
 * code never calls it: adding `'use dom'` to a file is what arranges for it to happen.
 */
export function mountDomComponent(Component: DomComponent, options: MountOptions = {}): void {
	const bridge = createDomBridge(readInjectedPayload())
	const container = options.container ?? resolveContainer()

	forwardConsole(bridge)
	reportUncaughtErrors(bridge)
	reportContentSize(bridge, container)

	const tree = (
		<DomBridgeProvider value={bridge}>
			<DomRoot bridge={bridge} component={Component} />
		</DomBridgeProvider>
	)

	// `StrictMode`'s double render is how a DOM component's effects get the same scrutiny native
	// components already get in development.
	const strict = options.strict ?? process.env['NODE_ENV'] !== 'production'

	createRoot(container).render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

interface DomRootProps {
	bridge: DomBridge
	component: DomComponent
}

/**
 * Re-renders the component whenever the native side sends new props, without ever remounting it —
 * which is what keeps DOM state alive across a prop change (E3-AC2).
 */
function DomRoot({ bridge, component: Component }: DomRootProps): React.ReactElement {
	// Wrapped in arrows rather than passed as method references, so the binding does not depend on
	// how the bridge implements them.
	const props = useSyncExternalStore(
		(onChange) => bridge.subscribe(onChange),
		() => bridge.getProps(),
	)
	const actionNames = useSyncExternalStore(
		(onChange) => bridge.subscribe(onChange),
		() => bridge.getActionNames(),
	)
	const actions = useMemo(() => createActionStubs(bridge, actionNames), [bridge, actionNames])
	const merged = useMemo(() => ({ ...props, ...actions }), [props, actions])

	return <Component {...merged} />
}

type ActionStub = (...args: readonly unknown[]) => Promise<Serializable>

/**
 * Turns the names of the function props into callable stubs. Each stub posts to the native side and
 * resolves with what the native function returned (E4-AC1, E4-AC2).
 */
function createActionStubs(bridge: DomBridge, names: readonly string[]) {
	return names.reduce(
		(acc, name) => {
			return { ...acc, [name]: (...args) => bridge.callAction(name, args) }
		},
		{} as Record<string, ActionStub>,
	)
}

function resolveContainer(): HTMLElement {
	const existing = document.querySelector<HTMLElement>(`#${ROOT_ELEMENT_ID}`)

	if (existing) {
		return existing
	}

	if (document.body === null) {
		throw new DomError(DomErrorCode.MalformedMessage, 'The DOM component was mounted before the page had a body.', {
			fix: 'This is an internal inconsistency; please report it with the app and library versions.',
		})
	}

	const created = document.createElement('div')

	created.id = ROOT_ELEMENT_ID
	document.body.append(created)

	return created
}
