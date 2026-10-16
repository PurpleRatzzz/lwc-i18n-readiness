# dreamhouse-lwc gold set: annotation notes

Target: `.targets/dreamhouse-lwc` at commit `3f496e4`. Scope: `force-app/main/default/lwc/**/*.html` and `*.js`, excluding `__tests__/` and `*.test.js`. Annotated by reading the source only, without looking at the scanner's code or output.

## What was read

- 34 files: 16 `.html` and 18 `.js`, across 17 components. All were read in full, template and JS together.
- `errorPanel` has no `errorPanel.html`. Its two templates are in `errorPanel/templates/` (`inlineMessage.html`, `noDataIllustration.html`), and `render()` picks one. Both templates are in scope and were annotated.
- `ldsUtils` is JS only. `navigateToRecord.html` is empty (`<template> </template>`).
- Every `c-error-panel` usage was traced into `errorPanel` to confirm that `friendly-message` is rendered (`<h3>{friendlyMessage}</h3>` in `noDataIllustration.html`).
- 22 files have at least one row. These 12 have none: `brokerCard.js`, `daysOnMarket.js`, `ldsUtils.js`, `navigateToRecord.html`, `navigateToRecord.js`, `paginator.js`, `propertyCarousel.js`, `propertyFilter.js`, `propertyListMap.html`, `propertySummary.js`, `propertyTile.js`, `propertyTileList.js`.
- Second pass: after the manual reading, a throwaway script listed every template text node, every template attribute containing letters, and every JS string literal containing letters. It was compared with the manual list and found nothing new. The script is not part of the repo. Every row's `line` was then checked against the source file.

## Row counts (computed from `dreamhouse.csv`)

| | count |
|---|---|
| total rows | 70 |
| issue `hardcoded` | 69 |
| issue `locale` | 1 (`USD`, `propertyTile.html:14`) |
| source_kind `attribute` | 30 |
| source_kind `text` | 22 |
| source_kind `js` | 18 |
| user_visible `yes` | 63 |
| user_visible `maybe` | 7 |
| fragment groups | 8 (F01 to F08, 12 rows in total) |
| `plural=yes` | 5 |

## Conventions used

- **Whitespace**: `text` is whitespace-collapsed and trimmed, which is what `normalizeText` is described to do. This applies to JS literals too: `'There was a problem scanning the QR code: '` is stored without its trailing space. `&nbsp;` is treated as whitespace (JS `\s` matches U+00A0), so `Distance to property:&nbsp;` becomes `Distance to property:`.
- **`line` for multi-line units**: the line of the first non-whitespace character. For an attribute on a tag that opens on an earlier line, it is the line where the attribute name is (`propertyLocation.html:3`, `sampleDataImporter.html:3`).
- **`where` for text nodes**: the parent element plus `#text`, for example `div#text` or `label#text`. The guidelines only give the format for attributes and JS sinks.
- **Template literal containing HTML** (`propertyListMap.js:177`, the map tooltip): the whole literal is one row at line 177, as the JS-literal rule says. The only visible hardcoded words in it are `Beds:` and `- Baths:` on line 180. A scanner that parses the HTML inside the literal and reports `Beds: ${property.Beds__c} - Baths: ${property.Baths__c}` at line 180 is finding the same issue, so the scorer may need a containment match for this row.

## `maybe` rows

| id | where | text | reason |
|---|---|---|---|
| G015 | `brokerCard.html:9` | `Navigate to record` | A `<label>` placed inside `lightning-button-icon`. That component has no default slot, so the child is most likely not rendered. The button has no `alternative-text` either, so this was probably meant as its accessible name. |
| G031 | `paginator.html:10` | `Previous` | Same as G015. |
| G033 | `paginator.html:24` | `Next` | Same as G015. |
| G058 | `propertySummary.html:10` | `Navigate to Record` | Same as G015. |
| G023 | `errorPanel.js:10` | `Error retrieving data` | Default value of `@api friendlyMessage`, which the template renders. Every consumer in this repo passes `friendly-message`, so the default is never shown in this app. |
| G024 | `inlineMessage.html:6` | `Show details.` | This template is used only when `type="inlineMessage"`, and no consumer in this repo passes that. |
| G044 | `propertyListMap.js:106` | `© OpenStreetMap` | Leaflet shows it in the map's attribution control, so it is visible. It is borderline because it is a brand/legal attribution that is normally left untranslated. |

## Other borderline decisions (rows kept as `yes`)

- **Strings shown by native mobile UI rather than the template**: `instructionText` and `successText` passed to `beginCapture` (`barcodeScanner.js:28`, `29`), and `permissionRationaleText` passed to `getContacts` (`listContactsFromDevice.js:21`). The mobileCapabilities APIs show these to the user.
- **Error objects created in JS**: `this.error = { message: '...' }` (`listContactsFromDevice.js:14`, `propertyLocation.js:38`). The error goes to `c-error-panel errors={error}`. `reduceErrors` returns `error.message`, and the panel lists it after the user clicks "Show details". It is visible, but only after that click.
- **Fragment groups**:
  - Single-row groups are given to text nodes containing `{expressions}` (F04, F08), to a JS literal concatenated with a variable (F02), and to template literals with `${}` (F05, F07).
  - `Distance to property:` and `miles` share F06, because together they form one message around the number: "Distance to property: {distance} miles".
  - `days on` and `the market` share F03. Their number `{daysOnMarket}` is in a sibling `<div>` and is data, so it has no row.
  - `Current latitude:` and `Current longitude:` are not grouped. Each is a self-contained label followed by a value in a sibling `<b>`.
