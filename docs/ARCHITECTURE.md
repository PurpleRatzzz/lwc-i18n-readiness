# Architecture and module contracts

The contracts below let the scanner and the label tooling be built in parallel. Change them only deliberately, and update this file in the same commit.

## Layout

```
src/
  cli.js                 command dispatcher: lwc-i18n <scan|pseudo|xliff-export|translate|xliff-import>
  finding.js             Finding shape, normalizeText, fingerprint
  baseline.js            "only new findings fail" logic
  commands/<name>.js     one file per CLI command, exports run(argv) -> exit code
  rules/index.js         rule registry
  rules/rN-*.js          one file per rule
  scan/                  file discovery, parsing, orchestration           (scanner)
  report/                text / json / github / markdown formatters        (scanner)
  config/default.js      attribute allowlists, JS sinks, ignore patterns   (scanner)
  labels/                read CustomLabels, write translation-meta.xml     (labels)
  pseudo/                pseudo-localization                               (labels)
  xliff/                 XLIFF 1.2 export / import / validation            (labels)
  translators/           translator adapters: stub, pseudo, external cmd  (labels)
test/                    node:test files, mirroring src/; fixtures in test/fixtures/
eval/                    gold set and scoring for precision/recall
docs/                    this file, the engineer checklist
upstream/                drafts of issues/PRs for upstream repos (posted only after review)
```

## Finding (src/finding.js)

Every rule returns `Finding[]` built with `makeFinding`:

| field | meaning |
|---|---|
| `ruleId` | `R1`…`R6` |
| `ruleName` | kebab-case name, e.g. `hardcoded-attribute` |
| `severity` | `error` (fails a PR when new) or `warning` (reported only) |
| `file` | path relative to the scan root, forward slashes |
| `line`, `column` | 1-based, at the **first non-whitespace character** of `text` (for attributes: where the attribute name starts) |
| `text` | the offending string as written in source, whitespace collapsed by `normalizeText` |
| `message` | one sentence for the engineer: what is wrong and what to do instead |
| `context` | rule-specific extras (`element`, `attribute`, `sink`, `subrule`…) |

`fingerprint(finding)` = hash of `ruleId + file + text`, with no line number, so baselines survive line shifts.

### What `text` is for each source kind

The gold set in `eval/` uses the same units, which is what makes precision/recall computable:

- **Template attribute**: the attribute value, e.g. `Reset` for `label="Reset"`.
- **Template text node**: the whole parse5 text node, `{expressions}` included, whitespace collapsed, e.g. `Beds: {property.Beds__c} - Baths: {property.Baths__c}`. `days on <br />the market` is two text nodes: `days on` and `the market`.
- **JS string**: the literal's content without quotes. For template literals keep `${...}` as written, e.g. `Order status set to "${value}"`. For `+` concatenations, report each literal operand separately.
- **Label (R6)**: the label's `fullName`.

## Rules (src/rules/*.js)

```js
export default {
    id: 'R1',
    name: 'hardcoded-attribute',
    kinds: ['template'],          // which file kinds the rule wants: 'template' | 'script' | 'labels'
    severity: 'error',
    description: '...',
    check(ctx) { return [/* Finding */]; }
};
```

The orchestrator parses each file once and passes the result to every rule that wants that kind:

| `ctx.kind` | files | fields |
|---|---|---|
| `template` | `**/lwc/<c>/<c>.html` (not `__tests__`) | `file`, `source`, `ast` (parse5 `parseFragment` with `sourceCodeLocationInfo: true`), `component`, `config` |
| `script` | `**/lwc/<c>/*.js` (not `__tests__`, not `*.test.js`) | `file`, `source`, `ast` (`@babel/parser` File), `component`, `config`, `templateAst` (the component's own template, if any) |
| `labels` | `**/labels/*.labels-meta.xml` | `file`, `source`, `config` (the rule parses with `src/labels/read.js`) |

Rules must be pure: no file I/O and no global state. The orchestrator may add fields to `ctx`; rules must ignore fields they don't know.

Ignore comments: `<!-- i18n-ignore-next-line -->` in templates and `// i18n-ignore-next-line` in JS suppress findings that start on the following line.

## Custom Label context convention

CustomLabel metadata has only `fullName`, `categories` (≤255 chars), `language`, `protected`, `shortDescription` and `value` (≤1000 chars). There is no field for translator notes or maximum length, so this project uses a convention in `categories`: comma-separated `key:value` tokens.

| token | meaning | example |
|---|---|---|
| `component:<name>` | LWC component that uses the label | `component:propertyFilter` |
| `ui:<type>` | UI element: `button`, `label`, `heading`, `text`, `toast`, `error`, `placeholder`, `alt`, `tooltip` | `ui:button` |
| `maxlen:<n>` | maximum characters that fit in the UI | `maxlen:20` |

`shortDescription` should say where the text appears and what any `{0}` placeholder stands for. It must not just repeat the value.

## Translator contract (src/translators/)

The round trip with project A uses files, not function calls: **XLIFF 1.2 in, XLIFF 1.2 out**.

- Export writes one `<file>` per label file, one `<trans-unit id="<fullName>">` per label, `<source>` = value, `<note>` = shortDescription plus categories. Placeholders such as `{0}` stay plain text.
- A translator fills `<target state="translated">` (or leaves `state="needs-translation"`).
- Adapters: `stub` (copies source, keeps `needs-translation`), `pseudo` (pseudo-localized target, for exercising the write path), and `command` (runs the external command in `LWC_I18N_TRANSLATOR_CMD` with `{in}`, `{out}` and `{lang}` substituted; this is where project A plugs in).
- Import validates every unit (placeholder parity, inline tag parity, `maxlen`, empty or untranslated target) before writing `translations/<sfLang>.translation-meta.xml`. Salesforce language codes use underscores (`zh_CN`), XLIFF uses BCP 47 (`zh-CN`); `src/xliff/` owns the mapping.
