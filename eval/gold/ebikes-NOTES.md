# ebikes-lwc gold set: annotation notes

Target: `.targets/ebikes-lwc` (trailheadapps/ebikes-lwc @ c60a6c1). The guidelines name dreamhouse-lwc; for this file the target is ebikes. Everything else follows `GUIDELINES.md`. The annotation was done by reading the source only, without looking at the scanner's code or output.

## What was read

- Scope: every `.html` and `.js` under `force-app/main/default/lwc/`, excluding `__tests__/` and `*.test.js`.
- 44 files (22 `.html`, 22 `.js`) in 22 components. Each file was read in full, and each template was read together with its JS. Every `c-*` child was opened to check whether it displays the prop (`c-error-panel` `friendly-message` and `c-placeholder` `message` are displayed; `c-navigation-menu-logo` `formfactor` is not).
- `errorPanel` has no `errorPanel.html`. Its two templates are `errorPanel/templates/inlineMessage.html` and `noDataIllustration.html`, and both are in scope.
- 17 components have rows. hero, ldsUtils, navigationMenuItem, productFamilyTile and recordOverview have none: everything they show comes from data or from builder config.
- Second pass: a script listed every quoted attribute value and every text node that contains letters in all templates, plus every JS string literal that contains letters. Each item was checked against the rows. Each row's line was then checked against the source line.

## Counts (computed from `ebikes.csv`)

| | |
|---|---|
| total rows | 76 |
| issue | hardcoded 72, locale 4 |
| source_kind | attribute 33, text 27, js 16 |
| user_visible | yes 70, maybe 6 |
| fragment groups | 6 (F01–F06, one row each) |
| plural=yes | 1 |

## Borderline decisions

### Included as `maybe`
- **G011** `inlineMessage.html:4` `{friendlyMessage}.`: the only literal is the period. The "no letters" rule could exclude it, but the unit's text contains an expression. The period is locale-specific punctuation (zh/ja use a full-width stop) and is attached to whatever message the parent passes.
- **G044** `orderStatusPath.js:197` `` `: ${reduceErrors(cause).join(', ')}` ``: same reasoning. The literal parts are `: ` and `, `. This string is appended to every `reportError()` base message. It is not grouped with those messages, because each one is a complete sentence by itself.
- **G014** `heroDetails.js:8` `'Hero Details'`: the `@api title` default is rendered in `<h1>`. heroDetails is not exposed, and its only parent (hero) always binds `title={title}`, which replaces the default even when the value is undefined. So the default is unlikely to render.
- **G045/G047** `paginator.html:11,23` `Previous`/`Next`, and **G049** `productCard.html:9` `Open Record`: these are `<label>` children of `lightning-button-icon`. That component has no slot, so the text is most likely neither rendered nor announced. The buttons have no `alternative-text`.

### Included as `yes` (worth flagging)
- **G010** `errorPanel.js:10` `@api friendlyMessage = 'Error retrieving data'`: this default is reachable, because `orderBuilder.html:39` and `productTileList.html:43` use `c-error-panel` without `friendly-message`.
- **G035** `orderStatusPath.html:53` `Current Stage:`: screen-reader-only (`slds-assistive-text`) text counts as read aloud. The text spans lines 53–54; the row uses line 53.
- **G034** `aria-label="Picklist values"` counts as a read-aloud attribute ("and similar").
- **G070** `productTile.html:13` `MSRP:&nbsp;`: the text is recorded as written in the source. parse5 decodes `&nbsp;` to U+00A0, so a decoded and trimmed form would be `MSRP:`.
- **G020/G028/G070** `Order Total:` and `MSRP:` are labels followed by a `<lightning-formatted-number>` element. The text node contains no `{expression}` and is not split, so there is **no fragment group**. The word order is still fixed by the markup.
- **G022** `Total Items: {orderQuantity}` gets a fragment group (expression inside the node) but **not** `plural`, because "Label: count" does not inflect the noun. **G046** (paginator `{totalItemCount} items • page …`) is `plural=yes`.

