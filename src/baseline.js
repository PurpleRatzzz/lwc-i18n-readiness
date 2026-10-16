import { readFileSync, writeFileSync } from 'node:fs';
import { fingerprint } from './finding.js';

/*
 * Baseline = the findings a repo already had when the check was switched on.
 * On a PR, only findings beyond the baseline fail the build; old ones are reported but don't block.
 * Without this, day one of the gate is hundreds of errors and engineers turn it off.
 *
 * Stored as { fingerprint: count } rather than a set: the same text can legitimately appear
 * twice in one file (e.g. two "Error retrieving data" panels), and adding a third copy is new debt.
 */

export function buildBaseline(findings) {
    const counts = {};
    for (const f of findings) {
        const fp = fingerprint(f);
        counts[fp] = (counts[fp] ?? 0) + 1;
    }
    return counts;
}

export function writeBaseline(path, findings) {
    const counts = buildBaseline(findings);
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n');
}

export function readBaseline(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

/** Split findings into those already covered by the baseline and those that are new. */
export function splitByBaseline(findings, baseline) {
    const remaining = { ...baseline };
    const known = [];
    const fresh = [];
    for (const f of findings) {
        const fp = fingerprint(f);
        if (remaining[fp] > 0) {
            remaining[fp] -= 1;
            known.push(f);
        } else {
            fresh.push(f);
        }
    }
    return { known, fresh };
}
