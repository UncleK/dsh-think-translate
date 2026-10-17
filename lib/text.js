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
