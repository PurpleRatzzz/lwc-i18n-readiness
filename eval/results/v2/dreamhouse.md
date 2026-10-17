# Scanner evaluation: dreamhouse-lwc

| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|---|
| Hardcoded user-facing strings (R1, R2, R4) | 62 | 6 | 69 | 62 | 6 | 1 | 0 | 1 | 98.4% (62/63) (raw) | 100.0% (62/62) (raw) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 10 | 0 | 12 | 11 | 0 | 1 | 0 | 1 | 91.7% (11/12) (raw) | 100.0% (10/10) (raw) |

Reported, not scored:

- Hardcoded currency/locale (R5): 1 in the gold set, 1 found, 0 missed, 0 not in the gold set.

"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.
