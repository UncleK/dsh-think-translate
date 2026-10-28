import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ADAPTERS, runChainFor, translateViaChain, translationLanguageError, needsTranslate } from '../lib/index.js'
import { protectedTextParts, translateProtectedText } from '../lib/text.js'

const host = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
function section(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start)
  return source.slice(start, end)
}
const browser = vm.createContext({ protectedTextParts })
vm.runInContext(section(client, 'function isCjk(', 'function sleepMs('), browser)

const valid = [
  ['zh-CN', '现在需要检查这个问题，确认构建结果。'],
  ['zh-CN', '先检查 `こんにちは` 和 `const message = "Hello"`，保留代码。'],
  ['zh-CN', '日语「こんにちは」'],
  ['zh-CN', '这个中文段落介绍日语术语こんにちは以及相关使用场景，正文保持中文说明。'],
  ['zh-CN', 'React TypeScript Vite'],
  ['zh-CN', 'OK'],
  ['zh-CN', '请参考 https://example.com/こんにちは/。'],
  ['zh-CN', '检查配置。\n```js\nconst x = "これは日本語です";\n```'],
  ['ja', 'これは日本語の翻訳です。設定を確認してください。'],
  ['ja', '設定確認'],
  ['ko', '설정을 확인하고 결과를 비교해야 합니다.'],
  ['ru', 'Нужно проверить настройки и сравнить результаты.'],
  ['en', 'The configuration is ready and the build should succeed.'],
  ['es', 'Esta configuración está lista para los archivos del proyecto.'],
  ['fr', 'Cette configuration est prête pour les fichiers du projet.'],
  ['de', 'Die Konfiguration ist für die Dateien in diesem Projekt bereit.'],
  ['pt', 'A configuração está pronta para os arquivos do projeto.'],
  ['pt', 'Você deve verificar os arquivos antes de continuar com as alterações.'],
]
const invalid = [
  ['zh-CN', 'これは日本語の翻訳です。設定を確認してください。'],
  ['zh-CN', '설정을 확인하고 결과를 비교해야 합니다.'],
  ['zh-CN', 'Нужно проверить настройки и сравнить результаты.'],
  ['zh-CN', 'The configuration is ready and the build should succeed.'],
  ['ja', '现在需要检查这个问题，确认构建结果。'],
  ['ko', '现在需要检查这个问题，确认构建结果。'],
  ['ru', 'The configuration is ready and the build should succeed.'],
  ['en', '现在需要检查这个问题，确认构建结果。'],
  ['en', 'これは日本語の翻訳です。設定を確認してください。'],
  ['en', 'Esta configuración está lista para los archivos del proyecto.'],
  ['es', 'The configuration is ready and the build should succeed.'],
  ['fr', 'Die Konfiguration ist für die Dateien in diesem Projekt bereit.'],
  ['de', 'Cette configuration est prête pour les fichiers du projet.'],
  ['pt', 'The configuration is ready and the build should succeed.'],
  ['pt', '现在需要检查这个问题，确认构建结果。'],
  ['en', 'Você deve verificar os arquivos antes de continuar com as alterações.'],
  ['zh-CN', ''],
]
for (const [target, text] of valid) it('allows correct or ambiguous prose: ' + target + ' ' + text.slice(0,18), () => {
  assert.equal(translationLanguageError(text, target), null)
  assert.equal(browser.translationLanguageError(text, target), null)
})
for (const [target, text] of invalid) it('rejects clear language mismatch: ' + target + ' ' + text.slice(0,18), () => {
  assert.match(translationLanguageError(text, target), /translation language mismatch:/)
  assert.match(browser.translationLanguageError(text, target), /translation language mismatch:/)
})

