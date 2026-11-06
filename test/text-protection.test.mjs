import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { protectedTextParts, translateProtectedText } from '../lib/text.js'
import { ADAPTERS, runChainFor, translateViaChain, chunkText, needsTranslate } from '../lib/index.js'
import { glossaryEntriesForTarget, translateWithGlossary, splitGlossaryText } from '../lib/glossary.js'
import { translationNamespace } from '../lib/runtime-state.js'

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

// A tab runs to the next tab stop of 4 columns, so each of these is 8 columns deep.
const eightColumns = ['        ', '\t\t', '\t    ', '    \t', '     \t', '\t \t']
const tabCode = '- name: secret-key\n'
// The name in a closing tag reads as a path, as on base. That is not what these tests are about.
const codeOf = parts => parts.filter(part => part.code && !/^\/\w+$/.test(part.text)).map(part => part.text)
async function assertStaysCode(text, codes) {
  const parts = protectedTextParts(text)
  assert.deepEqual(codeOf(parts), codes, JSON.stringify(text))
  assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), parts)
  for (let size = 1; size <= text.length; size++) {
    const run = await runThinkRow(text, size)
    assert.ok(run.seen.every(prose => !prose.includes('secret')), JSON.stringify(text) + ' at batch size ' + size)
    for (const code of codes) assert.ok(run.shown.includes(code), JSON.stringify(code) + ' changed at batch size ' + size)
  }
}

for (const [label, opening, parentCode] of [
  // A space before a tab leaves a line out of the code check, so nothing found it to be a list item.
  ['a space and a tab', 'Plan:\n \t- Update the config\n', []],
  ['two spaces and a tab', 'Plan:\n  \t- Update the config\n', []],
  ['three spaces and a tab', 'Plan:\n   \t- Update the config\n', []],
  ['a space and a tab under an item', '- Top level\n \t- Update the config\n', []],
  ['two spaces and a tab under an item', '- Top level\n  \t- Update the config\n', []],
  // A line that opens with a tab is code when no list item holds it, and so is the line under it.
  ['a tab', 'Plan:\n\t- Update the config\n', ['\t- Update the config\n']],
  ['a tab and two spaces', 'Plan:\n\t  - Update the config\n', ['\t  - Update the config\n']],
  ['a tab and two spaces too deep for its item', '- Top level\n\t  - Update the config\n', ['\t  - Update the config\n']],
  // Behind the marker a tab runs to column 4 too, so the content starts there and code at column 8.
  ['a tab behind the marker', 'Plan:\n-\tUpdate the config\n', []],
  ['a space and a tab behind the marker', 'Plan:\n- \tUpdate the config\n', []],
  ['two spaces and a tab behind the marker', 'Plan:\n-  \tUpdate the config\n', []],
  ['a tab behind an indented marker', 'Plan:\n  -\tUpdate the config\n', []],
  ['a tab behind an ordered marker', 'Plan:\n1.\tUpdate the config\n', []],
  ['a tab behind a long ordered marker', 'Plan:\n10.\tUpdate the config\n', []],
]) {
  it('keeps code 8 columns deep under a parent with ' + label, async () => {
    for (const child of eightColumns) await assertStaysCode(opening + child + tabCode + 'Done.\n', [...parentCode, child + tabCode])
  })
}

it('keeps shallower code under a parent with a space before its tab', async () => {
  for (const parent of [' \t', '  \t', '   \t']) {
    for (const child of ['    ', '\t', '     ', '\t ', '      ', '\t  ', '       ', '\t   ']) {
      await assertStaysCode('A first line long enough for its own batch.\n' + parent + '- Update the config\n' + child + tabCode + 'Done.\n', [child + tabCode])
    }
  }
})

it('keeps code past the content of a real item whose indent has a tab', async () => {
  // The parent content starts at column 6, so code starts at column 10.
  for (const child of ['          ', '\t\t  ', '     \t  ', '            ', '\t\t\t']) {
    await assertStaysCode('- Top level\n\t- Update the config\n' + child + tabCode + 'Done.\n', [child + tabCode])
    await assertStaysCode('- Top level\n    - Update the config\n' + child + tabCode + 'Done.\n', [child + tabCode])
  }
  // A line that is not list-shaped stays code under any parent.
  await assertStaysCode('Plan:\n \t- Update the config\n\tconst secret = 1;\nDone.\n', ['\tconst secret = 1;\n'])
})

for (const [label, text] of [
  ['tabs on three levels', '- First\n\t- Second\n\t\t- Third\n'],
  ['a tab and two spaces on the third level', '- First\n    - Second\n\t  - Third\n'],
  ['eight spaces under a real second level', '- First\n\t- Second\n        - Third\n'],
  ['a tab behind the parent marker', 'Plan:\n-\tFirst\n      - Second\n'],
  ['a tab off its stop, 8 columns under content at column 5', 'Plan:\n   - First\n\t \t- Second\n'],
  ['five spaces and a tab, 8 columns under content at column 5', 'Plan:\n   - First\n     \t- Second\n'],
  ['a space and a tab, as on base', 'Plan:\n- First\n \t- Second\n \t- Third\n'],
  ['a space and two tabs, as on base', 'Plan:\n \t\t- Second\n'],
]) {
  it('translates a real list line: ' + label, async () => {
    assert.deepEqual(protectedTextParts(text).filter(part => part.code), [])
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), protectedTextParts(text))
    const run = await runThinkRow(text, 900)
    assert.equal(run.seen.join('\n').split('\n').length, text.trimEnd().split('\n').length)
  })
}

