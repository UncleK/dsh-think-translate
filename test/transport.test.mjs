import { it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { requestText, requestTextInfo, isLoopback } from '../lib/transport.js'

// Public test-only key/certificate. No production credentials are used.
const key = readFileSync(new URL('./fixtures/proxy-test-key.pem', import.meta.url))
const cert = readFileSync(new URL('./fixtures/proxy-test-cert.pem', import.meta.url))

async function serve(t, server) {
  const sockets = new Set()
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  })
  return server.address().port
}
async function bodyOf(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

it('sends Unicode JSON directly to loopback without consulting a broken proxy', async t => {
  const body = JSON.stringify({ text: '翻译测试 日本語' })
  const port = await serve(t, http.createServer(async (req, res) => {
    assert.equal(req.method, 'POST')
    assert.equal(req.headers.authorization, 'Bearer test')
    assert.equal(Number(req.headers['content-length']), Buffer.byteLength(body))
    res.end(await bodyOf(req))
  }))
  assert.equal(await requestText('http://127.0.0.1:' + port, {
    method: 'POST', headers: { Authorization: 'Bearer test' }, body,
    proxy: 'http://127.0.0.1:1',
  }), body)
  assert.equal(isLoopback('http://[::1]:11434/v1'), true)
  assert.equal(isLoopback('http://[::ffff:127.0.0.1]:11434/v1'), true)
  assert.equal(isLoopback('https://remote.test/v1'), false)
})

it('uses an HTTP forward proxy for a hostname that cannot resolve directly', async t => {
  const port = await serve(t, http.createServer(async (req, res) => {
    assert.equal(req.url, 'http://remote.test:8765/chat/completions')
    assert.equal(req.headers.host, 'remote.test:8765')
    assert.equal(req.headers['content-length'], String(Buffer.byteLength('proxied body')))
    assert.equal(req.headers['proxy-authorization'], 'Basic ' + Buffer.from('user:p@ss').toString('base64'))
    res.end(await bodyOf(req))
  }))
  assert.equal(await requestText('http://remote.test:8765/chat/completions', {
    method: 'POST', body: 'proxied body', proxy: 'http://user:p%40ss@127.0.0.1:' + port,
  }), 'proxied body')
})

for (const secureProxy of [false, true]) {
  it('sends HTTPS POST through CONNECT with verified TLS and ' + (secureProxy ? 'an HTTPS' : 'an HTTP') + ' proxy', async t => {
    let connects = 0, tunnelBytes = 0
    const originPort = await serve(t, https.createServer({ key, cert }, async (req, res) => {
      assert.equal(req.headers.authorization, 'Bearer model-key')
      assert.equal(req.headers['proxy-authorization'], undefined)
      assert.equal(req.method, 'POST')
      assert.equal(Number(req.headers['content-length']), Buffer.byteLength('模型输入'))
      res.end(await bodyOf(req))
    }))
    const proxy = secureProxy ? https.createServer({ key, cert }) : http.createServer()
    const proxyPort = await serve(t, proxy)
    proxy.on('connect', (req, downstream, head) => {
      connects++
      assert.equal(req.url, 'remote.test:' + originPort)
      assert.equal(req.headers['proxy-authorization'], 'Basic ' + Buffer.from('u:p').toString('base64'))
      const upstream = net.connect(originPort, '127.0.0.1', () => {
        downstream.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        downstream.pipe(upstream); upstream.pipe(downstream)
      })
      downstream.on('data', bytes => { tunnelBytes += bytes.length })
      downstream.on('error', () => upstream.destroy())
      downstream.on('close', () => upstream.destroy())
      upstream.on('error', () => downstream.destroy())
    })
    const text = await requestText('https://remote.test:' + originPort + '/chat/completions', {
      method: 'POST', body: '模型输入', headers: { Authorization: 'Bearer model-key' }, ca: cert,
      proxy: (secureProxy ? 'https' : 'http') + '://u:p@127.0.0.1:' + proxyPort, timeoutMs: 2000,
    })
    assert.equal(text, '模型输入')
    assert.equal(connects, 1)
    assert.ok(tunnelBytes > 0, 'TLS and request data must use the CONNECT socket')
  })
}

it('does not retry directly after a proxy rejects CONNECT', async t => {
  let connects = 0
  const proxy = http.createServer()
  const port = await serve(t, proxy)
  proxy.on('connect', (req, socket) => { connects++; socket.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n') })
  await assert.rejects(requestText('https://remote.test/test', {
    proxy: 'http://127.0.0.1:' + port,
  }), /proxy CONNECT 407/)
  assert.equal(connects, 1)
})

it('bounds a stalled CONNECT with a deadline', async t => {
  const proxy = http.createServer()
  const port = await serve(t, proxy)
  proxy.on('connect', () => {})
  await assert.rejects(requestText('https://remote.test/test', {
    proxy: 'http://127.0.0.1:' + port, timeoutMs: 50,
  }), /request timeout/)
})

it('bounds a response body even while the server keeps sending bytes', async t => {
  const timers = []
  t.after(() => timers.forEach(clearInterval))
  const port = await serve(t, http.createServer((req, res) => {
    res.write('partial')
    timers.push(setInterval(() => res.write('.'), 10))
  }))
  await assert.rejects(requestText('http://127.0.0.1:' + port, { timeoutMs: 60 }), /request timeout/)
})

for (const status of [307, 308]) it('preserves POST on a ' + status + ' redirect and strips credentials across origins', async t => {
  let requests = 0
  const port = await serve(t, http.createServer(async (req, res) => {
    requests++
    if (requests === 1) {
      assert.equal(req.headers.authorization, 'Bearer private')
      res.writeHead(status, { Location: 'http://other.test/completions' }); res.end()
    } else {
      assert.equal(req.method, 'POST')
      assert.equal(req.headers.authorization, undefined)
      assert.equal(req.headers['x-api-key'], undefined)
      res.end(await bodyOf(req))
    }
  }))
  assert.equal(await requestText('http://remote.test/completions', {
    method: 'POST', body: 'preserved', headers: { Authorization: 'Bearer private', 'x-api-key': 'secret' },
    proxy: 'http://127.0.0.1:' + port,
  }), 'preserved')
  assert.equal(requests, 2)
})

it('reports the final session URL after cross-origin and relative GET redirects', async t => {
  const port = await serve(t, http.createServer((req, res) => {
    if (req.url === 'http://remote.test/translator') {
      res.writeHead(302, { Location: 'http://cn.remote.test/landing' }); res.end()
    } else if (req.url === 'http://cn.remote.test/landing') {
      res.writeHead(302, { Location: '/translator?region=CN' }); res.end()
    } else {
      assert.equal(req.url, 'http://cn.remote.test/translator?region=CN')
      res.writeHead(201); res.end('regional session')
    }
  }))
  const options = { proxy: 'http://127.0.0.1:' + port }
  assert.deepEqual(await requestTextInfo('http://remote.test/translator', options), {
    text: 'regional session', url: 'http://cn.remote.test/translator?region=CN', status: 201,
  })
  assert.equal(await requestText('http://remote.test/translator', options), 'regional session')
})

for (const status of [301, 302, 303]) it('keeps standard POST-to-GET behavior for a ' + status + ' redirect', async t => {
  const port = await serve(t, http.createServer(async (req, res) => {
    if (req.url === 'http://remote.test/translate') {
      assert.equal(req.method, 'POST')
      assert.equal(await bodyOf(req), 'original form')
      res.writeHead(status, { Location: 'http://cn.remote.test/translate' }); res.end()
    } else {
      assert.equal(req.method, 'GET')
      assert.equal(req.headers['content-type'], undefined)
      assert.equal(req.headers['content-length'], undefined)
      assert.equal(await bodyOf(req), '')
      res.end('body was dropped')
    }
  }))
  assert.deepEqual(await requestTextInfo('http://remote.test/translate', {
    method: 'POST', body: 'original form', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    proxy: 'http://127.0.0.1:' + port,
  }), { text: 'body was dropped', url: 'http://cn.remote.test/translate', status: 200 })
})

it('follows GET redirects and rejects non-success HTTP status', async t => {
  const port = await serve(t, http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(302, { Location: '/translated' }); res.end() }
    else if (req.url === '/translated') res.end('translated')
    else { res.writeHead(429); res.end('rate limited') }
  }))
  assert.equal(await requestText('http://127.0.0.1:' + port), 'translated')
  await assert.rejects(requestText('http://127.0.0.1:' + port + '/limited'), /HTTP 429/)
})