function providers(t, bad = 'これは日本語の翻訳です。') {
  const calls = []
  ADAPTERS['guard-bad'] = async () => { calls.push('bad'); return bad }
  ADAPTERS['guard-good'] = async () => { calls.push('good'); return '现在检查配置，确认构建结果。' }
  t.after(() => { delete ADAPTERS['guard-bad']; delete ADAPTERS['guard-good'] })
  return { calls, cfg: { providers: { bad: { enabled: true, type: 'guard-bad' }, good: { enabled: true, type: 'guard-good' } } } }
}
it('rejects a wrong language and continues the enabled provider chain', async t => {
  const {calls,cfg} = providers(t)
  const result = await runChainFor(['bad','good'], 'Check the configuration.', 'zh-CN', cfg)
  assert.equal(result.provider, 'good')
  assert.deepEqual(calls, ['bad','good'])
  assert.deepEqual(result.attempts.map(x => x.ok), [false,true])
  assert.match(result.attempts[0].error, /language mismatch/)
})
it('uses the explicit fallback chain after a language mismatch', async t => {
  const {cfg} = providers(t)
  const result = await translateViaChain('Check the configuration.', 'zh-CN', {...cfg,chain:['bad'],fallback:{enabled:true,chain:['good']}})
  assert.equal(result.provider, 'good')
  assert.deepEqual(result.attempts.map(x => x.ok), [false,true])
})
it('keeps the original when every enabled provider returns the wrong language', async t => {
  const {calls,cfg} = providers(t)
  const text = 'Check the configuration.'
  const result = await translateViaChain(text, 'zh-CN', {...cfg,chain:['bad'],fallback:{enabled:false,chain:['good']}})
  assert.equal(result.ok, false)
  assert.equal(result.text, text)
  assert.deepEqual(calls,['bad'])
})
it('rejects one wrong chunk even when other paragraphs are in Chinese', async t => {
  const {cfg} = providers(t)
  let n = 0
  ADAPTERS['guard-bad'] = async () => ++n === 1 ? '正确的中文段落。'.repeat(50) : 'これは日本語の翻訳です。'
  const result = await runChainFor(['bad','good'], 'First paragraph.\n\nSecond paragraph. '.repeat(90), 'zh-CN', cfg)
  assert.equal(result.provider, 'good')
})
function hostBox(cfg, adapters) {
  const box = vm.createContext({Date,Map,protectedTextParts,translateProtectedText,loadConfig:async()=>cfg,ADAPTERS:adapters,ollamaOrigin:()=>null})
  vm.runInContext(section(host,'const cache = new Map()','// ---------------------------------------------------------------- http glue'),box)
  return box
}
it('does not retain wrong-language output as a successful host cache entry', async () => {
  let calls=0
  const box=hostBox({chain:['test'],providers:{test:{enabled:true,type:'test'}}},{test:async()=>{calls++;return 'これは日本語の翻訳です。'}})
  const text='Check the configuration.'
  const first=await box.handleTranslate({text,target:'zh-CN'})
  assert.equal(first.ok,false)
  assert.equal(first.text,text)
  assert.ok(first.retryAt>Date.now())
  await box.handleTranslate({text,target:'zh-CN'})
  assert.equal(calls,1,'failure cooldown avoids repeat inference')
  box.cacheSet('zh-CN|'+box.fnv(text),{ok:false,retryAt:0})
  await box.handleTranslate({text,target:'zh-CN'})
  assert.equal(calls,2)
})
it('evicts a poisoned host cache entry and checks forced provider tests too', async () => {
  let calls=0
  const box=hostBox({chain:['test'],providers:{test:{enabled:true,type:'test'}}},{test:async()=>{calls++;return '检查配置。'}})
  const text='Check the configuration.'
  box.cacheSet('zh-CN|'+box.fnv(text),{ok:true,text:'これは日本語の翻訳です。'})
  assert.equal((await box.handleTranslate({text,target:'zh-CN'})).text,'检查配置。')
  assert.equal(calls,1)
  box.ADAPTERS.test=async()=> 'これは日本語の翻訳です。'
  assert.equal((await box.handleTranslate({text:'现在检查配置。',target:'zh-CN',provider:'test'})).ok,false)
})
function cacheBox(storage) {
  const box=vm.createContext({Map,Date,translationLanguageError,localStorage:{
    get length(){return storage.size},key:i=>[...storage.keys()][i],
    getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),
  }})
  vm.runInContext(section(client,'var mem = new Map();','var providerChecks = {}'),box)
  return box
}
it('discards v3 translations while preserving language preferences', () => {
  const storage=new Map([['dsh-xlate-cache:v3:zh-CN|old','{"ok":true,"text":"wrong"}'],['dsh-think-translate:lang','zh-CN']])
  cacheBox(storage)
  assert.equal(storage.has('dsh-xlate-cache:v3:zh-CN|old'),false)
  assert.equal(storage.get('dsh-think-translate:lang'),'zh-CN')
})
it('revalidates persisted and in-memory browser translations', () => {
  const storage=new Map([['dsh-xlate-cache:v4:zh-CN|bad',JSON.stringify({ok:true,text:'これは日本語の翻訳です。'})]])
  const box=cacheBox(storage)
  assert.equal(box.cacheMemGet('zh-CN|bad'),undefined)
  assert.equal(storage.size,0)
  box.cacheMemSet('zh-CN|bad',{ok:true,text:'これは日本語の翻訳です。'})
  assert.equal(storage.size,0)
  assert.equal(box.cacheMemGet('zh-CN|bad'),undefined)
  box.cacheMemSet('zh-CN|good',{ok:true,text:'检查配置。'})
  assert.equal(box.cacheMemGet('zh-CN|good').text,'检查配置。')
})
it('a browser connected to an older Host refuses a wrong-language success', async () => {
  const box=vm.createContext({Date,translationLanguageError,recordCheck:()=>{},fetchWithTimeout:async()=>({ok:true,json:async()=>({ok:true,text:'これは日本語の翻訳です。'})})})
  vm.runInContext(section(client,'async function hostAttempt(','function requestTranslate('),box)
  await assert.rejects(box.hostAttempt('Check the configuration.','zh-CN'),/language mismatch/)
})
