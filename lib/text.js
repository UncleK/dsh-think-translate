// Code spans keep their exact source offsets so neither translation nor batching
// needs placeholders that a provider could translate, remove, or reorder.
export function protectedTextParts(text, nestedLists = true) {
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
  // CommonMark HTML blocks as [start, end]. A line of an open block is verbatim, so it is no list
  // item whatever it looks like. The end can sit on the start line, the last two kinds end at a
  // blank line, and only the last kind cannot interrupt a paragraph.
  const htmlBlocks = [
    [/^<(?:pre|script|style|textarea)(?:[\t >]|$)/i, /<\/(?:pre|script|style|textarea)>/i],
    [/^<!--/, /-->/],
    [/^<\?/, /\?>/],
    [/^<![a-z]/i, />/],
    [/^<!\[CDATA\[/, /\]\]>/],
    [/^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[\t ]|\/?>|$)/i, /^\s*$/],
    [/^<(?:(?!(?:pre|script|style|textarea)[\t />])[a-z][a-z\d-]*(?:[\t ]+[a-z_:][\w.:-]*(?:[\t ]*=[\t ]*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*[\t ]*\/?|\/[a-z][a-z\d-]*[\t ]*)>$/i, /^\s*$/],
  ]
  const markers = /^[\t ]*(?:(?:>|[-+*][\t ]|[0-9]{1,9}[.)][\t ])[\t ]*)*/
  const htmlBlock = (content, paragraph) => htmlBlocks.slice(0, paragraph ? -1 : undefined).find(([start]) => start.test(content))
  // The walk below can miss a block: a code span or a fence swallows its opening line, or a tag it
  // takes for a block does. So a plain scan, with no state but the blocks it saw open, marks the
  // lines any block could hold. It overshoots, and a list line it marks stays code, as on base.
  // Fences pair as CommonMark pairs them, so an opener without a closer marks the rest of the text.
  // The rest is also marked from a line left of an open fence, which can end the item that holds it,
  // and from a fence the parser's pairing says nothing about: one in a quote, which ends with the
  // quote, one behind a number other than 1, which can be plain paragraph text, and one in an HTML
  // block, which is no fence. A block opened inside a fence that holds is just text.
  const plainBlockLines = new Set()
  if (nestedLists) {
    const open = new Set()
    let fence = null
    let unsure = false
    for (let start = 0, end; start < text.length; start = end) {
      end = lineEnd(start)
      if (unsure || fence || open.size) plainBlockLines.add(start)
      if (unsure) continue
      const line = text.slice(start, end)
      const lead = line.match(markers)[0]
      const content = line.slice(lead.length).trim()
      const column = width(line.match(/^[\t ]*/)[0])
      const run = /^(?:`{3,}(?=[^`]*$)|~{3,})/.exec(content)
      if (fence) {
        if (line.trim() && column < fence.column) unsure = true
        else if (run && run[0] === content && !lead.trim() && content[0] === fence.char && content.length >= fence.size && (fence.column ? column === fence.column : column < 4)) fence = null
        continue
      }
      if (run) {
        if (/>|[02-9]|[0-9]{2}/.test(lead) || open.size) unsure = true
        else fence = { column: width(lead), char: content[0], size: run[0].length }
        continue
      }
      const closed = [...open].filter(close => close.test(line))
      closed.forEach(close => open.delete(close))
      // The closing tag that ends a block is no block of its own.
      const block = htmlBlock(content, closed.length > 0)
      if (block && !block[1].test(content)) open.add(block[1])
    }
  }
  // The open HTML block and the column of the item that holds it: a line left of that column closes
  // the item and with it the block. htmlEnd is where the last verbatim line of any block ends.
  let html = null
  let htmlEnd = 0
  function openHtml(content, column, paragraph) {
    const block = htmlBlock(content, paragraph)
    if (!block) return false
    html = block[1].test(content) ? null : { end: block[1], column }
    openParagraph = false
    return true
  }
  function trackBlocks(line) {
    if (!line.trim()) { openParagraph = false; if (html && html.end.test(line)) html = null; return }
    const column = width(line.match(/^[\t ]*/)[0])
    if (html && column >= html.column) {
      if (html.end.test(line)) html = null
      htmlEnd = cursor + line.length
      return
    }
    html = null
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
      // The text of an item can open a block, unless a wide gap makes that text code.
      const lead = line.match(markers)[0]
      if (openParagraph && !wide(lead)) openHtml(line.slice(lead.length).trim(), width(lead), false)
    } else if (depth < 4 && openHtml(line.trim(), openItems[held - 1] || 0, openParagraph)) {
      openItems.length = held
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
  // Nor can it lean on a verbatim line of an HTML block, or open or sit in such a block itself.
  function nestedListItem(start, line) {
    const current = line.match(item)
    if (!current || wide(current[0]) || plainBlockLines.has(start) || htmlBlock(line.replace(markers, '').trim())) return false
    const before = text.slice(0, start).trimEnd()
    const from = before.lastIndexOf('\n') + 1
    const parent = before.slice(from).match(item)
    const last = parts[parts.length - 1]
    if (!parent || from < htmlEnd || plainBlockLines.has(from) || (from === 0 && parent[1]) || /^ {1,3}\t/.test(parent[1]) || (last && last.start <= from && last.end > from)) return false
    const column = width(current[1])
    if (html && column >= html.column) return false
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
      // nestedLists is off for a client that batches without regard to them, as handleTranslate explains.
      const indentedCode = /^(?: {4}|\t)/.test(line) && !(nestedLists && nestedListItem(cursor, line))
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
export async function translateProtectedText(text, translate, split = value => [value], nestedLists = true) {
  const output = []
  for (const part of protectedTextParts(text, nestedLists)) {
    const match = !part.code && part.text.match(/^(\s*)([\s\S]*?)(\s*)$/)
    if (!match || !/\p{L}/u.test(match[2])) { output.push(part.text); continue }
    const chunks = []
    for (const chunk of split(match[2])) chunks.push((await translate(chunk)).trim())
    output.push(match[1] + chunks.join('\n\n') + match[3])
  }
  return output.join('')
}
