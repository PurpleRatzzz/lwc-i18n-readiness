// Markdown for the job summary page ($GITHUB_STEP_SUMMARY): a table per rule, then the new findings.
// Reviewers read this page, so it leads with what changed in this PR rather than the old debt.
import { summary } from './text.js';

// The step summary is limited to 1 MiB; a first run without a baseline can have thousands of findings.
const MAX_LISTED = 200;

export function formatMarkdown(findings) {
    const lines = ['## i18n readiness scan', '', summary(findings)];
    if (findings.length === 0) return lines.join('\n') + '\n';

    lines.push('', '| Rule | Name | Severity | Findings | New |', '|---|---|---|---:|---:|');
    for (const [ruleId, group] of groupByRule(findings)) {
        const fresh = group.filter((f) => f.isNew).length;
        lines.push(`| ${ruleId} | ${group[0].ruleName} | ${group[0].severity} | ${group.length} | ${fresh} |`);
    }

    const fresh = findings.filter((f) => f.isNew);
    lines.push('', `### New findings (${fresh.length})`, '');
    if (fresh.length === 0) lines.push('None. Everything above is already in the baseline.');
    for (const f of fresh.slice(0, MAX_LISTED)) {
        lines.push(`- \`${f.file}:${f.line}:${f.column}\` **${f.ruleId}** ${f.severity}: ${escapeMarkdown(f.message)}`);
    }
    if (fresh.length > MAX_LISTED) lines.push(`- …and ${fresh.length - MAX_LISTED} more; see the job log.`);
    return lines.join('\n') + '\n';
}

/** Map(ruleId -> findings), in rule order. */
function groupByRule(findings) {
    const groups = new Map();
    for (const f of [...findings].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
        if (!groups.has(f.ruleId)) groups.set(f.ruleId, []);
        groups.get(f.ruleId).push(f);
    }
    return groups;
}

/**
 * Messages quote source code: <lightning-button> would be swallowed as an HTML tag, and
 * * _ ` [ ] | would turn into formatting. Escape them so the text shows as written.
 */
export function escapeMarkdown(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/([\\`*_[\]|])/g, '\\$1');
}
