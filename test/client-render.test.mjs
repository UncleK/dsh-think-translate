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
    try {
      if (type.prototype && type.prototype.render) {
        if (!inst.self) inst.self = new type(props)
        inst.self.props = props
        out = inst.self.render()
      } else {
        out = type(Object.assign({}, props, { children }))
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
  async function mount(ComponentType) {
    let tree = null
    for (let pass = 0; pass < 40; pass++) {
      dirty = false
      order = 0
      tree = renderComponent(ComponentType, {}, undefined)
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

async function mountPanel(config, scanConfig) {
  // The host already merges the harness's providers into GET /_xlate/config, so the
  // panel paints them without being asked; the scan route answers with the same shape
  // (a second argument models "the harness config changed since we loaded").
  const served = config
  const scanned = scanConfig || config
  const calls = []
  const runtime = createRuntime()
  const captured = {}
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: function () { return null }, setItem: function () {}, removeItem: function () {} },
    fetch: function (url, init) {
      calls.push({ url: url, init: init || null })
      let body = {}
      if (url === '/_xlate/config' && init && init.method === 'POST') {
        body = JSON.parse(init.body)
        body = configWith(body.providers || {}, body.chain || [])
      } else if (url === '/_xlate/config') {
        body = served
      } else if (url === '/_xlate/dsh-scan') {
        body = scanned
      } else if (url === '/_xlate/models') {
        body = { models: [] }
      } else if (url === '/_xlate/version') {
        body = { ok: true, name: 'dsh-think-translate', version: '1.2.0', repo: 'https://github.com/UncleK/dsh-think-translate' }
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body) } })
    },
    window: {},
  }
  sandbox.window.__ModuleLoader__ = { load: function (spec) { captured.spec = spec } }
  vm.createContext(sandbox)
  vm.runInContext(SRC, sandbox, { filename: 'lib/client.js' })

  const plugin = captured.spec.factory(function (name) {
    if (name === 'react') return { default: runtime.React }
    throw new Error('the test only provides react, not ' + name)
  })

  const registered = {}
  const specs = []
  const ctx = {
    slots: {
      inject: function (name, cb) { return cb() },
      register: function (spec, component) {
        specs.push(spec)
        if (spec.name === 'settings.section') registered.section = component
        return function () {}
      },
    },
  }
  plugin.apply(ctx)
  assert.equal(typeof registered.section, 'function', 'the panel must register itself into settings.section')

  const tree = await runtime.mount(registered.section)
  return {
    tree, calls, runtime, specs,
    registered: registered.section,
    // mount again with every component instance dropped (a real remount)
    remount: function () { runtime.reset(); return runtime.mount(registered.section) },
  }
}

describe('settings panel renders (real bundle, mini React)', function () {
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
    assert.match(text, /全部加入链/)

    click(button(afterScan, '全部加入链'))
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
