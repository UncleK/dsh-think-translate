import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { protectedTextParts, translateProtectedText } from '../lib/text.js'
import { ADAPTERS, runChainFor, translateViaChain, chunkText, needsTranslate } from '../lib/index.js'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
function between(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start)
  return source.slice(start, end)
}
const client = vm.createContext({})
vm.runInContext(between('function protectedTextParts(', 'function isCjk('), client)
vm.runInContext(between('function splitSentences(', 'var XL_STREAM_MARGIN'), client)

const samples = [
  ['inline', 'Check `const 中文 = "secret"` now.', ['`const 中文 = "secret"`']],
  ['multiple inline delimiters', 'Read ``a ` nested tick`` and `other()`.', ['``a ` nested tick``', '`other()`']],
  ['multiline inline', 'Read `first\nsecond` now.', ['`first\nsecond`']],
  ['fenced CRLF', 'Before.\r\n```js\r\nconst 中文 = "secret";\r\n```\r\nAfter.', ['```js\r\nconst 中文 = "secret";\r\n```\r\n']],
  ['long fence', 'Before.\n```js\n' + 'const key = "secret";\n'.repeat(300) + '```\nAfter.', ['```js\n' + 'const key = "secret";\n'.repeat(300) + '```\n']],
  ['longer fence with nested shorter fence', 'Before.\n````md\n```js\nconst key = 1;\n```\n````\nAfter.', ['````md\n```js\nconst key = 1;\n```\n````\n']],
  ['list fence with ticks in code', 'Before.\n- ```js\n  const secret = "```";\n  ```\nAfter.', ['- ```js\n  const secret = "```";\n  ```\n']],
  ['tilde fence', 'Before.\n~~~python\nsecret = "中文"\n~~~\nAfter.', ['~~~python\nsecret = "中文"\n~~~\n']],
  ['indented fence', 'Before.\n  ```sh\n  echo secret\n  ```\nAfter.', ['  ```sh\n  echo secret\n  ```\n']],
  ['quoted fence', 'Before.\n> ```sh\n> echo secret\n> ```\nAfter.', ['> ```sh\n> echo secret\n> ```\n']],
  ['indented code', 'Before.\n    const key = "secret";\nAfter.', ['    const key = "secret";\n']],
  ['four-space nested list', 'Plan:\n1. First step\n    - Read the configuration carefully\n    - Then compare the results\n2. Second step\n', []],
  ['tab nested list', 'Plan:\n- First step\n\t- Read the configuration carefully\n- Second step\n', []],
  ['CRLF nested list', 'Plan:\r\n- First step\r\n    - Read the configuration carefully\r\n- Second step\r\n', []],
  ['deeply nested list', '- First\n    - Second\n        - Third\n            - Fourth\n    1. Fifth\n', []],
  ['loose nested list', '1. First step\n\n    - Read the configuration carefully\n', []],
  ['nested list under a line with inline code', '- Read `secret()` first\n    - Then compare the results\n', ['`secret()`']],
  ['code inside a nested list item', '- Read the notes\n    - Open ./secret/app.json now\n', ['./secret/app.json']],
  ['indented YAML is not a nested list', 'Config:\n\n    - name: secret-key\n      run: deploy\n\nDone.\n', ['    - name: secret-key\n', '      run: deploy\n']],
  ['indented diff is not a nested list', 'Patch:\n\n    - const secret = old;\n    + const secret = neu;\n\nDone.\n', ['    - const secret = old;\n', '    + const secret = neu;\n']],
  ['indented YAML split by blank lines', 'Config:\n\n    - name: secret-a\n\n    - name: secret-b\n\nDone.\n', ['    - name: secret-a\n', '    - name: secret-b\n']],
  ['indented code after a list item', '- First step\n    const secret = 1;\nDone.\n', ['    const secret = 1;\n']],
  ['indented first line is not trusted as a parent', ' - First step\n    - name: secret-key\nDone.\n', ['    - name: secret-key\n']],
  ['code block indented past its list item', '1. Update the config:\n\n        - name: secret-key\n          run: deploy\n\nDone.\n', ['        - name: secret-key\n', '          run: deploy\n']],
  ['unfinished fence', 'Before.\n```js\nconst key = "secret"', ['```js\nconst key = "secret"']],
  ['unfinished inline', 'Before `const key = "secret"', ['`const key = "secret"']],
  ['bare Windows path', 'Open E:\\VP\\project\\config.json and continue.', ['E:\\VP\\project\\config.json']],
  ['quoted path with spaces', 'Open "C:\\Program Files\\App\\config.json" now.', ['"C:\\Program Files\\App\\config.json"']],
  ['closing quote at the end of its line', 'Open "./a b/c"\nThen continue.', ['"./a b/c"']],
  ['unclosed quote before a path', "Check the './foo directory first.\n\nThen read the next paragraph.", ['./foo']],
  ['quote closing only in a later paragraph', 'I think "./foo is the right place.\n\nThe docs say "hello" here.', ['./foo']],
  ['apostrophe on a later line', "The path '/etc/app is wrong.\nIt doesn't exist here.", ['/etc/app']],
  ['mismatched curly quote', '路径是“./foo/bar" 然后继续。\n\n第二段也要翻译。', ['./foo/bar']],
  ['unclosed quote before a Windows path', 'The value "C:\\Users\\me is what we picked.\n\nNext paragraph.', ['C:\\Users\\me']],
  ['UNC path', 'Read \\\\server\\share\\data.json now.', ['\\\\server\\share\\data.json']],
  ['POSIX and relative paths', 'Open /workspace/app/config.json, then ./src/main.ts.', ['/workspace/app/config.json', './src/main.ts']],
  ['URL with Markdown delimiter', 'Read [the guide](https://example.test/docs?q=1&x=2).', ['https://example.test/docs?q=1&x=2']],
  ['balanced URL parentheses', 'Read https://example.test/a(b) now.', ['https://example.test/a(b)']],
  ['bare commands', 'Please run npm test and git status --short, then check results.', ['npm test', 'git status --short']],
  ['build command', 'Run pnpm run build -- --serial before continuing.', ['pnpm run build -- --serial']],
  ['file name', 'Inspect runtime_config.json before continuing.', ['runtime_config.json']],
  ['standalone commands with arguments', 'Before.\nnpm install foo && npm test\nAfter.', ['npm install foo && npm test\n']],
  ['path adjacent to Chinese prose', '读取E:\\VP\\project\\config.json，然后检查结果。', ['E:\\VP\\project\\config.json']],
]

