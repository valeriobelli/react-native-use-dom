import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from '@jest/globals'
import { parseDocument } from 'yaml'

const requiredHeadings = ['Status', 'Context', 'Decision', 'Consequences']

/**
 * Reads a page of the wiki.
 *
 * @param {string} wikiFolder
 * @param {string} page
 */
function readPage(wikiFolder, page) {
	return readFileSync(path.join(wikiFolder, page), 'utf8')
}

/**
 * Lists the ADR files of a wiki folder.
 *
 * @param {string} wikiFolder
 */
function listAdrs(wikiFolder) {
	return readdirSync(wikiFolder)
		.filter((file) => /^ADR-.*\.md$/u.test(file))
		.sort()
}

/**
 * Returns the targets of the links in `Home.md`.
 *
 * @param {string} wikiFolder
 */
function readHomeLinks(wikiFolder) {
	const home = readPage(wikiFolder, 'Home.md')

	return [...home.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => match[1] ?? '')
}

/**
 * Returns the ADR files that `Home.md` does not link.
 *
 * @param {string} wikiFolder
 */
function findUnlistedAdrs(wikiFolder) {
	const linked = new Set(readHomeLinks(wikiFolder))

	return listAdrs(wikiFolder).filter((file) => !linked.has(file))
}

/**
 * Returns the local pages `Home.md` links that do not exist.
 *
 * @param {string} wikiFolder
 */
function findBrokenHomeLinks(wikiFolder) {
	const pages = new Set(readdirSync(wikiFolder))

	return readHomeLinks(wikiFolder)
		.filter((target) => !/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(target))
		.filter((target) => !pages.has(target.split('#')[0] ?? ''))
}

/**
 * Returns the `##` headings of a page, in order.
 *
 * @param {string} content
 */
function readHeadings(content) {
	return [...content.matchAll(/^## (.+?)\s*$/gmu)].map((match) => match[1])
}

const wikiFolder = path.resolve(__dirname, '..', 'wiki')

test('every ADR is listed in Home.md', () => {
	expect(findUnlistedAdrs(wikiFolder)).toEqual([])
})

test('Home.md links only files that exist', () => {
	expect(findBrokenHomeLinks(wikiFolder)).toEqual([])
})

test.each(listAdrs(wikiFolder))('%s has the four headings, in order', (file) => {
	expect(readHeadings(readPage(wikiFolder, file))).toEqual(requiredHeadings)
})

const workflow = parseDocument(
	readFileSync(path.resolve(__dirname, '..', '.github', 'workflows', 'publish-wiki.yml'), 'utf8'),
)
const steps = workflow.getIn(['jobs', 'publish-wiki', 'steps']).toJSON()
const wikiCheck = steps.find((step) => step.id === 'wiki')
const publish = steps.find((step) => step.uses?.startsWith('Andrew-Chen-Wang/github-wiki-action@'))

test('publishing requires available wiki storage checked with the workflow token', () => {
	expect(wikiCheck.env).toEqual({
		GH_TOKEN: '${{ github.token }}',
		GIT_TERMINAL_PROMPT: '0',
	})
	expect(publish.if).toBe("steps.wiki.outputs.available == 'true'")
})

test.each([
	{
		name: 'an initialized wiki',
		output: 'available=true\n',
		remoteOutput: 'abc123\trefs/heads/master',
		remoteStatus: '0',
		status: 0,
		stderr: '',
		warning: false,
	},
	{
		name: 'missing wiki storage',
		output: 'available=false\n',
		remoteOutput: 'remote: Repository not found.\nfatal: repository not found',
		remoteStatus: '128',
		status: 0,
		stderr: '',
		warning: true,
	},
	{
		name: 'an unexpected remote failure',
		output: '',
		remoteOutput: 'fatal: unable to access wiki: Could not resolve host: github.com',
		remoteStatus: '128',
		status: 1,
		stderr: 'fatal: unable to access wiki: Could not resolve host: github.com\n',
		warning: false,
	},
])('wiki preflight handles $name', ({ remoteStatus, remoteOutput, status, output, warning, stderr }) => {
	const folder = mkdtempSync(path.join(tmpdir(), 'wiki-check-'))
	const outputFile = path.join(folder, 'output')

	try {
		const result = spawnSync(
			'bash',
			[
				'-e',
				'-o',
				'pipefail',
				'-c',
				`
				: > "$GITHUB_OUTPUT"
				gh() { test "$*" = "auth setup-git"; }
				git() {
					test "$*" = "ls-remote https://github.com/owner/repo.wiki.git" || return 2
					printf '%s\\n' "$WIKI_REMOTE_OUTPUT"
					return "$WIKI_REMOTE_STATUS"
				}
				${wikiCheck.run}`,
			],
			{
				encoding: 'utf8',
				env: {
					...process.env,
					GITHUB_OUTPUT: outputFile,
					GITHUB_REPOSITORY: 'owner/repo',
					GITHUB_SERVER_URL: 'https://github.com',
					WIKI_REMOTE_OUTPUT: remoteOutput,
					WIKI_REMOTE_STATUS: remoteStatus,
				},
			},
		)

		expect(result.status).toBe(status)
		expect(result.stdout.includes('::warning::')).toBe(warning)
		expect(result.stderr).toBe(stderr)
		expect(readFileSync(outputFile, 'utf8')).toBe(output)
	} finally {
		rmSync(folder, { force: true, recursive: true })
	}
})
