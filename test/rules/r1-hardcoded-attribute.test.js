import { test } from 'node:test';
import assert from 'node:assert/strict';
import r1 from '../../src/rules/r1-hardcoded-attribute.js';
import { templateContext, located } from '../scan/helpers.js';

const findings = r1.check(templateContext('hardcodedAttributes/hardcodedAttributes.html'));

test('R1 reports literal user-facing attributes at the attribute name', () => {
    assert.deepEqual(located(findings), [
        '2:21 Property Filters',
        '4:13 Search Key',
        '5:13 Search...',
        '9:27 Reset',
        '13:13 Delete',
        '19:13 Enter a maximum price',
        '21:28 Company logo',
        '22:24 Error retrieving data',
        '24:29 Prices include tax'
    ]);
});

test('R1 fills context and an actionable message', () => {
    const reset = findings.find((f) => f.text === 'Reset');
    assert.deepEqual(reset.context, { element: 'lightning-button', attribute: 'label' });
    assert.equal(reset.message, 'Move label "Reset" on <lightning-button> into a Custom Label and import it via @salesforce/label.');
    assert.equal(reset.ruleId, 'R1');
    assert.equal(reset.severity, 'error');
    assert.equal(reset.file, 'hardcodedAttributes/hardcodedAttributes.html');
});

test('R1 covers message-when-* and display props of c-* children', () => {
    const attributes = findings.map((f) => `${f.context.element} ${f.context.attribute}`);
    assert.ok(attributes.includes('lightning-input message-when-value-missing'));
    assert.ok(attributes.includes('c-error-panel friendly-message'));
});

test('R1 ignores code attributes, bindings, numbers, data-*, URLs and identifiers', () => {
    const texts = findings.map((f) => f.text);
    for (const notUi of ['utility:delete', 'standard:filter', 'brand', 'neutral', '{labels.reset}', '100', 'delete-button', 'a0B000000000001', 'https://example.com/help', 'HelloBinding', 'LinkedIn']) {
        assert.ok(!texts.includes(notUi), `should not report ${notUi}`);
    }
    // title={property.Name} on a c-* child is a binding, not a literal.
    assert.ok(!findings.some((f) => f.context.element === 'c-property-tile'));
});
