import { BUILTIN_GLOSSARY } from './glossary-presets.js'

export const GLOSSARY_LANGUAGES = ['zh-CN', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt']
export const GLOSSARY_LIMIT = 128

function glossaryError(code, line = 1) {
  return Object.assign(new Error('Invalid glossary configuration: ' + code + ' at line ' + line), { code: 'GLOSSARY_' + code, line })
}

export function validateGlossaryEntries(entries) {
  if (!Array.isArray(entries)) throw glossaryError('FORMAT')
  if (entries.length > GLOSSARY_LIMIT) throw glossaryError('LIMIT', GLOSSARY_LIMIT + 1)
  const seen = new Set()
  return entries.map((entry, index) => {
    if (!entry || typeof entry.source !== 'string' || typeof entry.target !== 'string') throw glossaryError('FORMAT', index + 1)
    const source = entry.source.trim(), target = entry.target.trim()
    if (!source || !target || source.includes('=>') || /[\x00-\x1f\x7f]/.test(source + target)) throw glossaryError('FORMAT', index + 1)
    if (source.length > 128 || target.length > 256) throw glossaryError('LIMIT', index + 1)
    const key = source.toLowerCase()
    if (seen.has(key)) throw glossaryError('DUPLICATE', index + 1)
    seen.add(key)
    return { source, target }
  })
}

/** One literal source => target pair per nonblank line; user text is never a regex. */
export function parseGlossaryText(text) {
  const entries = [], lines = []
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    const separator = line.indexOf('=>')
    if (separator < 0) throw glossaryError('FORMAT', index + 1)
    entries.push({ source: line.slice(0, separator), target: line.slice(separator + 2) })
    lines.push(index + 1)
  })
  try { return validateGlossaryEntries(entries) }
  catch (error) { if (lines[error.line - 1]) error.line = lines[error.line - 1]; throw error }
}

export function serializeGlossary(entries) {
  return (entries || []).map(entry => entry.source + ' => ' + entry.target).join('\n')
}

/** Validate only fields supplied by the configuration editor; keep other languages. */
export function normalizeGlossaryPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw glossaryError('FORMAT')
  const result = {}
  if (value.enabled !== undefined) {
    if (typeof value.enabled !== 'boolean') throw glossaryError('FORMAT')
    result.enabled = value.enabled
  }
  if (value.builtin !== undefined) {
    if (typeof value.builtin !== 'boolean') throw glossaryError('FORMAT')
    result.builtin = value.builtin
  }
  if (value.entries !== undefined) {
    if (!value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw glossaryError('FORMAT')
    result.entries = {}
    for (const [language, entries] of Object.entries(value.entries)) {
      if (!GLOSSARY_LANGUAGES.includes(language)) throw glossaryError('LANGUAGE')
      result.entries[language] = validateGlossaryEntries(entries)
    }
  }
  return result
}

// Provider translation. Call only for prose already separated from protected code.
export function glossaryEntriesForTarget(glossary, target) {
  if (!glossary) return []
  const tag = String(target || '').replaceAll('_', '-').toLowerCase()
  const traditional = !/(?:^|-)hans(?:-|$)/.test(tag) && /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag)
  const language = /^zh(?:-|$)/.test(tag)
    ? traditional ? null : 'zh-CN'
    : GLOSSARY_LANGUAGES.find(language => language.toLowerCase() === tag.split('-')[0])
  if (!language) return []
  const custom = glossary.enabled === false ? [] : validateGlossaryEntries(glossary.entries?.[language] || [])
  const builtin = glossary.builtin === true ? BUILTIN_GLOSSARY.entries[language] : []
  // The custom limit is independent of the built-in set. Case-insensitive exact
  // source overrides win without copying built-ins into user configuration.
  const merged = new Map(builtin.map(entry => [entry.source.toLowerCase(), entry]))
  custom.forEach(entry => merged.set(entry.source.toLowerCase(), entry))
  return [...merged.values()]
}

function escapePattern(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function glossaryMatches(text, entries) {
  if (!entries.length) return []
  const sorted = entries.slice().sort((a, b) => b.source.length - a.source.length)
  const pattern = new RegExp(sorted.map(entry => '(' + escapePattern(entry.source) + ')').join('|'), 'giu')
  const matches = []
  let match
  while ((match = pattern.exec(text)) !== null) {
    const entry = sorted[match.slice(1).findIndex(value => value !== undefined)]
    const end = match.index + match[0].length
    if ((/[A-Za-z0-9_]/.test(entry.source[0]) && /[A-Za-z0-9_]/.test(text[match.index - 1] || ''))
      || (/[A-Za-z0-9_]/.test(entry.source.at(-1)) && /[A-Za-z0-9_]/.test(text[end] || ''))) continue
    matches.push({ start: match.index, end, target: entry.target })
  }
  return matches
}

/** Keep a matched multiword term intact at long-input chunk boundaries. */
export function splitGlossaryText(text, entries, fallback) {
  if (!entries.length || text.length <= 1200) return fallback(text)
  const matches = glossaryMatches(text, entries), chunks = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + 1200, text.length)
    if (end < text.length) {
      const paragraph = text.lastIndexOf('\n\n', end - 2)
      const space = text.lastIndexOf(' ', end - 1)
      if (paragraph > start) end = paragraph + 2
      else if (space > start + 600) end = space + 1
      if (/[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end] || '')) end--
      const crossing = matches.find(match => match.start < end && match.end > end)
      if (crossing) end = crossing.start
    }
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

/** Restore terms only when every opaque token survives once; otherwise fail open via the provider chain. */
export async function translateWithGlossary(text, entries, translate) {
  if (!entries.length) return { text: await translate(text), targets: [] }
  const matches = glossaryMatches(text, entries)
  let prefix = 'ZXQG'
  while (text.toLowerCase().includes(prefix.toLowerCase()) || entries.some(entry => entry.target.toLowerCase().includes(prefix.toLowerCase()))) prefix += 'Q'
  const tokens = []
  let cursor = 0, masked = ''
  for (const match of matches) {
    const token = prefix + tokens.length + 'QXZ'
    const before = text.slice(cursor, match.start)
    masked += before + token
    tokens.push({ token, target: match.target })
    cursor = match.end
  }
  if (!tokens.length) return { text: await translate(text), targets: [] }
  masked += text.slice(cursor)
  let translated = await translate(masked)
  if (typeof translated !== 'string') throw new Error('Translation provider returned invalid glossary text')
  for (const { token, target } of tokens) {
    const exactToken = new RegExp(escapePattern(token), 'gi')
    if ((translated.match(exactToken) || []).length !== 1) throw new Error('Translation provider changed a glossary token')
    translated = translated.replace(exactToken, () => target)
  }
  if (translated.toLowerCase().includes(prefix.toLowerCase())) throw new Error('Translation provider returned an unknown glossary token')
  return { text: translated, targets: [...new Set(tokens.map(token => token.target))] }
}
