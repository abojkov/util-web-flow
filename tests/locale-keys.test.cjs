const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const LOCALES_DIR = path.join(__dirname, '..', 'assets', 'locales')
const SOURCE_LOCALE = 'en.js'

function localeKeys(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const keys = [...source.matchAll(/^\s*'([^']+)':/gm)].map(match => match[1])
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
  assert.equal(
    duplicates.length,
    0,
    `${path.basename(filePath)} has duplicate keys: ${[...new Set(duplicates)].join(', ')}`
  )
  return new Set(keys)
}

function diff(from, to) {
  return [...from].filter(key => !to.has(key)).sort()
}

test('locale files define matching translation keys', () => {
  const files = fs
    .readdirSync(LOCALES_DIR)
    .filter(name => name.endsWith('.js'))
    .sort()
  assert.ok(files.includes(SOURCE_LOCALE), `missing source locale ${SOURCE_LOCALE}`)

  const sourcePath = path.join(LOCALES_DIR, SOURCE_LOCALE)
  const sourceKeys = localeKeys(sourcePath)
  assert.ok(sourceKeys.size > 0, `${SOURCE_LOCALE} defines no translation keys`)
  for (let month = 1; month <= 12; month++)
    assert.ok(sourceKeys.has(`months.${month}`), `${SOURCE_LOCALE} missing months.${month}`)
  assert.ok(sourceKeys.has('months.yearLabel'), `${SOURCE_LOCALE} missing months.yearLabel`)

  for (const file of files) {
    if (file === SOURCE_LOCALE) continue
    const keys = localeKeys(path.join(LOCALES_DIR, file))
    const missing = diff(sourceKeys, keys)
    const extra = diff(keys, sourceKeys)
    assert.deepEqual(
      missing,
      [],
      `${file} is missing ${missing.length} key(s) from ${SOURCE_LOCALE}: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`
    )
    assert.deepEqual(
      extra,
      [],
      `${file} has ${extra.length} unknown key(s) not in ${SOURCE_LOCALE}: ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? '…' : ''}`
    )
  }
})

test('index.html loads every locale file', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  const localeFiles = fs.readdirSync(LOCALES_DIR).filter(name => name.endsWith('.js'))
  for (const file of localeFiles) {
    assert.match(
      index,
      new RegExp(`assets/locales/${file.replace('.', '\\.')}`),
      `index.html must load assets/locales/${file}`
    )
  }
})
