const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createAppHarness } = require('./helpers/app-harness.cjs')

test('amount accepts US-style grouped decimals', () => {
  const s = createAppHarness()
  assert.equal(s.run("amount('2,340.55')"), 2340.55)
  assert.equal(s.run("amount('1,234,567.89')"), 1234567.89)
  assert.equal(s.run("amount('2340.55')"), 2340.55)
})

test('amount accepts EU-style grouped decimals', () => {
  const s = createAppHarness()
  assert.equal(s.run("amount('2.340,55')"), 2340.55)
  assert.equal(s.run("amount('2.456,66')"), 2456.66)
  assert.equal(s.run("amount('2340,55')"), 2340.55)
  assert.equal(s.run("amount('2.340')"), 2340)
})

test('amount accepts plain and spaced values', () => {
  const s = createAppHarness()
  assert.equal(s.run("amount('2340')"), 2340)
  assert.equal(s.run("amount('2 340,55')"), 2340.55)
  assert.equal(s.run("amount('1,23')"), 1.23)
  assert.equal(s.run("amount('1,234')"), 1234)
})

test('amount still rounds numeric values from calculations', () => {
  const s = createAppHarness()
  assert.equal(s.run('amount(100.567)'), 100.57)
  assert.equal(s.run('amount(2340.55)'), 2340.55)
})

test('amount rejects invalid values', () => {
  const s = createAppHarness()
  assert.ok(Number.isNaN(s.run("amount('')")))
  assert.ok(Number.isNaN(s.run("amount('abc')")))
})

test('decimalValue keeps extra precision for exchange rates', () => {
  const s = createAppHarness()
  assert.equal(s.run("decimalValue('61.234567')"), 61.234567)
  assert.equal(s.run("decimalValue('0,0162')"), 0.0162)
  assert.equal(s.run("decimalValue('2,340.55')"), 2340.55)
  assert.equal(s.run('decimalValue(61.234567)'), 61.234567)
})
