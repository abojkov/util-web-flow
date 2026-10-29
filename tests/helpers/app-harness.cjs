const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const payload = require('../fixtures/currency-rates.cjs')
const source = name =>
  fs.readFileSync(path.join(__dirname, '../../assets/js', name + '.js'), 'utf8')
const localeSource = name =>
  fs.readFileSync(path.join(__dirname, '../../assets/locales', name + '.js'), 'utf8')
const i18nBundle = () =>
  source('state') +
  '\n' +
  localeSource('en') +
  '\n' +
  localeSource('mk') +
  '\n' +
  source('i18n')

function createAppHarness() {
  const elements = new Map()
  let request,
    timer,
    renders = 0,
    writes = 0
  const context = vm.createContext({
    Date,
    Intl,
    AbortController,
    console: { error() {} },
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {})
        return elements.get(selector)
      },
      querySelectorAll: () => [],
    },
    setTimeout: callback => {
      timer = callback
      return 1
    },
    clearTimeout() {},
    fetch: async (url, options) => {
      request = { url, options }
      return { ok: true, json: async () => payload }
    },
    putSettings: async () => {
      writes++
    },
    render: () => {
      renders++
    },
  })
  vm.runInContext(i18nBundle() + '\n' + source('currency-sync'), context)
  return {
    context,
    elements,
    run: code => vm.runInContext(code, context),
    request: () => request,
    timeout: () => timer(),
    writes: () => writes,
    renders: () => renders,
  }
}

function createModalHarness() {
  const s = createAppHarness()
  const frames = []
  let body = null,
    html = '',
    controls = new Map(),
    focusCalls = []
  const root = {
    get innerHTML() {
      return html
    },
    set innerHTML(value) {
      html = value
      controls = new Map(
        [...value.matchAll(/<([a-z-]+)[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [
          id,
          {
            id,
            tag,
            disabled: false,
            focus(options) {
              focusCalls.push({ id, options })
              s.context.document.activeElement = this
            },
          },
        ])
      )
      body = value
        ? {
            scrollTop: 0,
            contains: node => controls.get(node.id) === node && node.id !== 'close-modal',
            querySelector: selector =>
              selector === '.settings-content'
                ? html.includes('class="settings-content"')
                  ? {}
                  : null
                : [...controls.values()].find(node => ['input', 'select'].includes(node.tag)),
          }
        : null
    },
  }
  Object.assign(s.context.document, {
    querySelector: selector =>
      selector === '#modal-root'
        ? root
        : selector === '.modal-body'
          ? body
          : controls.get(selector.slice(1)) || null,
    getElementById: id => controls.get(id) || null,
  })
  Object.assign(s.context, {
    requestAnimationFrame: callback => frames.push(callback),
    window: { matchMedia: () => ({ matches: false }) },
    reload: async () => {},
    toast() {},
    put: async (store, item) => {
      s.context.item = item
      s.run('state.settings=state.settings.filter(s=>s.id!==item.id).concat([item])')
    },
  })
  vm.runInContext(source('modals'), s.context)
  s.context.toast = () => {}
  return {
    ...s,
    body: () => body,
    root,
    control: id => controls.get(id),
    focusCalls: () => focusCalls,
    flush: () => {
      while (frames.length) frames.shift()()
    },
  }
}

module.exports = { source, createAppHarness, createModalHarness }
