# Evaluation

How well does the scanner find user-visible hardcoded text, and how much of what it reports is real? This folder answers both questions with two numbers:

- **Precision**: of the findings, how many point at a real problem.
- **Recall**: of the real problems, how many the scanner found.

## Method

1. **Held-out code.** The scanner was developed against lwc-recipes and its own test fixtures only. dreamhouse-lwc and ebikes-lwc (pinned in `targets.json`) were kept out of development.
2. **Guidelines first.** [gold/GUIDELINES.md](gold/GUIDELINES.md) was written before the scanner. It defines the unit (one attribute value, template text node or JS string), what counts as user-visible, and what doesn't (CSS classes, URLs, API names, console output…).
3. **Blind annotation.** For each repo, an independent AI agent read every component's template and JS and listed each user-visible hardcoded string. Each agent could read only the guidelines and the target source: no scanner code or output, and not the other repo's annotation. It checked line numbers with scripts, then made a second, scripted pass to catch anything it had missed. Borderline rows are `maybe` and are not scored.
4. **Freeze.** The rules were tagged `eval-freeze-1` before the first run on the held-out repos.
5. **Human review.** I reviewed every gold row with its source line. Rows I rejected stay in the file with `user_visible=no` and the reason.
6. **Adjudication.** Every disagreement between the scanner and the gold set is listed in `adjudication/<repo>.csv`, and I decided each one:
   - **scanner-fn**: the scanner missed it
   - **gold-error**: the annotation was wrong
   - **scanner-fp**: the scanner was wrong
   - **gold-miss**: the annotator missed it

`score.js` matches findings to gold rows on file plus normalized text, within ±2 lines. It scores three families:

- **Strings**: R1, R2 and R4.
- **Fragmented sentences and plurals**: R3, plus R4 findings marked `concatenated`.
- **Currency/locale**: R5. Reported but not scored, by the reviewer's decision, because a currency code is a data question, not a translation.

## Timeline

Every step is a commit, so the numbers can be traced.

| Commit | Step |
|---|---|
| `7467104`, `06e343c` | Blind gold sets committed as annotated (dreamhouse 70 rows, ebikes 76). |
| `f1962be` | Contract fix before the freeze: also scan multi-template components (`templates/*.html`). |
| `eval-freeze-1` | Rules frozen. |
| `04f2de1` | First run on held-out repos, raw. |
| `00265fa` | **Scorer** fix: the fragments family ignored R4's `concatenated` JS findings, which the contract assigned to R4 from the start. The scanner itself was not changed. |
| `df00b72` | Review round 1: two rows excluded (`© OpenStreetMap` is a legal attribution; `{friendlyMessage}.` is only a period). |
| `03638d4` | Review round 2: hardcoded separators and list joins in UI messages (`': ' + details`, `.join(', ')`) count as untranslated strings. The same criterion was applied to every instance, adding 3 ebikes rows. Currency codes are no longer scored. |
| `4295472` | v1 results, adjudicated. |
| `4771007`, `6eec6d8`, `78519bc` | v2 rules for the three kinds of misses, plus one false positive the change introduced on ebikes (`lwc:if`/`lwc:else` alternatives). |
| `5da33ce` | v2 results. **In-sample**: written after seeing these repos, so not an independent measure. |
| (review round 3) | The v2 scan surfaced dreamhouse `propertyMap.js:34` `` `${Address}, ${City}` `` (a card title). The reviewer judged it an annotation miss under the round-2 criterion, so it was added to the gold set (G071). v1 missed it as well, so **the v1 numbers below include it**. |

## Results

### v1 (`eval-freeze-1`): the independent measure

| | Precision | Recall |
|---|---|---|
| Strings, dreamhouse-lwc | 59/59 | 59/63 |
| Strings, ebikes-lwc | 66/66 | 66/70 |
| Fragments, dreamhouse-lwc | 10/10 | 9/11 |
| Fragments, ebikes-lwc | 4/4 | 3/4 |
| **Strings, total** | **125/125 (100%)** | **125/133 (94.0%)** |
| **Fragments, total** | **14/14 (100%)** | **12/15 (80.0%)** |

Misses:

- Text passed to native mobile features (dreamhouse `barcodeScanner.js:28,29`, `listContactsFromDevice.js:21`). These options weren't in R4's list of UI sinks.
- Separators with no letters (ebikes `orderStatusPath.js:197`, `orderBuilder.js:134,174,204`; dreamhouse `propertyMap.js:34`). R4 required letters.
- A sentence whose second half is nested inside `<b>` after a number (dreamhouse `propertyLocation.html:23`). R3 only compared sibling text nodes.

Per-repo tables: [results/dreamhouse.md](results/dreamhouse.md), [results/ebikes.md](results/ebikes.md).

### v2 (`eval-v2`): in-sample

See [results/v2/](results/v2/). On both repos v2 finds every gold item with no false positives (dreamhouse strings 63/63, fragments 11/11; ebikes 70/70, 4/4). While doing that it surfaced one item the annotator had missed (review round 3), and it introduced one false positive (`lwc:if`/`lwc:else` links), which was fixed. Treat these numbers as a check that the fixes work, not as a measure.

## Reproduce

```bash
npm run fetch-targets
node src/cli.js scan .targets/dreamhouse-lwc --format json > eval/results/dreamhouse.scan.json
node eval/score.js --repo dreamhouse-lwc --findings eval/results/dreamhouse.scan.json \
    --gold eval/gold/dreamhouse.csv --adjudication eval/adjudication/dreamhouse.csv --report eval/results/dreamhouse.md
```

Run this at `eval-freeze-1` for the v1 scan. The scorer keeps decisions already in the adjudication file and adds new disagreements as undecided.

## Caveats

- **Two small apps.** 133 scored strings and 15 scored fragmented sentences.
- **Correlated judgment.** The annotators and the scanner were both built with AI assistance, so they may share blind spots. The human review is what guards against that. It changed the gold set in 7 places (2 rows excluded, 1 row counted, 4 rows added) and overruled the annotator once more during adjudication.
