import { test } from 'node:test';
import assert from 'node:assert/strict';
import r2 from '../../src/rules/r2-hardcoded-text.js';
import { templateContext, located } from '../scan/helpers.js';

const findings = r2.check(templateContext('hardcodedText/hardcodedText.html'));

test('R2 reports text nodes with words, located at their first non-whitespace character', () => {
    assert.deepEqual(located(findings), [
        '5:9 Contacts',
        // A multi-line text node: Prettier's newline and indentation are skipped, and the
        // text is the whole node with whitespace collapsed.
        '7:9 No contacts found for this account.',
        // &nbsp; is decoded by parse5 and trimmed by normalizeText.
        '11:8 MSRP:',
        // A leading &nbsp; is whitespace too, so the column points at "Total", not at "&".
        '12:17 Total',
        // Text inside <template lwc:if> lives in template.content and must still be found.
        '21:9 These are the details!'
    ]);
});

test('R2 context names the parent element', () => {
    assert.deepEqual(findings[0].context, { element: 'h2' });
    assert.match(findings[0].message, /^Move the text "Contacts" in <h2> into a Custom Label/);
});

test('R2 skips CSS, bindings-only text, symbols, code samples and tag names', () => {
    const texts = findings.map((f) => f.text);
    assert.ok(!texts.some((t) => t.includes('color')), 'style content');
    assert.ok(!texts.includes('{contact.Name}, {contact.Title}'), 'only bindings');
    assert.ok(!texts.some((t) => t.includes('{count}')), 'only symbols and bindings');
    assert.ok(!texts.includes('c-contact-tile'), 'component tag name');
    assert.ok(!texts.some((t) => t.includes('querySelector') || t.includes('"name"')), 'code and pre');
});
