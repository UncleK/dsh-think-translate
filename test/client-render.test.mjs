// Mounts the real settings panel in Node with a very small React runtime.
//
// Text contracts cannot catch a render-time TypeError: the DSH-inherit block was
// first inserted above `var provs = cfg.providers || {}` in the same function, so
// it read a variable that is only assigned further down and the panel would have
// crashed on the first paint that has a config. This test renders the tree, clicks
// the buttons and asserts on the requests they send.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { translateProtectedText } from '../lib/text.js'
import { BUILTIN_GLOSSARY } from '../lib/glossary-presets.js'

const SRC = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')
const FRAGMENT = Symbol('fragment')

// ---------------------------------------------------------------------------
// minimal React: function + class components, the hooks this bundle uses
// ---------------------------------------------------------------------------
function createRuntime() {
  const instances = []
  let current = null
  let order = 0
  let dirty = false

  class Component {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(patch) {
      this.state = Object.assign({}, this.state, typeof patch === 'function' ? patch(this.state) : patch)
      dirty = true
    }
    render() { return null }
  }

  const React = {
    Fragment: FRAGMENT,
    Component,
    createElement: function (type, props) {
      const children = []
      for (let i = 2; i < arguments.length; i++) children.push(arguments[i])
      return { type, props: props || {}, children: children.length === 1 ? children[0] : children }
    },
    useState: function (init) {
      const inst = current
      const i = inst.cursor++
      if (!(i in inst.hooks)) inst.hooks[i] = typeof init === 'function' ? init() : init
      return [inst.hooks[i], function (v) {
        const next = typeof v === 'function' ? v(inst.hooks[i]) : v
        if (!Object.is(next, inst.hooks[i])) { inst.hooks[i] = next; dirty = true }
      }]
    },
    useEffect: function (fn, deps) {
      const inst = current
      const i = inst.cursor++
      const prev = inst.ran[i]
      const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length ||
        deps.some(function (d, k) { return !Object.is(d, prev.deps[k]) })
      if (changed) inst.pending.push({ i, fn, deps: deps || null })
    },
    useId: function () {
      const inst = current
      const i = inst.cursor++
      if (!inst.hooks[i]) inst.hooks[i] = 'xl-id-' + (i + 1)
      return inst.hooks[i]
    },
  }

  function renderNode(node) {
    if (node === null || node === undefined || node === false || node === true) return null
    if (typeof node === 'string' || typeof node === 'number') {
      return { host: true, type: '#text', props: {}, children: [String(node)] }
    }
    if (Array.isArray(node)) return node.map(renderNode).filter(Boolean)
    if (typeof node !== 'object') return null
    if (typeof node.type === 'string') {
      return { host: true, type: node.type, props: node.props, children: renderNode(node.children) }
    }
    if (node.type === FRAGMENT) return renderNode(node.children)
    if (typeof node.type === 'function') return renderComponent(node.type, node.props, node.children)
    return null
  }

  function renderComponent(type, props, children) {
    const idx = order++
    if (!instances[idx]) instances[idx] = { hooks: [], ran: {}, cursor: 0, pending: [] }
    const inst = instances[idx]
    const outer = current
    current = inst
    inst.cursor = 0
    inst.pending = []
    let out
    const componentProps = Object.assign({}, props, { children })
    try {
      if (type.prototype && type.prototype.render) {
        if (!inst.self) inst.self = new type(componentProps)
        inst.self.props = componentProps
        out = inst.self.render()
      } else {
        out = type(componentProps)
      }
    } finally {
      current = outer
    }
    for (const eff of inst.pending) {
      const prev = inst.ran[eff.i]
      if (prev && typeof prev.cleanup === 'function') prev.cleanup()
      const cleanup = eff.fn()
      inst.ran[eff.i] = { deps: eff.deps, cleanup: typeof cleanup === 'function' ? cleanup : null }
    }
    inst.pending = []
    return renderNode(out)
  }

  // Re-render until nothing is dirty any more (state set from a fetch resolves
  // between passes), so the assertions see the settled tree.
  async function mount(ComponentType, props = {}) {
    let tree = null
    for (let pass = 0; pass < 40; pass++) {
      dirty = false
      order = 0
      tree = renderComponent(ComponentType, props, undefined)
      await new Promise(function (r) { setTimeout(r, 0) })
      if (!dirty) return tree
    }
    throw new Error('the panel never settled: a state update kept re-rendering it')
  }

  return {
    React,
    mount,
    // Drop every component instance, the way React does when a list-slot row gets a
    // new key. The shell keys settings rows by registration identity, and this plugin
    // re-registers its section on a language change, so a remount is a real event.
    reset: function () { instances.length = 0; order = 0 },
  }
}

function flatten(node, out) {
  out = out || []
  if (!node) return out
  if (Array.isArray(node)) { node.forEach(function (n) { flatten(n, out) }); return out }
  out.push(node)
  if (node.children) flatten(node.children, out)
  return out
}

function textOf(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node.type === '#text') return node.children.join('')
  return textOf(node.children)
}

// class name of a rendered host node ('' for text nodes)
function cls(node) {
  return String((node.props && node.props.className) || '')
}

function button(tree, text) {  return flatten(tree).find(function (n) {
    return n.host && n.type === 'button' && textOf(n).indexOf(text) >= 0
  })
}

function click(node) {
  assert.ok(node, 'the button must be rendered')
  node.props.onClick({ target: {}, preventDefault: function () {} })
}

// ---------------------------------------------------------------------------
// the panel, loaded from the real bundle
// ---------------------------------------------------------------------------
const DSH_PROVIDER = {
  type: 'openai', source: 'dsh', baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-flash', apiKeyEnv: 'DEEPSEEK_API_KEY', enabled: false,
}

function configWith(providers, chain) {
  // dshScan rides on the config the scan route answers with (host-side diagnostic):
  // the panel uses it to name the file it read when a scan finds nothing.
  return {
    ok: true, chain: chain, providers: providers, targetLang: 'zh-CN', think: true, todo: true, ans: false, mode: 'lazy',
    dshScan: { home: 'C:/Users/test/.dsh', settingsFound: true, credsFound: true, providers: [] },
  }
}

