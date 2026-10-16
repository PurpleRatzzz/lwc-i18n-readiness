import { createHash } from 'node:crypto';

export const SEVERITIES = ['error', 'warning'];

/**
 * A Finding is the single data shape that every rule returns and every reporter reads.
 *
 * - file: path relative to the scan root, with forward slashes
 * - line/column: 1-based, pointing at the first non-whitespace character of `text`
 * - text: the offending string as written in source, whitespace collapsed
 * - context: rule-specific details (element, attribute, sink, subrule...), never needed to locate the finding
 */
export function makeFinding({ ruleId, ruleName, severity, file, line, column = 1, text, message, context = {} }) {
    if (!/^R\d+$/.test(ruleId)) throw new Error(`Invalid ruleId: ${ruleId}`);
    if (!SEVERITIES.includes(severity)) throw new Error(`Invalid severity: ${severity}`);
    if (!file || !Number.isInteger(line) || line < 1) throw new Error(`Invalid location: ${file}:${line}`);
    return { ruleId, ruleName, severity, file, line, column, text: normalizeText(text), message, context };
}

export function normalizeText(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Identity of a finding for baselines. Line numbers are left out on purpose:
 * an unrelated edit higher up in the file must not turn every old finding into a "new" one.
 */
export function fingerprint(finding) {
    return createHash('sha1')
        .update([finding.ruleId, finding.file, finding.text].join('\u0000'))
        .digest('hex')
        .slice(0, 16);
}