for (const [label, text, codes] of samples) {
  it('preserves exact code and excludes it from provider payloads: ' + label, async () => {
    const parts = protectedTextParts(text)
    assert.equal(parts.map(part => part.text).join(''), text)
    assert.deepEqual(parts.filter(part => part.code).map(part => part.text), codes)
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), parts)
    const payloads = []
    const result = await translateProtectedText(text, async prose => { payloads.push(prose); return '译文' }, chunkText)
    assert.ok(payloads.length > 0)
    assert.ok(payloads.every(payload => !payload.includes('secret') && !payload.includes('const 中文')))
    for (const code of codes) assert.ok(result.includes(code), 'code changed: ' + label)
    const batches = JSON.parse(JSON.stringify(client.splitSentences(text)))
    assert.equal(batches.map(batch => batch.text).join(''), text)
    assert.deepEqual(batches.filter(batch => batch.code).map(batch => batch.text), codes)
  })
}

it('keeps ordinary prose, dates and words containing command names translatable', () => {
  const text = 'The digital assistant starts working on 2026-11-04. Please install the application and continue.'
  assert.equal(protectedTextParts(text).some(part => part.code), false)
})

it('preserves whitespace around inline code without provider placeholders', async () => {
  const seen = []
  const result = await translateProtectedText('  First `x()` then  `y()`!\n', async text => {
    seen.push(text)
    return text === 'First' ? '首先' : '然后'
  })
  assert.deepEqual(seen, ['First', 'then'])
  assert.equal(result, '  首先 `x()` 然后  `y()`!\n')
})

