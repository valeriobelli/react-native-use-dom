import http from 'node:http'
import type { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'

import { routeUpgrade } from './upgrade-router'

const head = Buffer.alloc(0)

function upgrade(server: http.Server, url: string): { req: IncomingMessage; socket: Duplex } {
	const req = { url } as IncomingMessage
	const socket = new Duplex()
	server.emit('upgrade', req, socket, head)
	return { req, socket }
}

describe('routeUpgrade', () => {
	it('sends upgrades for its path to the handler, and to nothing else', () => {
		const server = http.createServer()
		const existing = jest.fn()
		server.on('upgrade', existing)
		const handle = jest.fn()

		routeUpgrade(server, '/_dom/hot', handle)
		const { req, socket } = upgrade(server, '/_dom/hot?platform=web')

		expect(handle).toHaveBeenCalledWith(req, socket, head)
		expect(existing).not.toHaveBeenCalled()
	})

	it('sends every other upgrade to the listeners the server had, in order, as the server', () => {
		const server = http.createServer()
		const calls: [string, unknown][] = []
		server.on('upgrade', function first(this: unknown) {
			calls.push(['first', this])
		})
		server.on('upgrade', function second(this: unknown) {
			calls.push(['second', this])
		})
		const handle = jest.fn()

		routeUpgrade(server, '/_dom/hot', handle)
		upgrade(server, '/hot')
		upgrade(server, '/_dom/hotter')

		expect(handle).not.toHaveBeenCalled()
		expect(calls).toEqual([
			['first', server],
			['second', server],
			['first', server],
			['second', server],
		])
	})

	it('leaves listeners added afterwards to run as they would', () => {
		const server = http.createServer()
		const handle = jest.fn()
		routeUpgrade(server, '/_dom/hot', handle)
		const later = jest.fn()
		server.on('upgrade', later)

		upgrade(server, '/_dom/hot')

		expect(handle).toHaveBeenCalledTimes(1)
		expect(later).toHaveBeenCalledTimes(1)
	})
})
