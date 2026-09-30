/* eslint-disable no-console, prefer-arrow-callback */

import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { styleText } from 'node:util'
import { globSync } from 'glob'

import { getLocales, localeNameFromLocalePath, omit } from './helpers.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const leadingLocaleName = 'en_US'
// Node strips types when importing `.ts`, so the modes that compare language
// packs, and `unused`, read `src/` and stay independent of `yarn build`.
const localePackGlob = `${root}/packages/@uppy/locales/src/*.ts`
const mode = process.argv[2]
const verbose = process.argv.includes('--verbose')

function unused(locales) {
  const unusedKeys = []
  for (const [name, locale] of Object.entries(locales)) {
    const source = globSync(
      `${root}/packages/@uppy/${name}/src/**/*.{ts,tsx}`,
      {
        ignore: ['**/locale.ts', '**/*.test.{ts,tsx}'],
      },
    )
      .map((filePath) => fs.readFileSync(filePath, 'utf-8'))
      .join('\n')

    for (const key of Object.keys(locale.strings)) {
      // Keys aren't always passed to `i18n()` directly (e.g. `getI18n()(key)`,
      // or lookup tables), so any string literal of the key counts as a use.
      if (!new RegExp(`['\`"]${key}['\`"]`).test(source)) {
        unusedKeys.push(`"${key}" in @uppy/${name}`)
      }
    }
  }

  if (unusedKeys.length > 0) {
    throw new Error(`Unused locale keys:\n  ${unusedKeys.join('\n  ')}`)
  }
}

// Locales are community-contributed and always lag behind `en_US`, so
// discrepancies are expected and this mode is advisory: it reports, it never
// fails the build. Pass `--verbose` for the per-key breakdown; the default is a
// one-line-per-locale summary so it stays readable in CI.
function warnings({ leadingLocale, followerLocales }) {
  const leadingStrings = leadingLocale.strings
  const total = Object.keys(leadingStrings).length
  const entries = Object.entries(followerLocales).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const details = []
  const summary = []
  let missingTotal = 0
  let excessTotal = 0

  for (const [name, locale] of entries) {
    const strings = locale.strings
    const missing = Object.keys(leadingStrings).filter(
      (key) => !(key in strings),
    )
    const excess = Object.keys(strings).filter(
      (key) => !(key in leadingStrings),
    )

    missingTotal += missing.length
    excessTotal += excess.length

    summary.push(
      [
        styleText('cyan', name.padEnd(16)),
        `${String(missing.length).padStart(3)} missing`,
        `${String(excess.length).padStart(3)} excess`,
        `(of ${total} keys in ${leadingLocaleName})`,
      ].join('  '),
    )

    details.push('')
    details.push(`--> Keys from ${leadingLocaleName} missing in ${name}`)
    details.push('')

    for (const key of missing) {
      let value = leadingStrings[key]

      if (typeof value === 'object') {
        // For values with plural forms, just take the first one right now
        value = value[Object.keys(value)[0]]
      }

      details.push(
        [
          `${styleText('cyan', name)} locale has missing string: '${styleText('red', key)}'`,
          `that is present in ${styleText('cyan', leadingLocaleName)}`,
          `with value: ${styleText('yellow', value)}`,
        ].join(' '),
      )
    }

    details.push('')
    details.push(`--> Keys from ${name} missing in ${leadingLocaleName}`)
    details.push('')

    for (const key of excess) {
      details.push(
        [
          `${styleText('cyan', name)} locale has excess string:`,
          `'${styleText('yellow', key)}' that is not present`,
          `in ${styleText('cyan', leadingLocaleName)}.`,
        ].join(' '),
      )
    }
  }

  if (verbose) {
    console.log(details.join('\n'))
    console.log('')
  }

  console.log(`--> Locale coverage relative to ${leadingLocaleName}\n`)
  console.log(summary.join('\n'))
  console.log(
    `\n${styleText('bold', `${entries.length} locales`)}: ${styleText(
      'red',
      `${missingTotal} missing`,
    )}, ${styleText('yellow', `${excessTotal} excess`)} string(s) in total.`,
  )

  if (!verbose && missingTotal + excessTotal > 0) {
    console.log(
      styleText(
        'dim',
        'Re-run with --verbose to list the individual keys. This check is advisory and does not fail the build.',
      ),
    )
  }
}

