import { test } from 'node:test';
import assert from 'node:assert/strict';
import r3 from '../../src/rules/r3-fragmented-sentence.js';
import { templateContext } from '../scan/helpers.js';

const findings = r3.check(templateContext('fragmentedSentences/fragmentedSentences.html'));
const bySubrule = (subrule) => findings.filter((f) => f.context.subrule === subrule).map((f) => `${f.line}:${f.column} ${f.text}`);

test('R3 interpolated: words mixed with {bindings} in one text node', () => {
    assert.deepEqual(bySubrule('interpolated'), [
        '3:9 Beds: {property.Beds__c} - Baths: {property.Baths__c}',
        '6:9 {totalItemCount} items • page {currentPageNumber} of {totalPages}',
        '16:8 {account.Name} has no open cases.'
    ]);
});

test('R3 split-by-markup: one sentence cut by inline elements, reported once on the first piece', () => {
    assert.deepEqual(bySubrule('split-by-markup'), ['11:29 days on', '13:8 Click', '25:9 Distance to property:']);
    // Text inside inline elements is part of the sentence: Click | here | to read the guide, or | skip | it.
    const click = findings.find((f) => f.text === 'Click');
    assert.equal(click.context.pieces, 5);
    assert.equal(click.context.element, 'p');
    // The second half sits inside <b>, after a value component: still one sentence, reported once.
    const distance = findings.filter((f) => f.text === 'Distance to property:');
    assert.deepEqual(distance.map((f) => f.context.pieces), [2]);
    // "Order Total: <lightning-formatted-number>" is a label and a value: one piece, nothing split.
    assert.ok(!findings.some((f) => f.text === 'Order Total:'));
    // lwc:if / lwc:else links are alternatives, not one sentence "Log In Log Out".
    assert.ok(!findings.some((f) => f.text === 'Log In'));
});

test('R3 plural: a number or binding followed by a plural noun, also next to interpolated', () => {
    assert.deepEqual(bySubrule('plural'), [
        '6:9 {totalItemCount} items • page {currentPageNumber} of {totalPages}',
        '14:8 Valid for 30 days.'
    ]);
    assert.deepEqual(findings.find((f) => f.text === 'Valid for 30 days.').context.phrases, ['30 days']);
});

test('R3 negatives: bindings only, "{x} has", a label: {value} pair, text separated by a block element', () => {
    const texts = findings.map((f) => f.text);
    assert.ok(!texts.includes('Owner: {record.Owner.Name}'), 'a label followed by its value is not a sentence');
    assert.ok(!texts.includes('{contact.Name}, {contact.Title}'));
    assert.ok(!texts.includes('Step one'), 'a <lightning-input> ends the sentence');
    assert.ok(!findings.some((f) => f.context.subrule === 'plural' && f.text.startsWith('{account.Name}')));
});