it('keeps the indent when a batch opens on a line with a space before its tab', async () => {
  // Without that indent the Host would trust the line as a parent and send the code under it.
  const first = 'A first line long enough for its own batch.\n'
  const rest = ' \t- Update the config\n    - name: secret-key\n'
  const run = await runThinkRow(first + rest, first.length)
  assert.deepEqual(run.batches.map(batch => batch.text), [first, rest])
  assert.deepEqual(run.seen, [first.trimEnd(), '- Update the config'])
  assert.equal(run.shown, '[T]' + first + ' \t[T]- Update the config\n    - name: secret-key\n')
})

it('keeps tab-indented code from the provider while streaming', async () => {
  let text = ''
  for (const parent of [' \t- ', '  \t- ', '\t- ', '\t  - ', '-\t', '- \t', '1.\t']) {
    for (const child of eightColumns) text += 'Plan:\n' + parent + 'Update the config\n' + child + tabCode + 'Done.\n'
  }
  text += 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
})

// More than 4 columns behind the marker make the text a code block inside the item, so the
// content starts one column behind the marker, whichever way those columns are written.
for (const [label, parent, first] of [
  ['five spaces behind the marker', '-     Update the config\n', 6],
  ['eight spaces behind the marker', '-        Update the config\n', 6],
  ['two tabs behind the marker', '-\t\tUpdate the config\n', 6],
  ['a space and two tabs behind the marker', '- \t\tUpdate the config\n', 6],
  ['four spaces and a tab behind the marker', '-    \tUpdate the config\n', 6],
  ['a tab and two spaces behind the marker', '-\t  Update the config\n', 6],
  ['five spaces behind an ordered marker', '1.     Update the config\n', 7],
  ['two tabs behind a long ordered marker', '10.\t\tUpdate the config\n', 8],
  ['five spaces behind an indented marker', '  -     Update the config\n', 8],
]) {
  it('keeps code past the first column of a code block under a parent with ' + label, async () => {
    const opening = 'Plan:\n' + parent
    for (const child of eightColumns) await assertStaysCode(opening + child + tabCode + 'Done.\n', [child + tabCode])
    await assertStaysCode(opening + ' '.repeat(first) + tabCode + 'Done.\n', [' '.repeat(first) + tabCode])
  })
}

it('keeps a nested line with a wide gap behind its marker, and the line under it', async () => {
  // Its own text is a code block inside the nested item, so it is no parent either.
  for (const nested of ['    -     name: secret-a\n', '\t-\t\tname: secret-a\n', '    - \t\tname: secret-a\n', '     1.     name: secret-a\n']) {
    await assertStaysCode('- Top level\n' + nested + 'Done.\n', [nested])
    await assertStaysCode('- Top level\n' + nested + '        ' + tabCode + 'Done.\n', [nested, '        ' + tabCode])
  }
})

it('keeps a line left of the content of a parent with a wide gap', async () => {
  // Nothing above it can continue a paragraph, so that line is an indented code block.
  for (const parent of ['100.     Update the config\n', '   -     Update the config\n', '  1.     Update the config\n', '100.\t Update the config\n']) {
    await assertStaysCode('Plan:\n' + parent + '    ' + tabCode + 'Done.\n', ['    ' + tabCode])
  }
})

for (const [label, text] of [
  ['exactly four spaces behind the marker', 'Plan:\n-    First\n        - Second\n'],
  ['a tab and a space behind the marker, 4 columns', 'Plan:\n-\t First\n        - Second\n'],
  ['exactly four spaces behind an ordered marker', 'Plan:\n1.    First\n         - Second\n'],
  ['a normal parent and three more levels', '1. First\n    - Second\n        - Third\n            - Fourth\n    - Fifth\n'],
  ['a tab behind a normal marker', 'Plan:\n-\tFirst\n\t- Second\n'],
  ['a list line inside the first columns under five spaces', 'Plan:\n-     First\n    - Second\n     - Third\n'],
  ['a list line inside the first columns under two tabs', 'Plan:\n-\t\tFirst\n     - Second\n'],
  ['a nested line with 4 columns behind its marker', '- Top level\n    -    Second\n    -\tThird\n'],
]) {
  it('translates a real list line: ' + label, async () => {
    assert.deepEqual(protectedTextParts(text).filter(part => part.code), [])
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), protectedTextParts(text))
    const run = await runThinkRow(text, 900)
    assert.equal(run.seen.join('\n').split('\n').length, text.trimEnd().split('\n').length)
  })
}

for (const [label, parent, child] of [
  // 2 columns off a tab stop the gap of 6 columns shrinks to 3, which would move the code column.
  ['a tab behind the marker', ' -  \tUpdate the config\n', '       '],
  ['a tab and a space behind the marker', ' 1. \t Update the config\n', '        '],
  // Without its indent the marker ends further left, so the code column moves left with it.
  ['five spaces behind the marker', '   -     Update the config\n', '    '],
]) {
  it('keeps the indent when a batch opens on a line with ' + label, async () => {
    const opening = 'A first line long enough for its own batch.\n'
    const rest = parent + child + tabCode
    const run = await runThinkRow(opening + rest, opening.length)
    assert.deepEqual(run.batches.map(batch => batch.text), [opening, rest])
    assert.ok(run.seen.every(prose => !prose.includes('secret')))
    assert.equal(run.seen.length, 2)
    assert.ok(run.shown.endsWith('\n' + child + tabCode))
    assert.ok(run.shown.includes('\n' + parent.match(/^ +/)[0] + '[T]'))
  })
}

