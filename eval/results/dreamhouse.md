# Scanner evaluation: dreamhouse-lwc

| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|---|
| Hardcoded user-facing strings (R1, R2, R4) | 62 | 6 | 65 | 59 | 6 | 0 | 3 | 0 | 100.0% (59/59) | 95.2% (59/62) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 10 | 0 | 10 | 10 | 0 | 0 | 1 | 0 | 100.0% (10/10) | 90.0% (9/10) |

Reported, not scored:

- Hardcoded currency/locale (R5): 1 in the gold set, 1 found, 0 missed, 0 not in the gold set.

"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.
