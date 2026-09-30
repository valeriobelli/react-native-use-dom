import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:net';
import type { Duplex } from 'node:stream';

/** A listener for the `upgrade` event of an HTTP server. */
export type UpgradeListener = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

/**
 * Sends the websocket upgrades for `pathname` to `handle`, and every other upgrade to the listeners
 * the server already had, in their order.
 *
 * Metro answers upgrades with a single listener that destroys the socket of any path it does not
 * know, and neither Metro nor the React Native CLI takes more endpoints once the server is running,
 * so the listeners are wrapped rather than added to. Listeners added afterwards are left as they are.
 */
export function routeUpgrade(server: Server, pathname: string, handle: UpgradeListener): void {
	const original = server.listeners('upgrade') as UpgradeListener[];
	server.removeAllListeners('upgrade');
	server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
		if (new URL(req.url ?? '/', 'http://localhost').pathname === pathname) {
			handle(req, socket, head);
			return;
		}
		for (const listener of original) listener.call(server, req, socket, head);
	});
}