async function mountPanel(config, scanConfig, officialTodoFirst = null, preferences = {}, localResponse = null, testResponse = null, primitives = null, memoryResponse = null) {
  // The host already merges the harness's providers into GET /_xlate/config, so the
  // panel paints them without being asked; the scan route answers with the same shape
  // (a second argument models "the harness config changed since we loaded").
  const served = config
  const scanned = scanConfig || config
  const calls = []
  const savedPreferences = { ...preferences }
  const disposers = []
  const runtime = createRuntime()
  const captured = {}
  const windowListeners = new Map()
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval: function (fn, ms) { const timer = setInterval(fn, ms); timer.unref(); return timer }, clearInterval, URL,
    localStorage: { getItem: function (key) {
      const pref = key.replace('dsh-think-translate:', '')
      return Object.hasOwn(savedPreferences, pref) ? String(savedPreferences[pref]) : null
    }, setItem: function (key, value) {
      savedPreferences[key.replace('dsh-think-translate:', '')] = String(value)
    }, removeItem: function () {} },
    fetch: function (url, init) {
      calls.push({ url: url, init: init || null })
      let body = {}
      if (url === '/_xlate/context') {
        body = { ok: true, officialEnabled: served.officialEnabled === true }
      } else if (url === '/_xlate/config' && init && init.method === 'POST') {
        body = JSON.parse(init.body)
        const update = body
        if (update.glossary) served.glossary = { ...(served.glossary || { enabled: true, entries: {} }), ...update.glossary,
          entries: { ...(served.glossary?.entries || {}), ...(update.glossary.entries || {}) } }
        body = { ...configWith(body.providers || served.providers || {}, body.chain || served.chain || []), glossary: served.glossary, glossaryPreset: served.glossaryPreset }
      } else if (url === '/_xlate/config') {
        body = served
      } else if (url === '/_xlate/dsh-scan') {
        body = scanned
      } else if (url === '/_xlate/models') {
        body = { models: [] }
      } else if (url === '/_xlate/version') {
        body = { ok: true, name: 'dsh-think-translate', version: '1.2.0', repo: 'https://github.com/UncleK/dsh-think-translate' }
      } else if (url === '/_xlate/translate') {
        body = testResponse ? testResponse(JSON.parse(init.body)) : { ok: true, text: '已翻译的任务', provider: 'test' }
      } else if (url === '/_xlate/local/release') {
        body = { ok: true, job: { id: 'release-1', model: served.providers.openai.model, origin: 'http://localhost:11434', phase: 'unloaded', running: false } }
      } else if (url === '/_xlate/local/prepare' || url.startsWith('/_xlate/local/status')) {
        body = { ok: true, memory: memoryResponse, job: localResponse || { id: '1', origin: 'http://localhost:11434', model: 'test-model', phase: 'ready', running: false, percent: 100, completed: 0, total: 0, platform: 'win32', canInstall: true } }
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body).then(value => ({ ...value, cacheNamespace: served.cacheNamespace || 'test-context', officialEnabled: served.officialEnabled === true })) } })
    },
    window: { addEventListener: (type, listener) => windowListeners.set(type, listener),
      removeEventListener: (type, listener) => { if (windowListeners.get(type) === listener) windowListeners.delete(type) } },
  }
  sandbox.window.__ModuleLoader__ = { load: function (spec) { captured.spec = spec } }
  vm.createContext(sandbox)
  vm.runInContext(SRC.replace('exports.inject = inject;', 'globalThis.__contextTest = { refresh: refreshTranslationContext, store: store }; exports.inject = inject;'), sandbox, { filename: 'lib/client.js' })

  const plugin = captured.spec.factory(function (name) {
    if (name === 'react') return { default: runtime.React }
    if (name === '@deepseek-ai/dsh-client-ui-primitives' && primitives) return primitives
    throw new Error('the test only provides react, not ' + name)
  })

  const registered = {}
  const views = new Map()
  const specs = []
  const entries = []
  const ctx = {
    effect: function (factory) {
      const dispose = factory()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    slots: {
      inject: function (name, cb) { return cb() },
      register: function (spec, component) {
        // DSH keyed slots reject duplicate key + priority cells (default 0).
        // Different priorities coexist; the lowest one supplies the toolview.
        if (spec.key !== undefined && entries.some(function (entry) {
          return entry.spec.name === spec.name && entry.spec.key === spec.key &&
            (entry.spec.priority ?? 0) === (spec.priority ?? 0)
        })) {
          throw new Error('keyed slot "' + spec.name + '" already has an entry for key "' + spec.key + '" at priority ' + (spec.priority ?? 0))
        }
        const entry = { spec, component }
        entries.push(entry)
        views.set(spec.name + ':' + (spec.key ?? spec.id), component)
        specs.push(spec)
        if (spec.name === 'settings.section') registered.section = component
        return function () {
          const index = entries.indexOf(entry)
          if (index >= 0) entries.splice(index, 1)
        }
      },
    },
  }
  const officialTodo = function OfficialTodo() { return null }
  const registerOfficialTodo = function () {
    ctx.slots.register({ name: 'tool.call.toolview', key: 'todo_write', locale: 'conversation' }, officialTodo)
  }
  if (officialTodoFirst === true) registerOfficialTodo()
  plugin.apply(ctx)
  if (officialTodoFirst === false) registerOfficialTodo()
  assert.equal(typeof registered.section, 'function', 'the panel must register itself into settings.section')

  const tree = await runtime.mount(registered.section)
  return {
    tree, calls, runtime, specs, entries, officialTodo, preferences: savedPreferences, windowListeners,
    refreshContext: () => sandbox.__contextTest.refresh(),
    dispose: function () { disposers.splice(0).reverse().forEach(function (dispose) { dispose() }) },
    renderView: function (name, key, props) {
      runtime.reset()
      return runtime.mount(views.get(name + ':' + key), props)
    },
    registered: registered.section,
    // mount again with every component instance dropped (a real remount)
    remount: function () { runtime.reset(); return runtime.mount(registered.section) },
  }
}

