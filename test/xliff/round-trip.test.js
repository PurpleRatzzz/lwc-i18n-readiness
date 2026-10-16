// The whole flow on the fixture, through the real CLI:
// labels -> xliff-export -> translate (pseudo / stub) -> xliff-import -> translation-meta.xml
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLabelsFile } from '../../src/labels/read.js';
import { parseTranslations } from '../../src/labels/translations.js';
import { pseudoLocalize } from '../../src/pseudo/pseudo.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';

function cli(...args) {
    return spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
}

function exportAndTranslate(translator) {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-i18n-'));
    const exported = join(dir, 'labels.zh-CN.xlf');
    const translated = join(dir, `labels.zh-CN.${translator}.xlf`);
    assert.equal(cli('xliff-export', FIXTURE, '--target-lang', 'zh-CN', '--out', exported).status, 0);
    const t = cli('translate', exported, '--out', translated, '--lang', 'zh-CN', '--translator', translator);
    assert.equal(t.status, 0, t.stderr);
    return { dir, translated };
}

test('export -> pseudo translate -> import writes every label, placeholders and tags intact', () => {
    const { dir, translated } = exportAndTranslate('pseudo');
    const out = join(dir, 'translations');

    // Apply_Button has maxlen:12 and its pseudo text is 15 characters: exactly the kind of
    // problem pseudo-localization is for. Without --allow-warnings it is held back, exit 1.
    const strict = cli('xliff-import', translated, '--labels', FIXTURE, '--out', out);
    assert.equal(strict.status, 1);
    assert.match(strict.stdout, /WARNING Apply_Button: Target is 15 characters, maxwidth is 12/);
    assert.match(strict.stdout, /6 units: 5 written, 0 skipped, 0 rejected, 1 held back/);

    const allowed = cli('xliff-import', translated, '--labels', FIXTURE, '--out', out, '--allow-warnings');
    assert.equal(allowed.status, 0, allowed.stdout);

    const written = parseTranslations(readFileSync(join(out, 'zh_CN.translation-meta.xml'), 'utf8'));
    const labels = readLabelsFile(FIXTURE);
    assert.deepEqual(
        written,
        labels.map((l) => ({ name: l.fullName, label: pseudoLocalize(l.value) })).sort((a, b) => (a.name < b.name ? -1 : 1))
    );
    const terms = written.find((t) => t.name === 'Terms_Html').label;
    assert.ok(terms.includes('<b>{0}</b>'), terms);
});

test('export -> stub translate -> import skips everything and writes nothing', () => {
    const { dir, translated } = exportAndTranslate('stub');
    const out = join(dir, 'translations');
    const result = cli('xliff-import', translated, '--labels', FIXTURE, '--out', out);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /6 units: 0 written, 6 skipped/);
    assert.ok(!existsSync(join(out, 'zh_CN.translation-meta.xml')));
});

test('pseudo command writes <locale>.translation-meta.xml and requires --locale', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-i18n-'));
    const ok = cli('pseudo', FIXTURE, '--locale', 'eo', '--out', dir);
    assert.equal(ok.status, 0, ok.stderr);
    const written = parseTranslations(readFileSync(join(dir, 'eo.translation-meta.xml'), 'utf8'));
    assert.equal(written.length, 6);
    assert.equal(written.find((t) => t.name === 'Page_Of').label, pseudoLocalize('Page {0} of {1}'));

    assert.equal(cli('pseudo', FIXTURE, '--out', dir).status, 2, 'no default locale');
    assert.equal(cli('pseudo', FIXTURE, '--locale', 'zh-CN', '--out', dir).status, 2, 'BCP 47 form is refused');
});

test('export refuses an unmapped target language before any work is done', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-i18n-'));
    const result = cli('xliff-export', FIXTURE, '--target-lang', 'tlh', '--out', join(dir, 'x.xlf'));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No Salesforce language code is mapped for "tlh"/);
    assert.ok(!existsSync(join(dir, 'x.xlf')));
});
