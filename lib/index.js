// dsh-think-translate host half: same-origin translation proxy with a pluggable
// provider chain. The browser calls POST /_xlate/translate (no CORS involved);
// this side owns provider adapters, API keys (local config file), caching,
// and the system-proxy-aware curl transport.
//
// Providers: google (gtx via Node CONNECT tunnel / curl), bing (ttranslatev3
// via curl), openai-compatible (any /chat/completions endpoint — usually the
// local Ollama).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'

export const name = 'dsh-think-translate'

// Hard dependencies: without this declaration apply() ran before the web
// server row mounted, ctx.get('webServer') returned undefined, and the whole
// plugin silently registered nothing (no error, no routes).
export const inject = ['webServer', 'subprocess', 'timer']

const CONFIG_PATH = fileURLToPath(new URL('./config.json', import.meta.url))

// Defaults: local model (Ollama) enabled from the start — the chain is
// fail-open, so if Ollama is down it falls back to google/bing. Selecting the
// local model in the UI also re-enables the provider (priority and enabled
// are independent fields; a disabled provider is silently skipped).
const DEFAULT_CONFIG = {
  priority: 'google',
  providers: {
    google: { enabled: true },
    bing: { enabled: true },
    openai: { enabled: true, baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct', apiKey: 'ollama-local' },
  },
}

// ---------------------------------------------------------------- transport

let subprocessRef = null
let timerRef = null

async function workdir() {
  return process.cwd() || '.'
}

async function runProgram(exeName, args, timeoutMs) {
  const sub = subprocessRef
  if (!sub) throw new Error('subprocess unavailable')
  const exe = await sub.resolveExecutable(exeName)
  const child = sub.spawn({
    argv: [exe].concat(args),
    cwd: await workdir(),
    stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
    graceMs: 2000,
  })
  const readP = (async function () {
    const chunks = []
    if (child.stdout) {
      for await (const c of child.stdout) chunks.push(c)
    }
    return chunks
  })()
  const timeoutP = timerRef.timeout(timeoutMs).then(function () { return 'timeout' })
  const doneP = child.done.then(function () { return 'done' })
  const winner = await Promise.race([doneP, timeoutP])
  if (winner === 'timeout') {
    child.terminate()
    await readP.catch(function () { return [] })
    throw new Error(exeName + ' timeout')
  }
  const chunks = await readP
  const outcome = await child.done
  let total = 0
  for (const c of chunks) total += c.byteLength
  const bytes = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength }
  const out = new TextDecoder().decode(bytes)
  if (outcome.exitCode !== 0) throw new Error(exeName + ' exit ' + outcome.exitCode + ': ' + out.slice(0, 200))
  return out
}

let proxyCache = { value: null, at: 0 }

async function getProxy() {
  const now = Date.now()
  if (proxyCache.at !== 0 && now - proxyCache.at < 10 * 60 * 1000) return proxyCache.value
  let value = null
  try {
    const out = await runProgram('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'], 8000)
    const en = out.match(/ProxyEnable\s+REG_DWORD\s+(\S+)/)
    const sv = out.match(/ProxyServer\s+REG_SZ\s+(\S+)/)
    if (en && en[1] && en[1].toLowerCase() !== '0x0' && sv && sv[1]) {
      let p = sv[1]
      if (p.indexOf(';') !== -1) {
        const mH = p.match(/https?=([^;]+)/i)
        const mS = p.match(/socks=([^;]+)/i)
        p = mH ? mH[1] : (mS ? mS[1] : '')
      }
      if (p) {
        if (/^socks/i.test(p)) value = 'socks5://' + p.replace(/^socks=?/i, '')
        else if (/^\d/.test(p)) value = 'http://' + p
        else value = p.indexOf('://') === -1 ? 'http://' + p : p
      }
    }
  } catch (e) {
    value = null
  }
  proxyCache = { value: value, at: now }
  return value
}