describe('exclusive translation and masked credential controls', function () {
  it('shows the conflict, yields all translation seats, and resumes without duplicate entries', async () => {
    const cfg = { ...configWith({}, []), officialEnabled: true }
    const panel = await mountPanel(cfg)
    assert.match(textOf(panel.tree), /本插件已暂停翻译/)
    assert.equal(panel.entries.some(entry => entry.spec.key === 'assistant-step' || entry.spec.key === 'todo_write' || entry.spec.id === 'todo'), false)
    assert.equal(panel.calls.filter(call => call.url === '/_xlate/translate').length, 0)
    cfg.officialEnabled = false
    await panel.refreshContext()
    assert.equal(panel.entries.filter(entry => entry.spec.key === 'assistant-step').length, 1)
    await panel.refreshContext()
    assert.equal(panel.entries.filter(entry => entry.spec.key === 'assistant-step').length, 1)
    cfg.officialEnabled = true
    await panel.refreshContext()
    assert.equal(panel.entries.some(entry => entry.spec.key === 'assistant-step'), false)
    panel.dispose()
    cfg.officialEnabled = false
    await panel.refreshContext()
    assert.equal(panel.entries.some(entry => entry.spec.key === 'assistant-step'), false, 'disposed plugin cannot remount its renderers')
  })

  it('keeps a saved key when the masked form is submitted without a replacement', async () => {
    const custom = { type: 'openai', enabled: true, baseURL: 'https://fixture.invalid/v1', model: 'fixture-model', apiKeyRef: 'masked-ref', hasApiKey: true }
    const panel = await mountPanel(configWith({ custom }, ['custom']))
    click(button(panel.tree, '编辑'))
    const tree = await panel.runtime.mount(panel.registered)
    const input = flatten(tree).find(node => node.type === 'input' && node.props.type === 'password')
    assert.equal(input.props.value, '')
    assert.match(input.props.placeholder, /已保存/)
    click(button(tree, '保存'))
    await panel.runtime.mount(panel.registered)
    const patch = JSON.parse(panel.calls.find(call => call.url === '/_xlate/config' && call.init?.method === 'POST').init.body)
    assert.equal(Object.hasOwn(patch.providers.custom, 'apiKey'), false)
    assert.equal(Object.hasOwn(patch.providers.custom, 'apiKeyRef'), false, 'browser cannot select a different stored key')
    panel.dispose()
  })

  it('requires an explicit clear action and sends null only for the selected key', async () => {
    const custom = { type: 'openai', enabled: true, baseURL: 'https://fixture.invalid/v1', model: 'fixture-model', hasApiKey: true }
    const panel = await mountPanel(configWith({ custom }, ['custom']))
    click(button(panel.tree, '编辑'))
    let tree = await panel.runtime.mount(panel.registered)
    const label = flatten(tree).find(node => node.type === 'label' && textOf(node) === '移除已保存的密钥')
    assert.ok(label)
    flatten(label).find(node => node.type === 'input').props.onChange({ target: { checked: true } })
    tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '保存'))
    await panel.runtime.mount(panel.registered)
    const patch = JSON.parse(panel.calls.find(call => call.url === '/_xlate/config' && call.init?.method === 'POST').init.body)
    assert.equal(patch.providers.custom.apiKey, null)
    panel.dispose()
  })

  it('discards a newly typed key when the edit form is cancelled', async () => {
    const custom = { type: 'openai', enabled: true, baseURL: 'https://fixture.invalid/v1', model: 'fixture-model', hasApiKey: true }
    const panel = await mountPanel(configWith({ custom }, ['custom']))
    click(button(panel.tree, '编辑'))
    let tree = await panel.runtime.mount(panel.registered)
    flatten(tree).find(node => node.type === 'input' && node.props.type === 'password').props.onChange({ target: { value: 'new-private-key' } })
    tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '取消'))
    tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '编辑'))
    tree = await panel.runtime.mount(panel.registered)
    assert.equal(flatten(tree).find(node => node.type === 'input' && node.props.type === 'password').props.value, '')
    assert.equal(panel.calls.some(call => call.url === '/_xlate/config' && call.init?.method === 'POST'), false)
    assert.equal(JSON.stringify(panel.preferences).includes('new-private-key'), false)
    panel.dispose()
  })
})

describe('glossary editor', function () {
  function editor(tree) { return flatten(tree).find(node => node.type === 'textarea') }
  function targetLanguage(tree) { return flatten(tree).find(node => node.type === 'select' && ['zh-CN', 'en'].includes(node.props.value)) }
  function checkbox(tree, text) {
    const row = flatten(tree).find(node => node.type === 'label' && textOf(node) === text)
    assert.ok(row, 'visible checkbox: ' + text)
    return flatten(row).find(node => node.type === 'input' && node.props.type === 'checkbox')
  }

  it('enables the built-in glossary with one click and preserves unsaved custom drafts', async () => {
    const cfg = { ...configWith({}, []), glossaryPreset: BUILTIN_GLOSSARY, glossary: { enabled: false, builtin: false, entries: { ja: [{ source: 'agent', target: 'エージェント' }] } } }
    const panel = await mountPanel(cfg)
    assert.match(textOf(panel.tree), /查看内置词条（60 条）/)
    editor(panel.tree).props.onChange({ target: { value: 'agent => 私人译法' } })
    let tree = await panel.runtime.mount(panel.registered)
    checkbox(tree, '启用内置词表').props.onChange({ target: { checked: true } })
    tree = await panel.runtime.mount(panel.registered)
    const posts = panel.calls.filter(call => call.url === '/_xlate/config' && call.init?.method === 'POST')
    assert.equal(posts.length, 1)
    assert.deepEqual(JSON.parse(posts[0].init.body), { glossary: { builtin: true } })
    assert.equal(cfg.glossary.enabled, false)
    assert.equal(editor(tree).props.value, 'agent => 私人译法')
    assert.equal(cfg.glossary.entries.ja[0].target, 'エージェント')
    assert.match(textOf(tree), /内置词表已启用，立即生效/)
    assert.equal(checkbox(tree, '启用内置词表').props.checked, true)
    assert.match(textOf(tree), /有未保存的修改/)
    click(button(tree, '保存术语表'))
    tree = await panel.runtime.mount(panel.registered)
    assert.equal(cfg.glossary.builtin, true)
    assert.equal(cfg.glossary.entries['zh-CN'][0].target, '私人译法')
    checkbox(tree, '启用自定义词条').props.onChange({ target: { checked: true } })
    tree = await panel.runtime.mount(panel.registered)
    assert.equal(cfg.glossary.builtin, true)
    checkbox(tree, '启用内置词表').props.onChange({ target: { checked: false } })
    tree = await panel.runtime.mount(panel.registered)
    assert.equal(cfg.glossary.builtin, false)
    assert.equal(cfg.glossary.enabled, true)
    assert.equal(cfg.glossary.entries['zh-CN'][0].target, '私人译法')
    assert.match(textOf(tree), /自定义词条保留/)
    panel.dispose()
  })

  it('does not offer activation against an older Host without built-in preset metadata', async () => {
    const panel = await mountPanel(configWith({}, []))
    assert.equal(checkbox(panel.tree, '启用内置词表').props.disabled, true)
    panel.dispose()
  })

  it('saves only the selected language and keeps the other languages and provider chain', async () => {
    const cfg = { ...configWith({}, []), glossary: { enabled: true, entries: { ja: [{ source: 'agent', target: 'エージェント' }] } } }
    const panel = await mountPanel(cfg)
    editor(panel.tree).props.onChange({ target: { value: 'DeepSeek => DeepSeek\nagent => 智能体' } })
    let tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '保存术语表'))
    tree = await panel.runtime.mount(panel.registered)
    const patch = JSON.parse(panel.calls.find(call => call.url === '/_xlate/config' && call.init?.method === 'POST').init.body)
    assert.deepEqual(patch, { glossary: { entries: { 'zh-CN': [{ source: 'DeepSeek', target: 'DeepSeek' }, { source: 'agent', target: '智能体' }] } } })
    assert.equal(cfg.glossary.entries.ja[0].target, 'エージェント')
    assert.match(textOf(tree), /术语表已保存/)
    panel.dispose()
  })

  it('shows the invalid line without submitting a malformed glossary', async () => {
    const panel = await mountPanel(configWith({}, []))
    editor(panel.tree).props.onChange({ target: { value: 'agent => 智能体\n\nAGENT => 代理' } })
    let tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '保存术语表'))
    tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(tree), /第 3 行/)
    assert.equal(panel.calls.some(call => call.url === '/_xlate/config' && call.init?.method === 'POST'), false)
    panel.dispose()
  })

  it('preserves unsaved drafts separately while switching target languages', async () => {
    const cfg = { ...configWith({}, []), glossary: { enabled: true, entries: { en: [{ source: '智能体', target: 'AI agent' }] } } }
    const panel = await mountPanel(cfg)
    editor(panel.tree).props.onChange({ target: { value: 'agent => 智能体' } })
    let tree = await panel.runtime.mount(panel.registered)
    targetLanguage(tree).props.onChange({ target: { value: 'en' } })
    tree = await panel.remount()
    assert.equal(editor(tree).props.value, '智能体 => AI agent')
    assert.match(textOf(tree), /Unsaved entries in 1 other languages/)
    editor(tree).props.onChange({ target: { value: '智能体 => agent' } })
    tree = await panel.runtime.mount(panel.registered)
    targetLanguage(tree).props.onChange({ target: { value: 'zh-CN' } })
    tree = await panel.remount()
    assert.equal(editor(tree).props.value, 'agent => 智能体')
    assert.equal(panel.calls.some(call => call.url === '/_xlate/config' && call.init?.method === 'POST'), false)
    panel.dispose()
  })

  it('clears the current language explicitly and can disable all glossary mappings', async () => {
    const cfg = { ...configWith({}, []), glossary: { enabled: true, entries: { 'zh-CN': [{ source: 'agent', target: '智能体' }], ja: [{ source: 'agent', target: 'エージェント' }] } } }
    const panel = await mountPanel(cfg)
    editor(panel.tree).props.onChange({ target: { value: '' } })
    let tree = await panel.runtime.mount(panel.registered)
    const label = flatten(tree).find(node => node.type === 'label' && textOf(node) === '启用自定义词条')
    flatten(label).find(node => node.type === 'input').props.onChange({ target: { checked: false } })
    tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '保存术语表'))
    await panel.runtime.mount(panel.registered)
    assert.equal(cfg.glossary.enabled, false)
    assert.deepEqual(cfg.glossary.entries['zh-CN'], [])
    assert.equal(cfg.glossary.entries.ja[0].target, 'エージェント')
    panel.dispose()
  })

  it('shows an unsaved reminder and highlights Save until the draft is saved or reverted', async () => {
    const panel = await mountPanel(configWith({}, []))
    assert.equal(button(panel.tree, '保存术语表').props.disabled, true)
    editor(panel.tree).props.onChange({ target: { value: 'agent => 自定义' } })
    let tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(tree), /有未保存的修改，请点击/)
    assert.match(button(tree, '保存术语表').props.className, /xl-save-pending/)
    let prevented = false
    const event = { preventDefault: () => { prevented = true } }
    panel.windowListeners.get('beforeunload')(event)
    assert.equal(prevented, true)
    assert.equal(event.returnValue, '')
    editor(tree).props.onChange({ target: { value: '' } })
    tree = await panel.runtime.mount(panel.registered)
    assert.doesNotMatch(textOf(tree), /有未保存的修改/)
    assert.equal(button(tree, '保存术语表').props.disabled, true)
    assert.equal(panel.windowListeners.has('beforeunload'), false)
    editor(tree).props.onChange({ target: { value: 'agent => 自定义' } })
    tree = await panel.runtime.mount(panel.registered)
    click(button(tree, '保存术语表'))
    tree = await panel.runtime.mount(panel.registered)
    assert.doesNotMatch(textOf(tree), /有未保存的修改/)
    assert.equal(button(tree, '保存术语表').props.disabled, true)
    panel.dispose()
  })
})

