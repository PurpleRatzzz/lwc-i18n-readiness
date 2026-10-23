# Does upstream context improve AI translation?

A small experiment connecting this repo with project A, an AI translation pipeline. The method was fixed in [PREREGISTRATION.md](PREREGISTRATION.md) and committed (`ca9382c`) before any translation ran. Raw translations and the blind judging sheets were committed (`86400e9`) before any verdict was written.

- **Translator.** Project A at `b26275f` (clean tree), `claude-sonnet-5-5`, config E (glossary, translation memory, concordance). One run per condition. Total cost about $0.15. A received only the exported XLIFF files.
- **Judge.** Yanlin Chen (native zh-CN), blind to the condition. Verdict: would it ship as is in that UI position?
- **Conditions.**
  - C1: labels as developers usually write them.
  - C2: the context R6 asks for.
  - C3: C2, plus fragments merged into whole labels with placeholders.

## Results

| | C1 as found | C2 context | C3 context + structure |
|---|---:|---:|---:|
| **Set 1, dreamhouse** (real code; main result) | 18/20 | 19/20 | 18/20 |
| **Set 2, starter kit** (usage unknown, scenario reconstructed) | 17/20 | 19/20 | 20/20 |
| Units A's QA gate sent to human review | 0 | 0 | 0 |

Every translation and verdict: [dreamhouse/results.md](dreamhouse/results.md), [starterkit/results.md](starterkit/results.md).

### Where the 9 failures were

| Kind | Failures | Units |
|---|---:|---|
| **Single strings** (31 per condition) | **0** | none |
| **Sentences assembled from pieces** | **6** | dreamhouse "18 days on the market" (C1, C3); starter kit "12 items • sorted by Name" (C1), "10 items of 50" (C1, C2), "3 filters" (C1) |
| **Hardcoded imperial unit** | **3** | dreamhouse "2.5 miles", in all three conditions: China uses kilometers. An internationalization bug in the source; no translation can fix it. |

## What this shows

1. **Context didn't matter for single strings.** All 31 single strings were acceptable in every condition. Context changed the translation of only 1 of them: C2 kept "Property" and "Broker" as object names instead of translating them, and both versions were acceptable.

   The ambiguous strings I expected to need context (`Property picture`, `Bedrooms`, `Search Key`, `Filter`, `Select`, `None`) were translated the same way, and acceptably, without it. **The first expectation was not supported.** With a glossary and translation memory behind it, the pipeline handled short UI strings well on its own.

2. **The failures were in assembled text.** Six of the nine failures are sentences that code builds from pieces.
   - **Starter kit**: context helped. C2 added the missing measure words (3 个筛选器), and restructuring fixed the rest (10 个项目，共 50 个): 1/4 → 3/4 → 4/4 assembled units acceptable.
   - **Dreamhouse**: the days-on-market badge failed in C1 ("18 已上市 天") and in C3 ("上市 18 天"), and passed in C2 ("18 天，已上市 在售"). In the real template the number is its own element, on the line above the text (`daysOnMarket.html:6-9`), so a translation that moves the number does not fit the layout. The judge also found 上市 the wrong sense and suggested 18 天前.

     What we know:
     - The C3 label (`{0} days on the market`) said nothing about the layout.
     - The C2 pieces were described as "shown under the day count" and "on the next line", and C2 kept the number first.
     - Nothing in A stops a placeholder from moving: its QA gate compares placeholder counts, not positions.

     **Why C3 failed was not tested.** We suspect the missing layout note let the translator reorder. But no C3 variant with a layout note was run, each condition ran only once, and the reordered phrase also had a meaning error. A merged label also needs a rendering decision that C3 never made: how a template that keeps the number in its own element would show `上市 {0} 天`. The second expectation was only partly supported.

3. **A per-string QA gate cannot see these failures.** A sent 0 units to review in all six runs, including "18 已上市 天". Each piece is fine on its own; only the assembled sentence is wrong.

   This is why fragments have to be stopped upstream (R3, R4 concatenation, R6 `fragment-value`) or caught in in-context review (pseudo-localization, LQA). Better prompts won't find them.

4. **Two upstream issues no translator can fix**: a hardcoded unit of measure (now checklist item 12), and word order fixed by the layout.

## Caveats

- **A demonstration, not a measurement.** n = 20 per condition, one run each, one judge.
- **Run-to-run variation.** Two dreamhouse single strings had identical inputs in C2 and C3 but came back slightly different (此房产 vs 此房源; quotes around object names). That is as large as the one change attributed to context.
- **The starter-kit scenario is reconstructed**, because no public code uses those labels. Read that set as "a translator who can only guess", not as ground truth.

## Deviations from the preregistration

- **Two error types per unit.** For two units the judge gave two error types (dreamhouse `meaning;order`, starter kit `terminology;meaning`). Both are counted.
- **"Name" in the starter-kit header.** The example sort field was left as "Name" in the sheet. At runtime Salesforce fills it with its own, translated, field label. The judge marked the C2 and C3 header units "acceptable if Name is not part of the translation", and confirmed afterwards that they count as acceptable. If they were counted as failures, the starter kit would be 17 / 18 / 18.
- **Miles.** The judge noted it is an internationalization issue, not a translation issue. It is scored as the preregistration says (not shippable as is) in all three conditions, so it doesn't change any comparison.