// @uppy/core's Translator interpolates by building `new RegExp('%\\{' + arg + '\\}')`
// from the option name, so only the exact `%{name}` form is ever substituted.
const placeholderPattern = /%\{(\w+)\}/g

/**
 * Anything that looks like a placeholder but isn't the exact `%{name}` form:
 * `% {name}`, `%{ name }`, `%{name` and `{name}` all render verbatim.
 * Only meaningful for a `name` we already know is not present in its exact form.
 */
function findMalformedPlaceholder(string, name) {
  const [match] = string.match(new RegExp(`%?\\s*\\{\\s*${name}\\s*\\}?`)) ?? []
  return match
}

function getPlaceholders(string) {
  return new Set(
    Array.from(string.matchAll(placeholderPattern), ([, name]) => name),
  )
}

/**
 * A locale value is either a string, or an object of plural forms keyed by the
 * indices the locale's `pluralize` returns. Normalize both into `[form, string]`
 * pairs so every form gets checked.
 */
function getForms(value) {
  if (typeof value === 'string') return [[null, value]]
  return Object.entries(value)
}

// Unlike `warnings`, this mode does fail the build: a placeholder that cannot
// interpolate is never an intentional translation choice, it is a typo that
// renders raw `%{...}` to users. Diverging placeholder *sets* are advisory,
// since a translation may legitimately spell a number out instead.
function placeholders({ leadingLocale, followerLocales }) {
  const errors = []
  const logs = []

  for (const [name, locale] of Object.entries(followerLocales)) {
    for (const [key, value] of Object.entries(locale.strings)) {
      const leadingValue = leadingLocale.strings[key]
      // Excess keys are already reported by the `warnings` mode.
      if (leadingValue == null) continue

      const expected = new Set(
        getForms(leadingValue).flatMap(([, string]) => [
          ...getPlaceholders(string),
        ]),
      )

      for (const [form, string] of getForms(value)) {
        const where = [
          styleText('cyan', name),
          `→ ${styleText('yellow', key)}${form == null ? '' : `['${form}']`}`,
        ].join(' ')
        const found = getPlaceholders(string)

        for (const placeholder of expected) {
          if (found.has(placeholder)) continue

          const malformed = findMalformedPlaceholder(string, placeholder)
          if (malformed) {
            errors.push(
              [
                `${where}: malformed placeholder ${styleText('red', malformed)},`,
                `expected ${styleText('green', `%{${placeholder}}`)}.`,
                `It will not interpolate and is rendered as-is:\n    ${string}`,
              ].join(' '),
            )
          } else {
            logs.push(
              [
                `${where}: missing placeholder ${styleText('red', `%{${placeholder}}`)}`,
                `that ${styleText('cyan', leadingLocaleName)} has:\n    ${string}`,
              ].join(' '),
            )
          }
        }

        for (const placeholder of found) {
          if (expected.has(placeholder)) continue

          logs.push(
            [
              `${where}: unknown placeholder ${styleText('red', `%{${placeholder}}`)}`,
              `that ${styleText('cyan', leadingLocaleName)} does not have,`,
              `so no value is passed for it and it is rendered as-is:\n    ${string}`,
            ].join(' '),
          )
        }
      }
    }
  }

  if (logs.length) {
    console.log(logs.join('\n'))
    console.log(
      `\n${styleText('yellow', `${logs.length} placeholder warning(s).`)}`,
    )
  }

  if (errors.length) {
    return Promise.reject(
      new Error(
        `\n${errors.join('\n')}\n\n${errors.length} malformed placeholder(s).`,
      ),
    )
  }

  return undefined
}

function test() {
  switch (mode) {
    case 'unused':
      return getLocales(`${root}/packages/@uppy/*/src/locale.ts`).then(unused)

    case 'warnings':
      return getLocales(localePackGlob, localeNameFromLocalePath).then(
        (locales) =>
          warnings({
            leadingLocale: locales[leadingLocaleName],
            followerLocales: omit(locales, leadingLocaleName),
          }),
      )

    case 'placeholders':
      return getLocales(localePackGlob, localeNameFromLocalePath).then(
        (locales) =>
          placeholders({
            leadingLocale: locales[leadingLocaleName],
            followerLocales: omit(locales, leadingLocaleName),
          }),
      )

    default:
      return Promise.reject(new Error(`Invalid mode "${mode}"`))
  }
}

await test()
