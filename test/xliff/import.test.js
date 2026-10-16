import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTranslations } from '../../src/labels/translations.js';
import { checkUnit, exitCode, planImport } from '../../src/xliff/import.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';

const label = { fullName: 'Records_Updated', value: '{0} records <b>saved</b>' };
const unit = (overrides = {}) => ({
    id: 'Records_Updated',
    maxwidth: null,
    sizeUnit: 'pixel',
    source: '{0} records <b>saved</b>',
    target: '已<b>保存</b> {0} 条记录',
    state: 'translated',
    ...overrides
});
const checks = (u, l = label) => checkUnit(u, l).map((i) => `${i.severity}:${i.check}`);

test('a good unit has no issues', () => {
    assert.deepEqual(checks(unit()), []);
    assert.deepEqual(checks(unit({ state: null })), [], 'a target without state counts as translated');
    assert.deepEqual(checks(unit({ state: 'final' })), []);
});

test('missing, empty or untranslated targets are skipped', () => {
    assert.deepEqual(checks(unit({ target: null, state: null })), ['skip:not-translated']);
    assert.deepEqual(checks(unit({ target: '   ' })), ['skip:not-translated']);
    assert.deepEqual(checks(unit({ state: 'new' })), ['skip:not-translated']);
    assert.deepEqual(checks(unit({ state: 'needs-translation' })), ['skip:not-translated']);
});

test('a different placeholder set is an error', () => {
    assert.deepEqual(checks(unit({ target: '已<b>保存</b>条记录' })), ['error:placeholders']);
    assert.deepEqual(checks(unit({ target: '已<b>保存</b> {1} 条记录' })), ['error:placeholders']);
    // Same set, repeated: fine.
    assert.deepEqual(checks(unit({ target: '{0}：已<b>保存</b> {0} 条记录' })), []);
});

test('a different tag set is an error, including XLIFF inline elements', () => {
    assert.deepEqual(checks(unit({ target: '已<b>保存 {0} 条记录' })), ['error:tags']);
    assert.deepEqual(checks(unit({ target: '已<g id="1">保存</g> {0} 条记录' })), ['error:tags']);
    // Moving a tag pair is allowed.
    assert.deepEqual(checks(unit({ target: '{0} 条记录<b>已保存</b>' })), []);
});

test('a target longer than maxwidth (in chars) is a warning', () => {
    const save = { fullName: 'Save', value: '<b>Save</b>' };
    const narrow = (target, sizeUnit = 'char') => unit({ id: 'Save', source: '<b>Save</b>', target, maxwidth: 8, sizeUnit });
    assert.deepEqual(checks(narrow('<b>保存所有更改并关闭</b>'), save), ['warning:maxwidth']);
    // Exactly 8: fine. Chinese characters count one each, and tags take no space on screen.
    assert.deepEqual(checks(narrow('<b>保存所有更改并关</b>'), save), []);
    // maxwidth in pixels (the XLIFF default unit) is not checked.
    assert.deepEqual(checks(narrow('<b>保存所有更改并关闭窗口</b>', 'pixel'), save), []);
});

test('a target identical to the source is a warning', () => {
    assert.deepEqual(checks(unit({ target: '{0} records <b>saved</b>' })), ['warning:same-as-source']);
});

test('an unknown id is an error', () => {
    const issues = checkUnit(unit({ id: 'Nope' }), undefined);
    assert.deepEqual(issues.map((i) => `${i.severity}:${i.check}`), ['error:unknown-id']);
});

test('a state that is not final, or a source that changed since export, is a warning', () => {
    assert.deepEqual(checks(unit({ state: 'needs-review-translation' })), ['warning:not-final']);
    assert.deepEqual(checks(unit(), { ...label, value: '{0} records <b>stored</b>' }), ['warning:source-changed']);
});

test('planImport: outcomes, what gets written, duplicates, missing units', () => {
    const labels = [label, { fullName: 'Other', value: 'Other' }, { fullName: 'Never_Sent', value: 'x' }];
    const units = [
        unit(),
        unit({ id: 'Other', source: 'Other', target: 'Other' }), // warning: same as source
        unit({ id: 'Ghost' }), // error: unknown
        unit({ target: null, state: null }) // duplicate id
    ];
    const plan = planImport(units, labels);
    assert.deepEqual(plan.units.map((u) => `${u.id}:${u.outcome}`), [
        'Records_Updated:written',
        'Other:held-back',
        'Ghost:rejected',
        'Records_Updated:rejected'
    ]);
    assert.deepEqual(plan.write, [{ name: 'Records_Updated', label: '已<b>保存</b> {0} 条记录' }]);
    assert.deepEqual(plan.missingFromXliff, ['Never_Sent']);
    assert.deepEqual(plan.summary, { units: 4, written: 1, skipped: 0, rejected: 2, heldBack: 1, errors: 2, warnings: 1 });

    const allowed = planImport(units, labels, { allowWarnings: true });
    assert.deepEqual(allowed.write.map((w) => w.name), ['Records_Updated', 'Other']);
});

