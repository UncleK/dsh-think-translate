import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parseGlossaryText, serializeGlossary, normalizeGlossaryPatch, glossaryEntriesForTarget, translateWithGlossary, splitGlossaryText } from '../lib/glossary.js'
import { ADAPTERS, runChainFor, translateViaChain, translationLanguageError } from '../lib/index.js'
import { translationNamespace } from '../lib/runtime-state.js'

const entries = [{ source: 'agent', target: '智能体' }, { source: 'task', target: '任务' }, { source: 'task card', target: '任务卡片' }]
const glossary = { enabled: true, entries: { 'zh-CN': entries, ja: [{ source: 'agent', target: 'エージェント' }] } }

it('parses blank lines and CRLF, trims pairs, and preserves literal regex/replacement characters', () => {
  const parsed = parseGlossaryText('\r\n C++ => C++语言 \r\n\r\nfoo.bar => $& 字面量\r\n')
  assert.deepEqual(parsed, [{ source: 'C++', target: 'C++语言' }, { source: 'foo.bar', target: '$& 字面量' }])
  assert.equal(serializeGlossary(parsed), 'C++ => C++语言\nfoo.bar => $& 字面量')
})

for (const [name, text, code, line] of [
  ['missing separator', 'agent', 'FORMAT', 1],
  ['empty source', ' => 智能体', 'FORMAT', 1],
  ['empty target', 'agent => ', 'FORMAT', 1],
  ['case-insensitive duplicate after blank line', 'agent => 智能体\n\nAGENT => 代理', 'DUPLICATE', 3],
  ['long source', 'a'.repeat(129) + ' => x', 'LIMIT', 1],
  ['long target', 'agent => ' + 'x'.repeat(257), 'LIMIT', 1],
  ['control character', 'agent => a\u0000b', 'FORMAT', 1],
]) it('rejects ' + name + ' with an actionable line number', () => {
  assert.throws(() => parseGlossaryText(text), error => error.code === 'GLOSSARY_' + code && error.line === line)
})

it('bounds entry count and validates target-language maps and enabled flags', () => {
  assert.throws(() => parseGlossaryText(Array.from({ length: 129 }, (_, i) => 'term' + i + ' => x').join('\n')), { code: 'GLOSSARY_LIMIT' })
  for (const value of [null, [], { enabled: 'true' }, { entries: [] }, { entries: { unknown: [] } }, { entries: JSON.parse('{"__proto__":[]}') }]) {
    assert.throws(() => normalizeGlossaryPatch(value))
  }
  assert.deepEqual(normalizeGlossaryPatch({ entries: { ja: [] } }), { entries: { ja: [] } })
})

it('keeps each language separate, supports aliases, and respects the global disable switch', () => {
  for (const target of ['zh', 'zh-CN', 'zh_Hans_CN', 'zh-Hans-HK']) assert.deepEqual(glossaryEntriesForTarget(glossary, target), entries)
  for (const target of ['zh-TW', 'zh-Hant', 'zh-Hant-CN', 'en', 'unknown']) assert.deepEqual(glossaryEntriesForTarget(glossary, target), [])
  assert.equal(glossaryEntriesForTarget(glossary, 'ja-JP')[0].target, 'エージェント')
  assert.deepEqual(glossaryEntriesForTarget({ ...glossary, enabled: false }, 'zh-CN'), [])
})

it('matches longest terms first, ignores case and avoids English word interiors', async () => {
  let request
  const result = await translateWithGlossary('Use AGENT for the task card, task and agentic behavior.', entries, async value => { request = value; return value })
  assert.equal(result.text, 'Use 智能体 for the 任务卡片, 任务 and agentic behavior.')
  assert.equal(request.includes('AGENT'), false)
  assert.equal(request.includes('task card'), false)
  assert.equal(request.includes('agentic'), true)
  assert.deepEqual(result.targets, ['智能体', '任务卡片', '任务'])
})

it('reorders tokens with translated grammar and restores repeated terms without leaking tokens', async () => {
  const result = await translateWithGlossary('agent meets agent', entries, async value => {
    const tokens = value.match(/ZXQ\w+?QXZ/g)
    return tokens[1].toLowerCase() + '遇到' + tokens[0]
  })
  assert.equal(result.text, '智能体遇到智能体')
  assert.deepEqual(result.targets, ['智能体'])
})

it('uses literal terms and replacements and avoids collisions with source or target marker-like text', async () => {
  const result = await translateWithGlossary('ZXQG text: C++ and foo.bar.', [
    { source: 'C++', target: 'C++语言' }, { source: 'foo.bar', target: 'zxqg $&' },
  ], async value => value)
  assert.equal(result.text, 'ZXQG text: C++语言 and zxqg $&.')
})

for (const [name, damage] of [
  ['removed token', value => value.replace(/ZXQ\w+?QXZ/, '')],
  ['duplicate token', value => value + value.match(/ZXQ\w+?QXZ/)[0]],
  ['unknown token', value => value + ' ZXQG999QXZ'],
  ['rewritten token', value => value.replace('QXZ', 'broken')],
]) it('rejects a provider that returns a ' + name, async () => {
  await assert.rejects(translateWithGlossary('Use agent now.', entries, async value => damage(value)), /glossary token/)
})

