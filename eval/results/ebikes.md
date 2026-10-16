# Scanner evaluation: ebikes-lwc

| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|---|
| Hardcoded user-facing strings (R1, R2, R4) | 66 | 6 | 70 | 66 | 4 | 0 | 0 | 0 | 100.0% (66/66) | 100.0% (66/66) |
| Fragmented sentences and plurals (R3) | 4 | 2 | 2 | 2 | 0 | 0 | 3 | 3 | 100.0% (2/2) (raw) | 25.0% (1/4) (raw) |
| Hardcoded currency/locale (R5) | 4 | 0 | 4 | 4 | 0 | 0 | 0 | 0 | 100.0% (4/4) | 100.0% (4/4) |

"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.
