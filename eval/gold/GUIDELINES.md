# Gold set annotation guidelines

The gold set lists every place in a target repo's LWC source where **end-user-visible text or locale-specific formatting is hardcoded**. It is built by reading the source, **without looking at the scanner's code or output**, so it can measure the scanner's recall.

Target: `dreamhouse-lwc` at the commit pinned in `targets.json` (`.targets/dreamhouse-lwc`). Scope: `force-app/main/default/lwc/**`. Skip `__tests__/` and `*.test.js`.

## Unit of annotation

One row per source string, using the units from `docs/ARCHITECTURE.md`:

- **Attribute value**: `label="Reset"` gives the text `Reset`.
- **Template text node**: the whole text between two tags, `{expressions}` included, whitespace collapsed. `Beds: {property.Beds__c} - Baths: {property.Baths__c}` is one row. `days on <br />the market` is two rows.
- **JS string literal**: the content without quotes. Template literals keep `${...}` as written. Each literal operand of a `+` concatenation is its own row.
- **Locale/currency literal**: e.g. `currency-code="USD"` gives the text `USD`.

`line` is the 1-based line of the first non-whitespace character of the text (for attributes, the line where the attribute name starts).

## What counts as user-visible (include)

- Visible text in templates
- Attributes that base components render or read aloud: `label`, `title`, `placeholder`, `alternative-text`, `alt`, `help-text`, `field-level-help`, `message-when-*`, and similar
- Properties passed to custom `c-*` components that end up displayed (check the child component's template), e.g. `friendly-message`
- JS strings that reach the UI: toast `title`/`message`, error messages assigned to fields the template renders, getters whose return value the template shows, HTML strings built in JS and injected into the page (e.g. map tooltips)
- Hardcoded currency or locale codes that affect displayed formatting

## Exclude (but note borderline cases in `notes`)

- `console.*` messages, thrown errors that are never displayed, test files
- CSS classes, styles, icon names (`utility:chevronleft`), URLs and paths, object/field API names (`Property__c`), event names, `data-*` attributes, `variant`/`size` values
- Strings with no letters at all (`•`, `:`, numbers)
- Legal notices, attributions and brand names that must stay untranslated (e.g. `© OpenStreetMap` in a map's attribution control)
- Text coming from data (`{property.Name}` alone is not hardcoded)

If you aren't sure whether something reaches the UI, include it with `user_visible=maybe` and explain in `notes`.

## CSV columns (`eval/gold/dreamhouse.csv`)

| column | values |
|---|---|
| `id` | `G001`, `G002`, … |
| `file` | relative to the repo root, e.g. `force-app/main/default/lwc/propertyFilter/propertyFilter.html` |
| `line` | as defined above |
| `text` | as defined above. Quote with `"` and double any inner `"` (RFC 4180) |
| `source_kind` | `attribute` / `text` / `js` |
| `where` | element+attribute (`lightning-button@label`), or JS sink (`ShowToastEvent.title`, `this.error.message`, `getter:title`) |
| `user_visible` | `yes` / `maybe`; a human reviewer may set `no` to exclude a row, with the reason at the start of `notes` |
| `issue` | `hardcoded` (needs a Custom Label), `locale` (hardcoded currency/locale), or both separated by `;` |
| `fragment_group` | empty, or the same short id (e.g. `F01`) on every row that belongs to one sentence split into pieces or around variables. A single text node with `{expressions}` inside also gets a group id |
| `plural` | `yes` if the text puts a number next to a noun that needs plural forms (`{totalItemCount} items`, `30 days`), else empty |
| `notes` | free text, especially for `maybe` rows |

After annotating, write a short `eval/gold/dreamhouse-NOTES.md`: how many components and files you read, row counts by `issue` and `source_kind`, and every borderline decision.