it('still takes the indent off a nested line with up to 4 spaces behind its marker', async () => {
  const opening = '- A first line long enough for its own batch.\n'
  const run = await runThinkRow(opening + '    -    Read the notes\n', opening.length)
  assert.deepEqual(run.batches.map(batch => batch.text), [opening, '-    Read the notes\n'])
  assert.deepEqual(run.seen, [opening.trimEnd(), '-    Read the notes'])
  assert.equal(run.shown, '[T]' + opening + '    [T]-    Read the notes\n')
})

it('keeps code under a wide marker gap from the provider while streaming', async () => {
  let text = ''
  for (const parent of ['-     ', '-\t\t', '- \t\t', '-    \t', '1.     ', '  -     ', ' -  \t']) {
    for (const child of eightColumns) text += 'Plan:\n' + parent + 'Update the config\n' + child + tabCode + 'Done.\n'
  }
  text += 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
})

// A list line measures from the content of the item that holds it. With no such item it is 4
// columns deep at the top level, which is an indented code block once no paragraph is open.
const heldCode = '    ' + tabCode
for (const [label, text, codes] of [
  ['left of the content of three spaces and a marker', 'Plan:\n\n   - Update the config\n\n' + heldCode, [heldCode]],
  ['left of the content of a three-digit marker', 'Plan:\n\n100. Update the config\n\n' + heldCode, [heldCode]],
  ['left of the content of an indented number', 'Plan:\n\n  1. Update the config\n\n' + heldCode, [heldCode]],
  ['left of the content behind a tab and a space', 'Plan:\n\n-\t Update the config\n\n' + heldCode, [heldCode]],
  ['a tab left of the content', 'Plan:\n\n   - Update the config\n\n\t' + tabCode, ['\t' + tabCode]],
  ['left of a nested item and of the item above it', 'Plan:\n\n   - First\n       - Second\n\n' + heldCode, [heldCode]],
  ['the same with no blank line', 'Plan:\n\n   - First\n       - Second\n' + heldCode, [heldCode]],
  ['outside two open items, with a wide gap above', '-\tFirst\n   - \t\tSecond\n\t    * Third\n\t' + tabCode, ['\t' + tabCode]],
  // Only a 1 can open an ordered list under a paragraph, so these numbers are paragraph text.
  ['under a 2 right below a paragraph', 'Plan:\n2. Update the config\n\n' + heldCode, [heldCode]],
  ['under a 10) right below a paragraph', 'Plan:\n10) Update the config\n\n' + heldCode, [heldCode]],
  ['under an indented 3 right below a paragraph', 'Plan:\n 3. Update the config\n\n' + heldCode, [heldCode]],
  ['under a wide 2 right below a paragraph', 'Plan:\n2.     Update the config\n\n' + heldCode, [heldCode]],
  ['under a 2 right below the text of an item', '- Top level\n  2. Update the config\n\n      ' + tabCode, ['      ' + tabCode]],
  ['under a number too long for a marker', 'Plan:\n1234567890. Update the config\n\n' + heldCode, [heldCode]],
  ['under lines that only continue a paragraph', 'Plan:\n2. First\n    - Second\n    - Third\n\n' + heldCode, ['    - Second\n', '    - Third\n', heldCode]],
  // A list line left of an open item ends it, so the next number is under plain text again.
  ['under a 10 below text, behind a line left of two open items', 'Plan:\n\n  100. First\n         * Second\n    - Third\nMore text\n10. Fourth\n\n' + heldCode, ['    - Third\n', heldCode]],
  // A thematic break is no list item, whatever it looks like.
  ['under a break of dashes', 'Plan:\n\n- - -\n\n' + heldCode, [heldCode]],
  ['under a break of stars', 'Plan:\n\n* * *\n' + heldCode, [heldCode]],
  // Fails closed where a paragraph could continue, as on base.
  ['continuing a paragraph under a 2', 'Plan:\n2. Update the config\n' + heldCode, [heldCode]],
  ['continuing a paragraph left of the content', 'Plan:\n\n   - Update the config\n' + heldCode, [heldCode]],
]) {
  it('keeps a list line ' + label, async () => {
    await assertStaysCode(text + 'Done.\n', codes)
  })
}

