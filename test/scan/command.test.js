// End-to-end tests of `lwc-i18n scan`: run the real CLI and check exit codes and output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './helpers.js';

const CLI = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const WITH_FINDINGS = join(FIXTURES, 'hardcodedLocale');
const CLEAN = join(FIXTURES, 'cleanComponent');

function scan(...args) {
    const result = spawnSync(process.execPath, [CLI, 'scan', ...args], { encoding: 'utf8' });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const tempFile = (name) => join(mkdtempSync(join(tmpdir(), 'lwc-i18n-')), name);

test('exit 1 when there are error findings and no baseline (every finding is new)', () => {
    const { code, stdout } = scan(WITH_FINDINGS);
    assert.equal(code, 1);
    assert.match(stdout, /hardcodedLocale\.html:5:9 {2}error {2}R5 hardcoded-locale/);
});

test('exit 0 for a clean project', () => {
    const { code, stdout } = scan(CLEAN);
    assert.equal(code, 0);
    assert.equal(stdout, 'No i18n findings.\n');
});

test('--write-baseline records today\'s findings and exits 0; the baseline then passes', () => {
    const baseline = tempFile('baseline.json');
    const written = scan(WITH_FINDINGS, '--write-baseline', baseline);
    assert.equal(written.code, 0);
    assert.ok(existsSync(baseline));

    const again = scan(WITH_FINDINGS, '--baseline', baseline, '--format', 'json');
    assert.equal(again.code, 0);
    const { findings } = JSON.parse(again.stdout);
    assert.ok(findings.length > 0);
    assert.ok(findings.every((f) => f.isNew === false));
});

test('exit 1 when a finding is not covered by the baseline', () => {
    const baseline = tempFile('baseline.json');
    scan(WITH_FINDINGS, '--write-baseline', baseline);
    // Drop one entry, as if that finding had been added after the baseline was taken.
    const counts = JSON.parse(readFileSync(baseline, 'utf8'));
    const [dropped] = Object.keys(counts);
    const droppedCount = counts[dropped];
    delete counts[dropped];
    writeFileSync(baseline, JSON.stringify(counts));

    const { code, stdout } = scan(WITH_FINDINGS, '--baseline', baseline, '--format', 'json');
    assert.equal(code, 1);
    const fresh = JSON.parse(stdout).findings.filter((f) => f.isNew);
    assert.equal(fresh.length, droppedCount);
    assert.ok(fresh.every((f) => f.fingerprint === dropped));
});

test('exit 0 when the only new findings are warnings (R6 label context)', () => {
    const { code, stdout } = scan(join(FIXTURES, 'warningsOnly'));
    assert.equal(code, 0);
    assert.match(stdout, /warning {2}R6 label-context/);
});

test('--rules limits the rules, and the exit code follows', () => {
    assert.equal(scan(WITH_FINDINGS, '--rules', 'R5').code, 1);
    // The fixture's only R1-R3 problems would be in its template, which has none.
    assert.equal(scan(WITH_FINDINGS, '--rules', 'R1,R2,R3').code, 0);
});

test('exit 2 for usage errors', () => {
    assert.equal(scan().code, 2);
    assert.equal(scan(join(FIXTURES, 'does-not-exist')).code, 2);
    assert.equal(scan(WITH_FINDINGS, '--format', 'xml').code, 2);
    assert.equal(scan(WITH_FINDINGS, '--rules', 'R9').code, 2);
    assert.equal(scan(WITH_FINDINGS, '--baseline', join(FIXTURES, 'missing.json')).code, 2);
    assert.equal(scan(WITH_FINDINGS, '--unknown-flag').code, 2);
    const { stderr } = scan(WITH_FINDINGS, '--format', 'xml');
    assert.match(stderr, /Usage: lwc-i18n scan <root>/);
});

test('files that cannot be parsed are named on stderr', () => {
    const { stderr } = scan(join(FIXTURES, 'brokenScript'));
    assert.match(stderr, /brokenScript\.js: could not parse: Unterminated string constant/);
});
