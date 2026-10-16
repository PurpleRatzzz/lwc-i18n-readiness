// Plain text for a terminal: one line per finding, then a one-line summary.
// Every formatter takes the same input: findings sorted by the scanner, each with the Finding
// fields plus `fingerprint` and `isNew` (false = already in the baseline).

export function formatText(findings) {
    const lines = findings.map(
        (f) =>
            `${f.file}:${f.line}:${f.column}  ${f.severity}  ${f.ruleId} ${f.ruleName}  ${f.message}` +
            // Without a baseline every finding is new, so only the old ones get a marker.
            (f.isNew ? '' : '  (in baseline)')
    );
    if (lines.length > 0) lines.push('');
    lines.push(summary(findings));
    return lines.join('\n') + '\n';
}

/** "12 findings (10 errors, 2 warnings), 3 new errors." */
export function summary(findings) {
    if (findings.length === 0) return 'No i18n findings.';
    const errors = findings.filter((f) => f.severity === 'error').length;
    const warnings = findings.length - errors;
    const newErrors = findings.filter((f) => f.isNew && f.severity === 'error').length;
    const counts = `${count(errors, 'error')}, ${count(warnings, 'warning')}`;
    return `${count(findings.length, 'finding')} (${counts}), ${newErrors} new ${newErrors === 1 ? 'error' : 'errors'}.`;
}

/** count(1, 'error') -> "1 error", count(3, 'error') -> "3 errors". */
function count(n, word) {
    return `${n} ${n === 1 ? word : `${word}s`}`;
}