for (const [label, text] of [
  ['a sibling behind a blank line', '- First\n\n    - Second\n\n    - Third\n'],
  ['a child behind a blank line', '1. First\n\n    - Second\n'],
  ['a child at the column of the content', '10. First\n\n    - Second\n'],
  ['a number that goes on with a list', '1. First\n2. Second\n\n    - Third\n'],
  ['a number behind a blank line', 'Plan:\n\n2. First\n\n    - Second\n'],
  ['a number below a heading', '## Steps\n2. First\n\n    - Second\n'],
  ['a number below a quote', '> Quote\n2. First\n\n    - Second\n'],
  ['a number below a fence', '```sh\necho one\n```\n2. First\n\n    - Second\n'],
  ['a level deeper and back', '- First\n\n    - Second\n\n        - Third\n\n    - Fourth\n'],
  ['a line left of a nested item, inside the item above it', '1. First\n   - Second\n    - Third\n'],
  ['a list below a break', '---\n\n- First\n    - Second\n'],
  // The text of a wide item is code, so there is no paragraph for the number to continue.
  ['a number under a wide item', '-     First\n  2. Second\n\n      - Third\n'],
]) {
  it('translates a real list line: ' + label, async () => {
    const parts = protectedTextParts(text)
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), parts)
    const code = parts.filter(part => part.code).map(part => part.text).join('')
    assert.ok(!text.split('\n').some(line => /^(?: {4}|\t)/.test(line) && code.includes(line)), JSON.stringify(code))
    const run = await runThinkRow(text, 900)
    const sent = run.seen.join('\n')
    for (const line of text.split('\n').filter(line => /^ +- /.test(line))) assert.ok(sent.includes(line.trim()), line)
  })
}

it('ends a batch before a line the Host would free under a number', async () => {
  const first = 'A first line long enough for its own batch.\n'
  const run = await runThinkRow(first + '2. Update the config\n\n' + heldCode + 'Done.\n', first.length)
  assert.deepEqual(run.batches.map(batch => batch.text), [first, '2. Update the config\n\n', heldCode + 'Done.\n'])
  assert.deepEqual(run.seen, [first.trimEnd(), '2. Update the config', 'Done.'])
  assert.equal(run.shown, '[T]' + first + '[T]2. Update the config\n\n' + heldCode + '[T]Done.\n')
})

it('ends a batch before a line the Host would free under a parent without its indent', async () => {
  const first = '- A first line long enough for its own batch.\n'
  const run = await runThinkRow(first + ' -   Update the config\n' + heldCode + 'Done.\n', first.length)
  assert.deepEqual(run.batches.map(batch => batch.text), [first, '-   Update the config\n', heldCode + 'Done.\n'])
  assert.ok(run.seen.every(prose => !prose.includes('secret')))
  assert.equal(run.shown, '[T]' + first + ' [T]-   Update the config\n' + heldCode + '[T]Done.\n')
})

