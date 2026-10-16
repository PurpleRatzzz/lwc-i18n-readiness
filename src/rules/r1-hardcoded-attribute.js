// R1 hardcoded-attribute: label="Reset" instead of label={labels.reset}.
import { makeFinding } from '../finding.js';
import { walkTemplate, isElement, isDynamic, isUiAttribute, attributePosition } from '../scan/template.js';
import { hasLetters, looksLikeCode, shorten } from '../scan/text.js';

const rule = {
    id: 'R1',
    name: 'hardcoded-attribute',
    kinds: ['template'],
    severity: 'error',
    description: 'User-facing attribute (label, title, placeholder, alternative-text...) has a literal value instead of a Custom Label.',
    check(ctx) {
        const findings = [];
        walkTemplate(ctx.ast, (node) => {
            if (!isElement(node)) return;
            for (const attr of node.attrs) {
                // Only attributes the user sees or hears; icon-name, variant, class... are code.
                if (!isUiAttribute(node.tagName, attr.name, ctx.config)) continue;
                // {labels.reset} is already dynamic; "100" or "-" has nothing to translate.
                if (isDynamic(attr.value) || !hasLetters(attr.value)) continue;
                if (looksLikeCode(attr.value, ctx.config.codeLikePatterns)) continue;
                findings.push(
                    makeFinding({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        severity: rule.severity,
                        file: ctx.file,
                        ...attributePosition(node, attr.name),
                        text: attr.value,
                        message:
                            `Move ${attr.name} "${shorten(attr.value)}" on <${node.tagName}> ` +
                            'into a Custom Label and import it via @salesforce/label.',
                        context: { element: node.tagName, attribute: attr.name }
                    })
                );
            }
        });
        return findings;
    }
};

export default rule;
