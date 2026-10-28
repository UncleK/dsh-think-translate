// Regenerate the editable comparison graphics; PNG previews use these SVGs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const assets = new URL('../docs/assets/', import.meta.url)
const dates = JSON.parse(readFileSync(new URL('../docs/first-release-evidence.json', import.meta.url), 'utf8'))
const copy = {
  'zh-CN': {
    title: '思考链翻译插件对比', subtitle: '为不同使用方式，保留不同选择',
    early: `早上线 ${dates.calendarDaysEarlier} 天`, official: '官方思考过程翻译', launched: '首次上线',
    foot: '首次上线按首个非 stage 的 npm 公开版本计，日期使用北京时间。',
    versions: '功能对比：本插件 1.2.15 / DSH 0.2.2-alpha.2 · 核对于 2026-10-29',
    sources: '来源：npm 发布时间记录 · 官方 0.2.1-alpha.2 发布说明',
    rows: [
      ['翻译范围', ['思考链 · 任务卡片 · 可选回答正文', '自动审查拒绝理由'], ['展开后的思考正文', '折叠预览保留原文']],
      ['本地模型', ['支持 Ollama', '按需加载、手动及空闲释放内存'], ['暂不支持本地模型']],
      ['提供方选择', ['Google / Bing / 自定义模型端点', 'OpenAI 兼容、Anthropic 与 DSH 发现'], ['Bing / Google', '原生付费 DeepSeek Flash']],
      ['失败回退', ['按启用顺序自动切换', '明显错误语言触发回退'], ['保留原文，用户显式重试', '不自动切换提供方']],
      ['翻译时机', ['全部预翻译 / 懒加载历史', '仅展开时翻译'], ['展开后翻译', '支持流式段落']],
      ['代码与路径', ['翻译前保护代码、路径、命令'], ['支持 Markdown 渲染', '翻译可能改变代码示例']],
      ['结果保存', ['浏览器缓存 + Host 内存缓存'], ['保存到所属 Session', '可跨进程复用']],
      ['界面集成', ['覆盖助手与任务界面', '需跟进上游界面接口'], ['复用官方正文 Factory', '维护成本更低']],
    ],
  },
  en: {
    title: 'Reasoning translation, compared', subtitle: 'Different capabilities for different workflows',
    early: `${dates.calendarDaysEarlier} days earlier`, official: 'Official reasoning translation', launched: 'First available',
    foot: 'First available = first public non-staging npm version. Dates use Asia/Shanghai.',
    versions: 'Features: plugin 1.2.15 / DSH 0.2.2-alpha.2 · Checked 2026-10-29',
    sources: 'Sources: npm publication records · Official 0.2.1-alpha.2 release notes',
    rows: [
      ['Coverage', ['Reasoning, tasks, optional answer text', 'Auto-review denial reasons'], ['Expanded reasoning text', 'Collapsed previews stay original']],
      ['Local models', ['Ollama, loaded on demand', 'Manual and idle memory release'], ['No local model provider']],
      ['Providers', ['Google / Bing / custom endpoints', 'OpenAI, Anthropic, DSH discovery'], ['Bing / Google', 'Native paid DeepSeek Flash']],
      ['Failure handling', ['Automatic ordered provider fallback', 'Rejects clearly wrong-language output'], ['Original text and explicit retry', 'No automatic provider fallback']],
      ['When to translate', ['Eager / lazy history', 'On expansion only'], ['After expansion', 'Supports streaming paragraphs']],
      ['Code and paths', ['Protected before translation'], ['Markdown rendering', 'Translation may alter code examples']],
      ['Saved results', ['Browser cache + Host memory cache'], ['Saved in the owning Session', 'Reusable across process restarts']],
      ['UI integration', ['Overrides Assistant and task views', 'Must track upstream UI interfaces'], ['Reuses the official content Factory', 'Lower integration maintenance']],
    ],
  },
}

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function text(x, y, content, size = 25, color = '#243247', weight = 400) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${escape(content)}</text>`
}
function lines(x, center, items, color = '#243247') {
  return items.map((item, i) => text(x, center + 9 + (i - (items.length - 1) / 2) * 35, item, 25, color)).join('\n')
}
mkdirSync(assets, { recursive: true })
for (const [language, c] of Object.entries(copy)) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1280" viewBox="0 0 1600 1280">',
    `<title>${escape(c.title)}</title>`,
    '<style>text{font-family:"Segoe UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif}</style>',
    '<rect width="1600" height="1280" fill="#ffffff"/>',
    text(56, 72, c.title, 42, '#142034', 700), text(56, 113, c.subtitle, 22, '#657186'),
    '<rect x="1236" y="34" width="308" height="54" rx="27" fill="#e9f0ff"/>',
    text(1270, 70, c.early, 27, '#345fce', 650),
    '<rect x="302" y="150" width="600" height="140" rx="14" fill="#edf3ff"/>',
    '<rect x="926" y="150" width="618" height="140" rx="14" fill="#f3f5f8"/>',
    text(330, 207, 'dsh-think-translate', 32, '#244fb7', 700),
    text(330, 255, `${c.launched}  ${dates.ours.localDate}`, 25, '#345fce', 600),
    text(954, 207, c.official, language === 'en' ? 29 : 32, '#263447', 650),
    text(954, 255, `${c.launched}  ${dates.official.localDate}`, 25, '#657186', 500),
  ]
  c.rows.forEach(([label, ours, official], i) => {
    const y = 308 + i * 104
    if (i % 2 === 0) svg.push(`<rect x="56" y="${y}" width="1488" height="104" rx="8" fill="#f8fafc"/>`)
    svg.push(text(74, y + 61, label, 23, '#536176', 600), lines(330, y + 52, ours), lines(954, y + 52, official))
    if (i < c.rows.length - 1) svg.push(`<path d="M56 ${y + 104}H1544" stroke="#e9edf3"/>`)
  })
  svg.push(text(56, 1185, c.foot, 20, '#68758a'), text(56, 1220, c.versions, 20, '#68758a'),
    `<a href="${escape(dates.official.releaseSource)}">${text(56, 1254, c.sources, 19, '#68758a')}</a>`, '</svg>')
  writeFileSync(new URL(`translation-comparison.${language}.svg`, assets), svg.join('\n') + '\n')
}
console.log(fileURLToPath(assets))