it('keeps code behind a blank line from the provider while streaming', async () => {
  let text = ''
  for (const parent of ['   - ', '100. ', '  1. ', '-\t ']) text += 'Plan:\n\n' + parent + 'Update the config\n\n' + heldCode + 'Done.\n\n'
  for (const parent of ['2. ', '10) ', ' 3. ']) text += 'Plan:\n' + parent + 'Update the config\n\n' + heldCode + 'Done.\n\n'
  text += 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
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

// The lines of a CommonMark HTML block are verbatim, so a list line there is no nested item.
const verbatim = '    - name: secret-key\n'
for (const [label, text, codes = [verbatim]] of [
  // These end at their end condition alone, so a blank line changes nothing.
  ['a pre', '<pre>\n- item\n' + verbatim + '</pre>\n'],
  ['a pre with attributes', '<pre class="a">\n- item\n' + verbatim + '</pre>\n'],
  ['an upper case pre', '<PRE>\n- item\n' + verbatim + '</PRE>\n'],
  ['a pre whose tag runs on to the next line', '<pre\nclass="a">\n- item\n' + verbatim + '</pre>\n'],
  ['a pre below a paragraph', 'Intro\n<pre>\n- item\n' + verbatim + '</pre>\n'],
  ['a pre indented by 3 spaces', '   <pre>\n- item\n' + verbatim + '</pre>\n'],
  ['a pre with a blank line inside', '<pre>\n- item\n\n' + verbatim + '</pre>\n'],
  ['a pre with CRLF line ends', '<pre>\r\n- item\r\n    - name: secret-key\r\n</pre>\r\n', ['    - name: secret-key\r\n']],
  ['a script', '<script>\n- item\n' + verbatim + '</script>\n'],
  ['a style', '<style>\n- item\n' + verbatim + '</style>\n'],
  ['a textarea', '<textarea>\n- item\n' + verbatim + '</textarea>\n'],
  ['a comment', '<!--\n- item\n' + verbatim + '-->\n'],
  ['a comment with a blank line inside', '<!-- note\n- item\n\n' + verbatim + '-->\n'],
  ['a processing instruction', '<?php\n- item\n' + verbatim + '?>\n'],
  ['a declaration', '<!DOCTYPE\n- item\n' + verbatim + '>\n'],
  ['a CDATA section', '<![CDATA[\n- item\n' + verbatim + ']]>\n'],
  // The closing line still belongs to the block, so nothing under it can lean on it.
  ['the line that closes a pre', '<pre>\n- item</pre>\n' + verbatim],
  ['the line that closes a comment', '<!--\n- item -->\n' + verbatim],
  // These end at a blank line, and what follows it has no list item above it.
  ['a div', '<div>\n- item\n' + verbatim + '\n'],
  ['a div with attributes', '<DIV id="a">\n- item\n' + verbatim + '\n'],
  ['a closing div', '</div>\n- item\n' + verbatim + '\n'],
  ['a self-closing p', '<p/>\n- item\n' + verbatim + '\n'],
  ['a table tag that runs on to the next line', '<table\n- item\n' + verbatim + '\n'],
  ['a div below a paragraph', 'Intro\n<div>\n- item\n' + verbatim + '\n'],
  ['behind the blank line that ends a div', '<div>\n- item\n\n' + verbatim],
  ['any complete tag', '<span>\n- item\n' + verbatim + '\n'],
  ['any complete closing tag', '</span>\n- item\n' + verbatim + '\n'],
  ['a complete tag with attributes', '<custom-tag a=b c=\'d\' e="f" g>\n- item\n' + verbatim + '\n'],
  ['a complete tag with spaces behind it', '<br/>  \n- item\n' + verbatim + '\n'],
  ['behind the blank line that ends a complete tag', '<span>\n- item\n\n' + verbatim],
  // A list item can hold a block, up to where the item ends.
  ['a pre in an item', '- <pre>\n' + verbatim + '</pre>\n'],
  ['a comment in an ordered item', '1. <!-- note\n' + verbatim + '-->\n'],
  ['a div in an item', '- <div>\n' + verbatim + '\n'],
  ['a complete tag in an item', '- <span>\n' + verbatim + '\n'],
  ['a pre in an item of an item', '- - <pre>\n' + verbatim + '</pre>\n'],
  ['a pre behind a tab', '-\t<pre>\n' + verbatim + '</pre>\n'],
  ['a pre on its own line in an item', '- top\n    <pre>\n  - item\n' + verbatim + '    </pre>\n', ['    <pre>\n', verbatim, '    </pre>\n']],
  // A nested line that opens a block is verbatim itself.
  ['a nested line that opens a div', '- top\n    - <div class="secret">\n', ['    - <div class="secret">\n']],
  ['a nested line that opens a pre', '- top\n    - <pre secret>\n', ['    - <pre secret>\n']],
  ['a nested line that holds a comment', '- top\n    - <!-- secret -->\n', ['    - <!-- secret -->\n']],
  ['a nested line that holds a complete tag', '- top\n    - <span title="secret">\n', ['    - <span title="secret">\n']],
]) {
  it('keeps a list line inside ' + label, async () => {
    await assertStaysCode(text + 'Done.\n', codes)
  })
}

// A block that is closed gives way to a real list. Behind it the list line is prose again.
const closedBlock = '<pre>\n- item\n' + verbatim + '</pre>\n'
const hiddenOpening = '`a\n<pre>\nb`'
for (const [label, text] of [
  ['right behind a closing tag on its own line', '- First\n    - Second\n'],
  ['behind a closing tag on its own line and a blank line', '\n- First\n    - Second\n'],
  ['behind a pre closed by another end tag', '<pre>\nwords\n</script>\n- First\n    - Second\n'],
  ['behind a pre closed on its opening line', '<pre>words</pre>\n- First\n    - Second\n'],
  ['behind a comment closed on its opening line', '<!-- note -->\n- First\n    - Second\n'],
  ['behind a closed comment', '<!--\n- item\n-->\n- First\n    - Second\n'],
  ['behind a closed processing instruction', '<?x\nwords\n?>\n- First\n    - Second\n'],
  ['behind a closed declaration', '<!X\nwords\n>\n- First\n    - Second\n'],
  ['behind a closed CDATA section', '<![CDATA[\nwords\n]]>\n- First\n    - Second\n'],
  ['behind a declaration closed on its opening line', '<!DOCTYPE html>\n- First\n    - Second\n'],
  ['behind the blank line that ends a div', '<div>\nwords\n\n- First\n    - Second\n'],
  ['behind the blank line that ends a complete tag', '<span>\nwords\n\n- First\n    - Second\n'],
  // None of these lines opens a block.
  ['under a tag with text behind it', '<span>words</span> more\n- First\n    - Second\n'],
  ['under a tag name that only starts like pre', '<prefix words\n- First\n    - Second\n'],
  ['under an autolink', '<user@example.test>\n- First\n    - Second\n'],
  ['under a less-than sign', 'a < b\n- First\n    - Second\n'],
  ['under a tag in the middle of a line', 'x <y> z\n- First\n    - Second\n'],
  ['in an item with a less-than sign', '- a < b\n    - Second\n'],
  ['in an item with a tag in the middle of its text', '- x <y> z\n    - Second\n'],
  ['in an item whose block ended at a blank line', '- <div>\n\n    - Second\n'],
  ['in an item whose pre closed on its opening line', '- <pre>words</pre>\n    - Second\n'],
  ['in an item whose comment closed on its opening line', '- <!-- note -->\n    - Second\n'],
]) {
  it('translates a real list line ' + label, async () => {
    // The same behind a block that the walk through the blocks cannot see open.
    for (const [block, codes] of [[closedBlock, [verbatim]], [hiddenOpening + '\n- item\n' + verbatim + '</pre>\n', [hiddenOpening, verbatim]]]) {
      const whole = block + text
      const parts = protectedTextParts(whole)
      assert.deepEqual(codeOf(parts), codes)
      assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(whole))), parts)
      const run = await runThinkRow(whole, 900)
      assert.ok(run.seen.every(prose => !prose.includes('secret')))
      assert.ok(run.seen.join('\n').includes(text.includes('First') ? '- First\n    - Second' : '- Second'))
    }
  })
}