async function curlArgs(extra) {
  const args = ['-sS', '--max-time', '25']
  // Loopback targets (local LLM endpoints) must bypass the system proxy.
  const last = extra.length ? String(extra[extra.length - 1]) : ''
  const mh = last.match(/^https?:\/\/([^\/?#]+)/i)
  const host = mh ? mh[1].replace(/^\[/, '').split(':')[0].toLowerCase() : ''
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host === '::ffff:127.0.0.1'
  if (!isLocal) {
    const px = await getProxy()
    if (px) args.push('-x', px)
  }
  for (const a of extra) args.push(a)
  return args
}

async function curlGet(url) {
  return runProgram('curl', await curlArgs(['-L', url]), 30000)
}

async function curlPostForm(url, form) {
  const extra = ['-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded', '--data-binary', form, url]
  return runProgram('curl', await curlArgs(extra), 30000)
}

async function curlPostJson(url, headerPairs, body) {
  const extra = ['-X', 'POST']
  for (const h of headerPairs) extra.push('-H', h)
  extra.push('--data-binary', body, url)
  return runProgram('curl', await curlArgs(extra), 40000)
}

// HTTPS GET through an HTTP proxy via a CONNECT tunnel, using Node's own TLS
// stack. curl is blocked by google gtx's anti-bot (TLS-fingerprint based:
// curl gets a "Sorry..." HTML page while .NET/Node/real browsers pass), so the
// google provider must not go through curl. SOCKS proxies are not supported
// here — callers keep the curl path for those.
function httpsViaProxy(urlStr, proxyHost, proxyPort, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const connectReq = http.request({
      host: proxyHost,
      port: proxyPort,
      method: 'CONNECT',
      path: url.host + ':443',
      headers: { Host: url.host + ':443', 'Proxy-Connection': 'Keep-Alive' },
      timeout: timeoutMs,
    })
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy()
        reject(new Error('proxy CONNECT ' + res.statusCode))
        return
      }
      const req2 = https.request({
        host: url.host,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        socket,
        servername: url.host,
        timeout: timeoutMs,
      }, (res2) => {
        const chunks = []
        res2.on('data', (c) => chunks.push(c))
        res2.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      req2.on('error', reject)
      req2.on('timeout', () => req2.destroy(new Error('https timeout')))
      req2.end()
    })
    connectReq.on('error', reject)
    connectReq.on('timeout', () => connectReq.destroy(new Error('proxy connect timeout')))
    connectReq.end()
  })
}

// ---------------------------------------------------------------- providers

let bingCache = null

async function viaGoogle(text, to) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(to) + '&dt=t&q=' + encodeURIComponent(text)
  const px = await getProxy()
  let raw = null
  if (px && /^http/i.test(px)) {
    // curl is fingerprint-blocked by google ("Sorry..." page); Node's TLS
    // stack passes. Only plain HTTP proxies support CONNECT here; SOCKS falls
    // back to curl.
    try {
      const p = new URL(px)
      raw = await httpsViaProxy(url, p.hostname, Number(p.port) || 80, 30000)
    } catch (e) {
      raw = null
    }
  }
  if (raw === null) raw = await curlGet(url)
  const arr = JSON.parse(raw)
  const segs = arr && arr[0]
  if (!Array.isArray(segs)) throw new Error('gtx unexpected shape')
  let out = ''
  for (const seg of segs) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0]
  }
  if (!out.trim()) throw new Error('gtx empty translation')
  return out
}

async function bingSession() {
  if (bingCache !== null && Date.now() < bingCache.exp) return bingCache
  const html = await curlGet('https://www.bing.com/translator')
  const ig = html.match(/IG:"([^"]+)"/)
  const ab = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]*)\]/)
  if (!ig || !ab) throw new Error('bing page shape changed')
  const parts = ab[1].split(',').map(function (s) { return s.trim().replace(/^"/, '').replace(/"$/, '') })
  if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error('bing params empty')
  bingCache = { ig: ig[1], key: parts[0], token: parts[1], exp: Date.now() + 50 * 60 * 1000 }
  return bingCache
}