describe('persistent translation sidebar entry', function () {
  function toggle(tree, label) {
    const row = flatten(tree).find(n => n.host && n.type === 'label' && textOf(n) === label)
    assert.ok(row, 'sidebar checkbox label is visible')
    return flatten(row).find(n => n.host && n.type === 'input' && n.props.type === 'checkbox')
  }
  function sidebar(panel) { return panel.entries.filter(e => e.spec.name === 'sidebar.panellist') }

  it('shows one entry immediately and restores the choice in a fresh client', async function () {
    const config = configWith({}, [])
    const panel = await mountPanel(config)
    assert.equal(sidebar(panel).length, 0)
    toggle(panel.tree, '在侧边栏显示翻译入口').props.onChange({ target: { checked: true } })
    assert.equal(sidebar(panel).length, 1)
    assert.equal(sidebar(panel)[0].spec.id, 'dsh-think-translate')
    assert.equal(panel.preferences.sidebar, 'true')
    const fresh = await mountPanel(config, undefined, null, panel.preferences)
    assert.equal(sidebar(fresh).length, 1)
    const page = await fresh.renderView('main', 'dsh-think-translate', {})
    assert.ok(flatten(page).some(n => n.host && n.type === 'h1' && textOf(n) === '思考链翻译'))
    toggle(page, '在侧边栏显示翻译入口').props.onChange({ target: { checked: false } })
    assert.equal(sidebar(fresh).length, 0)
    assert.equal(fresh.preferences.sidebar, 'false')
    assert.equal(fresh.calls.some(c => c.url === '/_xlate/config' && c.init), false)
    panel.dispose()
    fresh.dispose()
  })

  it('updates the entry label without duplicate rows when language changes', async function () {
    const panel = await mountPanel(configWith({}, []), undefined, null, { sidebar: 'true', lang: 'en' })
    assert.equal(sidebar(panel)[0].spec.label(), 'Think Translation')
    const language = flatten(panel.tree).find(n => n.host && n.type === 'select' && n.props.value === 'en')
    language.props.onChange({ target: { value: 'ja' } })
    assert.equal(sidebar(panel).length, 1)
    assert.equal(sidebar(panel)[0].spec.label(), '思考チェーン翻訳')
    panel.dispose()
  })

  it('withdraws the entry and its preference listener when the plugin is disposed', async function () {
    const panel = await mountPanel(configWith({}, []), undefined, null, { sidebar: 'true' })
    const checkbox = toggle(panel.tree, '在侧边栏显示翻译入口')
    assert.equal(sidebar(panel).length, 1)
    panel.dispose()
    assert.equal(sidebar(panel).length, 0)
    checkbox.props.onChange({ target: { checked: false } })
    checkbox.props.onChange({ target: { checked: true } })
    assert.equal(sidebar(panel).length, 0)
  })
})

