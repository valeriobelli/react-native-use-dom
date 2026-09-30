'use dom';

import type { DomProps } from 'react-native-use-dom';

const noteStyle = { margin: 0, padding: 16, font: '14px/1.5 system-ui', color: '#3c3c43' };

/** Laid out by the page: the app sizes it to its text with `matchContents`. */
export default function Note({ text }: { text: string; dom?: DomProps }) {
	return <p style={noteStyle}>{text}</p>;
}
