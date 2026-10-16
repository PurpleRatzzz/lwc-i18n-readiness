import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseCategories, parseLabels, readLabelsFile } from '../../src/labels/read.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';
const REAL = '.targets/offline-app-developer-starter-kit/force-app/main/default/labels/CustomLabels.labels-meta.xml';

const byName = (labels) => Object.fromEntries(labels.map((l) => [l.fullName, l]));

test('reads every label, ignoring a commented-out one', () => {
    const names = readLabelsFile(FIXTURE).map((l) => l.fullName);
    assert.deepEqual(names, ['Apply_Button', 'Records_Updated', 'Terms_Html', 'Page_Of', 'Max_Items', 'Search_Spaced']);
});

test('line and column point at each <fullName> tag', () => {
    const lines = readFileSync(FIXTURE, 'utf8').split('\n');
    for (const label of readLabelsFile(FIXTURE)) {
        const sourceLine = lines[label.line - 1];
        assert.equal(sourceLine.slice(label.column - 1), `<fullName>${label.fullName}</fullName>`);
    }
    assert.deepEqual(readLabelsFile(FIXTURE).map((l) => l.line), [10, 18, 26, 35, 42, 50]);
});

test('decodes entities, keeps spaces, keeps every value a string', () => {
    const labels = byName(readLabelsFile(FIXTURE));
    assert.equal(labels.Terms_Html.value, 'Hi <b>{0}</b>, read our "Terms" & Conditions ©');
    assert.equal(labels.Terms_Html.shortDescription, "Rich text under the sign-up form; {0} is the user's first name");
    assert.equal(labels.Search_Spaced.value, ' Search ');
    assert.equal(labels.Max_Items.value, '10');
    assert.equal(labels.Records_Updated.protected, true);
    assert.equal(labels.Apply_Button.protected, false);
    assert.equal(labels.Apply_Button.language, 'en_US');
    assert.equal(labels.Page_Of.categories, '');
});

test('splits categories into component / ui / maxlen / other', () => {
    const labels = byName(readLabelsFile(FIXTURE));
    assert.deepEqual(labels.Apply_Button.categoryTokens, { component: 'propertyFilter', ui: 'button', maxlen: 12, other: [] });
    // A second ui: token and unknown keys are kept in `other`, not dropped.
    assert.deepEqual(labels.Terms_Html.categoryTokens, { component: 'signup', ui: 'text', maxlen: null, other: ['team:legal', 'ui:label'] });
    // maxlen must be a positive whole number.
    assert.deepEqual(labels.Max_Items.categoryTokens, { component: null, ui: 'label', maxlen: null, other: ['maxlen:abc'] });
    assert.deepEqual(labels.Page_Of.categoryTokens, { component: null, ui: null, maxlen: null, other: [] });
});

test('parseCategories handles spacing, case and odd tokens', () => {
    assert.deepEqual(parseCategories(' UI:Heading ,maxlen:0, maxlen:40,,legacy '), {
        component: null,
        ui: 'Heading',
        maxlen: 40,
        other: ['maxlen:0', 'legacy']
    });
    assert.deepEqual(parseCategories(undefined), { component: null, ui: null, maxlen: null, other: [] });
});

test('a single label still gives an array; an empty file gives none', () => {
    const one = '<?xml version="1.0"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n<labels><fullName>A</fullName><value>a</value></labels>\n</CustomLabels>\n';
    const labels = parseLabels(one);
    assert.equal(labels.length, 1);
    assert.equal(labels[0].line, 3);
    assert.equal(labels[0].shortDescription, '');
    assert.deepEqual(parseLabels('<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"></CustomLabels>'), []);
});

test('malformed XML or a wrong root element is an error, not an empty result', () => {
    assert.throws(() => parseLabels('<CustomLabels><labels></CustomLabels>', 'bad.xml'), /bad\.xml is not well-formed XML/);
    assert.throws(() => parseLabels('<Translations></Translations>', 'x.xml'), /no <CustomLabels> root/);
});

test('reads the real offline-app-developer-starter-kit file', { skip: !existsSync(REAL) && 'run npm run fetch-targets' }, () => {
    const labels = readLabelsFile(REAL);
    assert.equal(labels.length, 23);
    const of = byName(labels).LMR_Of;
    // Its <shortDescription> is split over two lines; the line number must still be the <fullName> one.
    assert.equal(of.line, 49);
    assert.equal(of.shortDescription, 'when filtering the data - X items of Y');
});
