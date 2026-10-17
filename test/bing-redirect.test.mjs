import { it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { requestText, requestTextInfo } from '../lib/transport.js'

const source = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
const bingSource = source.slice(source.indexOf('async function bingSession('), source.indexOf('function resolveApiKey('))
const sessionHtml = 'IG:"test-session"; params_AbusePreventionHelper = [123,"test-token"];'
function bingContext(overrides = {}) {
  const sandbox = vm.createContext({ Date, URL, bingCache: null, ...overrides })
  vm.runInContext(bingSource, sandbox)
  return sandbox
}
async function serve(t, handler) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  return 'http://127.0.0.1:' + server.address().port
}

for (const [origin, tag, iid] of [
  ['https://cn.bing.com', '<div class="translator" data-iid="translator.5028" id="rich_tta">', 'translator.5028'],
  ['https://www.bing.com', "<div id='rich_tta' class='translator' data-iid='translator.5030'>", 'translator.5030'],
  ['https://cn.bing.com', '<div id="rich_tta">', 'SERP'],
]) it('Bing posts to its session origin and reads the page IID: ' + origin + ' / ' + iid, async () => {
  let sessionGets = 0
  const sandbox = bingContext({
    // Keep both boundaries so this test also exercises the old implementation.
    curlGet: async () => { sessionGets++; return sessionHtml + tag },
    curlGetInfo: async () => { sessionGets++; return { text: sessionHtml + tag, url: origin + '/translator?region=CN' } },
    curlPostForm: async (url, body) => {
      const endpoint = new URL(url), form = new URLSearchParams(body)
      assert.equal(endpoint.origin, origin)
      assert.equal(endpoint.pathname, '/ttranslatev3')
      assert.equal(endpoint.searchParams.get('IID'), iid)
      assert.equal(endpoint.searchParams.get('IG'), 'test-session')
      assert.equal(form.get('text'), 'source & text')
      assert.equal(form.get('fromLang'), 'auto-detect')
      assert.equal(form.get('to'), 'zh-Hans')
      assert.equal(form.get('token'), 'test-token')
      assert.equal(form.get('key'), '123')
      return '[{"translations":[{"text":"译文"}]}]'
    },
  })
  assert.equal(await sandbox.viaBing('source & text', 'zh-CN'), '译文')
  assert.equal(await sandbox.viaBing('source & text', 'zh-CN'), '译文')
  assert.equal(sessionGets, 1, 'cache the regional origin and IID together with the session')
})

it('Bing uses the redirected session origin without redirecting its translation POST', async t => {
  const translationRequests = []
  let sessionGets = 0, redirectedPosts = 0
  const regional = await serve(t, async (req, res) => {
    if (req.url === '/translator') {
      sessionGets++
      res.end(sessionHtml + '<div data-iid="translator.5028" id="rich_tta">')
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString('utf8')
    translationRequests.push({ method: req.method, body, url: req.url })
    // Reproduce Bing's empty reply when POST was changed to GET by a 302.
    if (req.method !== 'POST' || !body) { res.end(''); return }
    const form = new URLSearchParams(body)
    assert.equal(form.get('text'), 'Translate this sentence.')
    assert.equal(form.get('fromLang'), 'auto-detect')
    assert.equal(form.get('to'), 'zh-Hans')
    assert.equal(form.get('token'), 'test-token')
    assert.equal(new URL(req.url, regional).searchParams.get('IID'), 'translator.5028')
    res.end('[{"translations":[{"text":"翻译这个句子。"}]}]')
  })
  const initial = await serve(t, (req, res) => {
    if (req.method === 'POST') redirectedPosts++
    res.writeHead(302, { Location: regional + req.url }); res.end()
  })
  const sandbox = bingContext({
    curlGet: () => requestText(initial + '/translator'),
    curlGetInfo: () => requestTextInfo(initial + '/translator'),
    curlPostForm: (url, body) => requestText(url.replace('https://www.bing.com', initial), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    }),
  })
  assert.equal(await sandbox.viaBing('Translate this sentence.', 'zh-CN'), '翻译这个句子。')
  assert.equal(sessionGets, 1)
  assert.equal(redirectedPosts, 0, 'submit directly to the origin that issued the session')
  assert.equal(translationRequests.length, 1)
  assert.equal(translationRequests[0].method, 'POST')
  assert.ok(translationRequests[0].body.length > 0)
})

for (const [body, error] of [
  ['', /bing empty response/], [' \r\n ', /bing empty response/],
  ['<html>blocked</html>', /bing non-JSON response/],
  ['{"statusCode":400,"errorMessage":"invalid language"}', /bing API 400: invalid language/],
  ['[]', /bing empty translation/],
]) it('Bing reports a clear failure for ' + JSON.stringify(body), async () => {
  const sandbox = bingContext({
    bingCache: { ig: 'test', key: 'test', token: 'test', origin: 'https://cn.bing.com', iid: 'SERP', exp: Date.now() + 60000 },
    curlPostForm: async () => body,
  })
  await assert.rejects(sandbox.viaBing('source', 'zh-CN'), error)
})
