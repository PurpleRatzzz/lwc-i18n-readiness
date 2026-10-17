# Scanner evaluation: dreamhouse-lwc

All disagreements between scanner and gold set are decided; every number below is adjudicated.

| Family | Gold units | Found | Missed | Findings | Correct | Wrong | Not scored | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hardcoded user-facing strings (R1, R2, R4) | 63 | 63 | 0 | 69 | 63 | 0 | 6 | 100.0% (63/63) | 100.0% (63/63) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 11 | 11 | 0 | 12 | 12 | 0 | 0 | 100.0% (12/12) | 100.0% (11/11) |

- **Gold units, Found, Missed** count problems in the gold set. Recall = Found / Gold units.
- **Findings, Correct, Wrong** count scanner reports. Precision = Correct / (Correct + Wrong). One problem can be hit by more than one finding (R3 `interpolated` and `plural` on the same text node), so Correct can be larger than Found.
- **Not scored**: findings on rows the annotator marked `maybe`.

## Reported, not scored

- Hardcoded currency/locale (R5): 1 in the gold set, 1 found, 0 missed, 0 not in the gold set.
