import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'
import { parseDocument, YAMLMap, YAMLSeq } from 'yaml'

/**
 * The sections of a task issue, in the order every task issue must use them.
 */
const SECTIONS = [
	'Goal',
	'Context',
	'Read before starting',
	'Decisions already made (do not change them)',
	'Steps',
	'Out of scope',
	'Acceptance criteria',
	'Verify before opening the PR',
	'Rules',
	'Open questions',
	'Sources',
]

/**
 * The sections a task issue cannot be submitted without.
 */
const REQUIRED_SECTIONS = ['goal', 'steps', 'acceptance-criteria', 'verify-before-opening-the-pr']

/**
 * The checks every task issue asks its reader to run.
 */
const VERIFY_COMMANDS = ['pnpm lint', 'pnpm format:check', 'pnpm typecheck', 'pnpm test', 'zizmor .github']

/**
 * A `textarea` field of the issue form.
 *
 * @typedef {object} FormField
 * @property {string} type
 * @property {string} id
 * @property {{ label?: string, value?: string }} attributes
 * @property {{ required?: boolean }} validations
 */

/**
 * The issue form, whose every field is a textarea.
 *
 * @typedef {object} IssueForm
 * @property {FormField[]} body
 */

const TEMPLATES = path.resolve(__dirname, '..', '.github', 'ISSUE_TEMPLATE')
const markdown = readFileSync(path.join(TEMPLATES, 'task.md'), 'utf8')
const form = readForm(readFileSync(path.join(TEMPLATES, 'task.yml'), 'utf8'))

/**
 * Collapses every run of whitespace, so indentation and line wrapping don't count as differences.
 *
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
	return text.replaceAll(/\s+/gu, ' ').trim()
}

/**
 * Splits the markdown template into its sections, in the order they appear.
 *
 * @param {string} source
 * @returns {Map<string, string>}
 */
function markdownSections(source) {
	/** @type {Map<string, string>} */
	const sections = new Map()

	/** @type {string | null} */
	let current = null

	for (const line of source.split('\n')) {
		if (line.startsWith('## ')) {
			current = line.slice(3).trim()
			sections.set(current, '')
		} else if (current !== null) {
			sections.set(current, `${sections.get(current)}${line}\n`)
		}
	}

	return sections
}

const sections = markdownSections(markdown)

/**
 * The text of a markdown section, which must exist when a rule reads it.
 *
 * @param {string} name
 * @returns {string}
 */
function sectionOf(name) {
	const text = sections.get(name)

	if (text === undefined) {
		throw new TypeError(`task.md has no ${name} section`)
	}

	return text
}

/**
 * Reads the issue form, rejecting anything but its textareas: the template rules compare exactly
 * the textareas, in order, with the markdown template's sections.
 *
 * @param {string} source
 * @returns {IssueForm}
 */
function readForm(source) {
	const body = parseDocument(source).get('body')

	if (!(body instanceof YAMLSeq)) {
		throw new TypeError('task.yml has no body array')
	}

	/** @type {FormField[]} */
	const fields = []

	for (const entry of body.items) {
		if (!(entry instanceof YAMLMap)) {
			throw new TypeError('task.yml holds a field that is not a map')
		}

		const type = entry.getIn(['type'])

		if (type !== 'textarea') {
			throw new TypeError('task.yml holds a field that is not a textarea')
		}

		const id = entry.getIn(['id'])

		if (typeof id !== 'string') {
			throw new TypeError('task.yml holds a textarea without an id')
		}

		const label = entry.getIn(['attributes', 'label'])
		const value = entry.getIn(['attributes', 'value'])
		const required = entry.getIn(['validations', 'required'])

		fields.push({
			attributes: {
				label: typeof label === 'string' ? label : undefined,
				value: typeof value === 'string' ? value : undefined,
			},
			id,
			type,
			validations: { required: required === true },
		})
	}

	return { body: fields }
}

/** The label of every textarea of the form, with a missing label read as an empty string. */
function textareaLabels() {
	return form.body.map((field) => field.attributes.label ?? '')
}

/**
 * The pre-filled value of the form's textarea with the given id, or an empty string.
 *
 * @param {string} id
 * @returns {string}
 */
function textareaValue(id) {
	return form.body.find((field) => field.id === id)?.attributes.value ?? ''
}

/** The ids of the textareas the form requires, in the order `task.yml` lists them. */
function requiredTextareaIds() {
	return form.body.filter((field) => field.validations.required === true).map((field) => field.id)
}

/**
 * The command lines of a verify block, without the fences, hints and trailing comments.
 *
 * @param {string} text
 * @returns {string[]}
 */
function verifyCommands(text) {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '' && !line.startsWith('```') && !line.startsWith('<!--'))
		.map((line) => normalize(line.replace(/\s+#.*$/u, '')))
}

test('the markdown template lists the sections in order', () => {
	expect([...sections.keys()]).toEqual(SECTIONS)
})

test('the issue form has one textarea per section, in the same order', () => {
	expect(textareaLabels()).toEqual(SECTIONS)
})

test('the form marks exactly the sections that must be filled in as required', () => {
	expect(requiredTextareaIds()).toEqual(REQUIRED_SECTIONS)
})

test('both templates ask for the same verify commands, in the same order', () => {
	const fromMarkdown = verifyCommands(sectionOf('Verify before opening the PR'))
	const fromForm = verifyCommands(textareaValue('verify-before-opening-the-pr'))

	expect(fromMarkdown).toEqual(VERIFY_COMMANDS)
	expect(fromForm).toEqual(VERIFY_COMMANDS)
})

test('both templates pre-fill the same rules', () => {
	const fromMarkdown = normalize(sectionOf('Rules'))
	const fromForm = normalize(textareaValue('rules'))

	expect(fromMarkdown).toBe(fromForm)
	expect(fromMarkdown).toContain('Never rely on memory for external tools')
	expect(fromMarkdown).toContain('Needs a booted iOS simulator / Android emulator')
})
