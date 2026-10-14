import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import { isIP } from 'node:net'

export function isLoopback(url) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return ['localhost', '127.0.0.1', '::1', '::ffff:7f00:1'].includes(host)
}

function proxyAuthorization(proxy) {
  if (!proxy.username && !proxy.password) return {}
  const credentials = decodeURIComponent(proxy.username) + ':' + decodeURIComponent(proxy.password)
  return { 'Proxy-Authorization': 'Basic ' + Buffer.from(credentials).toString('base64') }
}

// One native request, with one deadline covering CONNECT, TLS, and the body.
// HTTP targets use an ordinary forward proxy; HTTPS targets use its CONNECT
// socket through a dedicated TLS agent, never a second direct connection.
function requestOnce(url, options) {
  return new Promise((resolve, reject) => {
    const proxy = options.proxy ? new URL(options.proxy) : null
    if (proxy && !['http:', 'https:'].includes(proxy.protocol)) {
      reject(new Error('Unsupported native proxy protocol: ' + proxy.protocol))
      return
    }
    let request, connectRequest, tunnel, agent, settled = false
    const deadline = setTimeout(() => finish(new Error('request timeout')), options.timeoutMs)
    function finish(error, value) {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      // Destroy unfinished requests and the operation's private tunnel only.
      // Direct requests keep Node's shared connection pool available.
      if (error) request?.destroy()
      connectRequest?.destroy()
      tunnel?.destroy()
      agent?.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    function send(client, requestOptions) {
      if (settled) return
      try { request = client.request(requestOptions, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('error', error => finish(error))
        response.on('aborted', () => finish(new Error('response aborted')))
        response.on('end', () => finish(null, {
          status: response.statusCode, headers: response.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        }))
      }) } catch (error) { finish(error); return }
      request.on('error', error => finish(error))
      if (options.body !== undefined) request.write(options.body)
      request.end()
    }
    const targetHost = url.hostname.replace(/^\[|\]$/g, '')
    const targetOptions = {
      hostname: targetHost, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method: options.method || 'GET',
      headers: { ...options.headers }, ca: options.ca,
    }
    // Bing and some model gateways reject chunked POST bodies with HTTP 411.
    if (options.body !== undefined && !Object.keys(targetOptions.headers).some(key =>
      ['content-length', 'transfer-encoding'].includes(key.toLowerCase()))) {
      targetOptions.headers['Content-Length'] = Buffer.byteLength(options.body)
    }
    if (!proxy) {
      send(url.protocol === 'https:' ? https : http, targetOptions)
    } else {
      const proxyClient = proxy.protocol === 'https:' ? https : http
      const proxyOptions = {
        hostname: proxy.hostname.replace(/^\[|\]$/g, ''),
        port: proxy.port || (proxy.protocol === 'https:' ? 443 : 80), ca: options.ca,
      }
      if (url.protocol === 'http:') {
        send(proxyClient, { ...proxyOptions, method: targetOptions.method, path: url.href,
          headers: { ...targetOptions.headers, Host: url.host, ...proxyAuthorization(proxy) } })
      } else {
        const authority = url.host + (url.port ? '' : ':443')
        connectRequest = proxyClient.request({ ...proxyOptions, method: 'CONNECT', path: authority,
          headers: { Host: authority, ...proxyAuthorization(proxy) } })
        connectRequest.on('error', error => finish(error))
        connectRequest.on('connect', (response, socket, head) => {
          if (settled) { socket.destroy(); return }
          tunnel = socket
          tunnel.on('error', error => finish(error))
          if (response.statusCode !== 200) { finish(new Error('proxy CONNECT ' + response.statusCode)); return }
          if (head.length) socket.unshift(head)
          agent = new https.Agent({ keepAlive: false })
          agent.createConnection = () => tls.connect({ socket,
            servername: isIP(targetHost) ? undefined : targetHost, ca: options.ca,
            ALPNProtocols: ['http/1.1'],
          })
          send(https, { ...targetOptions, agent })
        })
        connectRequest.end()
      }
    }
  })
}

export async function requestText(urlString, options = {}) {
  let url = new URL(urlString)
  let method = options.method || 'GET', body = options.body
  let headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json,text/plain,*/*', ...options.headers }
  const deadline = Date.now() + (options.timeoutMs || 25000)
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported request protocol: ' + url.protocol)
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('request timeout')
    // Re-evaluate loopback on every redirect so a local model never uses a proxy.
    const response = await requestOnce(url, { ...options, method, body, headers,
      timeoutMs: remaining, proxy: isLoopback(url.href) ? null : options.proxy })
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
      if (redirects === 5) throw new Error('Too many redirects')
      const next = new URL(response.headers.location, url)
      if (next.origin !== url.origin) {
        headers = Object.fromEntries(Object.entries(headers).filter(([key]) =>
          !['authorization', 'cookie', 'x-api-key', 'api-key', 'host'].includes(key.toLowerCase())))
      }
      if ((response.status === 303 && method !== 'HEAD') || ([301, 302].includes(response.status) && method === 'POST')) {
        method = 'GET'; body = undefined
        headers = Object.fromEntries(Object.entries(headers).filter(([key]) =>
          !['content-type', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())))
      }
      url = next
      continue
    }
    if (response.status < 200 || response.status >= 300) throw new Error('HTTP ' + response.status)
    return response.text
  }
}
