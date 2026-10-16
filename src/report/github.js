// GitHub Actions workflow commands, which GitHub turns into annotations on the PR diff:
//   ::error file=lwc/a/a.html,line=5,col=13,title=R1 hardcoded-attribute::Move label "Reset" ...
// New findings use their severity (::error / ::warning). Findings already in the baseline are
// sent as ::notice: they don't fail the build, so showing them as red errors next to a green
// check would be confusing, and GitHub caps annotations per type, so they must not crowd out new ones.

export function formatGithub(findings) {
    return findings.map((f) => `${toCommand(f)}\n`).join('');
}

function toCommand(f) {
    let command = f.severity === 'error' ? 'error' : 'warning';
    if (!f.isNew) command = 'notice';
    const title = `${f.ruleId} ${f.ruleName}${f.isNew ? '' : ' (baseline)'}`;
    const properties = [
        `file=${escapeProperty(f.file)}`,
        `line=${f.line}`,
        `col=${f.column}`,
        `title=${escapeProperty(title)}`
    ].join(',');
    return `::${command} ${properties}::${escapeData(f.message)}`;
}

/**
 * The message part of a workflow command ends at a newline, so newlines (and the % that starts
 * an escape) must be URL-style encoded. Same rules as GitHub's own @actions/core toolkit.
 */
export function escapeData(text) {
    return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Property values are also cut at "," (next property) and ":" (start of the message). */
export function escapeProperty(text) {
    return escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
