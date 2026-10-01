'use dom';

import { useCallback, useState } from 'react';
import type { DomProps, DomRef } from 'react-native-use-dom';
import { useDOMImperativeHandle } from 'react-native-use-dom/dom';

const buttonStyle = { font: '16px system-ui', padding: 16 };

/** What the app can do to the greeting through its ref. */
export interface GreetingHandle {
	reset(): void;
	getClicks(): number;
}

interface GreetingProps {
	name: string;
	/** A native action: the DOM side awaits what the app answers. */
	onClick(clicks: number): Promise<string>;
	ref?: DomRef<GreetingHandle>;
	dom?: DomProps;
}

export default function Greeting({ name, onClick }: GreetingProps) {
	const [clicks, setClicks] = useState(0);
	const [reply, setReply] = useState('');

	useDOMImperativeHandle<GreetingHandle>(
		() => ({
			reset: () => {
				setClicks(0);
				setReply('');
			},
			getClicks: () => clicks,
		}),
		[clicks],
	);

	const click = useCallback(async () => {
		const next = clicks + 1;
		setClicks(next);
		setReply(await onClick(next));
	}, [clicks, onClick]);

	return (
		<button type="button" style={buttonStyle} onClick={click}>
			Hello, {name}, from the DOM. Clicked {clicks} times. {reply}
		</button>
	);
}
