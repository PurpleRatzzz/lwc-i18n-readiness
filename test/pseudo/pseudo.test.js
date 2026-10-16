import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionFor, pseudoLocalize } from '../../src/pseudo/pseudo.js';

const visibleLength = (s) => [...s].length;

test('accents letters, wraps in brackets, pads', () => {
    assert.equal(pseudoLocalize('Save'), '[Šåvé ~~~~~]');
    assert.equal(pseudoLocalize('Cancel'), '[Çåñçéļ ~~~~ ~~~~]');
});

test('is deterministic', () => {
    const s = 'Define a date range for the report';
    assert.equal(pseudoLocalize(s), pseudoLocalize(s));
});

test('expansion follows the IBM tiers (upper bound), short strings grow most', () => {
    // [source length, expected total length including brackets]
    const cases = [
        [1, 3], [10, 30], // up to 10: +200%
        [11, 22], [20, 40], // 11-20: +100%
        [21, 38], [30, 54], // 21-30: +80%  (21 + ceil(16.8))
        [31, 50], [50, 80], // 31-50: +60%
        [51, 72], [70, 98], // 51-70: +40%
        [71, 93], [200, 260] // over 70: +30%
    ];
    for (const [length, expected] of cases) {
        assert.equal(visibleLength(pseudoLocalize('x'.repeat(length))), expected, `length ${length}`);
    }
    assert.equal(expansionFor(10), 2.0);
    assert.equal(expansionFor(11), 1.0);
    assert.equal(expansionFor(1000), 0.3);
});

test('never changes placeholders, tags, entities or printf tokens', () => {
    const source = 'Hello {0}, see <a href="/x">{1}</a> &amp; &#169; %s %1$s {!Account.Name}<br/>';
    const result = pseudoLocalize(source);
    for (const token of ['{0}', '<a href="/x">', '{1}', '</a>', '&amp;', '&#169;', '%s', '%1$s', '{!Account.Name}', '<br/>']) {
        assert.ok(result.includes(token), `kept ${token} in ${result}`);
    }
    assert.ok(result.startsWith('[Ĥéļļö {0}, šéé <a href="/x">{1}</a>'));
});

test('placeholders and tags do not count toward the expansion', () => {
    assert.equal(pseudoLocalize('{0}'), '[{0}]');
    // "<b>Hi</b>" has 2 translatable characters: 2 + ceil(2 * 2) = 6 visible, so 2 padding chars.
    assert.equal(pseudoLocalize('<b>Hi</b>'), '[<b>Ĥî</b> ~]');
    assert.equal(pseudoLocalize(''), '[]');
});

test('padding has spaces so long text can wrap, and never ends in a space', () => {
    const result = pseudoLocalize('x'.repeat(80));
    assert.ok(/ ~~~~ ~~~~/.test(result));
    assert.ok(!result.endsWith(' ]'));
});