test('exit code: 1 on errors, 1 on warnings unless allowed', () => {
    assert.equal(exitCode({ errors: 0, warnings: 0 }, false), 0);
    assert.equal(exitCode({ errors: 1, warnings: 0 }, true), 1);
    assert.equal(exitCode({ errors: 0, warnings: 2 }, false), 1);
    assert.equal(exitCode({ errors: 0, warnings: 2 }, true), 0);
});

// ---- the CLI command ----

function cli(...args) {
    return spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
}

function xliffWith(units, targetLang = 'de') {
    const body = units
        .map(({ id, source, target, state = 'translated', attrs = '' }) =>
            `<trans-unit id="${id}"${attrs}><source>${source}</source>` +
            (target === undefined ? '' : `<target state="${state}">${target}</target>`) +
            '</trans-unit>')
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
<file original="x" source-language="en-US" target-language="${targetLang}" datatype="xml"><body>
${body}
</body></file></xliff>
`;
}

function tempXliff(units, targetLang) {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-i18n-'));
    const file = join(dir, 'in.xlf');
    writeFileSync(file, xliffWith(units, targetLang));
    return { dir, file, out: join(dir, 'translations') };
}

const GOOD = { id: 'Records_Updated', source: '{0} records updated &amp; saved', target: '{0} Datensätze aktualisiert &amp; gespeichert' };
const TOO_LONG = { id: 'Apply_Button', source: 'Apply', target: 'Filter anwenden jetzt', attrs: ' maxwidth="12" size-unit="char"' };
const BROKEN = { id: 'Page_Of', source: 'Page {0} of {1}', target: 'Seite {0}' };

test('cli: clean batch writes the file and exits 0', () => {
    const { file, out } = tempXliff([GOOD]);
    const result = cli('xliff-import', file, '--labels', FIXTURE, '--out', out);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 units: 1 written, 0 skipped, 0 rejected, 0 held back/);
    assert.deepEqual(parseTranslations(readFileSync(join(out, 'de.translation-meta.xml'), 'utf8')), [
        { name: 'Records_Updated', label: '{0} Datensätze aktualisiert & gespeichert' }
    ]);
});

test('cli: warnings exit 1 and hold the unit back, unless --allow-warnings', () => {
    const held = tempXliff([GOOD, TOO_LONG]);
    const r1 = cli('xliff-import', held.file, '--labels', FIXTURE, '--out', held.out);
    assert.equal(r1.status, 1);
    assert.match(r1.stdout, /WARNING Apply_Button: Target is 21 characters, maxwidth is 12/);
    assert.deepEqual(parseTranslations(readFileSync(join(held.out, 'de.translation-meta.xml'), 'utf8')).map((t) => t.name), ['Records_Updated']);

    const allowed = tempXliff([GOOD, TOO_LONG]);
    const r2 = cli('xliff-import', allowed.file, '--labels', FIXTURE, '--out', allowed.out, '--allow-warnings');
    assert.equal(r2.status, 0);
    assert.deepEqual(parseTranslations(readFileSync(join(allowed.out, 'de.translation-meta.xml'), 'utf8')).map((t) => t.name), ['Apply_Button', 'Records_Updated']);
});

test('cli: errors exit 1 even with --allow-warnings, good units are still written, JSON report', () => {
    const { dir, file, out } = tempXliff([GOOD, BROKEN, { id: 'Unknown_Label', source: 'a', target: 'b' }]);
    const report = join(dir, 'report.json');
    const result = cli('xliff-import', file, '--labels', FIXTURE, '--out', out, '--allow-warnings', '--report', report);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /ERROR {3}Page_Of: Placeholders differ: source has \{0\} \{1\}, target has \{0\}/);
    assert.match(result.stdout, /ERROR {3}Unknown_Label: No label named "Unknown_Label"/);
    const json = JSON.parse(readFileSync(report, 'utf8'));
    assert.deepEqual(json.summary, { units: 3, written: 1, skipped: 0, rejected: 2, heldBack: 0, errors: 2, warnings: 0 });
    assert.equal(json.salesforceLanguage, 'de');
    assert.equal(json.missingFromXliff.length, 4);
    assert.ok(existsSync(join(out, 'de.translation-meta.xml')));
});

test('cli: nothing translated writes nothing and exits 0', () => {
    const { file, out } = tempXliff([{ ...GOOD, state: 'needs-translation' }, { id: 'Page_Of', source: 'Page {0} of {1}' }]);
    const result = cli('xliff-import', file, '--labels', FIXTURE, '--out', out);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /2 units: 0 written, 2 skipped/);
    assert.ok(!existsSync(out));
});

test('cli: unmapped target language and usage errors', () => {
    const { file, out } = tempXliff([GOOD], 'xx-YY');
    const unmapped = cli('xliff-import', file, '--labels', FIXTURE, '--out', out);
    assert.equal(unmapped.status, 1);
    assert.match(unmapped.stderr, /No Salesforce language code is mapped for "xx-YY"/);

    assert.equal(cli('xliff-import', file, '--out', out).status, 2, 'missing --labels');
    assert.equal(cli('xliff-import', file, '--labels', FIXTURE, '--out', out, '--bogus').status, 2);
});
