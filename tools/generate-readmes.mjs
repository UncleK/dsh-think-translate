// README layout and SVG text controls use only GitHub-supported markup.
// Raster hero banners and comparison charts are produced with image_gen;
// their exact copy and prompts are recorded in docs/i18n/visual-copy.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = p => readFileSync(resolve(root, p), 'utf8')
const write = (p, text) => writeFileSync(resolve(root, p), text)
const copy = JSON.parse(read('docs/i18n/readme-copy.json'))
const visual = JSON.parse(read('docs/i18n/visual-copy.json')).copy
const version = JSON.parse(read('package.json')).version
const repo = 'https://github.com/UncleK/dsh-think-translate'
const raw = 'https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/'
const languages = [['zh-CN', '中文'], ['en', 'English'], ['ja', '日本語'], ['ko', '한국어'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['ru', 'Русский'], ['pt', 'Português']]
const navIds = ['quick-start', 'demo', 'features', 'comparison', 'faq']
const badgeIds = ['mit', 'local', 'original']
const fileFor = lang => lang === 'en' ? 'README.md' : `README.${lang}.md`
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const img = (file, alt, attrs = '') => `<img src="${raw}${file}?v=${version}" alt="${esc(alt)}" ${attrs}/>`
function textSvg(text, badge = false, index = 0) {
  const size = badge ? 11 : 16
  const width = Math.ceil([...text].reduce((sum, ch) => sum + (/[\u2e80-\u9fff\uac00-\ud7af]/u.test(ch) ? 1 : .64), 0) * size + (badge ? 22 : 8))
  const height = badge ? 26 : 24
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${badge ? `<rect width="${width}" height="${height}" rx="4" fill="${index === 1 ? '#edf2ff' : '#f1f4f9'}"/>` : ''}<text x="${width / 2}" y="${badge ? 17 : 18}" text-anchor="middle" font-family="Arial,Microsoft YaHei,sans-serif" font-size="${size}" fill="${badge ? (index === 1 ? '#4d6bfe' : '#596780') : '#111111'}">${esc(text)}</text></svg>\n`
}
function assets(lang, c) {
  c.nav.forEach((text, i) => write(`docs/assets/nav-${navIds[i]}.${lang}.svg`, textSvg(text)))
  c.badges.forEach((text, i) => write(`docs/assets/badge-${badgeIds[i]}.${lang}.svg`, textSvg(text, true, i)))
}
function navigation(lang, c) {
  return `<p align="center">\n  ${languages.map(([code, name]) => code === lang ? `<b>${name}</b>` : `<a href="${fileFor(code)}">${name}</a>`).join(' · ')}\n</p>\n\n<p align="center">\n  ${c.nav.map((label, i) => `<a href="#${navIds[i]}">${img(`docs/assets/nav-${navIds[i]}.${lang}.svg`, label, 'height="24" ')}</a>`).join(' &nbsp;·&nbsp; ')}\n</p>`
}
function details(title, body) { return `<details>\n<summary><b>${esc(title)}</b></summary>\n\n${body}\n\n</details>` }
function document(lang, c) {
  const v = visual[lang]
  const featureBodies = [v.ours[3], v.ours[0], c.reviewDetail, `${v.ours[4]}. ${v.ours[5]}.`, v.ours[6], v.ours[2]]
  const cards = [0, 2, 4].map(i => `<tr>\n${[i, i + 1].map(j => `<td width="50%" valign="top">\n<h3>${esc(c.cardTitles[j])}</h3>\n<p>${esc(featureBodies[j])}</p>\n</td>`).join('\n')}\n</tr>`).join('\n')
  return `<p align="center">\n  ${img(`docs/assets/hero.${lang}.png`, `dsh-think-translate — ${v.hero[0]}`, 'width="100%" ')}\n</p>

<p align="center">\n  <b>${esc(c.introTitle)}</b><br />\n  ${esc(c.intro)}\n</p>

<p align="center">\n  ${c.badges.map((label, i) => img(`docs/assets/badge-${badgeIds[i]}.${lang}.svg`, label)).join('\n  ')}\n</p>

${navigation(lang, c)}

---

<a id="demo"></a>
## ${c.demoHeading}

<table>
<tr>
<td width="50%" align="center" valign="bottom">
${img('demo/demo.gif', c.demo1, 'width="100%" ')}
</td>
<td width="50%" align="center" valign="bottom">
${img('demo/demo2.gif', c.demo2, 'width="100%" ')}
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>${esc(c.demo1)}</sub></td>
<td align="center" valign="top"><sub>${esc(c.demo2)}</sub></td>
</tr>
</table>

<a id="comparison"></a>
## ${v.title}

<p align="center">\n  ${img(`docs/assets/translation-comparison.${lang}.png`, v.title, 'width="100%" ')}\n</p>

${c.comparisonNotice}

<a id="quick-start"></a>
## ${c.installHeading}

\x60\x60\x60bash
dsh plugin --profile web add dsh-think-translate
\x60\x60\x60

${c.installIntro}

${details(c.installDetails, `${c.fromGithub}\n\n\x60\x60\x60bash\ndsh plugin --profile web add github:UncleK/dsh-think-translate\n\x60\x60\x60\n\n${c.updateNpm}\n\n\x60\x60\x60bash\ndsh plugin --profile web add dsh-think-translate@latest\n\x60\x60\x60\n\n${c.restart}`)}

<a id="features"></a>
## ${c.featuresHeading}

<table>
${cards}
</table>

### ${c.providersHeading}

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

${c.providersIntro}

\x60\x60\x60text
${c.chain}
\x60\x60\x60

${details(c.providerDetails, c.providerNotes.map(t => '- ' + t).join('\n'))}

### ${c.memoryHeading}

| ${c.memoryHeaders.join(' | ')} |
|---|---|
${c.memoryRows.map(row => '| ' + row.join(' | ') + ' |').join('\n')}

${c.memoryFoot}

<a id="languages"></a>
### ${c.languagesHeading}

${languages.map(([, name]) => name).join(' · ')}

${c.languagesIntro}

<a id="faq"></a>
## ${c.faqHeading}

${c.faqs.map(([q, a]) => details(q, a)).join('\n\n')}

${details(c.changesTitle, c.changes.join('\n\n') + '\n\n' + c.older)}

${details(c.devTitle, c.devNotes.map(t => '- ' + t.replace('(docs/maintenance-notes.md)', `(${repo}/blob/main/docs/maintenance-notes.md)`)).join('\n'))}

---

<p align="center">\n  <b>dsh-think-translate</b><br />\n  <a href="${repo}/issues">${esc(c.footer[0])}</a> &nbsp;·&nbsp; <a href="${repo}/releases">${esc(c.footer[1])}</a> &nbsp;·&nbsp; <a href="${repo}/blob/main/LICENSE">${esc(c.footer[2])}</a>\n</p>\n`
}
for (const [lang, c] of Object.entries(copy)) { assets(lang, c); write(fileFor(lang), document(lang, c)) }
assets('zh-CN', { nav: ['快速安装', '实际演示', '核心能力', '官方对比', '常见问题'], badges: ['MIT License', 'Local Ollama', '原文完整保留'] })
let chinese = read('docs/i18n/README.zh-CN.template.md')
chinese = chinese.replace(/src="(docs\/assets\/[^"?]+|demo\/[^"?]+)"/g, (_, file) => `src="${raw}${file}?v=${version}"`)
write('README.zh-CN.md', chinese)
console.log(`Generated ${languages.length} READMEs and localized black navigation controls for ${version}.`)
