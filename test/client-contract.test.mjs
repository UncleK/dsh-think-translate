// Contract tests for the plugin's client bundle (issue #3).
//
// The bundle is a browser module graph — it cannot be imported into Node — so
// these assertions read the source text and pin the one contract that must hold
// against the official @deepseek-ai/dsh-client-ui-primitives:
//
//   * 0.1.2-alpha and later destructure a NESTED `labels` object and dereference
//     it without defaults (`context.labels.code.copyLabel`, `context.labels.footnotes`),
//     so passing only the old flat `codeLabels` prop makes every message with a
//     fenced code block (or footnotes) throw inside the official renderer.
//   * <= 0.1.1-rc renderers read the flat `codeLabels` prop instead.
//
// Both props are therefore passed. Verified against the real primitives build:
// the flat-only call reproduces `Cannot read properties of undefined (reading
// 'code')`, the nested one renders the code block with the configured copy label.
//
// Run with: node --test test/*.test.mjs
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')

describe('MarkdownText label contract (issue #3)', function () {
  it('builds the nested labels shape the 0.1.2+ renderer dereferences', function () {
    assert.match(src, /code:\s*\{\s*copyLabel:\s*tt\.copy,\s*copiedLabel:\s*tt\.copied\s*\}/)
    assert.match(src, /footnotes:\s*tt\.footnotes\s*\|\|\s*"Footnotes"/)
  })

  it('passes the nested labels to every official MarkdownText render', function () {
    const sites = src.split('labels: mdLabels, codeLabels: codeLabels').length - 1
    assert.equal(sites, 2, 'both the answer body and the collapsible original text must pass labels')
  })

  it('keeps the flat codeLabels prop for the <= 0.1.1-rc renderers', function () {
    assert.match(src, /var codeLabels = mdLabels \? mdLabels\.code : undefined;/)
  })

  it('caches the label objects, because MarkdownText is memoized on them', function () {
    assert.match(src, /mdLabelsCache\.set\(tt, labels\)/)
  })

  it('defines the footnotes label in all 8 languages', function () {
    const hits = (src.match(/^\s*footnotes: "/gm) || []).length
    assert.equal(hits, 8)
  })
})
