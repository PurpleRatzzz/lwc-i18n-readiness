import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLabelsFile } from '../../src/labels/read.js';
import { mergeTranslations, parseTranslations, writeTranslationFile } from '../../src/labels/translations.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';

test('a new file is Salesforce source format, entries sorted by name', () => {
    const xml = mergeTranslations(null, [
        { name: 'B_Label', label: 'Bee' },
        { name: 'A_Label', label: 'Ay' }
    ]);
    assert.equal(
        xml,
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Translations xmlns="http://soap.sforce.com/2006/04/metadata">',
            '    <customLabels>',
            '        <label>Ay</label>',
            '        <name>A_Label</name>',
            '    </customLabels>',
            '    <customLabels>',
            '        <label>Bee</label>',
            '        <name>B_Label</name>',
            '    </customLabels>',
            '</Translations>',
            ''
        ].join('\n')
    );
});

test('escapes special characters', () => {
    const xml = mergeTranslations(null, [{ name: 'X', label: `<b>{0}</b> & "q" 'a'` }]);
    assert.match(xml, /<label>&lt;b&gt;\{0\}&lt;\/b&gt; &amp; &quot;q&quot; &apos;a&apos;<\/label>/);
});

test('round trip: labels read -> translation written -> read back gives the same text', () => {
    const labels = readLabelsFile(FIXTURE);
    const dir = mkdtempSync(join(tmpdir(), 'lwc-i18n-'));
    const path = writeTranslationFile(dir, 'de', labels.map((l) => ({ name: l.fullName, label: l.value })));
    const back = parseTranslations(readFileSync(path, 'utf8'));
    const expected = labels.map((l) => ({ name: l.fullName, label: l.value })).sort((a, b) => (a.name < b.name ? -1 : 1));
    assert.deepEqual(back, expected);
    // The tricky ones survived: markup, quotes, ampersand, ©, and surrounding spaces.
    assert.ok(back.some((t) => t.label === 'Hi <b>{0}</b>, read our "Terms" & Conditions ©'));
    assert.ok(back.some((t) => t.label === ' Search '));
});

const EXISTING = `<?xml version="1.0" encoding="UTF-8"?>
<Translations xmlns="http://soap.sforce.com/2006/04/metadata">
    <customApplications>
        <label>Dreamhouse &amp; Co</label>
        <name>Dreamhouse</name>
    </customApplications>
    <!-- <customLabels><label>x</label><name>In_A_Comment</name></customLabels> -->
    <customLabels>
        <label>Alt A</label>
        <name>A_Label</name>
    </customLabels>
    <customTabs>
        <label>Häuser</label>
        <name>Property__c</name>
    </customTabs>
    <customLabels>
        <label>Alt B</label>
        <name>B_Label</name>
    </customLabels>
</Translations>
`;

test('merge keeps other elements byte for byte and merges customLabels by name', () => {
    const xml = mergeTranslations(EXISTING, [
        { name: 'B_Label', label: 'Neu B' },
        { name: 'C_Label', label: 'Neu C' }
    ]);
    // Everything that isn't ours is unchanged, comment included.
    for (const kept of [
        '    <customApplications>\n        <label>Dreamhouse &amp; Co</label>\n        <name>Dreamhouse</name>\n    </customApplications>\n',
        '    <!-- <customLabels><label>x</label><name>In_A_Comment</name></customLabels> -->\n',
        '    <customTabs>\n        <label>Häuser</label>\n        <name>Property__c</name>\n    </customTabs>\n'
    ]) {
        assert.ok(xml.includes(kept), `kept: ${kept}`);
    }
    // A kept, B replaced, C added; one block each, sorted, where the first old block was.
    assert.deepEqual(parseTranslations(xml), [
        { name: 'A_Label', label: 'Alt A' },
        { name: 'B_Label', label: 'Neu B' },
        { name: 'C_Label', label: 'Neu C' }
    ]);
    assert.ok(xml.indexOf('<name>C_Label</name>') < xml.indexOf('<customTabs>'));
    assert.ok(!xml.includes('Alt B'));
    assert.ok(!/\n[ \t]*\n/.test(xml), 'no blank lines left behind');
    // Merging the same entries again changes nothing.
    assert.equal(mergeTranslations(xml, [{ name: 'C_Label', label: 'Neu C' }]), xml);
});

test('without existing customLabels, the block goes where Salesforce expects it (alphabetical)', () => {
    const existing = `<?xml version="1.0" encoding="UTF-8"?>
<Translations xmlns="http://soap.sforce.com/2006/04/metadata">
    <customApplications>
        <label>App</label>
        <name>App</name>
    </customApplications>
    <customTabs>
        <label>Tab</label>
        <name>Tab</name>
    </customTabs>
</Translations>
`;
    const xml = mergeTranslations(existing, [{ name: 'X', label: 'x' }]);
    assert.ok(xml.indexOf('</customApplications>') < xml.indexOf('<customLabels>'));
    assert.ok(xml.indexOf('<customLabels>') < xml.indexOf('<customTabs>'));

    const onlyApps = existing.replace(/ {4}<customTabs>[\s\S]*<\/customTabs>\n/, '');
    const xml2 = mergeTranslations(onlyApps, [{ name: 'X', label: 'x' }]);
    assert.ok(xml2.endsWith('    </customLabels>\n</Translations>\n'));
});

test('merging into a file written on one line keeps it well-formed', () => {
    const oneLine = '<?xml version="1.0"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><customTabs><label>T</label><name>T</name></customTabs></Translations>';
    const xml = mergeTranslations(oneLine, [{ name: 'X', label: 'x' }]);
    assert.deepEqual(parseTranslations(xml), [{ name: 'X', label: 'x' }]);
    assert.ok(xml.startsWith('<?xml version="1.0"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata">    <customLabels>'));
    assert.ok(xml.includes('</customLabels>\n<customTabs><label>T</label><name>T</name></customTabs></Translations>'));
});

test('writeTranslationFile creates the folder and merges on the second write', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'lwc-i18n-')), 'translations');
    writeTranslationFile(dir, 'zh_CN', [{ name: 'A', label: '甲' }]);
    const path = writeTranslationFile(dir, 'zh_CN', [{ name: 'B', label: '乙' }]);
    assert.equal(path, join(dir, 'zh_CN.translation-meta.xml'));
    assert.deepEqual(parseTranslations(readFileSync(path, 'utf8')), [
        { name: 'A', label: '甲' },
        { name: 'B', label: '乙' }
    ]);
});