describe('todo_write slot composition (issue #4)', function () {
  for (const officialFirst of [true, false]) {
    it('loads and selects the translated toolview when the official entry registers ' + (officialFirst ? 'first' : 'last'), async function () {
      const panel = await mountPanel(configWith({}, []), undefined, officialFirst)
      const todos = panel.entries.filter(function (entry) {
        return entry.spec.name === 'tool.call.toolview' && entry.spec.key === 'todo_write'
      }).sort(function (a, b) { return (a.spec.priority ?? 0) - (b.spec.priority ?? 0) })
      assert.equal(todos.length, 2, 'the official and translated toolviews must coexist')
      assert.notEqual(todos[0].component, panel.officialTodo, 'the translated toolview must win dispatch')
      assert.equal(todos[1].component, panel.officialTodo, 'the official entry must remain available')
      assert.match(textOf(panel.tree), /目标语言/, 'apply must reach settings registration and rendering')
    })
  }
})

describe('DSH 0.2 conversation component props', function () {
  it('renders the official image Factory with its session image loader and keeps the answer', async function () {
    const panel = await mountPanel(configWith({}, []))
    const galleries = []
    const loadImage = () => 'authorized-image'
    const tree = await panel.renderView('conversation.chat.node', 'assistant-step', {
      node: { location: {}, data: { status: 'settled', blocks: [
        { kind: 'text', text: 'Answer before images.' },
        { kind: 'image', attachment: 'a' }, { kind: 'image', attachment: 'b' },
      ] } }, useTurnData: () => undefined, loadImage,
      renderFactorySlot: (name, props) => { galleries.push({ name, props }); return panel.runtime.React.createElement('span', null, 'gallery') },
    })
    assert.match(textOf(tree), /Answer before images/)
    assert.match(textOf(tree), /gallery/)
    assert.equal(galleries.length, 1)
    assert.equal(galleries[0].name, 'conversation.images.content')
    assert.deepEqual(Array.from(galleries[0].props.images, image => image.attachment), ['a', 'b'])
    assert.equal(galleries[0].props.loadImage, loadImage)
    assert.equal(panel.specs.find(spec => spec.key === 'assistant-step').children, undefined)
  })

  it('joins the Turn fold and exposes the reveal action without hiding reply text', async function () {
    const panel = await mountPanel(configWith({}, []))
    let folded, reveal, opened
    const tree = await panel.renderView('conversation.chat.node', 'assistant-step', {
      node: { location: {}, data: { status: 'settled', blocks: [
        { kind: 'reasoning', text: '检查原文。' }, { kind: 'text', text: 'Visible reply.' },
      ] } }, useTurnData: () => undefined,
      turnProcess: { foldable: true, open: false, setOpen: value => { opened = value } },
      useGroupAction: (hidden, action) => { folded = hidden; reveal = action; return { current: null } },
    })
    assert.equal(folded, true)
    assert.match(textOf(tree), /Visible reply/)
    assert.equal(flatten(tree).filter(node => node.props && node.props['data-turn-process-inline'] === true).length, 1)
    reveal()
    assert.equal(opened, true)
  })

  it('passes file links and durable original text selection to official Markdown', async function () {
    const seen = []
    const panel = await mountPanel(configWith({}, []), null, null, {}, null, null, { MarkdownText: props => { seen.push(props); return props.text } })
    const mentions = { resolve: () => undefined }
    const finalNode = { seq: 12, messageId: 'message-1' }
    await panel.renderView('conversation.chat.node', 'assistant-step', {
      node: { location: { kind: 'step', turn: { status: 'closed' } }, data: { status: 'settled', finalNode, blocks: [{ kind: 'text', text: 'Original answer.' }] } },
      useTurnData: () => ({ closing: { finalNode } }), fileMentions: () => mentions,
    })
    assert.equal(seen[0].fileMentions, mentions)
    assert.equal(seen[0].textInteractionSource, true)
  })
  it('keeps the stopped marker when an interrupted step has only reasoning', async function () {
    const panel = await mountPanel(configWith({}, []), undefined, null, { mode: 'expanded' })
    const tree = await panel.renderView('conversation.chat.node', 'assistant-step', {
      groupPart: 'reasoning', node: { location: {}, data: { status: 'interrupted', blocks: [{ kind: 'reasoning', text: '检查原文。' }] } },
      useTurnData: function () { return undefined }, t: function (key) { return key },
    })
    assert.equal(flatten(tree).filter(function (n) { return cls(n) === 'xl-warn' }).length, 1)
  })

  for (const groupPart of ['reasoning', 'response', undefined]) {
    it('keeps the original-text error fallback within group ' + groupPart, async function () {
      const panel = await mountPanel(configWith({}, []))
      const props = { groupPart, node: { data: { blocks: [
        { kind: 'reasoning', text: 'Original reasoning.' },
        { kind: 'text', text: 'Original answer.' },
      ] } } }
      const registered = panel.entries.find(function (entry) { return entry.spec.key === 'assistant-step' }).component
      const assistant = registered(props)
      const boundary = assistant.type(assistant.props)
      panel.runtime.reset()
      const tree = await panel.runtime.mount(function () { return boundary.props.fallback })
      const text = textOf(tree)
      if (groupPart !== 'response') assert.match(text, /Original reasoning/)
      else assert.doesNotMatch(text, /Original reasoning/)
      if (groupPart !== 'reasoning') assert.match(text, /Original answer/)
      else assert.doesNotMatch(text, /Original answer/)
    })
  }

  for (const think of [true, false]) {
    for (const status of ['completed', 'running', 'interrupted']) {
      it('renders split assistant groups once with thinking ' + think + ' and status ' + status, async function () {
        const panel = await mountPanel(configWith({}, []), undefined, null, { think, mode: 'expanded' })
        const node = { kind: 'assistant-step', location: { kind: 'step', turn: { status: 'closed' } }, data: {
          status, blocks: [
            { kind: 'reasoning', text: '检查第一段原文。' },
            { kind: 'text', text: 'First answer.' },
            { kind: 'reasoning', text: '检查第二段原文。' },
            { kind: 'text', text: 'Second answer.\n\n```js\nconst x = 1;\n```' },
            { kind: 'image', attachment: 'image-a' },
            { kind: 'image', attachment: 'image-b' },
            { kind: 'tool-call', callId: 'tool-a' },
          ],
        } }
        const original = JSON.stringify(node)
        const props = {
          node, useTurnData: function () { return undefined }, t: function (key) { return key },
          renderMessageImages: function (group) { return panel.runtime.React.createElement('span', { className: 'test-images' }, String(group.images.length)) },
        }
        const reasoning = await panel.renderView('conversation.chat.node', 'assistant-step', { ...props, groupPart: 'reasoning' })
        const response = await panel.renderView('conversation.chat.node', 'assistant-step', { ...props, groupPart: 'response' })
        assert.equal(flatten(reasoning).filter(function (n) { return cls(n) === 'xl-think' }).length, 2)
        if (status === 'running') assert.ok(flatten(reasoning).filter(function (n) { return cls(n) === 'xl-think-title' })
          .every(function (n) { return textOf(n) === '思考' }), 'earlier reasoning must not become the active streaming tail')
        assert.doesNotMatch(textOf(reasoning), /First answer|Second answer|const x = 1;/)
        assert.equal(flatten(reasoning).filter(function (n) { return cls(n) === 'test-images' }).length, 0)
        assert.equal(flatten(response).filter(function (n) { return cls(n) === 'xl-think' }).length, 0)
        assert.equal((textOf(response).match(/First answer/g) || []).length, 1)
        assert.equal((textOf(response).match(/Second answer/g) || []).length, 1)
        assert.match(textOf(response), /const x = 1;/)
        assert.equal(flatten(response).filter(function (n) { return cls(n) === 'test-images' }).length, 1)
        assert.equal(flatten(reasoning).filter(function (n) { return cls(n) === 'xl-warn' }).length, 0)
        assert.equal(flatten(response).filter(function (n) { return cls(n) === 'xl-warn' }).length, status === 'interrupted' ? 1 : 0)
        assert.equal(JSON.stringify(node), original)
      })
    }
  }

  it('renders long code-only batches inside translated reasoning without dropping code', async function () {
    const payloads = []
    const panel = await mountPanel(configWith({}, []), null, null, { mode: 'eager' }, null, async function (request) {
      const translated = await translateProtectedText(request.text, async function (prose) { payloads.push(prose); return '译文\n' })
      return { ok: true, text: translated, provider: 'test' }
    })
    const code = '```js\n' + 'const secret = "keep exactly";\n'.repeat(100) + '```\n'
    const text = 'Please inspect the current build output. '.repeat(40) + '\n' + code + 'After the code.'
    const node = { location: {}, data: { status: 'completed', blocks: [{ kind: 'reasoning', text }] } }
    const original = JSON.stringify(node)
    const props = { node, useTurnData: function () { return undefined }, t: function (key) { return key } }
    let tree = await panel.renderView('conversation.chat.node', 'assistant-step', props)
    click(flatten(tree).find(function (n) { return cls(n) === 'xl-think-row' }))
    const component = panel.entries.find(function (entry) { return entry.spec.key === 'assistant-step' }).component
    tree = await panel.runtime.mount(component, props)
    const translation = flatten(tree).find(function (n) { return cls(n) === 'xl-trans' })
    assert.ok(translation, 'translated reasoning must be visible')
    assert.ok(textOf(translation).includes(code), 'a skipped code-only batch must survive the display pipeline')
    assert.ok(payloads.length >= 2)
    assert.ok(payloads.every(function (payload) { return !payload.includes('secret') && !payload.includes('```') }))
    assert.equal(JSON.stringify(node), original)
  })

  it('renders assistant text and reasoning without changing the original blocks', async function () {
    const panel = await mountPanel(configWith({}, []))
    const node = { kind: 'assistant-step', location: { kind: 'step', turn: { status: 'closed' } }, data: {
      status: 'completed', blocks: [
        { kind: 'reasoning', text: '检查原始数据。' },
        { kind: 'text', text: 'Original answer.\n\n```js\nconst x = 1;\n```' },
      ],
    } }
    const original = JSON.stringify(node)
    const tree = await panel.renderView('conversation.chat.node', 'assistant-step', {
      node, useTurnData: function () { return undefined }, t: function (key) { return key },
    })
    assert.match(textOf(tree), /Original answer/)
    assert.match(textOf(tree), /const x = 1;/)
    assert.ok(flatten(tree).some(function (n) { return cls(n) === 'xl-think' }), 'the reasoning row must render')
    assert.equal(JSON.stringify(node), original, 'display translation must not mutate transcript blocks')
  })

  for (const phase of ['preparing', 'start', 'result']) {
    it('renders the todo_write ' + phase + ' phase without changing tool arguments', async function () {
      const panel = await mountPanel(configWith({}, []))
      const argsRaw = JSON.stringify({ todos: [{ content: 'Inspect the original data', status: 'in_progress' }] })
      const block = phase === 'result'
        ? { kind: 'tool-result', callId: 'test', call: { name: 'todo_write', argsRaw }, content: [], isError: false, subCalls: [] }
        : { phase, name: 'todo_write', callId: 'test', turn: 1, step: 1, time: 1, subCalls: [], ...(phase === 'start' ? { argsRaw } : {}) }
      const original = JSON.stringify(block)
      const tree = await panel.renderView('tool.call.toolview', 'todo_write', { phase, block })
      assert.ok(flatten(tree).some(function (n) { return cls(n) === 'xl-todo' }))
      if (phase !== 'preparing') assert.match(textOf(tree), /已翻译的任务/)
      assert.equal(JSON.stringify(block), original)
    })
  }

  it('renders the translated composer todo dock from the todos projection', async function () {
    const panel = await mountPanel(configWith({}, []))
    const todos = [{ content: 'Inspect the original data', status: 'in_progress' }]
    const original = JSON.stringify(todos)
    const props = { useProjection: function (key) { assert.equal(key, 'todos'); return todos }, t: function (key) { return key } }
    const tree = await panel.renderView('conversation.input.dock', 'todo', props)
    assert.ok(flatten(tree).some(function (n) { return n.props['data-testid'] === 'todo-panel' }))
    click(button(tree, 'todo.title'))
    const opened = await panel.runtime.mount(panel.entries.find(function (entry) { return entry.spec.id === 'todo' }).component, props)
    assert.match(textOf(opened), /已翻译的任务/)
    assert.equal(JSON.stringify(todos), original)
  })
})