// A fence that holds gives way to a real list too, and a block opened inside it is plain text.
for (const [label, fence, before = '', after = '- First\n    - Second\n'] of [
  ['a pre in a closed fence', '```\n<pre>\n```\n'],
  ['a comment in a closed fence', '~~~\n<!-- note\n~~~\n'],
  ['a pre in a closed fence in an item', '  ```\n  <pre>\n  ```\n', '- top\n'],
  ['a closed fence', '```\nwords\n```\n'],
  ['a closed fence with an info string', '```bash\nwords\n```\n'],
  ['a closed tilde fence', '~~~\nwords\n~~~\n'],
  ['a fence closed by a longer line', '```\nwords\n`````\n'],
  ['a fence with a blank line inside', '```\nwords\n\nmore\n```\n'],
  ['a fence closed with an indent', '```\nwords\n  ```\n'],
  ['a closed fence in an item', '  ```\n  words\n  ```\n', '- top\n'],
  ['a closed fence under a number', '   ```\n   words\n   ```\n', '1. top\n', '2. First\n    - Second\n'],
  ['a closed fence on the marker of an item', '- ```\n  words\n  ```\n'],
  ['a closed fence on the marker of a 1', '1. ```\n   words\n   ```\n'],
]) {
  it('translates a real list line behind ' + label, async () => {
    const text = before + fence + after
    const parts = protectedTextParts(text)
    assert.deepEqual(codeOf(parts), [fence])
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), parts)
    const run = await runThinkRow(text, 900)
    assert.ok(run.seen.join('\n').includes('First\n    - Second'))
  })
}

// A code span, a fence or a tag taken for a block can hide the line that opens a real one.
for (const [label, text, codes] of [
  ['a code span over the opening line', hiddenOpening + '\n- item\n' + verbatim, [hiddenOpening, verbatim]],
  ['a fence over the opening line', '- ```\nx\n<pre>\n```\n- item\n' + verbatim, ['- ```\nx\n<pre>\n```\n', verbatim]],
  ['a tag below a quote over the opening line', '> q\n<span>\n<!-- note\n\n- item\n' + verbatim, [verbatim]],
  ['a code span over a comment', '`a\n<!-- note\nb`\n- item\n\n' + verbatim + '-->\n', ['`a\n<!-- note\nb`', verbatim]],
  ['a code span over a div', '`a\n<div>\nb`\n- item\n' + verbatim + '\n', ['`a\n<div>\nb`', verbatim]],
  ['a code span over a div that a blank line ended', '`a\n<div>\nb`\n- item\n\n' + verbatim, ['`a\n<div>\nb`', verbatim]],
  ['a code span over a pre closed on the line above', hiddenOpening + '\n- item</pre>\n' + verbatim, [hiddenOpening, verbatim]],
  ['a fence over a comment', '- ```\nx\n<!-- note\n```\n- item\n' + verbatim, ['- ```\nx\n<!-- note\n```\n', verbatim]],
  ['a tag below a quote over a pre', '> q\n<span>\n<pre>\n\n- item\n' + verbatim, [verbatim]],
]) {
  it('keeps a list line behind ' + label, async () => {
    await assertStaysCode(text + 'Done.\n', codes)
  })
}

// A fence that CommonMark pairs differently from the parser leaves a real fence where the parser
// sees none. A line left of an open fence can end the item that holds it, and the next fence line
// then opens a new one. A fence in a quote ends with the quote, and so on.
for (const [label, text, codes] of [
  ['a list fence that ends with its item', '- ```\n```\n- item\n' + verbatim, ['- ```\n```\n', verbatim]],
  ['an ordered list fence that ends with its item', '1. ~~~\n~~~\n- item\n' + verbatim, ['1. ~~~\n~~~\n', verbatim]],
  ['a list fence with a line left of it', '- ```\nx\n```\n- item\n' + verbatim, ['- ```\nx\n```\n', verbatim]],
  ['a nested list fence that ends with its item', '  - ```\n```\n- item\n' + verbatim, ['  - ```\n```\n', verbatim]],
  ['an indented fence that ends with its item', '- a\n  ```\nb\n```\n- item\n' + verbatim, ['  ```\nb\n```\n', verbatim]],
  ['a tab-indented fence that ends with its item', '- a\n\t```\nb\n```\n- item\n' + verbatim, ['\t```\nb\n```\n', verbatim]],
  ['a quote fence that ends with its quote', '> ```\n```\n- item\n' + verbatim, ['> ```\n```\n', verbatim]],
  ['a list fence in a quote', '> - ```\n```\n- item\n' + verbatim, ['> - ```\n```\n', verbatim]],
  ['a quoted line that does not close a fence', '```\nx\n> ```\n- item\n' + verbatim, ['```\nx\n> ```\n', verbatim]],
  ['a closing line indented too far', '```\nx\n    ```\n- item\n' + verbatim, ['```\nx\n    ```\n', verbatim]],
  ['an info string with a backtick, which is no fence', '``` a`b\nx\n```\n- item\n' + verbatim, ['``` a`b\nx\n```\n', verbatim]],
  ['a number that is paragraph text', 'Plan:\n2. ```\n   x\n   ```\n- item\n' + verbatim, ['2. ```\n   x\n   ```\n', verbatim]],
  ['a zero that is paragraph text', 'Plan:\n0. ```\n   x\n   ```\n- item\n' + verbatim, ['0. ```\n   x\n   ```\n', verbatim]],
  ['a code span over a fence', '`a\n```\nb`\n- item\n' + verbatim, ['`a\n```\nb`', verbatim]],
  ['a code span over a tilde fence', '`a\n~~~\nb`\n- item\n' + verbatim, ['`a\n~~~\nb`', verbatim]],
  ['a code span over a fence that closes further down', '`a\n```\nb`\n- item\n' + verbatim + '```\n', ['`a\n```\nb`', verbatim, '```\nDone.\n']],
  ['a fence in a hidden pre', hiddenOpening + '\n```\n</pre>\n```\n- item\n' + verbatim, [hiddenOpening, '```\n</pre>\n```\n', verbatim]],
]) {
  it('keeps a list line behind ' + label, async () => {
    await assertStaysCode(text + 'Done.\n', codes)
  })
}