async function viaBing(text, to) {
  const s = await bingSession()
  const form = 'fromLang=auto&text=' + encodeURIComponent(text) + '&to=' + encodeURIComponent(to) + '&token=' + encodeURIComponent(s.token) + '&key=' + encodeURIComponent(s.key)
  const raw = await curlPostForm('https://www.bing.com/ttranslatev3?isIntl=1&IG=' + encodeURIComponent(s.ig) + '&IID=SERP', form)
  const arr = JSON.parse(raw)
  const tr = Array.isArray(arr) && arr[0] && arr[0].translations && arr[0].translations[0]
  if (!tr || typeof tr.text !== 'string' || !tr.text.trim()) throw new Error('bing empty translation')
  return tr.text
}

// The vocabulary-hint block fixes the local qwen family's habit of leaving
// common Chinese words untranslated (这个/方案/关键/针对...). Giving explicit
// mappings (zh -> ja) turns near-miss output into clean translations; the
// "never leave source words" rule applies to every target language.
const OPENAI_SYSTEM = 'You are a translation engine. Translate the user text into the requested target language. Output ONLY the translation — no explanations, no quotes, no trailing commentary. Never keep a source-language word untranslated in the output. Common mappings (Chinese -> Japanese): 这个 -> この; 那个 -> その; 方案 -> 案/プラン; 关键 -> 要点/鍵; 针对 -> 対して; 进行 -> 行う; 通过 -> 通じて; 以及 -> および; 对于 -> に対して; 需要 -> 必要がある; 我们 -> 私たち; 可以 -> できる; 问题 -> 問題; 情况 -> 状況; 内容 -> 内容; 相关 -> 関連; 以下 -> 以下; 上述 -> 前述; 当前 -> 現在; 整体 -> 全体; 主要 -> 主に; 具体 -> 具体的に; 方面 -> 面/点; 部分 -> 部分; 实现 -> 実装/実現; 使用 -> 使用する; 提供 -> 提供する; 支持 -> サポートする; 处理 -> 処理する; 解决 -> 解決する; 提高 -> 向上させる; 降低 -> 低下させる; 增加 -> 増加させる; 减少 -> 減らす. Keep code blocks, commands, file paths, URLs, and identifiers verbatim.'

async function viaOpenAI(text, to, cfg) {
  if (!cfg.apiKey) throw new Error('openai: missing apiKey')
  let url = String(cfg.baseURL || '').replace(/\/+$/, '')
  if (!url) throw new Error('openai: missing baseURL')
  if (!url.endsWith('/chat/completions')) url += '/chat/completions'
  const body = JSON.stringify({
    model: cfg.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: OPENAI_SYSTEM },
      { role: 'user', content: 'Target language: ' + to + '\n\n' + text },
    ],
    stream: false,
  })
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)([:/]|$)/i.test(url)
  let raw
  if (isLocal) {
    // Loopback endpoints (Ollama etc.): use Node fetch. curl carries the JSON
    // body through the Windows command line, where CJK text is decoded with
    // the ANSI code page and corrupted before the server ever sees it
    // (2026-08-24: zh->ja via host chain returned garbage/off-topic output
    // while direct fetch worked). Loopback bypasses the system proxy anyway,
    // so fetch is both correct and proxy-safe here.
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body,
    })
    if (!res.ok) throw new Error('openai HTTP ' + res.status)
    raw = await res.text()
  } else {
    raw = await curlPostJson(url, [
      'Authorization: Bearer ' + cfg.apiKey,
      'Content-Type: application/json',
    ], body)
  }
  const j = JSON.parse(raw)
  const msg = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
  if (typeof msg !== 'string' || !msg.trim()) throw new Error('openai empty output: ' + JSON.stringify(j).slice(0, 200))
  return msg.trim()
}

const ADAPTERS = {
  google: viaGoogle,
  bing: viaBing,
  openai: viaOpenAI,
}

// ---------------------------------------------------------------- config

let configCache = null

