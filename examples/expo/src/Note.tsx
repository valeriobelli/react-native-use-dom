'use dom';

import type { DomProps } from 'react-native-use-dom';

import './Note.css';

/**
 * Laid out by the page: the app sizes it to its text with `matchContents`. The link leaves the
 * page, which the DOM component never does itself: the app opens it through `onNavigationBlocked`.
 */
export default function Note({ text }: { text: string; dom?: DomProps }) {
	return (
		<p className="note">
			{text} <a href="https://reactnative.dev">Open reactnative.dev</a>
		</p>
	);
}