it('keeps escaped backticks as prose and consumes matching multi-backtick spans', () => {
  const text = 'An escaped \\` mark, followed by ``a ` b``.'
  assert.deepEqual(protectedTextParts(text).filter(part => part.code).map(part => part.text), ['``a ` b``'])
})

it('does not send code-only inputs or unfinished code to a provider', async () => {
  for (const text of ['```js\nconst secret = "中文";\n```', '~~~sh\necho secret\n~~~', '`const secret = 1;', '    const secret = 1;\n']) {
    assert.equal(needsTranslate(text, 'ja'), false)
    assert.equal(await translateProtectedText(text, () => { throw new Error('code reached provider') }), text)
  }
})

it('holds an unfinished streaming code span until its closing delimiter arrives', () => {
  const prefix = 'Before.\n```js\nconst value = 1;\n'
  const unfinished = client.splitSentences(prefix).find(part => part.code)
  const finished = client.splitSentences(prefix + '```\nAfter.').find(part => part.code)
  assert.equal(unfinished.complete, false)
  assert.equal(finished.complete, true)
  assert.equal(unfinished.start, finished.start)
  assert.equal(finished.text, '```js\nconst value = 1;\n```\n')
})

it('holds a streaming quoted path while its line is still open', () => {
  const codes = text => JSON.parse(JSON.stringify(client.splitSentences(text))).filter(part => part.code).map(part => part.text)
  assert.deepEqual(codes('Open "C:\\Program Files\\Ap'), ['"C:\\Program Files\\Ap'])
  assert.deepEqual(codes('Open "C:\\Program Files\\App\\config.json" now.'), ['"C:\\Program Files\\App\\config.json"'])
  assert.deepEqual(codes('Open "C:\\Program Files\\Ap\nNext line.'), ['C:\\Program'])
})

// Replays the shipped ThinkRow loop. The browser parses the whole text, the Host one batch.
// With a step the text grows by that many characters per loop pass, as it does while streaming.
async function runThinkRow(text, batchChars = 1, step = 0) {
  const row = source.slice(source.indexOf('function ThinkRow('))
  const start = row.indexOf('var alive = true;'), end = row.indexOf('return function () { alive = false;')
  const seen = [], batches = []
  const tRef = { current: { segIdx: 0, transText: '', done: false, failed: false, busy: false } }
  const stateRef = { current: null }
  let length = 0
  const advance = () => {
    length = step ? length + step : text.length
    stateRef.current = { text: text.slice(0, length), running: length < text.length }
  }
  advance()
  Object.assign(client, {
    tRef, stateRef, lang: 'zh-CN',
    XL_STREAM_MARGIN: 120, XL_STREAM_MIN_BATCH: 24, XL_BATCH_CHARS: batchChars,
    mutate: fn => { tRef.current = fn(tRef.current) },
    sleepMs: async () => { advance() },
    requestTranslate: async batch => {
      batches.push({ text: batch, running: stateRef.current.running })
      advance()
      return { ok: true, text: await translateProtectedText(batch, async prose => { seen.push(prose); return '[T]' + prose }) }
    },
  })
  await vm.runInContext(row.slice(start, end), client)
  return { seen, batches, shown: tRef.current.transText }
}

it('translates a nested list line that opens a batch', async () => {
  const nested = await runThinkRow('1. First step\n    - Read the notes\n    - Compare the results\n2. Second step\n')
  assert.deepEqual(nested.seen, ['1. First step', '- Read the notes', '- Compare the results', '2. Second step'])
  assert.equal(nested.shown, '[T]1. First step\n    [T]- Read the notes\n    [T]- Compare the results\n[T]2. Second step\n')
})

