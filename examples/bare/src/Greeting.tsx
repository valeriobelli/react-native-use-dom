'use dom';

import { useCallback, useState } from 'react';

const buttonStyle = { font: '16px system-ui', padding: 16 };

export default function Greeting({ name }: { name: string }) {
	const [clicks, setClicks] = useState(0);
	const onClick = useCallback(() => setClicks((count) => count + 1), []);

	return (
		<button type="button" style={buttonStyle} onClick={onClick}>
			Hello, {name}, from the DOM. Clicked {clicks} times.
		</button>
	);
}
