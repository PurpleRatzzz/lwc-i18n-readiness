# Scanner evaluation: ebikes-lwc

| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|---|
| Hardcoded user-facing strings (R1, R2, R4) | 70 | 4 | 74 | 70 | 4 | 0 | 0 | 0 | 100.0% (70/70) | 100.0% (70/70) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 5 | 0 | 5 | 5 | 0 | 0 | 1 | 0 | 100.0% (5/5) | 100.0% (4/4) |

Reported, not scored:

- Hardcoded currency/locale (R5): 4 in the gold set, 4 found, 0 missed, 0 not in the gold set.

"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.