it('does not send indented code when a batch opens on it or in the middle of a line', async () => {
  const yaml = await runThinkRow('Config:\n\n    - name: secret-key\n    - name: secret-other\n\nDone.\n')
  assert.ok(yaml.seen.every(prose => !prose.includes('secret')))
  const midLine = await runThinkRow('A long enough sentence for its own batch; - then the config\n    - name: secret-key\nDone.\n', 40)
  assert.ok(midLine.seen.every(prose => !prose.includes('secret')))
})

it('keeps the indent of the very first line so its child stays code at the Host', async () => {
  const first = await runThinkRow(' - First step\n    - name: secret-key\nDone.\n', 900)
  assert.ok(first.seen.length > 0 && first.seen.every(prose => !prose.includes('secret')))
  assert.ok(first.shown.startsWith(' ') && first.shown.includes('    - name: secret-key\n'))
})

// A batch can open behind a sentence end or inline code. The Host reads what follows as a
// line start, so the tail must not share a batch with the indented line under it.
const defaultBatchChars = Number(/var XL_BATCH_CHARS = (\d+);/.exec(source)[1])
const filler = 'Word '.repeat(defaultBatchChars / 5).trimEnd()
const yamlLines = '    - name: secret-key\n      run: secret-deploy\n'
for (const [cut, tail] of [
  [';', '- then the config'],
  [';', '* then the config'],
  [';', '+ then the config'],
  [';', '1. then the config'],
  [';', '2) then the config'],
  ['!', '- then the config'],
  ['?', '- then the config'],
  ['。', '- then the config'],
  ['！', '- then the config'],
  ['？', '- then the config'],
  ['`x()`', '- then the config'],
  ['`x()`', '1. then the config'],
  [';', ' - then the config'],
  [';', '\t- then the config'],
  ['`x()`', '.- then the config'],
]) {
  it('keeps a sentence tail apart from the indented code under it: ' + JSON.stringify(cut + tail.replace(' the config', '')), async () => {
    const text = filler + cut + tail + '\n' + yamlLines + 'Done.\n' + filler + ';and more prose\nNext line.\n'
    const run = await runThinkRow(text, defaultBatchChars)
    assert.ok(run.seen.every(prose => !prose.includes('secret')))
    assert.deepEqual(run.batches.map(batch => batch.text), [
      filler + cut, tail + '\n', yamlLines + 'Done.\n' + filler + ';', 'and more prose\nNext line.\n',
    ])
    assert.ok(run.shown.includes('\n' + yamlLines))
  })
}

const tailShapes = 'Read the notes;- then the config\n    - name: secret-a\n      run: secret-b\n'
  + 'Read the notes.- then the config\n    - name: secret-c\n'
  + 'Read the notes; - then the config\n    - name: secret-d\n'
  + 'Read `x()`- then the config\n\n    + const secret = neu;\n'
  + 'Read the notes?1. then the config\n\t- name: secret-e\n'
  + 'Done.\n'

it('keeps indented code from the provider at every batch size', async () => {
  for (let size = 1; size <= tailShapes.length; size++) {
    const run = await runThinkRow(tailShapes, size)
    assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size)
  }
})

