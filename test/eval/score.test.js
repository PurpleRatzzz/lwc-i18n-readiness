import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../../eval/csv.js';
import { FAMILIES, matchFamily, disagreements, summarize } from '../../eval/score.js';

const FILE = 'lwc/a/a.html';

const gold = (id, line, text, extra = {}) => ({
    id,
    file: FILE,
    line: String(line),
    text,
    source_kind: 'text',
    where: '',
    user_visible: 'yes',
    issue: 'hardcoded',
    fragment_group: '',
    plural: '',
    notes: '',
    ...extra
});

const finding = (ruleId, line, text) => ({ ruleId, file: FILE, line, text });

test('csv round trip keeps quotes, commas and newlines', () => {
    const records = [{ a: 'Order status set to "${value}"', b: 'x, y\nz' }];
    assert.deepEqual(parseCsv(toCsv(records, ['a', 'b'])), records);
});

test('strings family: match within line tolerance, unmatched and missed', () => {
    const rows = [gold('G1', 5, 'Reset'), gold('G2', 9, 'Search Key'), gold('G3', 20, 'Maybe text', { user_visible: 'maybe' })];
    const findings = [
        finding('R1', 6, 'Reset'), // 1 line off: still a match
        finding('R2', 20, 'Maybe text'), // matches a maybe row: excluded from precision
        finding('R4', 30, 'badge'), // not in gold
        finding('R3', 5, 'Reset') // other family: ignored here
    ];
    const r = matchFamily(FAMILIES.strings, findings, rows);
    assert.equal(r.matched.length, 1);
    assert.equal(r.matchedMaybe.length, 1);
    assert.deepEqual(r.unmatched.map((f) => f.text), ['badge']);
    assert.deepEqual(r.missed.map((u) => u[0].id), ['G2']);

    const s = summarize(r, disagreements('strings', r));
    assert.equal(s.raw.precision.value, 1 / 2);
    assert.equal(s.raw.recall.value, 1 / 2);
    assert.equal(s.pending, 2);
    assert.equal(s.adjudicated, null);
});

test('adjudication: gold-miss counts for the scanner, gold-error leaves the denominator', () => {
    const rows = [gold('G1', 5, 'Reset'), gold('G2', 9, 'Search Key')];
    const r = matchFamily(FAMILIES.strings, [finding('R1', 5, 'Reset'), finding('R1', 12, 'Max Price')], rows);
    const decided = disagreements('strings', r).map((d) => ({
        ...d,
        decision: d.kind === 'unmatched-finding' ? 'gold-miss' : 'gold-error'
    }));
    const s = summarize(r, decided);
    assert.equal(s.adjudicated.precision.value, 1); // 2 of 2 findings are real problems
    assert.equal(s.adjudicated.recall.value, 1); // (1 detected + 1 gold-miss) / (2 - 1 gold-error + 1)
});

test('fragments family: a group counts once, any matching piece detects it', () => {
    const rows = [
        gold('G1', 3, 'days on', { fragment_group: 'F1' }),
        gold('G2', 4, 'the market', { fragment_group: 'F1' }),
        gold('G3', 8, '30 days', { plural: 'yes' })
    ];
    const r = matchFamily(FAMILIES.fragments, [finding('R3', 4, 'the market')], rows);
    assert.equal(r.yesUnits.length, 2);
    assert.equal(r.detectedUnits.length, 1);
    assert.deepEqual(r.missed.map((u) => u[0].id), ['G3']);
});
