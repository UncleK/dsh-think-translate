// Auto-review denial: the approval card must show the reviewer's reason in the
// target language.
//
// The approval composer is official shell UI, not a conversation node this
// plugin can shadow, so the decorator augments the rendered card in place. These
// tests drive the bundle's real apply() through a tiny React + DOM sandbox:
// they pin that only Auto review headlines are touched, that the reason (never
// the localized prefix) is what gets translated, that the block is idempotent
// and survives a remount, and that disposal/disablement removes it.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const SRC = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')

// ------------------------------------------------------------------ tiny DOM
function matches(el, sel) {
  const attr = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/)
  if (attr) {
    if (el.nodeType !== 1 || !(attr[1] in el.attrs)) return false
    return attr[2] === undefined || el.attrs[attr[1]] === attr[2]
  }
  return el.tagName === String(sel).toUpperCase()
}
function descendants(el, out) {
  out = out || []
  for (const c of el.children) {
    if (c.nodeType !== 1) continue
    out.push(c)
    descendants(c, out)
  }
  return out
}
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    parentNode: null,
    get isConnected() { return this.tagName === 'HTML' || Boolean(this.parentNode && this.parentNode.isConnected) },
    attrs: {},
    style: {},
    dataset: {},
    className: '',
    _text: '',
    get textContent() {
      return this._text + this.children.map(function (c) { return c.textContent }).join('')
    },
    set textContent(v) {
      this.children.length = 0
      this._text = String(v)
    },
    get nextSibling() {
      const parent = this.parentNode
      if (!parent) return null
      const index = parent.children.indexOf(this)
      return index < 0 ? null : (parent.children[index + 1] || null)
    },
    setAttribute: function (k, v) { this.attrs[k] = String(v) },
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null },
    hasAttribute: function (k) { return k in this.attrs },
    removeAttribute: function (k) { delete this.attrs[k] },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c },
    insertBefore: function (c, ref) {
      c.parentNode = this
      const i = ref === null || ref === undefined ? -1 : this.children.indexOf(ref)
      if (i < 0) this.children.push(c)
      else this.children.splice(i, 0, c)
      return c
    },
    removeChild: function (c) {
      const i = this.children.indexOf(c)
      if (i < 0) throw new Error('removeChild: not a child')
      this.children.splice(i, 1)
      c.parentNode = null
      return c
    },
    querySelectorAll: function (sel) { return descendants(this).filter(function (n) { return matches(n, sel) }) },
    querySelector: function (sel) { return this.querySelectorAll(sel)[0] || null },
    closest: function (sel) {
      let n = this
      while (n) { if (matches(n, sel)) return n; n = n.parentNode }
      return null
    },
  }
  return el
}

// One rendered approval card: root[data-approval-key] > card > body > headline.
function buildApprovalCard(headline) {
  const root = makeElement('div')
  root.setAttribute('data-approval-key', 'approval-1')
  const card = makeElement('div')
  const body = makeElement('div')
  body.setAttribute('data-approval-scroll', '')
  const head = makeElement('div')
  head.attrs.class = 'xl_test_headline'
  head.textContent = headline
  body.appendChild(head)
  card.appendChild(body)
  root.appendChild(card)
  return { root: root, body: body, headline: head }
}

function buildDocument() {
  const documentElement = makeElement('html')
  const head = makeElement('head')
  const body = makeElement('body')
  documentElement.appendChild(head)
  documentElement.appendChild(body)
  const document = {
    documentElement: documentElement,
    head: head,
    body: body,
    createElement: makeElement,
    querySelectorAll: function (sel) { return descendants(documentElement).filter(function (n) { return matches(n, sel) }) },
    querySelector: function (sel) { return this.querySelectorAll(sel)[0] || null },
  }
  return { document: document, documentElement: documentElement, body: body }
}

function fakeStorage(preferences) {
  const map = Object.create(null)
  for (const key of Object.keys(preferences || {})) map['dsh-think-translate:' + key] = String(preferences[key])
  return {
    getItem: function (k) { return k in map ? map[k] : null },
    setItem: function (k, v) { map[k] = String(v) },
    removeItem: function (k) { delete map[k] },
  }
}

