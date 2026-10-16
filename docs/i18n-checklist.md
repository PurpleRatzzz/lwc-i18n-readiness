# i18n checklist for LWC engineers

Ten things to get right before your strings go to translation. Each item links to a real example in Salesforce's own sample apps (pinned commits) and names the scanner rule that catches it. "Manual" means no rule can catch it reliably, so it needs a reviewer.

Run the checker from a clone of this repo with `node src/cli.js scan <path-to-your-project>`, or add the GitHub Action (see README) so it runs on every PR. Put `<!-- i18n-ignore-next-line -->` or `// i18n-ignore-next-line` above a line you've deliberately left untranslated.

---

**1. Every string a user can see or hear goes into a Custom Label, in templates and in JS.** · R1, R2, R4
Don't: `label="Reset"` ([dreamhouse propertyFilter](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyFilter/propertyFilter.html#L5)), `title: 'Scanning Canceled'` in a toast ([barcodeScanner](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/barcodeScanner/barcodeScanner.js#L56)).
Do: `import RESET from '@salesforce/label/c.PropertyFilter_Reset';` and expose it as `label={labels.reset}`. Text that translators never see ships in English in every language.

**2. One sentence, one label. Use placeholders, never pieces.** · R3, R4
Don't: `Beds: {property.Beds__c} - Baths: {property.Baths__c}` ([propertyTile](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyTile/propertyTile.html#L10)), `days on <br />the market` ([daysOnMarket](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/daysOnMarket/daysOnMarket.html#L9)).
Do: one label `{0} beds · {1} baths`, filled in by a getter with a small `format(label, ...args)` helper that replaces `{n}`. Word order differs by language (Japanese often puts the number after the noun), and translators can only reorder what's inside one string.

**3. Numbers next to nouns need plural rules.** · R3 (plural)
Don't: `{totalItemCount} items • page {currentPageNumber} of {totalPages}` ([paginator](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/paginator/paginator.html#L15)).
Do: pick the label with `new Intl.PluralRules(LOCALE).select(n)` (`LOCALE` from `@salesforce/i18n/locale`). Create labels for every category your target languages use (`one`, `few`, `many`, `other`), because the set of labels is the same in every language. Chinese uses one form; Russian and Polish need more than two.

**4. Never hardcode a currency or locale.** · R5
Don't: `currency-code="USD"` ([dreamhouse propertyTile](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyTile/propertyTile.html#L14); also four places in ebikes, e.g. [orderBuilder](https://github.com/trailheadapps/ebikes-lwc/blob/c60a6c1cfae41e2f8bf6cf4f961a4f07954abfee/force-app/main/default/lwc/orderBuilder/orderBuilder.html#L10)).
Do: use the record's `CurrencyIsoCode` in multi-currency orgs, or the user's currency from `@salesforce/i18n/currency`, as [lwc-recipes opportunitiesSummary](https://github.com/trailheadapps/lwc-recipes/blob/d6a89c734f7a3401ff474220ead3f449e8b44f3e/force-app/main/default/lwc/opportunitiesSummary/opportunitiesSummary.js#L2) does. Keep using `lightning-formatted-number` and `lightning-formatted-date-time`; they already follow the user's locale.

**5. Show picklist labels, not API values.** · Manual
Don't: a toast built from the picklist **value** while the path shows the **label** ([ebikes orderStatusPath](https://github.com/trailheadapps/ebikes-lwc/blob/c60a6c1cfae41e2f8bf6cf4f961a4f07954abfee/force-app/main/default/lwc/orderStatusPath/orderStatusPath.js#L139)). Value and label are identical in English, so nobody notices until the picklist is translated or renamed.
Do: what [ebikes productFilter](https://github.com/trailheadapps/ebikes-lwc/blob/c60a6c1cfae41e2f8bf6cf4f961a4f07954abfee/force-app/main/default/lwc/productFilter/productFilter.html#L28) does: `label={category.label}`. Values are for logic, labels are for people.

**6. Give every label context: where it appears, what it is, what `{0}` means, and how much room it has.** · R6
Don't: `shortDescription` = `Cancel`, `value` = `Cancel` ([offline-app-developer-starter-kit](https://github.com/salesforce/offline-app-developer-starter-kit/blob/fb66da8fb5e477b23ee56f805ab80dee70df3156/force-app/main/default/labels/CustomLabels.labels-meta.xml#L4-L10)). "Cancel" a dialog, or "Cancel" an order?
Do: `shortDescription` = "Button that closes the edit dialog without saving"; `categories` = `component:recordEditor, ui:button, maxlen:12`. Custom Labels have no field for translator notes or maximum length, so this convention lives in `categories`. AI translation is only as good as the context it gets; the export puts both into the XLIFF `<note>` and `maxwidth`.

**7. Leave room for text to grow, and test it before translation.** · `lwc-i18n pseudo`
Short strings grow the most: a 5-letter button label can double in German or Finnish. Avoid fixed widths. When you use a `truncate` class (e.g. [propertyTile](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyTile/propertyTile.html#L7)), also give the full text in a `title`. Deploy a pseudo-localized language and look: anything still in plain English is hardcoded; a missing `]` means truncation.

**8. Don't build HTML with English in JS.** · R4
Don't: a map tooltip assembled as `<h1>${property.Name}</h1><p>Beds: ${…} - Baths: ${…}</p>` ([propertyListMap](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyListMap/propertyListMap.js#L176-L183)).
Do: fill the text parts from labels (item 2), then build the markup. Better still, render it from a template.

**9. Icon-only buttons need a translatable `alternative-text`.** · Manual (R1 catches it only when it's a literal)
Don't: delete and save buttons with an icon and no text at all ([ebikes orderItemTile](https://github.com/trailheadapps/ebikes-lwc/blob/c60a6c1cfae41e2f8bf6cf4f961a4f07954abfee/force-app/main/default/lwc/orderItemTile/orderItemTile.html#L58-L72)). A screen reader user hears nothing useful, in any language.
Do: `alternative-text={labels.deleteItem}`. Accessibility text is UI text and needs translating like any other.

**10. Let the platform format addresses and names.** · Manual
Don't: `` `${Address__c}, ${City__c}` `` as a card title ([propertyMap](https://github.com/trailheadapps/dreamhouse-lwc/blob/3f496e4e28c0fc8d00ca059622e2ab92ac2612ea/force-app/main/default/lwc/propertyMap/propertyMap.js#L34)). Field order and separators differ by country; a Japanese address runs from the largest unit to the smallest.
Do: `lightning-formatted-address` and `lightning-formatted-name`, which follow the user's locale.
