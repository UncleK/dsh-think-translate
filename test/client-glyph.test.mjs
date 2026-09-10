// The settings-nav glyph fallback mutates SHELL chrome, so it gets its own test
// with a hand-rolled DOM: the shell's own <svg> must stay in the tree (React keeps
// a reference to it — replacing it leaves React patching a detached node), the
// decoration must be idempotent, and disposal must put the shell's glyph back.
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
    const v = el.attrs[attr[1]]
    if (v === undefined) return false
    return attr[2] === undefined || v === attr[2]
  }
  return el.tagName === sel.toUpperCase()
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
  return {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    children: [],
    parentNode: null,
    attrs: {},
    style: {},
    dataset: {},
    ownText: '',
    get textContent() {
      return this.ownText + this.children.map(function (c) { return c.textContent }).join('')
    },
    get lastElementChild() {
      const els = this.children.filter(function (c) { return c.nodeType === 1 })
      return els.length ? els[els.length - 1] : null
    },
    setAttribute: function (k, v) { this.attrs[k] = String(v) },
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null },
    removeAttribute: function (k) { delete this.attrs[k] },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c },
    insertBefore: function (c, ref) {
      const i = this.children.indexOf(ref)
      c.parentNode = this
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
    set innerHTML(v) { this._html = v },
    get innerHTML() { return this._html || '' },
  }
}

function buildDom() {
  const documentElement = makeElement('html')
  const body = makeElement('body')
  documentElement.appendChild(body)
  const nav = makeElement('nav')
  body.appendChild(nav)

  const makeButton = function (title, tag) {
    const btn = makeElement('button')
    const icon = makeElement(tag || 'svg')
    icon.setAttribute('class', 'shell-icon')
    const label = makeElement('span')
    label.ownText = title
    btn.appendChild(icon)
    btn.appendChild(label)
    nav.appendChild(btn)
    return { btn: btn, icon: icon, label: label }
  }

  const ours = makeButton('思考链翻译')
  const other = makeButton('通用设置')
  const head = makeElement('head')
  documentElement.appendChild(head)
  const document = {
    documentElement: documentElement,
    body: body,
    head: head,
    createElement: makeElement,
    querySelectorAll: function (sel) { return descendants(documentElement).filter(function (n) { return matches(n, sel) }) },
    querySelector: function (sel) { return this.querySelectorAll(sel)[0] || null },
  }
  return { document: document, ours: ours, other: other, nav: nav }
}

function loadPlugin(dom, timers, observers) {
  const sandbox = {
    console,
    setTimeout: function (fn) { timers.push(fn); return timers.length },
    clearTimeout: function (id) { if (id) timers[id - 1] = null },
    setInterval: function () { return 0 },
    clearInterval: function () {},
    localStorage: { getItem: function () { return null }, setItem: function () {}, removeItem: function () {} },
    document: dom.document,
    MutationObserver: function (cb) {
      const o = { cb: cb, target: null, disconnected: false, observe: function (t) { this.target = t }, disconnect: function () { this.disconnected = true } }
      observers.push(o)
      return o
    },
    window: {},
  }
  sandbox.window.__ModuleLoader__ = { load: function (spec) { sandbox.__spec = spec } }
  vm.createContext(sandbox)
  vm.runInContext(SRC, sandbox, { filename: 'lib/client.js' })
  const plugin = sandbox.__spec.factory(function (name) {
    if (name === 'react') {
      return {
        default: {
          createElement: function () { return null }, Fragment: null,
          useState: function () { return [null, function () {}] }, useEffect: function () {},
          useId: function () { return 'id' }, Component: class {},
        },
      }
    }
    throw new Error('unexpected require: ' + name)
  })
  const disposers = []
  const ctx = {
    slots: { inject: function (name, cb) { const d = cb(); if (typeof d === 'function') disposers.push(d); return d }, register: function () { return function () {} } },
    effect: function (fn) { const d = fn(); if (typeof d === 'function') disposers.push(d); return d },
  }
  plugin.apply(ctx)
  return { disposers: disposers }
}

function flush(timers) {
  const run = timers.splice(0, timers.length)
  for (const fn of run) if (typeof fn === 'function') fn()
}

describe('settings nav glyph fallback', function () {
  it('puts its own glyph in place without removing the shell’s node', function () {
    const dom = buildDom()
    const timers = [], observers = []
    loadPlugin(dom, timers, observers)
    assert.equal(observers.length, 1, 'one observer')
    assert.equal(observers[0].target, dom.document.documentElement, 'observes the root, not <body>')
    flush(timers)

    const holder = dom.ours.btn.querySelector('[data-xl-nav-glyph="1"]')
    assert.ok(holder, 'the plugin glyph is inserted')
    assert.equal(dom.ours.btn.children[0], holder, 'it takes the icon slot')
    assert.equal(dom.ours.btn.children[1], dom.ours.icon, 'the shell svg stays in the tree')
    assert.equal(dom.ours.icon.parentNode, dom.ours.btn, 'and keeps its parent')
    assert.equal(dom.ours.icon.style.display, 'none', 'but is hidden')
    assert.equal(holder.getAttribute('class'), 'shell-icon', 'it carries the shell class')
    assert.match(holder.innerHTML, /<svg/, 'and the inline book')

    assert.equal(dom.other.btn.querySelector('[data-xl-nav-glyph="1"]'), null, 'another section is untouched')
    assert.equal(dom.other.icon.style.display, undefined, 'and keeps its own glyph visible')
  })

  it('is idempotent and self-heals when the shell re-renders its icon', function () {
    const dom = buildDom()
    const timers = [], observers = []
    loadPlugin(dom, timers, observers)
    flush(timers)
    flush(timers)

    const count = function () { return dom.ours.btn.querySelectorAll('[data-xl-nav-glyph="1"]').length }
    assert.equal(count(), 1, 'no second glyph after another pass')

    // the shell swaps in a fresh icon (new element, same button)
    const fresh = makeElement('svg')
    fresh.setAttribute('class', 'shell-icon')
    dom.ours.btn.insertBefore(fresh, dom.ours.icon)
    dom.ours.btn.removeChild(dom.ours.icon)
    observers[0].cb([{ target: dom.nav, addedNodes: [fresh] }])
    flush(timers)

    assert.equal(count(), 1, 'still exactly one plugin glyph')
    assert.equal(fresh.style.display, 'none', 'the new shell glyph is hidden too')
    assert.equal(dom.ours.btn.children[1], fresh, 'and stays in the tree')
  })

  it('restores the shell glyph when the plugin is disposed', function () {
    const dom = buildDom()
    const timers = [], observers = []
    const h = loadPlugin(dom, timers, observers)
    flush(timers)
    assert.ok(dom.ours.btn.querySelector('[data-xl-nav-glyph="1"]'), 'decorated first')

    for (const d of h.disposers) d()
    assert.equal(dom.ours.btn.querySelector('[data-xl-nav-glyph="1"]'), null, 'the plugin glyph is removed')
    assert.equal(dom.ours.icon.style.display, '', 'the shell glyph is visible again')
    assert.equal(dom.ours.icon.getAttribute('data-xl-nav-glyph-hidden'), null, 'and unmarked')
    assert.equal(observers[0].disconnected, true, 'the observer is disconnected')
  })
})
