// The scan orchestrator: discover files, parse each once, run the rules that want it,
// drop ignored findings, and return everything sorted.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import defaultConfig from '../config/default.js';
import { rules as allRules } from '../rules/index.js';
import { discoverFiles } from './discover.js';
import { parseTemplate } from './template.js';
import { parseScript } from './script.js';

/**
 * Scans a project directory.
 * Returns { findings, errors, files }: findings sorted by file, line, column;
 * errors = files that could not be read or parsed, or a rule that crashed on a file. They are
 * reported, not fatal, so one broken file doesn't hide the findings in all the others.
 */
export function scan(root, { rules = allRules, config = defaultConfig } = {}) {
    const files = discoverFiles(root, config);
    const errors = [];
    const parsed = [];

    for (const f of files) {
        try {
            const source = readFileSync(f.absPath, 'utf8');
            parsed.push({ ...f, source, ast: parse(f.kind, source) });
        } catch (err) {
            errors.push({ file: f.file, message: `could not parse: ${err.message}` });
        }
    }

    // A script's rules need its component's templates, e.g. to know which fields are displayed.
    // Group the parsed templates by component folder: lwc/errorPanel/ -> [templates/inlineMessage.html, ...].
    const templatesByComponent = new Map();
    for (const f of parsed.filter((p) => p.kind === 'template')) {
        if (!templatesByComponent.has(f.componentDir)) templatesByComponent.set(f.componentDir, []);
        templatesByComponent.get(f.componentDir).push(f);
    }

    const findings = [];
    for (const f of parsed) {
        const ctx = { kind: f.kind, file: f.file, source: f.source, ast: f.ast, component: f.component, config };
        if (f.kind === 'script') {
            const templates = templatesByComponent.get(f.componentDir) ?? [];
            const ownPath = join(f.componentDir, `${f.component}.html`);
            // The contract field: the component's own lwc/<c>/<c>.html.
            ctx.templateAst = templates.find((t) => t.absPath === ownPath)?.ast ?? null;
            // An extra field (the contract allows it): every template of the component, for
            // components that pick one in render(), such as errorPanel's templates/ folder.
            ctx.componentTemplates = templates.map((t) => t.ast);
        }

        const ignored = ignoredLines(f.source, f.kind);
        for (const rule of rules) {
            if (!rule.kinds.includes(f.kind)) continue;
            try {
                for (const finding of rule.check(ctx)) {
                    if (!ignored.has(finding.line)) findings.push(finding);
                }
            } catch (err) {
                errors.push({ file: f.file, message: `${rule.id} failed: ${err.message}` });
            }
        }
    }
    return { findings: sortFindings(findings), errors, files };
}

function parse(kind, source) {
    if (kind === 'template') return parseTemplate(source);
    if (kind === 'script') return parseScript(source);
    return null; // labels: the rule parses them itself (src/labels/read.js)
}

// One marker per comment syntax; a marker on line N hides findings that start on line N+1.
const IGNORE_MARKERS = {
    template: /<!--\s*i18n-ignore-next-line\s*-->/,
    labels: /<!--\s*i18n-ignore-next-line\s*-->/,
    script: /\/\/\s*i18n-ignore-next-line\b/
};

/** Line numbers (1-based) whose findings an ignore comment suppresses. */
export function ignoredLines(source, kind) {
    const marker = IGNORE_MARKERS[kind];
    const ignored = new Set();
    source.split('\n').forEach((text, index) => {
        // `index` is 0-based, so the marker is on line index + 1 and the ignored line is index + 2.
        if (marker.test(text)) ignored.add(index + 2);
    });
    return ignored;
}

/**
 * Sort by file, then line, then column (then rule, so ties are stable). Files are compared
 * by code unit, not localeCompare, so the order doesn't depend on the machine's locale.
 */
export function sortFindings(findings) {
    return [...findings].sort(
        (a, b) =>
            compare(a.file, b.file) || a.line - b.line || a.column - b.column || compare(a.ruleId, b.ruleId)
    );
}

function compare(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
}
