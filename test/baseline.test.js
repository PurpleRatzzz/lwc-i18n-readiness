import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFinding, fingerprint } from '../src/finding.js';
import { buildBaseline, splitByBaseline } from '../src/baseline.js';

const f = (text, line = 1) =>
    makeFinding({
        ruleId: 'R1',
        ruleName: 'hardcoded-attribute',
        severity: 'error',
        file: 'lwc/a/a.html',
        line,
        text,
        message: 'm'
    });

test('makeFinding collapses whitespace in text', () => {
    assert.equal(f('  days on\n   the market ').text, 'days on the market');
});

test('makeFinding rejects bad input', () => {
    assert.throws(() => makeFinding({ ruleId: 'X1', severity: 'error', file: 'a', line: 1 }));
    assert.throws(() => makeFinding({ ruleId: 'R1', severity: 'info', file: 'a', line: 1 }));
    assert.throws(() => makeFinding({ ruleId: 'R1', severity: 'error', file: 'a', line: 0 }));
});

test('fingerprint ignores line numbers', () => {
    assert.equal(fingerprint(f('Reset', 3)), fingerprint(f('Reset', 30)));
    assert.notEqual(fingerprint(f('Reset')), fingerprint(f('Search Key')));
});

test('baseline lets old findings through and flags new ones', () => {
    const baseline = buildBaseline([f('Reset'), f('Search Key')]);
    const { known, fresh } = splitByBaseline([f('Reset', 9), f('Max Price')], baseline);
    assert.deepEqual(known.map((x) => x.text), ['Reset']);
    assert.deepEqual(fresh.map((x) => x.text), ['Max Price']);
});

test('baseline counts duplicates: a third copy of the same text is new', () => {
    const baseline = buildBaseline([f('Error retrieving data'), f('Error retrieving data')]);
    const findings = [f('Error retrieving data'), f('Error retrieving data'), f('Error retrieving data')];
    const { known, fresh } = splitByBaseline(findings, baseline);
    assert.equal(known.length, 2);
    assert.equal(fresh.length, 1);
});
