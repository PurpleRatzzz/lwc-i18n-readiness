import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLabelsFile } from '../../src/labels/read.js';
import { pseudoLocalize } from '../../src/pseudo/pseudo.js';
import commandTranslator, { shellQuote } from '../../src/translators/command.js';
import { fillTargets } from '../../src/translators/fill-targets.js';
import { translators } from '../../src/translators/index.js';
import { buildXliff } from '../../src/xliff/export.js';
import { parseXliff } from '../../src/xliff/parse.js';

const FIXTURE = 'test/fixtures/labels/sample.labels-meta.xml';
const labels = readLabelsFile(FIXTURE);
const XLIFF = buildXliff(labels, { original: FIXTURE, targetLang: 'zh-CN' });

// A directory with a space in its name, to prove paths are quoted for the shell.
function workDir() {
    const dir = join(mkdtempSync(join(tmpdir(), 'lwc-i18n-')), 'with space');
    mkdirSync(dir);
    const inFile = join(dir, 'in.xlf');
    writeFileSync(inFile, XLIFF);
    return { dir, inFile, outFile: join(dir, 'out.xlf') };
}

test('stub copies the source into needs-translation targets and changes nothing else', async () => {
    const { inFile, outFile } = workDir();
    await translators.stub({ inFile, outFile, lang: 'zh-CN' });
    const out = readFileSync(outFile, 'utf8');
    const units = parseXliff(out).units;
    assert.deepEqual(units.map((u) => u.target), labels.map((l) => l.value));
    assert.ok(units.every((u) => u.state === 'needs-translation'));
    // Remove the target lines and we are back to the exported file.
    assert.equal(out.replace(/\n[ \t]*<target [^\n]*<\/target>/g, ''), XLIFF);
});

test('pseudo fills translated pseudo targets', async () => {
    const { inFile, outFile } = workDir();
    await translators.pseudo({ inFile, outFile, lang: 'zh-CN' });
    const units = parseXliff(readFileSync(outFile, 'utf8')).units;
    assert.deepEqual(units.map((u) => u.target), labels.map((l) => pseudoLocalize(l.value)));
    assert.ok(units.every((u) => u.state === 'translated'));
});

test('fillTargets replaces an existing target instead of adding a second one', () => {
    const once = fillTargets(XLIFF, (s) => s, 'needs-translation');
    const twice = fillTargets(once, (s) => `T:${s}`, 'translated');
    assert.equal((twice.match(/<target /g) ?? []).length, labels.length);
    assert.equal(parseXliff(twice).units[0].target, 'T:Apply');
    // Also for a self-closing <target/>.
    const selfClosing = '<trans-unit id="a"><source>Hi &amp; bye</source><target/></trans-unit>';
    assert.equal(fillTargets(selfClosing, (s) => s.toUpperCase(), 'translated'),
        '<trans-unit id="a"><source>Hi &amp; bye</source>\n<target state="translated">HI &amp; BYE</target></trans-unit>');
});

// The fake external translator: a node one-liner that copies {in} to {out} and records {lang}.
const FAKE = `${shellQuote(process.execPath)} -e "const fs = require('fs'); const [i, o, l] = process.argv.slice(1); fs.writeFileSync(o, fs.readFileSync(i, 'utf8') + '<!-- lang ' + l + ' -->\\n')" {in} {out} {lang}`;

test('command runs LWC_I18N_TRANSLATOR_CMD with {in}, {out} and {lang} filled in', async () => {
    const { inFile, outFile } = workDir();
    await commandTranslator({ inFile, outFile, lang: 'zh-CN', env: { ...process.env, LWC_I18N_TRANSLATOR_CMD: FAKE } });
    assert.equal(readFileSync(outFile, 'utf8'), `${XLIFF}<!-- lang zh-CN -->\n`);
});

test('command fails clearly: no variable, non-zero exit, no output, output not XLIFF', async () => {
    const { inFile, outFile } = workDir();
    const run = (cmd) => commandTranslator({ inFile, outFile, lang: 'zh-CN', env: { ...process.env, LWC_I18N_TRANSLATOR_CMD: cmd } });
    const node = shellQuote(process.execPath);

    await assert.rejects(commandTranslator({ inFile, outFile, lang: 'zh-CN', env: {} }), /Set LWC_I18N_TRANSLATOR_CMD/);
    await assert.rejects(run(`${node} -e "process.exit(3)"`), /exited with code 3/);

    // A stale output from an earlier run must not count as this run's output.
    writeFileSync(outFile, XLIFF);
    await assert.rejects(run(`${node} -e "0"`), /did not write/);
    assert.ok(!existsSync(outFile));

    await assert.rejects(run(`${node} -e "require('fs').writeFileSync(process.argv[1], '<html></html>')" {out}`), /is not XLIFF 1\.2|no <xliff> root/);
});

test('translate CLI with --translator command, and its usage errors', () => {
    const { inFile, outFile } = workDir();
    const cli = (args, env = {}) =>
        spawnSync(process.execPath, ['src/cli.js', 'translate', ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

    const ok = cli([inFile, '--out', outFile, '--lang', 'zh-CN', '--translator', 'command'], { LWC_I18N_TRANSLATOR_CMD: FAKE });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /Translated 6 units with "command"/);

    assert.equal(cli([inFile, '--out', outFile, '--lang', 'zh-CN']).status, 2, 'no --translator');
    assert.equal(cli([inFile, '--out', outFile, '--lang', 'zh-CN', '--translator', 'google']).status, 2, 'unknown translator');
    assert.equal(cli([inFile, '--out', outFile, '--lang', 'xx', '--translator', 'stub']).status, 2, 'unmapped language');
    const mismatch = cli([inFile, '--out', outFile, '--lang', 'de', '--translator', 'stub']);
    assert.equal(mismatch.status, 2);
    assert.match(mismatch.stderr, /--lang de does not match the file's target-language zh-CN/);
});