it('keeps code, paths, URLs and commands outside glossary replacement through the actual provider chain', async t => {
  const payloads = []
  ADAPTERS['glossary-test'] = async value => { payloads.push(value); return value.replace('Please use', '请使用').replace('and check', '并检查') }
  t.after(() => { delete ADAPTERS['glossary-test'] })
  const config = { chain: ['test'], glossary, providers: { test: { enabled: true, type: 'glossary-test' } } }
  const text = 'Please use agent and check `agent`.\n```js\nconst agent = 1;\n```\nE:\\agent\\config.json\nhttps://example.test/agent\ngit status --short\n'
  const result = await runChainFor(['test'], text, 'zh-CN', config)
  assert.equal(result.ok, true)
  for (const code of ['`agent`', 'const agent = 1;', 'E:\\agent\\config.json', 'https://example.test/agent', 'git status --short']) assert.ok(result.text.includes(code))
  assert.ok(result.text.includes('智能体'))
  assert.ok(payloads.every(value => !value.includes('const agent') && !value.includes('https://') && !value.includes('E:\\')))
})

it('falls back to the next enabled provider when terminology tokens are damaged', async t => {
  const calls = []
  ADAPTERS['glossary-bad'] = async value => { calls.push('bad'); return value.replace(/ZXQ\w+?QXZ/g, '') }
  ADAPTERS['glossary-good'] = async value => { calls.push('good'); return value.replace('Please use', '请使用') }
  t.after(() => { delete ADAPTERS['glossary-bad']; delete ADAPTERS['glossary-good'] })
  const cfg = { chain: ['bad', 'good'], glossary, providers: { bad: { enabled: true, type: 'glossary-bad' }, good: { enabled: true, type: 'glossary-good' } } }
  const result = await translateViaChain('Please use agent.', 'zh-CN', cfg)
  assert.equal(result.provider, 'good')
  assert.ok(result.text.includes('智能体'))
  assert.deepEqual(calls, ['bad', 'good'])
  cfg.chain = ['bad']
  const failed = await translateViaChain('Please use agent.', 'zh-CN', cfg)
  assert.equal(failed.ok, false)
  assert.equal(failed.text, 'Please use agent.')
  assert.equal(failed.text.includes('ZXQG'), false)
})

it('allows explicitly fixed foreign-language phrases without relaxing other language checks', () => {
  const phrase = 'This is the exact product name with English words'
  assert.ok(translationLanguageError(phrase, 'zh-CN'))
  assert.equal(translationLanguageError(phrase, 'zh-CN', [phrase]), null)
  assert.ok(translationLanguageError(phrase + ' and this is the wrong English response because it should be translated.', 'zh-CN', [phrase]))
})

it('invalidates caches when a glossary language, mapping or enabled flag changes', () => {
  const cfg = { chain: [], providers: {}, glossary }
  const first = translationNamespace(cfg)
  for (const change of [next => next.glossary.enabled = false, next => next.glossary.entries['zh-CN'][0].target = '代理', next => next.glossary.entries.ja = []]) {
    const next = structuredClone(cfg); change(next)
    assert.notEqual(translationNamespace(next), first)
  }
})

it('does not split a matched phrase at a long-input boundary', () => {
  const text = 'A'.repeat(1194) + ' task card ' + 'B'.repeat(1300)
  const chunks = splitGlossaryText(text, entries, value => [value])
  assert.equal(chunks.join(''), text)
  assert.ok(chunks.every(chunk => chunk.length <= 1200))
  assert.ok(chunks.some(chunk => chunk.includes('task card')))
})

it('keeps chunk limits at paragraph edges and does not split Unicode surrogate pairs', () => {
  for (const text of ['A'.repeat(1200) + '\n\n' + 'B'.repeat(1300), 'A'.repeat(1199) + '😀' + 'B'.repeat(1300)]) {
    const chunks = splitGlossaryText(text, entries, value => [value])
    assert.equal(chunks.join(''), text)
    assert.ok(chunks.every(chunk => chunk.length <= 1200 && !/[\uD800-\uDBFF]$/.test(chunk) && !/^[\uDC00-\uDFFF]/.test(chunk)))
  }
})

it('keeps the standalone client parser and validation behavior in parity with the Host', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const box = vm.createContext({})
  vm.runInContext(source.slice(source.indexOf('const GLOSSARY_LANGUAGES'), source.indexOf('var mem = new Map();')), box)
  const text = '\n DeepSeek => DeepSeek\nagent => 智能体\n'
  assert.deepEqual(JSON.parse(JSON.stringify(box.parseGlossaryText(text))), parseGlossaryText(text))
  assert.equal(box.serializeGlossary(entries), serializeGlossary(entries))
  assert.throws(() => box.parseGlossaryText('agent => x\nAGENT => y'), error => error.code === 'GLOSSARY_DUPLICATE' && error.line === 2)
})
