import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { scanDshProviders, extractDshProviders, extractCredRefs, extractHarnessDefaultRoute, parseDshYaml, dshSections, providersFromSections } from '../lib/discovery.js'
import { stripResolvedKeys } from '../lib/index.js'

const home = join('test-home', '.dsh')
const desktop = join(home, 'profiles', 'desktop')
const web = join(home, 'profiles', 'web')
const patchPath = join(desktop, 'cordis.patch.yml')
const profileContext = { home, name: 'desktop', dir: desktop, patchPath, overlays: [] }
// Shape emitted by DSH's settings/config-editor: a row's complete config,
// rather than a legacy section map. Credentials remain at the home root.
const patch = `
- id: llm-pi-ai
  config:
    providers:
      desktop-hub:
        api: openai-completions
        apiKeyEnv: DESKTOP_KEY
        baseURL: 'https://desktop.example/v1' # inline comment
        models:
          - id: 'desktop-model'
            input: [text, image]
- id: default-model
  config: { provider: deepseek-official, model: deepseek-chat }
`
const legacy = `llm-pi-ai:
  providers:
    legacy-hub:
      baseURL: https://legacy.example/v1
      models: [{id: old-model}]
`

function scan(files, extra = {}) {
  const paths = new Map(Object.entries(files))
  return scanDshProviders({
    candidates: [home], profileContext,
    exists: path => paths.has(path),
    readText(path) {
      if (!paths.has(path)) throw Object.assign(new Error('absent'), { code: 'ENOENT' })
      const content = paths.get(path)
      if (content instanceof Error) throw content
      return content
    },
    ...extra,
  })
}

