// Builds rule contexts from fixture files the same way the orchestrator does, so rule tests
// can call rule.check(ctx) directly without scanning a whole folder.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from '../../src/config/default.js';
import { parseTemplate } from '../../src/scan/template.js';
import { parseScript } from '../../src/scan/script.js';

/** Absolute path of test/fixtures/lwc/, the root used by the orchestrator and command tests. */
export const FIXTURES = fileURLToPath(new URL('../fixtures/lwc/', import.meta.url));

const read = (file) => readFileSync(FIXTURES + file, 'utf8');
const componentOf = (file) => file.split('/')[0];

/** ctx for a template, e.g. templateContext('hardcodedText/hardcodedText.html'). */
export function templateContext(file) {
    const source = read(file);
    return { kind: 'template', file, source, ast: parseTemplate(source), component: componentOf(file), config };
}

/** ctx for a script; `templates` are the component's .html files, the first being its own <c>.html. */
export function scriptContext(file, templates = []) {
    const source = read(file);
    const asts = templates.map((t) => parseTemplate(read(t)));
    return {
        kind: 'script',
        file,
        source,
        ast: parseScript(source),
        component: componentOf(file),
        config,
        templateAst: asts[0] ?? null,
        componentTemplates: asts
    };
}

/** ctx for a script given as a string, with an optional template string: for small, focused cases. */
export function inlineScript(source, template = null) {
    const ast = template === null ? null : parseTemplate(template);
    return {
        kind: 'script',
        file: 'inline/inline.js',
        source,
        ast: parseScript(source),
        component: 'inline',
        config,
        templateAst: ast,
        componentTemplates: ast ? [ast] : []
    };
}

/** ctx for a template given as a string. */
export function inlineTemplate(source) {
    return { kind: 'template', file: 'inline/inline.html', source, ast: parseTemplate(source), component: 'inline', config };
}

/** Compact view of findings for assertions: "line:column text". */
export function located(findings) {
    return findings.map((f) => `${f.line}:${f.column} ${f.text}`);
}