it('keeps list lines below a fence that says nothing from the provider while streaming', async () => {
  let text = ''
  for (const shape of ['- ```\n```\n', '> ```\n```\n', '- a\n  ```\nb\n```\n', '`a\n```\nb`\n']) text += shape + '- item\n' + verbatim + 'Done.\n\n'
  text += 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
})

// The scan knows no containers and no paragraphs, so it also counts blocks CommonMark ends earlier
// or never opens. A list line there stays code, which is what base does with every indented line.
for (const [label, text, codes = [verbatim]] of [
  ['behind an item that held a pre', '- <pre>\n- First\n' + verbatim],
  ['behind an item that held a div', '- <div>\n- First\n' + verbatim + '\n'],
  ['behind a quote that held a pre', '> <pre>\n- First\n' + verbatim],
  ['under a complete tag below a paragraph', 'Intro\n<span>\n- First\n' + verbatim + '\n'],
  ['under a number below a paragraph that holds a pre', 'Intro\n2. <pre>\n- First\n' + verbatim],
  ['below a closed fence in a quote', '> ```\n> x\n> ```\n- First\n' + verbatim, ['> ```\n> x\n> ```\n', verbatim]],
  ['below a closed fence behind a number', '2. ```\n   x\n   ```\n- First\n' + verbatim, ['2. ```\n   x\n   ```\n', verbatim]],
  ['below a closed fence with a line left of it', ' ```\nx\n```\n- First\n' + verbatim, [' ```\nx\n```\n', verbatim]],
  ['below a closed fence in a div', '<div>\n```\nx\n```\n\n- First\n' + verbatim, ['```\nx\n```\n', verbatim]],
  ['behind an indented pre', '    <pre>\n\n- First\n' + verbatim, ['    <pre>\n', verbatim]],
]) {
  it('keeps a list line as on base ' + label, async () => {
    await assertStaysCode(text + 'Done.\n', codes)
  })
}

it('still sends the prose lines of a pre, as on base', async () => {
  const run = await runThinkRow('<pre>\nSome words to translate\n- item\n' + verbatim + '</pre>\nDone.\n', 900)
  assert.deepEqual(run.seen, ['<pre>\nSome words to translate\n- item', '>\nDone.'])
})

it('ends a batch before a line the Host would free behind a cut through a pre', async () => {
  const first = 'A first line long enough for its own batch.\n<pre>\n'
  const run = await runThinkRow(first + '- item\n' + verbatim + '</pre>\nDone.\n', first.length)
  assert.deepEqual(run.batches.map(batch => batch.text), [first, '- item\n', verbatim + '</pre>\nDone.\n'])
  assert.deepEqual(run.seen, [first.trimEnd(), '- item', '>\nDone.'])
})

it('keeps the lines of an HTML block from the provider while streaming', async () => {
  let text = ''
  for (const open of ['<pre>', '<script>', '<!-- note', '<?php', '<!DOCTYPE', '<![CDATA[']) text += 'Plan:\n' + open + '\n- item\n\n' + verbatim + '</pre>\n-->\n?>\n>\n]]>\n\n'
  for (const open of ['<div>', '</div>', '<span>']) text += open + '\n- item\n' + verbatim + '\n'
  for (const open of ['- <div>', '- <span>', '- <pre>']) text += open + '\n' + verbatim + '\n'
  text += 'Some more plain prose for the stream margin to pass over.\n'.repeat(5)
  for (const size of [24, 40, 80, 900]) {
    for (const step of [7, 20, 40, 80, 200]) {
      const run = await runThinkRow(text, size, step)
      assert.ok(run.seen.every(prose => !prose.includes('secret')), 'batch size ' + size + ', step ' + step)
    }
  }
})

// The real route handler and provider chain. Only a client that says so has nested list lines freed.
const hostSource = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
function hostRoute() {
  const sent = []
  const cfg = { chain: ['test'], providers: { test: { enabled: true, type: 'test' } } }
  const context = vm.createContext({ glossaryEntriesForTarget, translateWithGlossary, splitGlossaryText,
    structuredCloneSafe: value => JSON.parse(JSON.stringify(value)), configGeneration: 0,
    translationContext: config => ({ cacheNamespace: translationNamespace(config), officialEnabled: false }),
    Date, Map, protectedTextParts, translateProtectedText, loadConfig: async () => cfg, ollamaOrigin: () => null,
    ADAPTERS: { test: async prose => { sent.push(prose); return '这是译文。' } } })
  const from = hostSource.indexOf('const cache = new Map()')
  vm.runInContext(hostSource.slice(from, hostSource.indexOf('// ---------------------------------------------------------------- http glue', from)), context)
  return { sent, handle: body => context.handleTranslate(body), namespace: translationNamespace(cfg) }
}
const nestedMessage = '- First step\n    - Read the notes\n'
const oldClient = { target: 'zh-CN' }
const newClient = { target: 'zh-CN', nestedLists: true }

