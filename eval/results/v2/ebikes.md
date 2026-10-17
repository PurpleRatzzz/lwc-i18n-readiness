# Scanner evaluation: ebikes-lwc

All disagreements between scanner and gold set are decided; every number below is adjudicated.

| Family | Gold units | Found | Missed | Findings | Correct | Wrong | Not scored | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hardcoded user-facing strings (R1, R2, R4) | 70 | 70 | 0 | 74 | 70 | 0 | 4 | 100.0% (70/70) | 100.0% (70/70) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 4 | 4 | 0 | 5 | 5 | 0 | 0 | 100.0% (5/5) | 100.0% (4/4) |

- **Gold units, Found, Missed** count problems in the gold set. Recall = Found / Gold units.
- **Findings, Correct, Wrong** count scanner reports. Precision = Correct / (Correct + Wrong). One problem can be hit by more than one finding (R3 `interpolated` and `plural` on the same text node), so Correct can be larger than Found.
- **Not scored**: findings on rows the annotator marked `maybe`.

## Human decisions applied

- fragments · missed-gold G022 · `orderBuilder.html:14` "Total Items: {orderQuantity}" → **gold-error**. Human review: a single 'Label: {value}' pair is not a fragmented sentence (R3 definition fixed before evaluation); the label is still counted as hardcoded text.

## Reported, not scored

- Hardcoded currency/locale (R5): 4 in the gold set, 4 found, 0 missed, 0 not in the gold set.
