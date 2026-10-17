# Scanner evaluation: dreamhouse-lwc

All disagreements between scanner and gold set are decided; every number below is adjudicated.

| Family | Gold units | Found | Missed | Findings | Correct | Wrong | Not scored | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hardcoded user-facing strings (R1, R2, R4) | 63 | 59 | 4 | 65 | 59 | 0 | 6 | 100.0% (59/59) | 93.7% (59/63) |
| Fragmented sentences and plurals (R3, R4 concatenated) | 11 | 9 | 2 | 10 | 10 | 0 | 0 | 100.0% (10/10) | 81.8% (9/11) |

- **Gold units, Found, Missed** count problems in the gold set. Recall = Found / Gold units.
- **Findings, Correct, Wrong** count scanner reports. Precision = Correct / (Correct + Wrong). One problem can be hit by more than one finding (R3 `interpolated` and `plural` on the same text node), so Correct can be larger than Found.
- **Not scored**: findings on rows the annotator marked `maybe`.

## Human decisions applied

- strings · missed-gold G008 · `barcodeScanner.js:28` "Scan a QR Code" → **scanner-fn**. Human review: true miss. Mobile BarcodeScanner instructionText is shown to the same user in the scanner UI; R4 has no sink for lightning/mobileCapabilities options.
- strings · missed-gold G009 · `barcodeScanner.js:29` "Scanning complete." → **scanner-fn**. Human review: true miss, same as G008 (successText).
- strings · missed-gold G030 · `listContactsFromDevice.js:21` "Allow access to your contacts to enable contacts processing." → **scanner-fn**. Human review: true miss, same as G008 (ContactsService permissionRationaleText).
- strings · missed-gold G071 · `propertyMap.js:34` "${property.Address__c.value}, ${property.City__c.value}" → **scanner-fn**. Human review round 3: separator glued between values in a displayed title; v1 R4 required letters.
- fragments · missed-gold G051 G052 · `propertyLocation.html:23` "Distance to property: | miles" → **scanner-fn**. Human review: true miss. Second half of the sentence is nested inside <b>; R3 only compares sibling text nodes.
- fragments · missed-gold G071 · `propertyMap.js:34` "${property.Address__c.value}, ${property.City__c.value}" → **scanner-fn**. Human review round 3: separator glued between values in a displayed title; v1 R4 required letters.

## Reported, not scored

- Hardcoded currency/locale (R5): 1 in the gold set, 1 found, 0 missed, 0 not in the gold set.
