'use dom';

import type { DomProps } from 'react-native-use-dom';

import './Lines.css';

/** Fills the space the app gives it, and scrolls its own content when that is taller. */
export default function Lines({ count }: { count: number; dom?: DomProps }) {
	const lines = Array.from({ length: count }, (_, index) => `Line ${index + 1} of the page.`);
	return (
		<ol className="lines">
			{lines.map((line) => (
				<li key={line}>{line}</li>
			))}
		</ol>
	);
}
