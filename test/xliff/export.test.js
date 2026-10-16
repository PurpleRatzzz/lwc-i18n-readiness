import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { readLabelsFile } from '../../src/labels/read.js';
import { buildXliff } from '../../src/xliff/export.js';
import { parseXliff } from '../../src/xliff/parse.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';
const labels = readLabelsFile(FIXTURE);
const xml = buildXliff(labels, { original: FIXTURE, targetLang: 'zh-CN' });

// Parse with plain fast-xml-parser too, so the test doesn't only trust our own reader.
const raw = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', isArray: (n) => n === 'trans-unit' || n === 'note' })
    .parse(xml).xliff;

test('has the XLIFF 1.2 root and one <file> with languages and original', () => {
    assert.equal(raw['@_version'], '1.2');
    assert.equal(raw['@_xmlns'], 'urn:oasis:names:tc:xliff:document:1.2');
    assert.ok(!Array.isArray(raw.file));
    assert.equal(raw.file['@_original'], FIXTURE);
    assert.equal(raw.file['@_source-language'], 'en-US');
    assert.equal(raw.file['@_target-language'], 'zh-CN');
    assert.equal(raw.file['@_datatype'], 'xml');
});

test('one trans-unit per label, id and resname = fullName, no <target>', () => {
    const units = raw.file.body['trans-unit'];
    assert.deepEqual(units.map((u) => u['@_id']), labels.map((l) => l.fullName));
    for (const unit of units) {
        assert.equal(unit['@_resname'], unit['@_id']);
        assert.equal(unit.target, undefined);
        assert.equal(unit.source['@_xml:space'], 'preserve');
    }
});

test('notes carry the description and the categories', () => {
    const terms = raw.file.body['trans-unit'].find((u) => u['@_id'] === 'Terms_Html');
    assert.deepEqual(
        terms.note.map((n) => [n['@_from'], n['#text']]),
        [
            ['developer', "Rich text under the sign-up form; {0} is the user's first name"],
            ['context', 'component:signup,ui:text,team:legal,ui:label']
        ]
    );
    // No categories: no context note.
    const pageOf = raw.file.body['trans-unit'].find((u) => u['@_id'] === 'Page_Of');
    assert.deepEqual(pageOf.note.map((n) => n['@_from']), ['developer']);
});

test('maxlen:N becomes maxwidth="N" size-unit="char", only where set', () => {
    const units = raw.file.body['trans-unit'];
    const withWidth = units.filter((u) => u['@_maxwidth'] !== undefined);
    assert.deepEqual(withWidth.map((u) => [u['@_id'], u['@_maxwidth'], u['@_size-unit']]), [['Apply_Button', '12', 'char']]);
});

test('placeholders stay plain text and special characters are escaped once', () => {
    assert.ok(xml.includes('<source xml:space="preserve">Page {0} of {1}</source>'));
    assert.ok(xml.includes('Hi &lt;b&gt;{0}&lt;/b&gt;, read our &quot;Terms&quot; &amp; Conditions ©'));
    assert.ok(!/<(x|ph|g|bpt)\b/.test(xml), 'no XLIFF inline elements');
    // Our reader gives back exactly the label values.
    const parsed = parseXliff(xml);
    assert.deepEqual(parsed.units.map((u) => u.source), labels.map((l) => l.value));
    assert.equal(parsed.units.find((u) => u.id === 'Search_Spaced').source, ' Search ');
});

test('duplicate fullNames are refused', () => {
    assert.throws(() => buildXliff([labels[0], labels[0]], { original: 'x', targetLang: 'de' }), /Duplicate label fullName: Apply_Button/);
});

test('parseXliff reads notes with their from attribute', async () => {
    const { parseXliff } = await import('../../src/xliff/parse.js');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="x" source-language="en-US" target-language="zh-CN" datatype="xml"><body>
    <trans-unit id="A"><source>Save</source><target state="needs-review-translation">保存</target>
      <note from="developer">Button</note><note from="qa">Length over budget</note></trans-unit>
  </body></file>
</xliff>`;
    const [u] = parseXliff(xml).units;
    assert.deepEqual(u.notes, [
        { from: 'developer', text: 'Button' },
        { from: 'qa', text: 'Length over budget' }
    ]);
});
