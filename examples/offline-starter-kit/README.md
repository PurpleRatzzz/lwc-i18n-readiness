# Example: the Custom Labels tooling on a real labels file

Every file in this folder was produced by the commands below. Nothing was edited by hand.

## Source

- Repository: [salesforce/offline-app-developer-starter-kit](https://github.com/salesforce/offline-app-developer-starter-kit)
- Commit: `fb66da8` (`fb66da8fb5e477b23ee56f805ab80dee70df3156`, pinned in `targets.json`)
- File: `force-app/main/default/labels/CustomLabels.labels-meta.xml` (23 labels)
- License: BSD-3-Clause, notice reproduced at the end of this file

Fetch it with `npm run fetch-targets`, which clones it into `.targets/`.

## Commands

Run from the project root (`project-b/`). The paths in the reports and in the XLIFF `original`
attribute are relative to that directory.

```sh
L=.targets/offline-app-developer-starter-kit/force-app/main/default/labels/CustomLabels.labels-meta.xml
E=examples/offline-starter-kit

# 1. Pseudo-localized translation file
node src/cli.js pseudo $L --locale eo --out $E/pseudo

# 2. XLIFF 1.2 export for zh-CN
node src/cli.js xliff-export $L --target-lang zh-CN --out $E/labels.zh-CN.xlf

# 3. "Translate" with the two built-in translators that need no API
node src/cli.js translate $E/labels.zh-CN.xlf --out $E/labels.zh-CN.stub.xlf   --lang zh-CN --translator stub
node src/cli.js translate $E/labels.zh-CN.xlf --out $E/labels.zh-CN.pseudo.xlf --lang zh-CN --translator pseudo

# 4. Import each one back (text report on stdout, JSON with --report)
node src/cli.js xliff-import $E/labels.zh-CN.stub.xlf   --labels $L --out $E/import-stub   --report $E/import-stub.report.json   > $E/import-stub.report.txt
node src/cli.js xliff-import $E/labels.zh-CN.pseudo.xlf --labels $L --out $E/import-pseudo --report $E/import-pseudo.report.json > $E/import-pseudo.report.txt

# 5. R6 findings as JSON (calls the rule directly, the same way the scan orchestrator does)
node -e "
const fs = require('fs');
import('./src/rules/r6-label-context.js').then(({ default: r6 }) => {
    const root = '.targets/offline-app-developer-starter-kit/';
    const file = 'force-app/main/default/labels/CustomLabels.labels-meta.xml';
    const findings = r6.check({ kind: 'labels', file, source: fs.readFileSync(root + file, 'utf8'), config: {} });
    fs.writeFileSync('examples/offline-starter-kit/r6-findings.json', JSON.stringify(findings, null, 2) + '\n');
});"
```

All commands exited with code 0.

## Files and results

| File | What it is |
|---|---|
| `pseudo/eo.translation-meta.xml` | 23 pseudo-localized labels, e.g. `Save` → `[Šåvé ~~~~~]` |
| `labels.zh-CN.xlf` | XLIFF 1.2 export: 23 `<trans-unit>`s, no `<target>` yet |
| `labels.zh-CN.stub.xlf` | stub translator: source copied into `<target state="needs-translation">` |
| `labels.zh-CN.pseudo.xlf` | pseudo translator: pseudo text in `<target state="translated">` |
| `import-stub.report.txt` / `.json` | 23 units: 0 written, 23 skipped, 0 rejected, 0 held back. No translation file written |
| `import-pseudo.report.txt` / `.json` | 23 units: 23 written, 0 skipped, 0 rejected, 0 held back (0 errors, 0 warnings) |
| `import-pseudo/zh_CN.translation-meta.xml` | the 23 labels written back in Salesforce source format |
| `r6-findings.json` | 43 R6 findings on 23 labels |

R6 findings by subrule:

| subrule | findings |
|---|---|
| `no-ui-category` | 23 (the file uses no `categories` at all) |
| `description-repeats-value` | 13 (e.g. `LMR_Save`: description `Save`, value `Save`) |
| `unexplained-placeholder` | 0 (no label has `{0}` placeholders) |
| `fragment-value` | 7: `items`, `sorted by`, `of`, `filter`, `filters`, `selected`, `select` |

The labels that pass `description-repeats-value` show what useful context looks like:
`LMR_Of` (value `of`) is described as "when filtering the data - X items of Y". That description
also suggests that `items` and `of` are fragments joined into one sentence at runtime, a pattern
many languages cannot translate word by word. This file is why R6 has a `fragment-value` subrule:
externalizing text into labels doesn't help if each label is only a piece of a sentence. The usage
can't be confirmed here: no file in the repo at this commit references the `LMR_` labels outside
the labels file itself.

## Notes

- **`eo` is a placeholder locale.** Pseudo text has to go into a language the org can enable.
  The final pseudo locale will be chosen once a Developer Edition org shows which languages
  it can enable. Until then `eo` only fixes the file name; the content would not change.
- **`import-pseudo/zh_CN.translation-meta.xml` is not Chinese.** It holds pseudo text under the
  zh_CN file name. Its purpose is to exercise the import and write path end to end without a
  translation API. The real zh-CN translation will come from project A through
  `--translator command`.
- The real labels have no `maxlen:` category, so the export has no `maxwidth` and the import
  had nothing to check for length. The test fixture (`test/fixtures/labels/`) covers that case.

## License of the source file

The label values in these outputs come from salesforce/offline-app-developer-starter-kit,
which is distributed under the following license:

```
BSD 3-Clause License

Copyright (c) 2022 Salesforce, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of Salesforce.com nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