function flush(timers) {
  const run = timers.splice(0, timers.length)
  for (const fn of run) if (typeof fn === 'function') fn()
}

function loadPlugin(dom, timers, observers, preferences, translate) {
  const storage = fakeStorage(preferences)
  const calls = []
  const sandbox = {
    console,
    setTimeout: function (fn) { timers.push(fn); return timers.length },
    clearTimeout: function (id) { if (id) timers[id - 1] = null },
    setInterval: function () { return 0 },
    clearInterval: function () {},
    localStorage: storage,
    document: dom.document,
    MutationObserver: function (cb) {
      const o = { cb: cb, target: null, disconnected: false, observe: function (t) { this.target = t }, disconnect: function () { this.disconnected = true } }
      observers.push(o)
      return o
    },
    fetch: function (url, init) {
      calls.push({ url: url, body: init && init.body ? JSON.parse(init.body) : null })
      const body = url === '/_xlate/translate'
        ? { ok: true, text: translate ? translate(calls[calls.length - 1].body) : '译文', provider: 'test' }
        : { ok: true }
      return Promise.resolve({ ok: true, status: 200, json: function () {
        return Promise.resolve(body.text).then(function (text) { return { ...body, text } })
      } })
    },
    AbortController,
    URL,
    window: {},
  }
  sandbox.window.__ModuleLoader__ = { load: function (spec) { sandbox.__spec = spec } }
  vm.createContext(sandbox)
  vm.runInContext(SRC, sandbox, { filename: 'lib/client.js' })
  const plugin = sandbox.__spec.factory(function (name) {
    if (name === 'react') {
      return {
        default: {
          createElement: function (type, props, ...children) { return { type, props: props || {}, children: children.flat() } }, Fragment: null,
          useState: function () { return [null, function () {}] }, useEffect: function () {},
          useId: function () { return 'id' }, Component: class {},
        },
      }
    }
    throw new Error('unexpected require: ' + name)
  })
  const disposers = []
  const views = new Map()
  const ctx = {
    slots: {
      inject: function (name, cb) { const d = cb(); if (typeof d === 'function') disposers.push(d); return d },
      register: function (spec, component) { views.set(spec.name, component); return function () {} },
    },
    effect: function (fn) { const d = fn(); if (typeof d === 'function') disposers.push(d); return d },
  }
  plugin.apply(ctx)
  function changeSetting(name, value) {
    const tree = views.get('settings.section')()
    const labels = tree.children.filter(node => node.type === 'label')
    const label = labels.find(node => node.children.some(child => child.type === 'span' && child.children.includes(name)))
    assert.ok(label, 'setting is rendered: ' + name)
    const control = label.children.find(child => child.type === 'input' || child.type === 'select')
    control.props.onChange({ target: { value, checked: value } })
  }
  return { disposers, calls, observers, changeSetting }
}

async function settle(timers, predicate) {
  for (let i = 0; i < 60; i++) {
    flush(timers)
    const value = predicate()
    if (value) return value
    await new Promise(function (resolve) { setTimeout(resolve, 2) })
  }
  return predicate()
}

function translateCalls(calls) {
  return calls.filter(function (c) { return c.url === '/_xlate/translate' })
}

function reviewBlock(card) {
  return card.root.querySelector('[data-xl-review-block]')
}

const REASON = 'Deleting files outside the session-created scope is irreversible.'
const ZH_HEADLINE = 'Auto review 拒绝了此调用：' + REASON
const EN_HEADLINE = 'Auto review denied this call: ' + REASON
const ZH_TRANSLATED = '删除会话创建范围之外的文件是不可逆的。'

function pendingApproval() {
  const dom = buildDocument(), timers = [], observers = []
  const card = buildApprovalCard(ZH_HEADLINE)
  dom.body.appendChild(card.root)
  let resolve
  const result = new Promise(done => { resolve = done })
  const plugin = loadPlugin(dom, timers, observers, {}, body => body.target === 'en' ? REASON : result)
  flush(timers)
  assert.equal(translateCalls(plugin.calls).length, 1, 'translation is in flight')
  return { dom, timers, observers, card, plugin, resolve }
}

