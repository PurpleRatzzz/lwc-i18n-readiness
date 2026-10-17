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
    // Undecided: raw counts, every disagreement against the scanner.
    assert.equal(s.adjudicated, false);
    assert.equal(s.pending, 2);
    assert.deepEqual(s.units, { total: 2, found: 1, missed: 1 });
    assert.deepEqual(s.findings, { total: 3, correct: 1, wrong: 1, notScored: 1 });
    assert.equal(s.precision.value, 1 / 2);
    assert.equal(s.recall.value, 1 / 2);
});

test('adjudication: gold-miss counts for the scanner, gold-error leaves the denominator', () => {
    const rows = [gold('G1', 5, 'Reset'), gold('G2', 9, 'Search Key')];
    const r = matchFamily(FAMILIES.strings, [finding('R1', 5, 'Reset'), finding('R1', 12, 'Max Price')], rows);
    const decided = disagreements('strings', r).map((d) => ({
        ...d,
        decision: d.kind === 'unmatched-finding' ? 'gold-miss' : 'gold-error'
    }));
    const s = summarize(r, decided);
    // The columns agree with the ratios: G2 left the gold set, Max Price joined it.
    assert.equal(s.adjudicated, true);
    assert.deepEqual(s.units, { total: 2, found: 2, missed: 0 });
    assert.deepEqual(s.findings, { total: 2, correct: 2, wrong: 0, notScored: 0 });
    assert.equal(s.precision.value, 1);
    assert.equal(s.recall.value, 1);
});

test('one gold unit hit by two findings: both findings are correct, the unit is found once', () => {
    const rows = [gold('G1', 15, '{n} items • page {p} of {t}', { fragment_group: 'F1', plural: 'yes' })];
    const twice = [finding('R3', 15, '{n} items • page {p} of {t}'), finding('R3', 15, '{n} items • page {p} of {t}')];
    const s = summarize(matchFamily(FAMILIES.fragments, twice, rows), []);
    assert.deepEqual(s.units, { total: 1, found: 1, missed: 0 });
    assert.equal(s.findings.correct, 2);
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

test('gold text with HTML entities matches the decoded scanner text', () => {
    const rows = [gold('G1', 12, 'MSRP:&nbsp;')];
    const r = matchFamily(FAMILIES.strings, [finding('R2', 12, 'MSRP:')], rows);
    assert.equal(r.matched.length, 1);
});

test('fragments family counts R4 findings marked concatenated, not plain R4', () => {
    const rows = [gold('G1', 7, 'Order status set to "${value}"', { fragment_group: 'F1', source_kind: 'js' })];
    const concatenated = { ...finding('R4', 7, 'Order status set to "${value}"'), context: { concatenated: true } };
    const plain = { ...finding('R4', 9, 'Success'), context: { concatenated: false } };
    const r = matchFamily(FAMILIES.fragments, [concatenated, plain], rows);
    assert.equal(r.matched.length, 1);
    assert.equal(r.unmatched.length, 0);
});

test('rows a reviewer set to user_visible=no are not gold units', () => {
    const rows = [gold('G1', 5, '© OpenStreetMap', { user_visible: 'no' }), gold('G2', 9, 'Reset')];
    const r = matchFamily(FAMILIES.strings, [finding('R1', 9, 'Reset')], rows);
    assert.equal(r.units.length, 1);
    assert.equal(r.missed.length, 0);
});

test('the same text twice in one file keeps two separate decisions', () => {
    const rows = [gold('G1', 134, ', '), gold('G2', 174, ', ')];
    const d = disagreements('strings', matchFamily(FAMILIES.strings, [], rows));
    assert.equal(new Set(d.map((x) => `${x.line} ${x.gold_ids}`)).size, 2);
});
