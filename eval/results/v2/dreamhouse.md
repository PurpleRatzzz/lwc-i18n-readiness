# Scanner evaluation: dreamhouse-lwc

| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|---|
| Hardcoded user-facing strings (R1, R2, R4) | 63 | 6 | 69 | 63 | 6 | 0 | 0 | 0 | 100.0% (63/63) | 100.0% (63/63) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 11 | 0 | 12 | 12 | 0 | 0 | 0 | 0 | 100.0% (12/12) | 100.0% (11/11) |

Reported, not scored:

- Hardcoded currency/locale (R5): 1 in the gold set, 1 found, 0 missed, 0 not in the gold set.

"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.