it('keeps indented code from the provider while streaming', async () => {
  const text = tailShapes + 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [1, 7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
})

it('sends a short tail on its own while streaming instead of waiting for the end', async () => {
  const text = 'A long enough opening sentence for its own batch;- then\n    - name: secret-key\n'
    + 'Some more plain prose for the stream margin to pass over.\n'.repeat(8)
  const run = await runThinkRow(text, 40, 1)
  const tail = run.batches.find(batch => batch.text === '- then\n')
  assert.ok(tail && tail.running)
})

it('translates a nested line when the previous batch ended on inline code that closes its parent', async () => {
  const parent = '- Read `x()`'
  const run = await runThinkRow(parent + '\n    - Then compare the results\n', parent.length)
  assert.deepEqual(run.seen, ['- Read', '- Then compare the results'])
  assert.equal(run.shown, '[T]- Read `x()`\n    [T]- Then compare the results\n')
  // The real first line of a text is no tail: its nested line stays in the same batch.
  const first = await runThinkRow('- First step\n    - Read the notes\n', 900)
  assert.deepEqual(first.batches.map(batch => batch.text), ['- First step\n    - Read the notes\n'])
})

it('protects mixed code when an enabled provider fails and the next provider succeeds', async t => {
  const calls = []
  ADAPTERS['protection-fail'] = async text => { calls.push(['fail', text]); throw new Error('temporary failure') }
  ADAPTERS['protection-ok'] = async text => { calls.push(['ok', text]); return '译文' }
  t.after(() => { delete ADAPTERS['protection-fail']; delete ADAPTERS['protection-ok'] })
  const text = 'Before `secret()` after.\n```js\nconst secret = 1;\n```\nEnd.'
  const result = await runChainFor(['first', 'second'], text, 'zh-CN', { providers: {
    first: { enabled: true, type: 'protection-fail' }, second: { enabled: true, type: 'protection-ok' },
  } })
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'second')
  assert.deepEqual(result.attempts.map(attempt => attempt.ok), [false, true])
  assert.ok(calls.every(([, payload]) => !payload.includes('secret')))
  assert.ok(result.text.includes('`secret()`'))
  assert.ok(result.text.includes('```js\nconst secret = 1;\n```\n'))
})

it('never invokes disabled or removed providers in either configured chain', async t => {
  const calls = []
  ADAPTERS['switch-test'] = async (text, target, provider) => { calls.push(provider.id); return '译文' }
  t.after(() => { delete ADAPTERS['switch-test'] })
  const providers = {
    disabled: { id: 'disabled', enabled: false, type: 'switch-test' },
    removed: { id: 'removed', enabled: true, type: 'switch-test' },
    allowed: { id: 'allowed', enabled: true, type: 'switch-test' },
  }
  const off = await translateViaChain('Text to translate.', 'zh-CN', {
    chain: ['disabled'], fallback: { enabled: false, chain: ['allowed'] }, providers,
  })
  assert.equal(off.ok, false)
  assert.deepEqual(calls, [])
  const on = await translateViaChain('Text to translate.', 'zh-CN', {
    chain: ['disabled'], fallback: { enabled: true, chain: ['disabled', 'allowed'] }, providers,
  })
  assert.equal(on.provider, 'allowed')
  assert.deepEqual(calls, ['allowed'])
})

it('keeps the original after Host failure without any direct browser request', async () => {
  const requests = []
  const box = vm.createContext({ Date, Map, Promise, needsTranslate: () => true, fnv: value => value,
    localStorage: { length: 0, getItem: () => null, setItem: () => {} }, recordCheck: () => {},
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method })
      assert.ok(['/_xlate/context', '/_xlate/translate'].includes(url), 'browser bypassed configured routing')
      if (url === '/_xlate/context') return { ok: true, json: async () => ({ cacheNamespace: 'test-context', officialEnabled: false }) }
      return { ok: true, json: async () => ({ ok: false, error: 'No enabled provider', retryAt: Date.now() + 30000 }) }
    },
    sleepMs: async () => {},
    fetchWithTimeout: async (...args) => box.fetch(...args),
  })
  vm.runInContext(between('var mem = new Map();', 'var providerChecks = {}'), box)
  vm.runInContext(between('async function hostAttempt(', 'function useXlate('), box)
  const result = await box.requestTranslate('Original sample.', 'zh-CN')
  assert.equal(result.ok, false)
  assert.equal(result.text, 'Original sample.')
  assert.deepEqual(requests, [{ url: '/_xlate/context', method: 'GET' }, { url: '/_xlate/translate', method: 'POST' }])
})
