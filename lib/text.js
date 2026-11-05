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
  const item = /^([\t ]*)(?:[-+*]|([0-9]{1,9})[.)])[\t ]+(?=\S)/
  // A tab runs to the next tab stop of 4 columns.
  const width = value => [...value].reduce((column, char) => column + (char === '\t' ? 4 - column % 4 : 1), 0)
  // More than 4 columns behind a marker make the text a code block inside the item, whose
  // content then starts one column behind the marker.
  const wide = value => width(value) - width(value.trimEnd()) > 4
  // The list items open above the current line, as the columns where their content starts,
  // and whether a paragraph is open there. A line inside an open item measures from its content.
  const openItems = []
  let openParagraph = false
  function trackBlocks(line) {
    if (!line.trim()) { openParagraph = false; return }
    const column = width(line.match(/^[\t ]*/)[0])
    const held = openItems.filter(start => start <= column).length
    const depth = column - (openItems[held - 1] || 0)
    const marker = depth < 4 && line.match(item)
    if (depth < 4 && /^[\t ]*(?:#{1,6}(?:[\t ]|$)|>|`{3,}|~{3,}|([-*_])[\t ]*(?:\1[\t ]*){2,}$)/.test(line.trimEnd())) {
      openItems.length = held
      openParagraph = false
    } else if (marker && !(openParagraph && held === openItems.length && marker[2] && Number(marker[2]) !== 1)) {
      // Only a 1 can open an ordered list under a paragraph. Any other number is paragraph text.
      openItems.length = held
      openItems.push(wide(marker[0]) ? width(marker[0].trimEnd()) + 1 : width(marker[0]))
      openParagraph = !wide(marker[0])
    } else if (!openParagraph || (held < openItems.length && item.test(line))) {
      // A list line left of an open item ends that item, whatever it holds.
      openItems.length = held
      openParagraph = depth < 4
    }
  }
  // An indented list line is prose only under a list item that stayed prose, and
  // only while it is not indented far enough to be a code block in the item that holds it.
  // An indented first line may be the tail of a sentence cut mid-line by a batch.
  // A space before a tab hides a 4-column indent from the code check below, so nothing
  // has found that line to be a list item, and a line under it cannot lean on it.
  function nestedListItem(start, line) {
    const current = line.match(item)
    if (!current || wide(current[0])) return false
    const before = text.slice(0, start).trimEnd()
    const from = before.lastIndexOf('\n') + 1
    const parent = before.slice(from).match(item)
    const last = parts[parts.length - 1]
    if (!parent || (from === 0 && parent[1]) || /^ {1,3}\t/.test(parent[1]) || (last && last.start <= from && last.end > from)) return false
    const column = width(current[1])
    return column - (openItems.filter(start => start <= column).pop() || 0) < 4
  }
  function technicalSpan(start) {
    const before = text[start - 1] || ''
    if (before && /[A-Za-z0-9_\\/]/.test(before)) return 0
    const rest = text.slice(start)
    // Quotes are part of a path token only when its prefix is unambiguous.
    const quoted = rest.match(/^("|'|“)(?:[A-Za-z]:[\\/]|\\\\|~?\/|\.\.?\/)/)
    if (quoted) {
      const close = quoted[1] === '“' ? '”' : quoted[1]
      // The closing quote must be on the same line. Without one the quote stays
      // prose and the next character can still match the bare path below. While the
      // line is still open the quote can close, so hold it like an unfinished span.
      const stop = lineEnd(start)
      const end = text.slice(start + 1, stop).indexOf(close)
      return end >= 0 ? end + 2 : text[stop - 1] === '\n' ? 0 : text.length - start
    }
    const token = rest.match(/^(?:https?:\/\/|file:\/\/|[A-Za-z]:[\\/]|\\\\|~?\/|\.\.?\/)[^\s<>"'`，。！？；：、]+/)
      || rest.match(/^[\w@.-]+\.(?:[cm]?js|jsx|tsx?|jsonl?|ya?ml|toml|ini|env|md|py|sh|ps1|cmd|bat|exe|lock|go|rs|cpp|sql|html|css|txt|zstd|png|jpe?g|svg)(?![\w.])/i)
    if (token) {
      let value = token[0].replace(/[.,;:!?，。！？；：、]+$/, '')
      // Keep balanced URL parentheses, but leave Markdown/prose delimiters out.
      for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
        while (value.endsWith(close) && value.split(close).length > value.split(open).length) value = value.slice(0, -1)
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
        trackBlocks(line)
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
      const indentedCode = /^(?: {4}|\t)/.test(line) && !nestedListItem(cursor, line)
      trackBlocks(line)
      if (indentedCode) {
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
