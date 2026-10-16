import { test } from 'node:test';
import assert from 'node:assert/strict';
import r5 from '../../src/rules/r5-hardcoded-locale.js';
import { templateContext, scriptContext, located } from '../scan/helpers.js';

test('R5 template: a literal currency-code, not a bound one', () => {
    const findings = r5.check(templateContext('hardcodedLocale/hardcodedLocale.html'));
    assert.deepEqual(located(findings), ['5:9 USD']);
    assert.deepEqual(findings[0].context, { element: 'lightning-formatted-number', attribute: 'currency-code' });
    assert.match(findings[0].message, /CurrencyIsoCode/);
});

test('R5 script: Intl and toLocale* locales, currency options, locale/currency variables', () => {
    const findings = r5.check(scriptContext('hardcodedLocale/hardcodedLocale.js'));
    assert.deepEqual(
        findings.map((f) => `${f.line} ${f.text} ${f.context.sink}`),
        [
            '5 EUR currency-variable',
            '8 ja-JP locale-variable',
            '10 USD currency-variable',
            '13 en-US Intl.NumberFormat',
            '13 USD currency-variable',
            '21 de-DE toLocaleDateString',
            '29 fr-FR Intl.Collator'
        ]
    );
    const enUs = findings.find((f) => f.text === 'en-US');
    assert.equal(enUs.column, 39);
    assert.equal(enUs.message, 'Replace the hardcoded locale "en-US" with the user\'s locale from @salesforce/i18n/locale.');
});

test('R5 script: values from @salesforce/i18n and other option values are fine', () => {
    const texts = r5.check(scriptContext('hardcodedLocale/hardcodedLocale.js')).map((f) => f.text);
    for (const fine of ['symbol', 'currency', 'long', 'Price']) assert.ok(!texts.includes(fine), fine);
});