describe('issue #11: profile-owned DSH provider discovery', () => {
  it('reads Desktop patch rows without any legacy settings.yaml', () => {
    const result = scan({ [patchPath]: patch, [join(home, '.credentials.yaml')]: 'version: 1\nrefs:\n  DESKTOP_KEY: "quoted key # intact"\n' })
    assert.equal(result.ok, true)
    assert.equal(result.providers['desktop-hub'].model, 'desktop-model')
    assert.equal(result.providers['desktop-hub'].apiKeyEnv, 'DESKTOP_KEY')
    assert.equal(result.refs.DESKTOP_KEY, 'quoted key # intact')
    assert.equal(result.providers['deepseek-official'].model, 'deepseek-chat')
    assert.equal(result.diag.sourcePath, patchPath)
    assert.deepEqual(result.diag.sourcePaths, [patchPath])
    assert.equal(result.diag.settingsFound, false)
    assert.equal(result.diag.profile, 'desktop')
  })

  it('follows the running profile ahead of environment guesses and old files', () => {
    const result = scan({ [patchPath]: patch, [join('old-home', 'settings.yaml')]: legacy, [join(home, 'settings.yaml')]: legacy }, { candidates: ['old-home', home] })
    assert.equal(result.diag.home, home)
    assert.equal(result.providers['legacy-hub'], undefined)
    assert.ok(result.providers['desktop-hub'])
  })

  it('does not mix Desktop providers into the Web profile', () => {
    const webPath = join(web, 'cordis.patch.yml')
    const result = scan({ [patchPath]: patch, [webPath]: patch.replaceAll('desktop-', 'web-') }, {
      profileContext: { home, name: 'web', dir: web, patchPath: webPath },
    })
    assert.ok(result.providers['web-hub'])
    assert.equal(result.providers['desktop-hub'], undefined)
    assert.equal(result.diag.sourcePath, webPath)
  })

  it('infers the installed profile when old launchers provide no context', () => {
    const result = scan({ [patchPath]: patch }, { profileContext: undefined, modulePath: home + '/profiles/desktop/node_modules/dsh-think-translate/lib/index.js' })
    assert.equal(result.diag.profile, 'desktop')
    assert.ok(result.providers['desktop-hub'])
  })

  it('finds the sole Desktop patch without any legacy settings file', () => {
    const result = scan({ [patchPath]: patch }, { profileContext: undefined })
    assert.ok(result.providers['desktop-hub'])
  })

  it('does not guess between two profiles without runtime information', () => {
    const result = scan({ [patchPath]: patch, [join(web, 'cordis.patch.yml')]: patch }, { profileContext: undefined })
    assert.equal(result.ok, false)
    assert.deepEqual(result.providers, {})
    assert.match(result.diag.error, /active DSH profile/)
  })

  it('keeps the legacy format working when no modern profile exists', () => {
    const result = scan({ [join(home, 'settings.yaml')]: legacy }, { profileContext: undefined })
    assert.equal(result.ok, true)
    assert.equal(result.providers['legacy-hub'].model, 'old-model')
    assert.equal(result.diag.sourcePath, join(home, 'settings.yaml'))
  })

  it('keeps legacy settings for an older profile install with no Cordis files', () => {
    const result = scan({ [join(home, 'settings.yaml')]: legacy }, {
      profileContext: undefined, modulePath: home + '/profiles/web/node_modules/dsh-think-translate/lib/index.js',
    })
    assert.equal(result.ok, true)
    assert.equal(result.providers['legacy-hub'].model, 'old-model')
  })

  it('uses inherited runtime rows for a profile patch that only edits other plugins', () => {
    const result = scan({ [patchPath]: '- id: ui-theme\n  config: {preference: dark}\n' }, { runtimeRows: parseDshYaml(patch) })
    assert.ok(result.providers['desktop-hub'])
    assert.equal(result.providers['deepseek-official'].model, 'deepseek-chat')
  })

  it('applies profile, home and command-line replacements in DSH order', () => {
    const result = scan({
      [join(desktop, 'cordis.yml')]: patch.replaceAll('desktop-model', 'base-model'),
      [patchPath]: patch,
      [join(home, 'cordis.patch.yml')]: '- id: default-model\n  config: {provider: deepseek-official, model: home-model}\n',
    }, { profileContext: { ...profileContext, overlays: [{ id: 'default-model', config: { provider: 'deepseek-official', model: 'cli-model' } }] } })
    assert.equal(result.providers['desktop-hub'].model, 'desktop-model')
    assert.equal(result.providers['deepseek-official'].model, 'cli-model')
  })

  it('replaces complete row configs rather than reviving deleted inherited providers', () => {
    const result = scan({ [patchPath]: '- id: llm-pi-ai\n  config: {providers: {}}\n' }, { runtimeRows: parseDshYaml(patch).slice(0, 1) })
    assert.equal(result.ok, true)
    assert.deepEqual(result.providers, {})
  })

  it('honors disabled providers, rows and groups', () => {
    const sections = dshSections([parseDshYaml(`
- insert:
    - id: group
      group: true
      disabled: true
      config:
        - id: llm-pi-ai
          config:
            providers:
              disabled-hub: {baseURL: 'https://disabled.example', models: [{id: m}]}
`)])
    assert.deepEqual(providersFromSections(sections), {})
    const result = scan({ [patchPath]: patch + '\n- id: llm-pi-ai\n  disabled: true\n- id: llm-deepseek\n  disabled: true\n' })
    assert.equal(result.ok, true)
    assert.deepEqual(result.providers, {})
  })

  it('reads quoted/flow YAML, anchors, nested inserts and legacy model aliases', () => {
    const result = extractDshProviders(`
- insert:
    - id: llm-pi-ai
      config:
        providers:
          first: &provider {baseURL: 'https://flow.example/v1', models: [{id: 'model with spaces'}]}
          second: *provider
`)
    assert.equal(result.first.model, 'model with spaces')
    assert.equal(result.second.baseURL, 'https://flow.example/v1')
    assert.equal(extractHarnessDefaultRoute('agent-default-model: {provider: deepseek-official, model: legacy-model}').entry.model, 'legacy-model')
  })

  it('keeps literal/ref credentials out of browser, disk and diagnostics', () => {
    const secret = 'fixture-secret-do-not-expose'
    const result = scan({
      [patchPath]: patch.replace('apiKeyEnv: DESKTOP_KEY', 'apiKey: ' + secret),
      [join(home, '.credentials.yaml')]: 'refs: {DESKTOP_KEY: ' + secret + '}\n',
    })
    assert.equal(result.providers['desktop-hub'].apiKey, secret)
    assert.equal(result.refs.DESKTOP_KEY, secret)
    assert.equal(JSON.stringify(result.diag).includes(secret), false)
    assert.equal(JSON.stringify(stripResolvedKeys({ providers: result.providers })).includes(secret), false)
  })

  it('never evaluates !!js expressions and skips expression-valued endpoints', () => {
    const result = scan({ [patchPath]: patch.replace("'https://desktop.example/v1'", '!!js "process.exit(99)"') })
    assert.equal(result.ok, true)
    assert.equal(result.providers['desktop-hub'], undefined)
    assert.ok(result.providers['deepseek-official'])
  })

  it('ignores unrelated !!js fields without losing literal provider configs', () => {
    const result = scan({ [patchPath]: patch + '\n- id: unrelated\n  config: {value: !!js "process.exit(99)"}\n' })
    assert.equal(result.ok, true)
    assert.ok(result.providers['desktop-hub'])
  })

  it('does not enable an expression-disabled row by guessing its value', () => {
    const result = scan({ [patchPath]: patch + '\n- id: llm-pi-ai\n  disabled: !!js "true"\n' })
    assert.equal(result.providers['desktop-hub'], undefined)
    assert.ok(result.providers['deepseek-official'])
  })

  it('sanitizes malformed YAML without treating a failed scan as provider removal', () => {
    const secret = 'fixture-secret-malformed'
    const result = scan({ [patchPath]: patch + '\nsecret: [' + secret })
    assert.equal(result.ok, false)
    assert.deepEqual(result.providers, {})
    assert.equal(result.diag.error, 'Invalid DSH YAML')
    assert.equal(result.diag.sourcePath, patchPath)
    assert.equal(JSON.stringify(result.diag).includes(secret), false)
  })

  it('treats unreadable profiles/credentials as transient failures', () => {
    for (const path of [patchPath, join(home, '.credentials.yaml')]) {
      const result = scan({ [patchPath]: patch, [path]: Object.assign(new Error('sensitive file content'), { code: 'EACCES' }) })
      assert.equal(result.ok, false)
      assert.deepEqual(result.providers, {})
      assert.equal(JSON.stringify(result.diag).includes('sensitive file content'), false)
    }
  })

  it('reports an absent profile without falling back to stale legacy settings', () => {
    const result = scan({ [join(home, 'settings.yaml')]: legacy })
    assert.equal(result.ok, false)
    assert.deepEqual(result.providers, {})
    assert.equal(result.diag.sourcePath, patchPath)
  })

  it('unquotes credential references and ignores expressions and non-string keys', () => {
    assert.deepEqual(extractCredRefs('refs: {KEY: "a # b", NUMBER: 123, EXPR: !!js "process.exit(99)"}'), { KEY: 'a # b' })
  })
})
