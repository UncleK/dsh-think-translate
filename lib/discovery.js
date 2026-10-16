// DSH moved settings into profile-owned Cordis rows. Read only literal values;
// never evaluate a profile's !!js expressions while discovering providers.
import { existsSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { load, DEFAULT_SCHEMA, Type } from 'js-yaml'

const EXPRESSION = Object.freeze({ dshExpression: true })
const schema = DEFAULT_SCHEMA.extend([
  new Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: () => EXPRESSION }),
])
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && value !== EXPRESSION
const text = value => typeof value === 'string' && value.trim() ? value.trim() : undefined

export function parseDshYaml(source) {
  try { return load(source, { schema, maxDepth: 40, maxTotalMergeKeys: 1000 }) }
  // YAMLException includes source lines, which can contain credentials.
  catch { throw new Error('Invalid DSH YAML') }
}

// Cordis replaces a row's config when a later patch supplies that field.
// Flatten groups and insert lists without following Includes or running code.
export function dshSections(documents) {
  const rows = new Map()
  function visit(document, parentDisabled = false, ancestors = new Set()) {
    if (!document || typeof document !== 'object' || ancestors.has(document)) return
    const next = new Set(ancestors).add(document)
    if (Array.isArray(document)) {
      for (const row of document) visit(row, parentDisabled, next)
      return
    }
    if (!object(document)) return
    if (Object.hasOwn(document, 'insert')) visit(document.insert, parentDisabled, next)
    const id = text(document.id)
    if (id) {
      const old = rows.get(id) || {}
      if (old.name && document.name && old.name !== document.name) return
      const row = { ...old, ...document }
      if (parentDisabled) row.disabled = true
      rows.set(id, row)
      if (row.group && Array.isArray(row.config)) visit(row.config, parentDisabled || (row.disabled != null && row.disabled !== false), next)
    } else if (!Object.hasOwn(document, 'insert')) {
      // Legacy settings.yaml uses section names instead of id/config rows.
      for (const [key, config] of Object.entries(document)) {
        if (object(config)) rows.set(key === 'agent-default-model' ? 'default-model' : key, { id: key, config })
      }
    }
  }
  for (const document of documents) visit(document)
  const sections = new Map()
  for (const [id, row] of rows) {
    const key = id === 'agent-default-model' ? 'default-model' : id
    // Keep a disabled row as a null section so a successful scan can remove
    // its old imported providers, rather than retaining stale credentials.
    sections.set(key, row.disabled != null && row.disabled !== false ? null : (object(row.config) ? row.config : {}))
  }
  return sections
}

export function providersFromSections(sections) {
  const out = {}
  const providers = sections.get('llm-pi-ai')?.providers
  if (!object(providers)) return out
  for (const [id, raw] of Object.entries(providers)) {
    if (['__proto__', 'constructor', 'prototype'].includes(id)) continue
    if (!object(raw) || raw.enabled === false || raw.disabled === true) continue
    const baseURL = text(raw.baseURL)
    const model = Array.isArray(raw.models) ? raw.models.map(m => object(m) ? text(m.id) : undefined).find(Boolean) : undefined
    // Preserve the existing supported discovery protocol; Responses-only
    // endpoints cannot be driven through our chat/completions adapter.
    if (!baseURL || !model || (raw.api !== undefined && raw.api !== 'openai-completions')) continue
    const entry = { baseURL, model }
    if (text(raw.apiKeyEnv)) entry.apiKeyEnv = text(raw.apiKeyEnv)
    if (text(raw.apiKey)) entry.apiKey = text(raw.apiKey)
    Object.defineProperty(out, id, { value: entry, enumerable: true, configurable: true, writable: true })
  }
  return out
}

export function defaultRouteFromSections(sections) {
  const config = sections.get('default-model')
  if (config?.provider !== 'deepseek-official' || !text(config.model)) return null
  const deepseek = sections.get('llm-deepseek')
  if (sections.has('llm-deepseek') && deepseek === null) return null
  return {
    id: 'deepseek-official',
    entry: {
      type: 'openai',
      baseURL: text(deepseek?.baseURL) || 'https://api.deepseek.com',
      model: text(config.model), apiKeyEnv: 'DEEPSEEK_API_KEY',
    },
  }
}

export function extractDshProviders(source) {
  return providersFromSections(dshSections([parseDshYaml(source)]))
}

