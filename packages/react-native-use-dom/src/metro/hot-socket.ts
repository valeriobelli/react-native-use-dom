import type { IncomingMessage } from 'node:http';

import type { ConfigT } from 'metro-config';
import HmrServer from 'metro/private/HmrServer';
import createWebsocketServer from 'metro/private/lib/createWebsocketServer';
import formatBundlingError from 'metro/private/lib/formatBundlingError';
import type Server from 'metro/private/Server';

import { DEV_ENTRY_PATH } from '../runtime/paths';
import type { UpgradeListener } from './upgrade-router';

type HmrMessage = string | Buffer | ArrayBuffer | Buffer[];

/** The part of the `ws` server Metro creates that is used here. */
export interface HotSocketServer {
	handleUpgrade(...args: [...Parameters<UpgradeListener>, (socket: unknown) => void]): void;
	emit(event: 'connection', socket: unknown, req: IncomingMessage): boolean;
	close(): void;
}

/**
 * Metro's HMR protocol for the bundles `server` builds, on a websocket server that takes upgrades
 * handed to it. `toBundleUrl` turns the path and query of a bundle request, as a page makes it,
 * into the ones the bundle was built from.
 */
export function createHotSocketServer(
	server: Server,
	webConfig: ConfigT,
	toBundleUrl: (url: URL) => string,
): HotSocketServer {
	const hmr = new HmrServer(server.getBundler(), server.getCreateModuleId(), webConfig);
	return createWebsocketServer({
		websocketServer: {
			onClientConnect: hmr.onClientConnect,
			onClientDisconnect: hmr.onClientDisconnect,
			onClientError: hmr.onClientError,
			onClientMessage: async (client, message, sendFn) => {
				try {
					await hmr.onClientMessage(client, toWebHmrMessage(message, toBundleUrl), sendFn);
				} catch (error) {
					// Metro reports a failed registration nowhere, which leaves the page waiting for an answer.
					sendFn(JSON.stringify({ type: 'error', body: formatBundlingError(error as Error) }));
				}
			},
		},
	});
}

/**
 * A page registers the bundle URL it loaded, which names the generated entry by route rather than by
 * file: it is registered as the URL the bundle was built from, which is what Metro keys its builds on.
 */
function toWebHmrMessage(message: HmrMessage, toBundleUrl: (url: URL) => string): string {
	const text = messageText(message);
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		// Metro answers malformed messages itself.
		return text;
	}
	if (!isRegisterEntryPoints(data)) return text;
	return JSON.stringify({
		...data,
		entryPoints: data.entryPoints.map((entryPoint) => {
			const url = new URL(entryPoint, 'http://localhost');
			return url.pathname === DEV_ENTRY_PATH ? `${url.origin}${toBundleUrl(url)}` : entryPoint;
		}),
	});
}

function messageText(message: HmrMessage): string {
	if (typeof message === 'string') return message;
	if (Array.isArray(message)) return Buffer.concat(message).toString();
	return Buffer.from(message instanceof ArrayBuffer ? new Uint8Array(message) : message).toString();
}

function isRegisterEntryPoints(data: unknown): data is { type: 'register-entrypoints'; entryPoints: string[] } {
	if (typeof data !== 'object' || data === null) return false;
	const { type, entryPoints } = data as { type?: unknown; entryPoints?: unknown };
	return (
		type === 'register-entrypoints' &&
		Array.isArray(entryPoints) &&
		entryPoints.every((entryPoint) => typeof entryPoint === 'string')
	);
}