describe('settings panel renders (real bundle, mini React)', function () {
  it('does not let an older failed probe overwrite a newer successful probe', async function () {
    let reject
    const pending = new Promise((resolve, fail) => { reject = fail })
    let count = 0
    const first = { type: 'openai', enabled: true, baseURL: 'https://first.example/v1', model: 'first-model' }
    const panel = await mountPanel(configWith({ first }, ['first']), undefined, null, {}, null,
      () => ++count === 1 ? pending : { ok: true })
    click(button(panel.tree, '测试'))
    click(button(panel.tree, '测试'))
    let tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(tree), /连通 ✓/)
    reject(new Error('old network failure'))
    tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(tree), /连通 ✓/)
    assert.doesNotMatch(textOf(tree), /old network failure/)
    assert.match(textOf(flatten(tree).find(n => cls(n) === 'xl-kv-value')), /first-model/)
  })

  it('ignores an older successful test after the model was changed', async function () {
    let resolve
    const pending = new Promise(done => { resolve = done })
    const first = { type: 'openai', enabled: true, baseURL: 'https://first.example/v1', model: 'old-model' }
    const panel = await mountPanel(configWith({ first }, ['first']), undefined, null, {}, null, () => pending)
    click(button(panel.tree, '测试'))
    first.model = 'new-model'
    resolve({ ok: true, model: 'old-model' })
    const tree = await panel.runtime.mount(panel.registered)
    const current = flatten(tree).find(n => cls(n) === 'xl-kv-value')
    assert.doesNotMatch(textOf(current), /old-model|new-model/)
  })

  it('keeps the first verified provider current when the second provider is tested', async function () {
    const first = { type: 'openai', enabled: true, baseURL: 'https://first.example/v1', model: 'first-model' }
    const second = { type: 'openai', enabled: true, baseURL: 'https://second.example/v1', model: 'second-model' }
    let firstFails = false
    const panel = await mountPanel(configWith({ first, second }, ['first', 'second']), undefined, null, {}, null,
      body => firstFails && body.provider === 'first' ? { ok: false, error: 'offline' } : { ok: true })
    const testButtons = tree => flatten(tree).filter(n => n.type === 'button' && textOf(n) === '测试')
    const current = tree => flatten(tree).find(n => cls(n) === 'xl-kv-value')
    click(testButtons(panel.tree)[0])
    let tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(current(tree)), /first-model/)
    click(testButtons(tree)[1])
    tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(current(tree)), /first-model/)
    assert.doesNotMatch(textOf(current(tree)), /second-model/)
    firstFails = true
    click(testButtons(tree)[0])
    tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(current(tree)), /second-model/)
    first.model = 'new-model'
    firstFails = false
    click(testButtons(tree)[0])
    tree = await panel.runtime.mount(panel.registered)
    assert.match(textOf(current(tree)), /new-model/)
  })

  const ollama = { type: 'openai', enabled: true, baseURL: 'http://localhost:11434/v1', model: 'test-model' }
  it('releases the selected local model without changing its enabled state or order', async function () {
    const panel = await mountPanel(configWith({ openai: ollama }, ['openai']))
    click(button(panel.tree, '释放模型内存'))
    await panel.runtime.mount(panel.registered)
    const release = panel.calls.find(c => c.url === '/_xlate/local/release')
    assert.deepEqual(JSON.parse(release.init.body), { model: ollama.model, baseURL: ollama.baseURL })
    assert.equal(panel.calls.some(c => c.url === '/_xlate/config' && c.init), false)
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
  })

  it('persists idle time and can turn automatic release off', async function () {
    const panel = await mountPanel(configWith({ openai: ollama }, ['openai']))
    const input = flatten(panel.tree).find(node => node.props && node.props['aria-label'] === '空闲后自动释放')
    input.props.onChange({ target: { value: '0' } })
    await panel.runtime.mount(panel.registered)
    const save = panel.calls.find(c => c.url === '/_xlate/config' && c.init)
    assert.deepEqual(JSON.parse(save.init.body), { localModel: { idleMinutes: 0 } })
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
  })
  it('shows the server idle countdown without loading or refreshing the model', async function () {
    const cfg = configWith({ openai: ollama }, ['openai'])
    cfg.localModel = { idleMinutes: 30 }
    const panel = await mountPanel(cfg, null, null, {}, null, null, null,
      { loaded: true, active: 0, sizeBytes: 1500000000, expiresAt: new Date(Date.now() + 5 * 60000 - 1000).toISOString() })
    assert.match(textOf(panel.tree), /空闲后自动释放 5 min/)
    assert.match(textOf(panel.tree), /每次翻译后重新计时/)
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
  })
  it('reads memory status without loading the first local provider, including after reopening settings', async function () {
    const panel = await mountPanel(configWith({ openai: ollama }, ['openai']))
    const preparation = panel.calls.filter(c => c.url === '/_xlate/local/prepare')
    assert.equal(preparation.length, 0)
    await panel.remount()
    assert.equal(panel.calls.filter(c => c.url === '/_xlate/local/prepare').length, 0)
    assert.ok(panel.calls.some(c => c.url === '/_xlate/local/status'))
  })
  it('defers loading until use when its row is moved above the other provider', async function () {
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true }, openai: ollama }, ['google', 'openai']))
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
    const up = flatten(panel.tree).filter(n => n.type === 'button' && textOf(n) === '↑')[1]
    click(up)
    await panel.runtime.mount(panel.registered)
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
  })
  it('prepares before an explicit local test even when the provider checkbox is off', async function () {
    const panel = await mountPanel(configWith({ openai: { ...ollama, enabled: false } }, ['openai']))
    assert.equal(panel.calls.some(c => c.url === '/_xlate/local/prepare'), false)
    click(button(panel.tree, '测试'))
    const tree = await panel.runtime.mount(panel.registered)
    const prepare = panel.calls.findIndex(c => c.url === '/_xlate/local/prepare')
    const test = panel.calls.findIndex(c => c.url === '/_xlate/translate')
    assert.ok(prepare >= 0 && test > prepare)
    assert.equal(JSON.parse(panel.calls[test].init.body).provider, 'openai')
    assert.match(textOf(tree), /连通 ✓/)
  })
  it('shows missing-model guidance and grants installation/download only from the setup button', async function () {
    const status = { id: 'setup', origin: 'http://localhost:11434', model: 'test-model', phase: 'needs_model', running: false, canInstall: true, percent: null }
    const panel = await mountPanel(configWith({ openai: ollama }, ['openai']), undefined, null, {}, status)
    assert.match(textOf(panel.tree), /所选模型尚未下载/)
    click(button(panel.tree, '一键安装并准备'))
    await panel.runtime.mount(panel.registered)
    const calls = panel.calls.filter(c => c.url === '/_xlate/local/prepare')
    assert.deepEqual(JSON.parse(calls[calls.length - 1].init.body), { allowInstall: true, allowDownload: true })
  })
  it('shows the real download percentage and byte counts', async function () {
    const status = { id: 'progress', origin: 'http://localhost:11434', model: 'test-model', phase: 'downloading_model', running: true, percent: 50, completed: 1048576, total: 2097152 }
    const panel = await mountPanel(configWith({ openai: ollama }, ['openai']), undefined, null, {}, status)
    assert.match(textOf(panel.tree), /下载模型.*50%.*1\.0 MB \/ 2\.0 MB/)
  })

  it('paints the section and lists the DSH providers it can use', async function () {
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true }, 'a-dsh': DSH_PROVIDER }, ['google']))
    const text = textOf(panel.tree)
    // The section title travels as the registration label; the panel itself
    // paints the settings, the provider list, the status block and the about row.
    const section = panel.specs.find(function (s) { return s.name === 'settings.section' })
    assert.equal(section.label, '思考链翻译')
    assert.equal(section.id, 'dsh-think-translate')
    assert.match(text, /目标语言/)
    assert.match(text, /当前使用/)
    // The discovered provider is listed without asking (the host merges it), under a
    // heading that says what the rows are, with a rescan button beside "+ add provider".
    assert.match(text, /重新扫描 DSH 配置/, 'the rescan entry point must be visible')
    assert.match(text, /DSH 已配置提供方/, 'and the list names what it holds')
    assert.match(text, /a-dsh/, 'with the provider the harness is configured with')
    assert.ok(flatten(panel.tree).some(function (n) { return n.host && cls(n) === 'xl-btn xl-add-btn' }),
      'each listed provider has its compact "+" add button')
    assert.ok(!panel.calls.some(function (c) { return c.url === '/_xlate/dsh-scan' }),
      'nothing is scanned before the user asks for it')
  })

  it('rescans on click, then adds every listed provider with one more click', async function () {
    // The host already merges the harness's providers into the config it serves, so
    // they are listed without asking. The button re-reads them (an edit to
    // ~/.dsh/settings.yaml otherwise needs a restart) and the bulk action sits on the
    // list they appear in — there is no second, duplicate list any more.
    const scan = configWith({
      google: { type: 'google', enabled: true },
      'a-dsh': DSH_PROVIDER,
      'b-dsh': { type: 'openai', source: 'dsh', baseURL: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', apiKeyEnv: 'OPENROUTER_OX_API_KEY', enabled: false },
    }, ['google'])

    const panel = await mountPanel(scan)
    click(button(panel.tree, '重新扫描 DSH 配置'))
    const afterScan = await panel.runtime.mount(panel.registered)

    assert.ok(panel.calls.some(function (c) { return c.url === '/_xlate/dsh-scan' }), 'the click must rescan')
    const text = textOf(afterScan)
    assert.match(text, /a-dsh/, 'the list shows the harness’s own provider ids')
    assert.match(text, /b-dsh/)
    assert.match(text, /全部加入/)

    click(button(afterScan, '全部加入'))
    const saved = panel.calls.filter(function (c) { return c.url === '/_xlate/config' && c.init && c.init.method === 'POST' })
    assert.equal(saved.length, 1, 'exactly one save is sent')
    const chain = JSON.parse(saved[0].init.body).chain
    assert.deepEqual(chain, ['google', 'a-dsh', 'b-dsh'], 'both inherited providers join the chain, order preserved')
  })

  it('adds one provider from the list with the compact + button', async function () {
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true }, 'a-dsh': DSH_PROVIDER }, ['google']))
    const add = flatten(panel.tree).find(function (n) { return n.host && cls(n) === 'xl-btn xl-add-btn' })
    assert.ok(add, 'the row carries a compact "+" button')
    assert.equal(textOf(add), '+', 'with no label text')
    assert.ok(add.props.title, 'and the wording lives in its tooltip: ' + add.props.title)
    click(add)
    const after = await panel.runtime.mount(panel.registered)
    const post = panel.calls.filter(function (c) { return c.url === '/_xlate/config' && c.init && c.init.method === 'POST' }).pop()
    assert.deepEqual(JSON.parse(post.init.body).chain, ['google', 'a-dsh'])
    assert.match(textOf(after), /a-dsh/)
  })

  it('names the list after what it holds', async function () {
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true }, 'a-dsh': DSH_PROVIDER }, ['google']))
    assert.match(textOf(panel.tree), /DSH 已配置提供方/, 'all-DSH rows get the DSH heading')
  })

  it('explains a scan that found nothing, naming the file it read', async function () {
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true } }, ['google']))
    click(button(panel.tree, '重新扫描 DSH 配置'))
    const afterScan = await panel.runtime.mount(panel.registered)
    const text = textOf(afterScan)
    assert.match(text, /没有发现已配置的 provider/)
    assert.match(text, /settings\.yaml/, 'and it names the file it looked at')
  })

  it('shows the Desktop profile file and sanitized scan error for a modern empty scan', async function () {
    const config = configWith({ google: { type: 'google', enabled: true } }, ['google'])
    config.dshScan.sourcePath = 'C:/Users/test/.dsh/profiles/desktop/cordis.patch.yml'
    config.dshScan.error = 'Invalid DSH YAML'
    const panel = await mountPanel(config)
    click(button(panel.tree, '重新扫描 DSH 配置'))
    const text = textOf(await panel.runtime.mount(panel.registered))
    assert.ok(text.includes(config.dshScan.sourcePath))
    assert.ok(text.includes('Invalid DSH YAML'))
    assert.ok(!text.includes('/settings.yaml'))
  })

  it('keeps a half-typed provider form across the remount a language change causes', async function () {
    // The section is re-registered on a language change so its nav title follows, and
    // the shell keys list rows by registration identity — so the panel is unmounted
    // and mounted again. Everything the user is in the middle of has to survive that.
    const panel = await mountPanel(configWith({ google: { type: 'google', enabled: true } }, ['google']))
    click(button(panel.tree, '+ 添加自定义提供方'))
    let tree = await panel.runtime.mount(panel.registered)

    const form = flatten(tree).find(function (n) { return n.host && cls(n) === 'xl-add-form' })
    assert.ok(form, 'the add form is open')
    const inputs = flatten(form).filter(function (n) { return n.host && n.type === 'input' && cls(n) === 'xl-cfg' })
    const baseURL = inputs.find(function (n) { return n.props.placeholder === 'https://api.example.com/v1' })
    const key = inputs[inputs.length - 1]
    baseURL.props.onChange({ target: { value: 'https://my-gateway.example/v1' } })
    key.props.onChange({ target: { value: 'sk-half-typed' } })
    tree = await panel.runtime.mount(panel.registered)

    // the language switch: the registration is replaced and the row gets a new key
    const langSelect = flatten(tree).find(function (n) {
      return n.host && n.type === 'select' && flatten(n).some(function (o) { return o.props && o.props.value === 'ja' })
    })
    langSelect.props.onChange({ target: { value: 'ja' } })
    const afterRemount = await panel.remount()

    const text = textOf(afterRemount)
    const form2 = flatten(afterRemount).find(function (n) { return n.host && cls(n) === 'xl-add-form' })
    assert.ok(form2, 'the form is still open after the remount')
    const values = flatten(form2).filter(function (n) { return n.host && n.type === 'input' && cls(n) === 'xl-cfg' })
      .map(function (n) { return n.props.value })
    assert.ok(values.includes('https://my-gateway.example/v1'), 'the typed base URL survived: ' + values.join(', '))
    assert.ok(values.includes('sk-half-typed'), 'the typed key survived: ' + values.join(', '))
    // and the panel must not flash the "host half not loaded" notice while it
    // refetches: the last known config is part of the draft
    assert.ok(!/host 半边未生效|not loaded|未加载/.test(text), 'no unavailable flash: ' + text.slice(0, 120))
    assert.ok(panel.specs.filter(function (s) { return s.name === 'settings.section' }).length >= 2,
      'the section was registered again for the new language')
  })
})
