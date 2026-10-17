# Scanner evaluation: ebikes-lwc

All disagreements between scanner and gold set are decided; every number below is adjudicated.

| Family | Gold units | Found | Missed | Findings | Correct | Wrong | Not scored | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hardcoded user-facing strings (R1, R2, R4) | 70 | 66 | 4 | 70 | 66 | 0 | 4 | 100.0% (66/66) | 94.3% (66/70) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 4 | 3 | 1 | 4 | 4 | 0 | 0 | 100.0% (4/4) | 75.0% (3/4) |

- **Gold units, Found, Missed** count problems in the gold set. Recall = Found / Gold units.
- **Findings, Correct, Wrong** count scanner reports. Precision = Correct / (Correct + Wrong). One problem can be hit by more than one finding (R3 `interpolated` and `plural` on the same text node), so Correct can be larger than Found.
- **Not scored**: findings on rows the annotator marked `maybe`.

## Human decisions applied

- strings · missed-gold G044 · `orderStatusPath.js:197` ": ${reduceErrors(cause).join(', ')}" → **scanner-fn**. Human review round 2: counted. Separator and list join glued to a UI message; R4 skips literals without letters.
- strings · missed-gold G077 · `orderBuilder.js:134` "," → **scanner-fn**. Human review round 2: hardcoded list separator in a toast message; R4 skips literals without letters.
- strings · missed-gold G078 · `orderBuilder.js:174` "," → **scanner-fn**. Same as G077.
- strings · missed-gold G079 · `orderBuilder.js:204` "," → **scanner-fn**. Same as G077.
- fragments · missed-gold G022 · `orderBuilder.html:14` "Total Items: {orderQuantity}" → **gold-error**. Human review: a single 'Label: {value}' pair is not a fragmented sentence (R3 definition fixed before evaluation); the label is still counted as hardcoded text.
- fragments · missed-gold G044 · `orderStatusPath.js:197` ": ${reduceErrors(cause).join(', ')}" → **scanner-fn**. Human review round 2: counted. Separator and list join glued to a UI message; R4 skips literals without letters.

## Reported, not scored

- Hardcoded currency/locale (R5): 4 in the gold set, 4 found, 0 missed, 0 not in the gold set.