- **Plural**:
  - `yes` for `days on` (its number is in the sibling element), `30 days`, `60 days`, the paginator `{totalItemCount} items ...`, and `miles`. `{distance}` can be 1, and decimals also have CLDR plural categories.
  - Not set for `Beds: {n} - Baths: {n}`, both the template version and the tooltip. In "label: value" form the noun is a field label, not a counted phrase.
- **`miles`**: kept as `issue=hardcoded` only. The imperial unit, also hardcoded in JS as `km / 1.609344`, is a measurement-system locale problem. The guidelines limit `locale` to currency and locale codes, so this is only recorded in `notes`.

## Considered and excluded

These are not rows, for the reasons given.

- **Literal part has no letters** (guideline: strings with no letters, with `•` and `:` as examples):
  - `{friendlyMessage}.` at `inlineMessage.html:4`: only a period.
  - `{property.City__c} •` at `propertyTile.html:8`: only a bullet, which is the guideline's own example.
  - `{phoneNumber.value} ({phoneNumber.label})` at `listContactsFromDevice.html:25`: only parentheses.
  - `${property.Address__c.value}, ${property.City__c.value}` at `propertyMap.js:34`: only a comma. This value becomes the card title.

  Sentence punctuation and full-width brackets do differ by locale (for example `。`, `（）`), but the guideline excludes this case explicitly.
- **Data only**, where the order is a locale concern but no hardcoded text or code is involved:
  - `{deviceContact.name.givenName} {deviceContact.name.familyName}` (`listContactsFromDevice.html:17`): given-name-first order.
  - The address/city order in `propertyMap.js:34`.
  - `${property.Name.value}` (`propertyMap.js:41`), `&nbsp;{location.coords.latitude|longitude}` (`propertyLocation.html:16`, `20`), `{daysOnMarket}`, `{message}`, `{address}`, `{propertyName}`, and `title={property.Name}`.
- **Not displayed**:
  - `console.error('Error compressing and creating file: ', ...)` (`propertyCarousel.js:94`).
  - HTML comments in `barcodeScanner.html` (lines 4 and 12).
  - The `L.divIcon` HTML at `propertyListMap.js:140`. It is injected into the page but is SVG markup with no text.
  - The `mapIcon.path` SVG path at `propertyMap.js:44`.
- **Non-text values**: `accept=".jpg,.png,.gif"`, `type`, `variant`, `size`, `icon-name`, CSS classes, event names (`previous`, `next`, `selected`, `click`), navigation types, object and field API names, URLs, and image-processing option values (`fill`, `reduce`, `white`).
- **Formatting with no hardcoded locale**:
  - `lightning-formatted-date-time` (`daysOnMarket.html:16`) and `lightning-formatted-number` (`propertyLocation.html:24`) format according to the user's locale.
  - The price slider (max `1200000`, `propertyFilter`) and `maxPrice = 9999999` (`propertyTileList.js`) are amounts in an implicit currency but have no currency code.
- **Toast messages set from `error.message` / `e.message`**: these are data.
- **Missing accessible names**: these are not hardcoded strings, so they have no rows. They are worth flagging separately as a11y issues.
  - `lightning-icon` in `propertyCarousel.html:21` has no `alternative-text`.
  - `lightning-carousel-image` has no `alternative-text`.
  - The four `lightning-button-icon`s have no `alternative-text`.
- **Out of scope**: `*.js-meta.xml` files. They were opened only to confirm that `errorPanel` is not exposed. They were not annotated.

## Ambiguities in GUIDELINES.md and how they were resolved

1. **Text nodes mixing `{expressions}` with punctuation only.** The guideline counts the expression as part of the text but excludes strings with no letters. Resolved as: excluded when the non-expression part has no letters.
2. **Whitespace in JS literals.** "Content without quotes" is not explicit about leading and trailing spaces. Resolved by collapsing and trimming, as `normalizeText` is described to do.
3. **HTML inside a JS template literal.** Resolved as one row for the whole literal, per the JS-literal rule, with a note in the row.
4. **`where` for template text nodes.** The guidelines give no format. Resolved as `<parent>#text`.
5. **Fragment groups across elements.** A group is used when the pieces form one translatable message around a value. Self-contained `label:` + value is not grouped.
6. **Plural for "label: value" counts** (`Beds: 3`). Resolved as not plural.
7. **`locale` scope.** Read narrowly as currency and locale codes, so units (miles) and name or address order are not marked `locale`.
8. **Text that is reachable only in other apps** (a component default, or a template variant nobody selects). Resolved as `maybe` rather than excluded.