async function loadConfig() {
  if (configCache !== null) return configCache
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    configCache = deepMerge(structuredCloneSafe(DEFAULT_CONFIG), parsed)
  } catch (e) {
    configCache = structuredCloneSafe(DEFAULT_CONFIG)
    await saveConfig(configCache).catch(function () {})
  }
  return configCache
}

async function saveConfig(cfg) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
  configCache = cfg
}

function structuredCloneSafe(v) { return JSON.parse(JSON.stringify(v)) }

function deepMerge(base, patch) {
  for (const k of Object.keys(patch || {})) {
    const pv = patch[k]
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], pv)
    } else {
      base[k] = pv
    }
  }
  return base
}

// ---------------------------------------------------------------- pipeline

const cache = new Map()
const CACHE_MAX = 600
const inflight = new Map()
const state = { lastError: null, lastProvider: null, ok: 0, fail: 0 }

function fnv(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36) + '.' + s.length.toString(36)
}
function cacheGet(k) {
  if (!cache.has(k)) return undefined
  const v = cache.get(k)
  cache.delete(k)
  cache.set(k, v)
  return v
}
function cacheSet(k, v) {
  cache.set(k, v)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

function isCjk(code) {
  return (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff)
    || (code >= 0xf900 && code <= 0xfaff) || (code >= 0x20000 && code <= 0x2ffff)
    || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)
    || (code >= 0x3040 && code <= 0x30ff) || (code >= 0x31f0 && code <= 0x31ff)
}
function isLatin(code) { return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) }
function cjkRatio(text) {
  let c = 0, l = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0
    if (isCjk(code)) c++
    else if (isLatin(code)) l++
  }
  const total = c + l
  return total === 0 ? 0 : c / total
}
function isCodeOnlyLine(line) {
  return /^(?:[$>#]\s*)?(?:(?:npm|pnpm|yarn|bun|npx|node|git|cd|curl|pwsh|reg)\b|(?:const|let|var|import|export|function|class|return|if|for|while|async|await)\b|[\[{(]|['"]?[\w.-]+['"]?\s*(?:[:=]|=>)|[\w$.]+\s*\(|(?:[~./][\w@~./-]*|[\w.-]+\/[\w@~./-]+)(?::\d+)?$)/.test(line)
}
function hasProse(text) {
  const outside = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
  const lines = outside.split('\n').map(function (l) { return l.trim() }).filter(Boolean)
  if (lines.length === 0) return false
  let hasLetters = false
  for (const ch of outside) {
    const code = ch.codePointAt(0) || 0
    if (isLatin(code) || (code >= 0x3400 && code <= 0x9fff)) { hasLetters = true; break }
  }
  if (!hasLetters) return false
  for (const line of lines) if (!isCodeOnlyLine(line)) return true
  return false
}
function needsTranslate(text, target) {
  if (!text || !text.trim()) return false
  if (!hasProse(text)) return false
  if (target.indexOf('zh') === 0 && cjkRatio(text) >= 0.3) return false
  return true
}
function chunkText(text) {
  if (text.length <= 1200) return [text]
  const sentences = text.match(/[\s\S]*?[.。！？!?;\n]|[\s\S]+$/g) || [text]
  const chunks = []
  let cur = ''
  for (const sn of sentences) {
    if (cur && cur.length + sn.length > 1200) { chunks.push(cur); cur = '' }
    if (sn.length > 1200) {
      for (let i = 0; i < sn.length; i += 1100) chunks.push(sn.slice(i, i + 1100))
      cur = ''
    } else {
      cur += sn
    }
  }
  if (cur.trim()) chunks.push(cur)
  return chunks.length ? chunks : [text]
}

async function translateViaChain(text, target, cfg) {
  const priority = cfg.priority
  const ids = Object.keys(ADAPTERS)
    .filter(function (id) { return cfg.providers[id] && cfg.providers[id].enabled && ADAPTERS[id] })
  ids.sort(function (a, b) { return (a === priority ? -1 : 0) - (b === priority ? -1 : 0) })
  let lastErr = null
  for (const id of ids) {
    try {
      const chunks = chunkText(text)
      const outs = []
      for (const c of chunks) outs.push(await ADAPTERS[id](c, target, cfg.providers[id]))
      state.ok++
      state.lastProvider = id
      state.lastError = null
      return { ok: true, text: outs.join(''), provider: id }
    } catch (e) {
      lastErr = e
      if (id === 'bing') bingCache = null
    }
  }
  state.fail++
  state.lastError = lastErr instanceof Error ? lastErr.message : String(lastErr)
  return { ok: false, text: text, error: state.lastError }
}

async function handleTranslate(body) {
  const text = body && typeof body.text === 'string' ? body.text : ''
  const target = body && typeof body.target === 'string' && body.target ? body.target : 'zh-CN'
  if (!text.trim()) return { ok: true, text: '', skipped: true }
  const key = target + '|' + fnv(text)
  const hit = cacheGet(key)
  if (hit !== undefined) return hit
  const busy = inflight.get(key)
  if (busy !== undefined) return busy
  const job = (async function () {
    if (!needsTranslate(text, target)) {
      const r = { ok: true, text: text, skipped: true }
      cacheSet(key, r)
      return r
    }
    const cfg = await loadConfig()
    const r = await translateViaChain(text, target, cfg)
    if (r.ok) cacheSet(key, r)
    return r
  })()
  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}

// ---------------------------------------------------------------- http glue

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = []
    let size = 0
    req.on('data', function (c) {
      size += c.length
      if (size > 2 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// List models served by the configured openai-compatible endpoint (usually
// the local Ollama). Used by the settings panel to offer a model picker.
async function handleModels() {
  const cfg = await loadConfig()
  const p = cfg.providers && cfg.providers.openai
  const base = p && p.baseURL ? String(p.baseURL).replace(/\/+$/, '') : ''
  if (!base) return { ok: true, models: [], current: p && p.model }
  try {
    const url = base + '/models'
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)([:/]|$)/i.test(url)
    let raw
    if (isLocal) {
      const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + (p.apiKey || '') } })
      if (!res.ok) throw new Error('models HTTP ' + res.status)
      raw = await res.text()
    } else {
      const extra = ['-H', 'Authorization: Bearer ' + (p.apiKey || ''), url]
      raw = await runProgram('curl', await curlArgs(extra), 30000)
    }
    const j = JSON.parse(raw)
    const list = Array.isArray(j && j.data)
      ? j.data.map(function (m) { return m && typeof m.id === 'string' ? m.id : null }).filter(Boolean)
      : []
    return { ok: true, models: list, current: p.model }
  } catch (e) {
    return { ok: true, models: [], current: p.model, error: e instanceof Error ? e.message : String(e) }
  }
}

// ---------------------------------------------------------------- model pull

// In-flight model downloads, keyed by model name. Started from the settings
// panel (first local-model selection); the Ollama /api/pull stream is consumed
// here and snapshotted for the polling status route. On success the openai
// provider is auto-configured (enabled + model) and priority switches to it.
const pullJobs = new Map()

async function pullModel(model) {
  const clean = String(model || '').trim()
  if (!clean) return { ok: false, error: 'model name required' }
  const live = pullJobs.get(clean)
  if (live && !live.done && !live.error) return { ok: true, model: clean, running: true }
  const job = { model: clean, status: 'starting', digest: null, total: 0, completed: 0, done: false, error: null, at: Date.now() }
  pullJobs.set(clean, job)
  ;(async function () {
    try {
      const res = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: clean, stream: true }),
      })
      if (!res.ok) throw new Error('ollama pull HTTP ' + res.status)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx).trim()
          buf = buf.slice(idx + 1)
          if (!line) continue
          try {
            const ev = JSON.parse(line)
            if (ev.status) job.status = ev.status
            if (ev.digest) job.digest = ev.digest
            if (typeof ev.total === 'number') job.total = ev.total
            if (typeof ev.completed === 'number') job.completed = ev.completed
            job.at = Date.now()
            if (ev.status === 'success') job.done = true
          } catch (e) { /* ignore a malformed progress line */ }
        }
      }
      if (!job.done) throw new Error('pull stream ended before success')
      // Auto-configure: enable the openai provider with the freshly pulled
      // model and make it the priority.
      const cfg = await loadConfig()
      const base = cfg.providers.openai.baseURL || 'http://localhost:11434/v1'
      const key = cfg.providers.openai.apiKey || 'ollama-local'
      cfg.providers.openai = { enabled: true, baseURL: base, model: clean, apiKey: key }
      cfg.priority = 'openai'
      await saveConfig(cfg)
      job.status = 'configured'
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e)
      job.status = 'error'
    }
  })()
  return { ok: true, model: clean }
}

