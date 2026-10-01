'use dom';

import type { DomProps } from 'react-native-use-dom';

import './Note.css';

/**
 * Laid out by the page: the app sizes it to its text with `matchContents`. The note is a link that
 * leaves the page, which the DOM component never does itself: the app opens it through
 * `onNavigationBlocked`. The icon is a file of `public`, loaded by a URL relative to the page.
 */
export default function Note({ text }: { text: string; dom?: DomProps }) {
	return (
		<a className="note" href="https://reactnative.dev">
			<img src="atom.svg" alt="" />
			{text} <span className="link">Open reactnative.dev</span>
		</a>
	);
}