### Excluded (no row)
- `hero.html:2` `alt=""`: empty (decorative image).
- `productCard.html:59,69` `aria-labelledby="Front"` / `"Rear"`: these are ID references, not text. No element has those ids, so they label nothing.
- `', '` passed to `.join` in `orderBuilder.js:134,174,204`: no letters. It is a hardcoded list separator (see below).
- `console.error` messages: `navigationMenu.js:42,51,87`, `navigationMenuItem.js:82`.
- Config and API values: `type="inlineMessage"`/`'inlineMessage'`, `formfactor="hamburger|desktop"`, hero `'Video'/'Image'/'left'/'right'/'true'`, navigationMenu `'None'/'LoginRequired'/'Draft'/'Live'/'top-right'`, `name: 'Home'`, record-type id `'012000000000000AAA'`, `mode` `'readonly'/'view'`, URL paths in heroDetails.
- Expression-only text (`{item.label}`, `{title}`, `{slogan}`, `{buttonText}`, `{name}`, `{description}`, `{productName}`, `{pathItem.label}`, `{errorMessage}`, `{message}`, `{friendlyMessage}` alone).
- `maximum-fraction-digits="0"`, `formatter="currency"`, slider `min/max/step`: these are formatting options, not locale codes.
- Out of scope (`.js-meta.xml`): hero's builder defaults ("Electra Series", "Ride With Power", "See Electra Bikes") and builder property labels are user-facing English, but they are not `.html` or `.js`.

## Other i18n problems (not captured by the columns)
- **API value shown instead of a label**: `orderStatusPath.js:139,145` put the picklist API `value` into the toast or error text, not the translated `label`. `productFamilyTile.html:7` uses `alt={category}`, where `category` is a config value that is also the image file name.
- **Fixed currency**: `currency-code="USD"` appears in 4 places. `orderItemTile` "Price" uses `formatter="currency"` with no code, so it follows the user's currency, which is inconsistent with the USD MSRP shown next to it. The productFilter "Max Price" slider shows unformatted numbers (0–10000).
- **Message assembly**: server error text is joined with `', '`, and `reportError` builds `"<message>: <details>"`. Both are English punctuation and fixed order. Raw server and HTTP `statusText` errors (from `ldsUtils.reduceErrors`) are shown untranslated.
- **Locale-insensitive case**: `productTileList.js:67` lowercases the search key with `toLowerCase()`. This breaks for Turkish dotted/dotless i.
- **Toast position**: `toastPosition = 'top-right'` (`navigationMenu.js:34`) is fixed. Its behaviour in RTL layouts is worth checking.
- **Missing accessible names (text that will need labels once fixed)**: the `lightning-button-icon`s in paginator (2), productCard (1) and orderItemTile (delete and save, lines 58/66) have no `alternative-text`. The hamburger and close `<img>` in `navigationMenu.html:58,120` have no `alt`.
- **Bugs that affect text**: `navigationMenu.html:38` binds `label={buttonLabel}` (and `onclick={handleClick}`), and neither exists in the JS, so the button has no label. `Current Stage:` is rendered for every path item, not only the current one.
- **Near-duplicates for translators**: "Show details" vs "Show details."; "You have successfully created a Case." vs "...a case."; "Case Created" ×2; "Product picture" ×4; "Search Key" ×2.
- **Hardcoded headings instead of field labels**: productFilter `Category/Material/Level`, and productCard `Front/Rear` (where the field label is hidden with `variant="label-hidden"`).
- Navigation menu labels (`{item.label}`) come from the Apex `NavigationController`. Whether they are translated depends on that query, which is out of scope and not verified.

## Guideline ambiguities and how they were resolved
1. **Templates outside `<c>/<c>.html`**: `docs/ARCHITECTURE.md` defines template files as `**/lwc/<c>/<c>.html`, which does not match `errorPanel/templates/*.html`. They are included (G011–G013) because the task scope is every `.html`.
2. **"No letters" vs expressions**: when the only letters are inside `{…}`/`${…}`, the row is `maybe` (G011, G044). Pure no-letter literals like `', '` are excluded.
3. **Entities in text**: `&nbsp;` is kept as written (G070), and the decoded form is given in `notes`.
4. **Label + value element**: no fragment group unless the text node itself has an expression.
5. **`where` format**: text nodes use `<parent>#text`. `@api` defaults use `this.<prop> (@api default)`. Messages routed through `reportError` use `this.errorMessage (via reportError)`. `lightning/toast` uses `Toast.show.label` (that API's title field is `label`).
6. **Default `@api` values**: `yes` if a real parent leaves the prop unset (errorPanel), `maybe` if every parent overrides it (heroDetails).
7. **Content in slotless base components**: `maybe` (G045, G047, G049).
