import { getHostComponent } from 'react-native-nitro-modules';
import type { ViewConfig } from 'react-native-nitro-modules';

import type { RNUseDomWebViewMethods, RNUseDomWebViewProps } from './specs/RNUseDomWebView.nitro';

// Required at runtime rather than imported, so that the generated file stays outside the TypeScript
// source tree: nitrogen owns `nitrogen/generated`, and it is regenerated from the spec on demand.
// eslint-disable-next-line
const viewConfig =
	require('../../nitrogen/generated/shared/json/RNUseDomWebViewConfig.json') as ViewConfig<RNUseDomWebViewProps>;

/** The native view. Internal: everything a developer touches goes through the component proxy. */
export const RNUseDomWebView = getHostComponent<RNUseDomWebViewProps, RNUseDomWebViewMethods>(
	'RNUseDomWebView',
	() => viewConfig,
);

export type { RNUseDomWebViewMethods, RNUseDomWebViewProps };
