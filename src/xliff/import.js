// Validate translated XLIFF units before they are written back to Salesforce.
//
// Every unit ends up with one outcome:
//   skipped    not translated yet (no/empty target, or state new / needs-translation). Normal
//              in a partial batch, so it doesn't fail the run.
//   rejected   at least one error. A broken placeholder or tag would break the UI or the
//              code that fills it in, so the unit is never written.
//   held-back  warnings only, and --allow-warnings not given. Not written; a person decides.
//   written    no issues, or warnings that were allowed.
// Good units are written even when others fail: one bad string shouldn't block the rest of
// the batch. The exit code (see exitCode) still tells CI that something needs attention.

const PLACEHOLDER = /\{\d+\}/g;
// HTML/XML tags. Labels carry HTML as plain text (e.g. "<b>{0}</b>" for rich text), and a real
// XLIFF inline element like <g id="1"> also shows up here as text (see xmlToText).
const TAG = /<\/?[A-Za-z][^<>]*>/g;
const NOT_TRANSLATED_STATES = ['new', 'needs-translation'];
// States that mean "done". Any other state (needs-review-translation, needs-l10n, ...) means
// the translator flagged the unit as not final, e.g. project A when its QA gate blocks a unit.
const FINAL_STATES = ['translated', 'final', 'signed-off'];

/**
 * Check one unit against its label. `label` is undefined when the labels file has no label
 * with this id. Returns [{ severity: 'skip'|'error'|'warning', check, message }].
 */
export function checkUnit(unit, label) {
    if (!label) {
        return [issue('error', 'unknown-id', `No label named "${unit.id}" in the labels file`)];
    }
    if (unit.target === null || unit.target.trim() === '') {
        return [issue('skip', 'not-translated', unit.target === null ? 'No <target>' : 'Empty <target>')];
    }
    if (NOT_TRANSLATED_STATES.includes(unit.state)) {
        return [issue('skip', 'not-translated', `Target state is ${unit.state}`)];
    }

    const issues = [];

    // Placeholders are compared as sets: {0} must still be there, and no {2} may appear from nowhere.
    const sourcePlaceholders = uniqueSorted(unit.source.match(PLACEHOLDER));
    const targetPlaceholders = uniqueSorted(unit.target.match(PLACEHOLDER));
    if (sourcePlaceholders.join() !== targetPlaceholders.join()) {
        const message = `Placeholders differ: source has ${list(sourcePlaceholders)}, target has ${list(targetPlaceholders)}`;
        issues.push(issue('error', 'placeholders', message));
    }

    // Tags are compared with their counts (sorted, not de-duplicated): a missing second </b>
    // leaves the markup unbalanced even though the set of tag names is the same. Order may change.
    const sourceTags = (unit.source.match(TAG) ?? []).sort();
    const targetTags = (unit.target.match(TAG) ?? []).sort();
    if (sourceTags.join('\n') !== targetTags.join('\n')) {
        issues.push(issue('error', 'tags', `Tags differ: source has ${list(sourceTags)}, target has ${list(targetTags)}`));
    }

    // size-unit="char": count characters as code points, so one Chinese character counts as 1.
    // Tags take no space on screen, so they don't count; placeholders do, as written.
    const length = [...unit.target.replace(TAG, '')].length;
    if (unit.maxwidth && unit.sizeUnit === 'char' && length > unit.maxwidth) {
        issues.push(issue('warning', 'maxwidth', `Target is ${length} characters, maxwidth is ${unit.maxwidth}`));
    }

    // Can be right (brand names, "OK", "Email" in some languages), so only a warning.
    if (unit.target === unit.source) {
        issues.push(issue('warning', 'same-as-source', 'Target is identical to source'));
    }

    if (unit.state !== null && !FINAL_STATES.includes(unit.state)) {
        issues.push(issue('warning', 'not-final', `Target state is ${unit.state}`));
    }

    // The English text changed after export: the translation may describe the old text.
    if (unit.source !== label.value) {
        issues.push(issue('warning', 'source-changed', 'The label value changed since this XLIFF was exported'));
    }

    return issues;
}

/**
 * Validate all units. Returns { units: [{ id, outcome, issues }], write: [{ name, label }],
 * missingFromXliff: [fullName], summary }.
 */
export function planImport(units, labels, { allowWarnings = false } = {}) {
    const labelsByName = new Map(labels.map((label) => [label.fullName, label]));
    const seen = new Set();
    const results = [];
    const write = [];

    for (const unit of units) {
        const issues = seen.has(unit.id)
            ? [issue('error', 'duplicate-id', `trans-unit id "${unit.id}" appears more than once`)]
            : checkUnit(unit, labelsByName.get(unit.id));
        seen.add(unit.id);

        const outcome = outcomeOf(issues, allowWarnings);
        if (outcome === 'written') write.push({ name: unit.id, label: unit.target });
        results.push({ id: unit.id, outcome, issues });
    }

    const count = (outcome) => results.filter((r) => r.outcome === outcome).length;
    const issues = results.flatMap((r) => r.issues);
    return {
        units: results,
        write,
        // Not an error (a batch can be partial), but worth seeing: a translator that silently
        // drops units would otherwise go unnoticed.
        missingFromXliff: labels.map((l) => l.fullName).filter((name) => !seen.has(name)),
        summary: {
            units: results.length,
            written: count('written'),
            skipped: count('skipped'),
            rejected: count('rejected'),
            heldBack: count('held-back'),
            errors: issues.filter((i) => i.severity === 'error').length,
            warnings: issues.filter((i) => i.severity === 'warning').length
        }
    };
}

/** 1 if any error, or any warning without --allow-warnings; else 0. */
export function exitCode(summary, allowWarnings) {
    if (summary.errors > 0) return 1;
    if (summary.warnings > 0 && !allowWarnings) return 1;
    return 0;
}

/** Human-readable report, one line per issue. */
export function formatReport(report) {
    const s = report.summary;
    const lines = [
        `XLIFF import: ${report.xliff}`,
        `  labels:   ${report.labels}`,
        `  language: ${report.targetLanguage} (Salesforce ${report.salesforceLanguage})`,
        `  output:   ${report.output ?? 'nothing written (no unit passed)'}`,
        `  ${s.units} units: ${s.written} written, ${s.skipped} skipped, ${s.rejected} rejected, ${s.heldBack} held back` +
            ` (${s.errors} errors, ${s.warnings} warnings)`
    ];
    if (report.missingFromXliff.length > 0) {
        lines.push(`  ${report.missingFromXliff.length} labels have no trans-unit: ${report.missingFromXliff.join(', ')}`);
    }
    const issueLines = report.units.flatMap((unit) =>
        unit.issues.map((i) => `  ${i.severity.toUpperCase().padEnd(7)} ${unit.id}: ${i.message}`)
    );
    if (issueLines.length > 0) lines.push('', ...issueLines);
    return lines.join('\n') + '\n';
}

function outcomeOf(issues, allowWarnings) {
    if (issues.some((i) => i.severity === 'skip')) return 'skipped';
    if (issues.some((i) => i.severity === 'error')) return 'rejected';
    if (issues.some((i) => i.severity === 'warning') && !allowWarnings) return 'held-back';
    return 'written';
}

function issue(severity, check, message) {
    return { severity, check, message };
}

function uniqueSorted(items) {
    return [...new Set(items ?? [])].sort();
}

function list(items) {
    return items.length > 0 ? items.join(' ') : 'none';
}