export function extractHarnessDefaultRoute(source) {
  return defaultRouteFromSections(dshSections([parseDshYaml(source)]))
}

export function extractCredRefs(source) {
  const raw = parseDshYaml(source)?.refs
  if (!object(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'string' && value.length))
}

export function scanDshProviders({ candidates = [], profileContext, modulePath = '', runtimeRows = [], exists = existsSync, readText = p => readFileSync(p, 'utf8') } = {}) {
  // profileContext is supplied by the official launcher and wins over all
  // path guesses, including stale settings.yaml under another DSH_HOME.
  const installed = modulePath.replace(/\\/g, '/').match(/^(.*)\/profiles\/([^/]+)\/node_modules\//)
  let home = text(profileContext?.home) || installed?.[1]
  let profile = text(profileContext?.name) || installed?.[2]
  const has = path => { try { return exists(path) } catch { return false } }
  if (!home) home = candidates.find(dir => has(join(dir, 'settings.yaml')) || has(join(dir, 'cordis.patch.yml')) || ['desktop', 'web'].some(name => has(join(dir, 'profiles', name, 'cordis.patch.yml')))) || candidates[0] || ''
  if (!profile && !profileContext?.dir && !profileContext?.patchPath) {
    const found = ['desktop', 'web'].filter(name => has(join(home, 'profiles', name, 'cordis.patch.yml')))
    if (found.length === 1) profile = found[0]
    // When both profiles exist the caller must identify the running one.
    if (found.length > 1) return { providers: {}, refs: {}, ok: false, diag: { home, profile: null, sourcePath: join(home, 'profiles'), sourcePaths: [], providers: [], error: 'Cannot identify the active DSH profile' } }
  }
  const dir = text(profileContext?.dir) || (profile ? join(home, 'profiles', profile) : undefined)
  const patchPath = text(profileContext?.patchPath) || (dir ? join(dir, 'cordis.patch.yml') : undefined)
  const legacyPath = join(home, 'settings.yaml')
  const modern = Boolean(profileContext?.dir || profileContext?.patchPath || runtimeRows.length
    || (dir && has(join(dir, 'cordis.yml'))) || (patchPath && has(patchPath)) || has(join(home, 'cordis.patch.yml')))
  const paths = modern ? [dir && join(dir, 'cordis.yml'), patchPath, join(home, 'cordis.patch.yml')].filter(Boolean) : [legacyPath]
  const diag = { home, profile: profile || (dir ? basename(dir) : null), sourcePath: patchPath || paths[0], sourcePaths: [], settingsFound: has(legacyPath), credsFound: false, providers: [], error: null }
  const result = { providers: {}, refs: {}, ok: false, diag }
  try {
    const documents = modern ? [runtimeRows] : []
    for (const path of [...new Set(paths)]) {
      diag.sourcePath = path
      let source
      try { source = readText(path) } catch (error) {
        if (error?.code === 'ENOENT') continue
        throw new Error('Unable to read DSH configuration')
      }
      documents.push(parseDshYaml(source))
      diag.sourcePaths.push(path)
    }
    if (modern && Array.isArray(profileContext?.overlays)) documents.push(profileContext.overlays)
    const sections = dshSections(documents)
    const providers = providersFromSections(sections)
    const def = defaultRouteFromSections(sections)
    for (const [id, entry] of Object.entries(providers)) result.providers[id] = { type: 'openai', source: 'dsh', enabled: false, ...entry }
    if (def && !Object.hasOwn(result.providers, def.id)) result.providers[def.id] = { source: 'dsh', enabled: false, ...def.entry }
    result.ok = sections.has('llm-pi-ai') || sections.has('default-model') || (modern && runtimeRows.length > 0)
    const credsPath = join(home, '.credentials.yaml')
    let credentials = ''
    try { credentials = readText(credsPath); diag.credsFound = true } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error('Unable to read DSH credentials')
    }
    result.refs = extractCredRefs(credentials)
    diag.providers = Object.keys(result.providers)
    diag.sourcePath = diag.sourcePaths.includes(patchPath) ? patchPath : (diag.sourcePaths.at(-1) || patchPath || paths[0])
  } catch (error) {
    result.providers = {}; result.refs = {}; result.ok = false
    diag.error = error.message
  }
  return result
}