describe('auto-review denial reason translation', function () {
  it('ignores an in-flight result after the user turns translation off', async function () {
    const f = pendingApproval()
    f.plugin.changeSetting('翻译自动审查的拒绝原因', false)
    flush(f.timers)
    f.resolve(ZH_TRANSLATED)
    await settle(f.timers, () => null)
    assert.equal(reviewBlock(f.card), null)
  })

  it('invalidates a response even before the debounced DOM scan runs', async function () {
    const f = pendingApproval()
    f.plugin.changeSetting('翻译自动审查的拒绝原因', false)
    f.resolve(ZH_TRANSLATED)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(Boolean(reviewBlock(f.card)), false)
  })

  it('ignores an old result when the target changes to the original language', async function () {
    const f = pendingApproval()
    f.plugin.changeSetting('目标语言', 'en')
    flush(f.timers)
    f.resolve(ZH_TRANSLATED)
    await settle(f.timers, () => null)
    assert.equal(Boolean(reviewBlock(f.card)), false, 'Chinese result never appears under the English target')
    assert.ok(translateCalls(f.plugin.calls).some(call => call.body.target === 'en'))
  })

  for (const reason of [
    'Эта операция удалит важные файлы без возможности восстановления.',
    '이 작업은 중요한 파일을 영구적으로 삭제합니다.',
    'Cette opération supprimera définitivement les fichiers importants.',
  ]) {
    it('translates non-English reasons to English: ' + reason, async function () {
      const dom = buildDocument(), timers = [], observers = []
      const card = buildApprovalCard('Auto review denied this call: ' + reason)
      dom.body.appendChild(card.root)
      const translated = 'This operation permanently deletes important files.'
      const plugin = loadPlugin(dom, timers, observers, { lang: 'en' }, () => translated)
      const block = await settle(timers, () => reviewBlock(card))
      assert.ok(block)
      assert.equal(block.children[1].textContent, translated)
      assert.equal(translateCalls(plugin.calls)[0].body.text, reason)
    })
  }

  it('drops the first request when the setting is turned off and back on', async function () {
    const f = pendingApproval()
    f.plugin.changeSetting('翻译自动审查的拒绝原因', false)
    flush(f.timers)
    f.plugin.changeSetting('翻译自动审查的拒绝原因', true)
    flush(f.timers)
    f.resolve(ZH_TRANSLATED)
    const block = await settle(f.timers, () => reviewBlock(f.card))
    assert.ok(block)
    assert.equal(f.card.root.querySelectorAll('[data-xl-review-block]').length, 1)
    assert.equal(translateCalls(f.plugin.calls).length, 1, 'shared pending request is reused')
  })

  it('ignores an in-flight result after the card is detached or disposed', async function () {
    for (const dispose of [false, true]) {
      const f = pendingApproval()
      if (dispose) for (const cleanup of f.plugin.disposers) cleanup()
      else f.dom.body.removeChild(f.card.root)
      f.resolve(ZH_TRANSLATED)
      await settle(f.timers, () => null)
      assert.equal(reviewBlock(f.card), null)
    }
  })

  it('does not append an old reason after the headline changes before the observer runs', async function () {
    const f = pendingApproval()
    f.card.headline.textContent = 'The sandbox blocked this command: workspace access required.'
    f.resolve(ZH_TRANSLATED)
    await settle(f.timers, () => null)
    assert.equal(reviewBlock(f.card), null)
  })

  it('does not mistake another Auto review message for a denial', async function () {
    const dom = buildDocument(), timers = [], observers = []
    const card = buildApprovalCard('Auto review configuration: choose a permission policy.')
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, () => ZH_TRANSLATED)
    await settle(timers, () => null)
    assert.equal(reviewBlock(card), null)
    assert.equal(translateCalls(plugin.calls).length, 0)
  })

  it('keeps the original headline when the provider fails', async function () {
    const dom = buildDocument(), timers = [], observers = []
    const card = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(card.root)
    loadPlugin(dom, timers, observers, {}, () => Promise.reject(new Error('provider unavailable')))
    await settle(timers, () => null)
    assert.equal(reviewBlock(card), null)
    assert.equal(card.headline.textContent, ZH_HEADLINE)
  })

  it('appends a translated reason below the Auto review headline (zh shell)', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })

    const block = await settle(timers, function () { return reviewBlock(card) })
    assert.ok(block, 'the translated block is inserted')
    assert.equal(card.headline.nextSibling, block, 'it sits directly under the headline')
    assert.match(block.className, /xl-review-xlate/, 'it carries the plugin style')
    const label = block.querySelector('[data-xl-review-block]') || block
    assert.equal(label, block)
    // label + translated text nodes, in that order
    assert.equal(block.children.length, 2, 'label and translated text')
    assert.equal(block.children[0].textContent, '自动审查拒绝原因')
    assert.equal(block.children[1].textContent, ZH_TRANSLATED)

    const sent = translateCalls(plugin.calls)
    assert.equal(sent.length, 1, 'exactly one translation request')
    assert.equal(sent[0].body.text, REASON, 'the localized prefix is never sent')
    assert.equal(sent[0].body.target, 'zh-CN')
    // The official headline is untouched: the plugin only appends.
    assert.equal(card.headline.textContent, ZH_HEADLINE)
  })

  it('handles the English shell headline too', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard(EN_HEADLINE)
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })

    const block = await settle(timers, function () { return reviewBlock(card) })
    assert.ok(block, 'translated')
    assert.equal(block.children[1].textContent, ZH_TRANSLATED)
    const sent = translateCalls(plugin.calls)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].body.text, REASON)
  })

  it('leaves every other approval prompt alone', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard('The sandbox blocked this command: it writes outside the workspace.')
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })

    await settle(timers, function () { return null })
    assert.equal(reviewBlock(card), null, 'no block for a non-Auto-review prompt')
    assert.equal(translateCalls(plugin.calls).length, 0, 'and no translation request')
  })

  it('skips a headline that carries no reason', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard('Auto review 拒绝了此调用。')
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })

    await settle(timers, function () { return null })
    assert.equal(reviewBlock(card), null)
    assert.equal(translateCalls(plugin.calls).length, 0)
  })

  it('does not duplicate the block when the card re-renders', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })
    await settle(timers, function () { return reviewBlock(card) })

    // A later shell mutation touches the card (e.g. aria-busy while answering).
    observers[1].cb([{ target: card.root, addedNodes: [] }])
    await settle(timers, function () { return null })
    assert.equal(card.root.querySelectorAll('[data-xl-review-block]').length, 1, 'exactly one block')
    assert.equal(translateCalls(plugin.calls).length, 1, 'the cached translation is reused')
  })

  it('re-decorates a remounted card', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const first = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(first.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })
    await settle(timers, function () { return reviewBlock(first) })

    // The shell unmounts the whole card and mounts a fresh one for a new request.
    dom.body.removeChild(first.root)
    const second = buildApprovalCard('Auto review denied this call: force-pushing over main rewrites history.')
    dom.body.appendChild(second.root)
    observers[1].cb([{ target: dom.body, addedNodes: [second.root] }])
    const block = await settle(timers, function () { return reviewBlock(second) })
    assert.ok(block, 'the new card is translated')
    assert.equal(translateCalls(plugin.calls).length, 2)
  })

  it('skips a reason already written in the target language', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard('Auto review 拒绝了此调用：该操作会删除生产数据库。')
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return '不应出现' })

    await settle(timers, function () { return null })
    assert.equal(reviewBlock(card), null, 'no redundant block')
    assert.equal(translateCalls(plugin.calls).length, 0, 'needsTranslate keeps it local')
  })

  it('does nothing when the setting is off', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, { review: 'false' }, function () { return ZH_TRANSLATED })

    await settle(timers, function () { return null })
    assert.equal(reviewBlock(card), null)
    assert.equal(translateCalls(plugin.calls).length, 0)
  })

  it('removes the block and the observer when the plugin is disposed', async function () {
    const dom = buildDocument()
    const timers = [], observers = []
    const card = buildApprovalCard(ZH_HEADLINE)
    dom.body.appendChild(card.root)
    const plugin = loadPlugin(dom, timers, observers, {}, function () { return ZH_TRANSLATED })
    await settle(timers, function () { return reviewBlock(card) })

    for (const dispose of plugin.disposers) dispose()
    assert.equal(reviewBlock(card), null, 'the block is removed')
    assert.equal(observers[1].disconnected, true, 'the approval observer is disconnected')
  })
})