async function handlePullStatus() {
  // Normalize stuck jobs: if the model is already installed (e.g. the pull
  // stream ended without a success event during sha256 verification), report
  // it as configured so the UI never hangs on "verifying" (2026-08-25).
  let installed = null
  try {
    const res = await fetch('http://localhost:11434/api/tags')
    if (res.ok) {
      const j = await res.json()
      installed = new Set((j.models || []).map(function (m) { return m && m.name }))
    }
  } catch (e) { /* ollama unreachable — leave jobs as-is */ }
  const jobs = []
  for (const job of pullJobs.values()) {
    const isInstalled = installed !== null && installed.has(job.model)
    if (isInstalled && !job.done && !job.error) {
      job.done = true
      job.status = 'configured'
      job.error = null
    }
    jobs.push({
      model: job.model,
      status: job.status,
      digest: job.digest,
      total: job.total,
      completed: job.completed,
      percent: job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : 0,
      done: job.done,
      error: job.error,
    })
  }
  return { ok: true, jobs }
}

export function apply(ctx) {
  subprocessRef = ctx.get('subprocess')
  timerRef = ctx.get('timer')

  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  // ctx.effect expects a FACTORY returning a disposer. Passing
  // webServer.register(route) directly made Cordis invoke the returned
  // disposer immediately — every route self-removed right after registering,
  // silently (2026-08-22 root cause #3).
  ctx.effect(function () {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/_xlate/translate',
      handler: async function (req, res) {
        try {
          if (req.method !== 'POST') { sendJson(res, 405, { error: 'POST only' }); return }
          const body = await readBody(req)
          sendJson(res, 200, await handleTranslate(body))
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    })
    return dispose
  }, 'dsh-think-translate: translate route')

  ctx.effect(function () {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/_xlate/config',
      handler: async function (req, res) {
        try {
          if (req.method === 'GET') {
            sendJson(res, 200, await loadConfig())
            return
          }
          if (req.method === 'POST') {
            const patch = await readBody(req)
            const merged = deepMerge(await loadConfig(), patch)
            await saveConfig(merged)
            sendJson(res, 200, merged)
            return
          }
          sendJson(res, 405, { error: 'GET/POST only' })
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      },
    })
    return dispose
  }, 'dsh-think-translate: config route')

  ctx.effect(function () {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/_xlate/models',
      handler: async function (req, res) {
        try {
          if (req.method !== 'GET') { sendJson(res, 405, { error: 'GET only' }); return }
          sendJson(res, 200, await handleModels())
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    })
    return dispose
  }, 'dsh-think-translate: models route')

  ctx.effect(function () {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/_xlate/model/pull',
      handler: async function (req, res) {
        try {
          if (req.method !== 'POST') { sendJson(res, 405, { error: 'POST only' }); return }
          const body = await readBody(req)
          sendJson(res, 200, await pullModel(body && body.model))
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    })
    return dispose
  }, 'dsh-think-translate: model pull route')

  ctx.effect(function () {
    const dispose = webServer.register({
      kind: 'exact',
      path: '/_xlate/model/pull-status',
      handler: async function (req, res) {
        try {
          if (req.method !== 'GET') { sendJson(res, 405, { error: 'GET only' }); return }
          sendJson(res, 200, await handlePullStatus())
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    })
    return dispose
  }, 'dsh-think-translate: model pull-status route')
}
