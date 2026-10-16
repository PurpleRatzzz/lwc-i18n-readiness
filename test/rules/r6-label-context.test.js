import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import r6, { labelProblems } from '../../src/rules/r6-label-context.js';
import { parseCategories } from '../../src/labels/read.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';

// A label with good context; each test changes one thing.
const label = (overrides = {}) => ({
    fullName: 'Apply_Button',
    value: 'Apply',
    shortDescription: 'Button in the filter panel that applies the selected filters',
    categoryTokens: parseCategories('ui:button'),
    ...overrides
});
const subrules = (l) => labelProblems(l).map((p) => p.subrule);

test('a label with good context has no problems', () => {
    assert.deepEqual(subrules(label()), []);
});

test('description-repeats-value ignores case and whitespace', () => {
    assert.deepEqual(subrules(label({ shortDescription: 'apply' })), ['description-repeats-value']);
    assert.deepEqual(subrules(label({ value: 'Start Date', shortDescription: ' start  date ' })), ['description-repeats-value']);
    assert.deepEqual(subrules(label({ value: 'Start Date', shortDescription: 'StartDate' })), ['description-repeats-value']);
    // A description that adds something is fine, even if it starts with the value.
    assert.deepEqual(subrules(label({ shortDescription: 'Apply button' })), []);
    // An empty description isn't "repeating" (and Salesforce requires one anyway).
    assert.deepEqual(subrules(label({ shortDescription: '' })), []);
});

test('no-ui-category fires without a ui: token', () => {
    assert.deepEqual(subrules(label({ categoryTokens: parseCategories('') })), ['no-ui-category']);
    assert.deepEqual(subrules(label({ categoryTokens: parseCategories('component:x, maxlen:10') })), ['no-ui-category']);
    assert.deepEqual(subrules(label({ categoryTokens: parseCategories('component:x, ui:toast') })), []);
});

test('unexplained-placeholder fires when the description does not mention the placeholders', () => {
    const toast = (shortDescription) => label({ value: '{0} records updated', shortDescription });
    assert.deepEqual(subrules(toast('Toast after a bulk edit')), ['unexplained-placeholder']);
    assert.deepEqual(subrules(toast('Toast after a bulk edit; {0} is the record count')), []);
    assert.deepEqual(subrules(toast('Toast after a bulk edit; the placeholder is the record count')), []);
    assert.deepEqual(subrules(toast('Toast after a bulk edit; the Variable is a number')), []);
    // Each placeholder needs explaining; one finding lists all that are missing.
    const pageOf = labelProblems(label({ value: 'Page {0} of {1}', shortDescription: 'Pager; {0} is the page' }));
    assert.equal(pageOf.length, 1);
    assert.match(pageOf[0].message, /^The value has \{1\} but/);
    // No placeholder, no finding.
    assert.deepEqual(subrules(label({ value: 'Use {braces}', shortDescription: 'Help text' })), []);
});

test('check() parses ctx.source and returns Findings on the <fullName> line', () => {
    const findings = r6.check({
        kind: 'labels',
        file: 'force-app/main/default/labels/CustomLabels.labels-meta.xml',
        source: readFileSync(FIXTURE, 'utf8'),
        config: {}
    });
    const summary = findings.map((f) => `${f.text}:${f.line}:${f.context.subrule}`);
    assert.deepEqual(summary, [
        'Page_Of:35:no-ui-category',
        'Page_Of:35:unexplained-placeholder',
        'Search_Spaced:50:description-repeats-value',
        'Search_Spaced:50:no-ui-category'
    ]);
    for (const f of findings) {
        assert.equal(f.ruleId, 'R6');
        assert.equal(f.ruleName, 'label-context');
        assert.equal(f.severity, 'warning');
        assert.equal(f.file, 'force-app/main/default/labels/CustomLabels.labels-meta.xml');
        assert.equal(f.column, 9);
        assert.ok(f.message.length > 0);
    }
});

test('rule metadata matches the contract', () => {
    assert.equal(r6.id, 'R6');
    assert.equal(r6.name, 'label-context');
    assert.deepEqual(r6.kinds, ['labels']);
    assert.equal(r6.severity, 'warning');
});

test('fragment-value fires on values that start in lower case', () => {
    for (const value of ['of', 'items', 'sorted by', 'éditer']) {
        assert.ok(subrules(label({ value })).includes('fragment-value'), value);
    }
    // Whole messages, including ones that start with a placeholder, are fine.
    for (const value of ['Apply', '{0} items of {1}', '  Start Date']) {
        assert.ok(!subrules(label({ value })).includes('fragment-value'), value);
    }
});
