// Code spans keep their exact source offsets so neither translation nor batching
// needs placeholders that a provider could translate, remove, or reorder.
export function protectedTextParts(text) {
  const parts = []
  let proseStart = 0
  let cursor = 0
  function protect(start, end, complete) {
    if (start > proseStart) parts.push({ text: text.slice(proseStart, start), start: proseStart, end: start, code: false, complete: true })
    parts.push({ text: text.slice(start, end), start, end, code: true, complete })
    proseStart = end
    cursor = end
  }
  function lineEnd(start) {
    const newline = text.indexOf('\n', start)
    return newline < 0 ? text.length : newline + 1
  }
  function technicalSpan(start) {
    const before = text[start - 1] || ''
    if (before && /[A-Za-z0-9_\\/]/.test(before)) return 0
    const rest = text.slice(start)
    // Quotes are part of a path token only when its prefix is unambiguous.
    const quoted = rest.match(/^("|'|“)(?:[A-Za-z]:[\\/]|\\\\|~?\/|\.\.?\/)/)
    if (quoted) {
      const close = quoted[1] === '“' ? '”' : quoted[1]
      const end = text.indexOf(close, start + 1)
      return end < 0 ? text.length - start : end + 1 - start
    }
    const token = rest.match(/^(?:https?:\/\/|file:\/\/|[A-Za-z]:[\\/]|\\\\|~?\/|\.\.?\/)[^\s<>"'`，。！？；：、]+/)
      || rest.match(/^[\w@.-]+\.(?:[cm]?js|jsx|tsx?|jsonl?|ya?ml|toml|ini|env|md|py|sh|ps1|cmd|bat|exe|lock|go|rs|cpp|sql|html|css|txt|zstd|png|jpe?g|svg)(?![\w.])/i)
    if (token) {
      let value = token[0].replace(/[.,;:!?，。！？；：、]+$/, '')
      // Keep balanced URL parentheses, but leave Markdown/prose delimiters out.
      for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
        while (value.endsWith(close) && value.split(close).length > value.split(open).length) value = value.slice(0, -1)
      }
      // Common CJK pairs use a slash as punctuation. Keep path-shaped tokens
      // and standalone Unicode directory names protected.
      const left = text.slice(Math.max(0, start - 2), start)
      if (value.startsWith('/') && !/[.\\/]/.test(value.slice(1).replace(/和\/或|输入\/输出|入力\/出力/g, ''))
        && ((left.endsWith('输入') && value.startsWith('/输出'))
          || (left.endsWith('入力') && value.startsWith('/出力'))
          || (left.endsWith('和') && value.startsWith('/或')))) return 0
      // Split at a known file extension followed by a prose continuation.
      // A URL can legally contain the same text as a slug, so keep it whole.
      if (!/^(?:https?|file):/i.test(value)) {
        const extension = /\.(?:[cm]?js|jsx|tsx?|jsonl?|ya?ml|toml|ini|env|md|py|sh|ps1|cmd|bat|exe|lock|go|rs|cpp|sql|html|css|txt|zstd|png|jpe?g|svg)(?=(?:然后|接着|并且|之后|後に|してから)[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}$)/iu.exec(value)
        if (extension) value = value.slice(0, extension.index + extension[0].length)
      }
      return value.length
    }
    const command = rest.match(/^(?:(?:npm|pnpm|yarn)\s+(?:run\s+[\w:.-]+|test|ci|install|build|start)|git\s+(?:status|diff|log|fetch|pull|push|show|branch)|(?:python3?|node)\s+[\w./\\:-]+\.(?:py|[cm]?js))(?=$|[\s.,;:!?，。！？；：、)]|--)(?:[ \t]+(?:--?[\w-]+(?:=[\w./\\:@=-]+)?|--|"[^"\r\n]*"|'[^'\r\n]*'))*/)
    return command ? command[0].length : 0
  }
  while (cursor < text.length) {
    if (cursor === 0 || text[cursor - 1] === '\n') {
      const end = lineEnd(cursor)
      const line = text.slice(cursor, end)
      // Treat indented/quoted fences conservatively as code as well.
      const fence = line.match(/^[\t ]*(?:>[\t ]*)*(?:(?:[-+*]|[0-9]+[.)])[\t ]+)?(`{3,}|~{3,})[^\r\n]*(?:\r?\n)?$/)
      if (fence) {
        const close = new RegExp('^[\\t ]*(?:>[\\t ]*)*' + fence[1][0] + '{' + fence[1].length + ',}[\\t ]*(?:\\r?\\n)?$')
        let stop = end
        let complete = false
        while (stop < text.length) {
          const next = lineEnd(stop)
          if (close.test(text.slice(stop, next))) { stop = next; complete = true; break }
          stop = next
        }
        protect(cursor, stop, complete)
        continue
      }
      if (/^(?: {4}|\t)/.test(line)) {
        protect(cursor, end, end < text.length || line.endsWith('\n'))
        continue
      }
      const shellLine = /^(?:\$\s*)?(?:(?:npm|pnpm|yarn)\s+(?:run|test|ci|install|add|remove|uninstall|build|start)\b|git\s+(?:status|diff|log|fetch|pull|push|show|branch|checkout|switch|commit|add)\b|(?:curl|wget)\s+-)/.test(line)
      if (shellLine && !/\b(?:and|then|before|after|because|please|shows|prints|returns|failed|succeeded|should|will|can|is|are)\b/.test(line)) {
        protect(cursor, end, end < text.length || line.endsWith('\n'))
        continue
      }
    }
    if (text[cursor] === '`') {
      let slashes = 0
      for (let i = cursor - 1; i >= 0 && text[i] === '\\'; i--) slashes++
      if (slashes % 2) { cursor++; continue }
      let after = cursor + 1
      while (text[after] === '`') after++
      const size = after - cursor
      let next = after
      let stop = text.length
      let complete = false
      while ((next = text.indexOf('`', next)) >= 0) {
        let end = next + 1
        while (text[end] === '`') end++
        if (end - next === size) { stop = end; complete = true; break }
        next = end
      }
      // An unfinished streaming code span must not expose its body as prose.
      protect(cursor, stop, complete)
      continue
    }
    const technicalLength = technicalSpan(cursor)
    if (technicalLength) {
      protect(cursor, cursor + technicalLength, true)
      continue
    }
    cursor++
  }
  if (proseStart < text.length) parts.push({ text: text.slice(proseStart), start: proseStart, end: text.length, code: false, complete: true })
  return parts
}

// Only prose reaches a provider; separators adjoining code stay byte-for-byte.
export async function translateProtectedText(text, translate, split = value => [value]) {
  const output = []
  for (const part of protectedTextParts(text)) {
    const match = !part.code && part.text.match(/^(\s*)([\s\S]*?)(\s*)$/)
    if (!match || !/\p{L}/u.test(match[2])) { output.push(part.text); continue }
    const chunks = []
    for (const chunk of split(match[2])) chunks.push((await translate(chunk)).trim())
    output.push(match[1] + chunks.join('\n\n') + match[3])
  }
  return output.join('')
}
