import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import config from '../../src/config/default.js';
import { classify, discoverFiles } from '../../src/scan/discover.js';
import { scan, ignoredLines, sortFindings } from '../../src/scan/index.js';
import r1 from '../../src/rules/r1-hardcoded-attribute.js';
import { FIXTURES } from './helpers.js';

const { findings, errors, files } = scan(FIXTURES);
const inFile = (file) => findings.filter((f) => f.file === file);

test('classify: file kinds and components from the path', () => {
    const lwc = join('/p', 'force-app', 'main', 'default', 'lwc');
    assert.deepEqual(classify(join(lwc, 'hello', 'hello.html')), { kind: 'template', component: 'hello', componentDir: join(lwc, 'hello') });
    assert.equal(classify(join(lwc, 'errorPanel', 'templates', 'inlineMessage.html')).component, 'errorPanel');
    assert.equal(classify(join(lwc, 'hello', 'hello.js')).kind, 'script');
    assert.equal(classify(join(lwc, 'hello', 'hello.test.js')), null);
    assert.equal(classify(join(lwc, 'hello', 'utils', 'helper.js')), null, 'scripts only directly in lwc/<c>/');
    assert.equal(classify(join(lwc, 'jsconfig.json')), null);
    assert.equal(classify(join('/p', 'force-app', 'main', 'default', 'labels', 'CustomLabels.labels-meta.xml')).kind, 'labels');
    assert.equal(classify(join('/p', 'force-app', 'main', 'default', 'classes', 'Foo.cls')), null);
});

test('discovery skips __tests__ and finds templates in subfolders', () => {
    const paths = discoverFiles(FIXTURES, config).map((f) => f.file);
    assert.ok(!paths.some((p) => p.includes('__tests__')), '__tests__ must be skipped');
    assert.ok(paths.includes('errorPanel/templates/inlineMessage.html'));
    assert.ok(paths.includes('errorPanel/templates/noDataIllustration.html'));
    assert.ok(paths.includes('errorPanel/errorPanel.js'));
    assert.deepEqual(paths, [...paths].sort(), 'stable, sorted order');
    assert.equal(files.length, paths.length);
});

test('nothing is reported from __tests__ folders', () => {
    assert.ok(!findings.some((f) => f.file.includes('__tests__')));
    assert.ok(!findings.some((f) => f.text.startsWith('Mock')));
});

test('multi-template component: templates/ files are scanned and feed R4', () => {
    assert.deepEqual(
        inFile('errorPanel/templates/inlineMessage.html').map((f) => `${f.ruleId} ${f.line}:${f.column} ${f.text}`),
        ['R2 4:45 Show details.']
    );
    assert.deepEqual(inFile('errorPanel/templates/noDataIllustration.html').map((f) => `${f.ruleId} ${f.text}`), ['R1 No data']);
    // errorPanel has no errorPanel.html; {friendlyText} is only rendered by the templates/ files,
    // and "friendlyText" isn't named like a message, so this proves R4 saw those templates.
    const [panel] = inFile('errorPanel/errorPanel.js');
    assert.equal(panel.text, 'Error retrieving data');
    assert.deepEqual(panel.context, { sink: 'field-default', field: 'friendlyText', api: true, via: 'template', concatenated: false });
});

test('ignore comments suppress findings on the next line only', () => {
    assert.deepEqual(inFile('ignoreComments/ignoreComments.html').map((f) => `${f.ruleId} ${f.text}`), ['R1 Cancel']);
    assert.deepEqual(inFile('ignoreComments/ignoreComments.js').map((f) => `${f.ruleId} ${f.text}`), ['R4 Saved']);
});

test('ignoredLines: the line after each marker', () => {
    const html = '<template>\n<!-- i18n-ignore-next-line -->\n<p>x</p>\n</template>';
    assert.deepEqual([...ignoredLines(html, 'template')], [3]);
    const js = 'a();\n    // i18n-ignore-next-line\nb();\n// other comment\nc();';
    assert.deepEqual([...ignoredLines(js, 'script')], [3]);
});

test('a file that does not parse is reported as an error and the rest is still scanned', () => {
    assert.equal(errors.length, 1);
    assert.equal(errors[0].file, 'brokenScript/brokenScript.js');
    assert.match(errors[0].message, /^could not parse: /);
    assert.deepEqual(inFile('brokenScript/brokenScript.html').map((f) => f.text), ['Still scanned']);
});

test('a component that uses labels and i18n imports has no findings', () => {
    assert.deepEqual(findings.filter((f) => f.file.startsWith('cleanComponent/')), []);
});

test('findings are sorted by file, line, column', () => {
    assert.deepEqual(findings, sortFindings(findings));
    const keys = findings.map((f) => [f.file, f.line, f.column]);
    for (let i = 1; i < keys.length; i++) {
        const [a, b] = [keys[i - 1], keys[i]];
        assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))), `${a} before ${b}`);
    }
});

test('the rules option limits which rules run', () => {
    const only = scan(FIXTURES, { rules: [r1] });
    assert.ok(only.findings.length > 0);
    assert.ok(only.findings.every((f) => f.ruleId === 'R1'));
});

test('a rule that throws is reported per file instead of stopping the scan', () => {
    const broken = { id: 'R9', kinds: ['template'], check: () => { throw new Error('boom'); } };
    const result = scan(join(FIXTURES, 'hardcodedText'), { rules: [broken, r1] });
    assert.deepEqual(result.errors, [{ file: 'hardcodedText.html', message: 'R9 failed: boom' }]);
});
