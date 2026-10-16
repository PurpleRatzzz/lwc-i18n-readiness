// R2 hardcoded-text: words typed straight into the template, e.g. <p>No contacts found.</p>.
import { makeFinding } from '../finding.js';
import { walkTemplate, isTranslatableText, textPosition } from '../scan/template.js';
import { shorten } from '../scan/text.js';

const rule = {
    id: 'R2',
    name: 'hardcoded-text',
    kinds: ['template'],
    severity: 'error',
    description: 'Template text node contains literal user-facing text.',
    check(ctx) {
        const findings = [];
        walkTemplate(ctx.ast, (node, parent) => {
            if (!isTranslatableText(node, parent, ctx.config)) return;
            const element = parent?.tagName ?? null;
            findings.push(
                makeFinding({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    file: ctx.file,
                    ...textPosition(ctx.source, node),
                    text: node.value,
                    message:
                        `Move the text "${shorten(node.value)}"${element ? ` in <${element}>` : ''} ` +
                        'into a Custom Label and import it via @salesforce/label.',
                    context: { element }
                })
            );
        });
        return findings;
    }
};

export default rule;