// A page from before the flag counts every indented line as code and cuts batches on size alone,
// so a batch can run between any two of these offsets.
function oldClientCuts(text) {
  const cuts = new Set([0, text.length])
  for (const part of protectedTextParts(text, false)) {
    cuts.add(part.start)
    cuts.add(part.end)
    if (!part.code) for (const match of part.text.matchAll(/[。！？!?;\n]+/g)) cuts.add(part.start + match.index + match[0].length)
  }
  return [...cuts].sort((a, b) => a - b)
}
for (const [label, text] of [
  ['a list parent cut out of a sentence', tailShapes],
  ['a cut at the batch default', filler + ';- then the config\n' + yamlLines + 'Done.\n'],
  ['a list parent right above, as in a whole message', '- then the config\n' + yamlLines],
  ['a parent on a later line of the batch', 'Read the notes;- first\n- then the config\n' + yamlLines],
  ['a number that only continues a paragraph', 'Plan:\n2. foo\n3. bar\n' + verbatim],
  ['a cut through a pre', '<pre>\nwords\n- item\n' + verbatim + '</pre>\n'],
  ['a cut through a div', '<div>\nwords\n- item\n' + verbatim + '\n'],
]) {
  it('old client, new Host: keeps indented lines from the provider with ' + label, async () => {
    const host = hostRoute()
    const cuts = oldClientCuts(text)
    for (let from = 0; from < cuts.length; from++) {
      for (let to = from + 1; to < cuts.length; to++) {
        const batch = text.slice(cuts[from], cuts[to])
        const result = await host.handle({ text: batch, ...oldClient })
        assert.ok(host.sent.every(prose => !prose.includes('secret')), JSON.stringify(batch))
        assert.ok(result.text.includes('secret') === batch.includes('secret'), JSON.stringify(batch))
      }
    }
  })
}

it('old client, new Host: keeps a nested line from the provider on the provider test path too', async () => {
  const host = hostRoute()
  await host.handle({ text: '- then the config\n' + verbatim, ...oldClient, provider: 'test' })
  assert.deepEqual(host.sent, ['- then the config'])
})

it('frees nested list lines only for a client that says it batches for them', async () => {
  const oldPage = hostRoute()
  const kept = await oldPage.handle({ text: nestedMessage, ...oldClient })
  assert.deepEqual(oldPage.sent, ['- First step'])
  assert.ok(kept.text.includes('    - Read the notes\n'))
  // What the new client sends for a whole message that opens with a real list parent.
  const newPage = hostRoute()
  const freed = await newPage.handle({ text: nestedMessage, ...newClient })
  assert.deepEqual(newPage.sent, [nestedMessage.trimEnd()])
  assert.ok(!freed.text.includes('Read the notes'))
})

it('does not serve one client the cached answer of the other', async () => {
  for (const order of [[oldClient, newClient], [newClient, oldClient]]) {
    const host = hostRoute()
    const answers = new Map()
    for (const request of order) answers.set(request, await host.handle({ text: nestedMessage, ...request }))
    assert.equal(host.sent.length, 2)
    assert.ok(answers.get(oldClient).text.includes('    - Read the notes\n'))
    assert.ok(!answers.get(newClient).text.includes('Read the notes'))
  }
})

it('sends the flag from the real client and gets a whole message with a list parent translated', async () => {
  const host = hostRoute()
  const bodies = []
  const box = vm.createContext({ Date, Map, Promise, needsTranslate: () => true, fnv: value => value, translationLanguageError: () => null,
    localStorage: { length: 0, getItem: () => null, setItem: () => {} }, recordCheck: () => {}, sleepMs: async () => {},
    fetch: async (url, options) => {
      if (url === '/_xlate/context') return { ok: true, json: async () => ({ cacheNamespace: host.namespace, officialEnabled: false }) }
      bodies.push(JSON.parse(options.body))
      return { ok: true, json: async () => host.handle(bodies[bodies.length - 1]) }
    },
    fetchWithTimeout: async (...args) => box.fetch(...args),
  })
  vm.runInContext(between('var mem = new Map();', 'var providerChecks = {}'), box)
  vm.runInContext(between('async function hostAttempt(', 'function useXlate('), box)
  const result = await box.requestTranslate(nestedMessage, 'zh-CN')
  assert.equal(result.ok, true)
  assert.equal(bodies[0].nestedLists, true)
  assert.deepEqual(host.sent, [nestedMessage.trimEnd()])
})

it('reads every indented line as code in both parser copies when nested lists are off', () => {
  for (const text of [nestedMessage, 'Plan:\n1. First step\n    - Read the notes\n\t- Compare the results\n', '- First\n\n    - Second\n']) {
    const parts = protectedTextParts(text, false)
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text, false))), parts)
    for (const line of text.split('\n').filter(line => /^(?: {4}|\t)/.test(line))) {
      assert.ok(parts.some(part => part.code && part.text === line + '\n'), line)
    }
  }
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
