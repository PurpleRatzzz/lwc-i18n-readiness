// R6 label-context: a Custom Label that gives the translator (human or AI) too little context.
// A label value like "Apply" or "of" is ambiguous on its own; the shortDescription and the
// ui: category are the only places the translator can learn where and how it is used.
import { makeFinding } from '../finding.js';
import { parseLabels } from '../labels/read.js';

const PLACEHOLDER = /\{\d+\}/g;

const rule = {
    id: 'R6',
    name: 'label-context',
    kinds: ['labels'],
    severity: 'warning',
    description: 'Custom Label lacks translator context: description repeats the value, no ui: category, unexplained {0} placeholders, or the value is a sentence fragment.',
    check(ctx) {
        // Rules must be pure (docs/ARCHITECTURE.md): parse ctx.source, never read the file ourselves.
        const findings = [];
        for (const label of parseLabels(ctx.source, ctx.file)) {
            for (const { subrule, message } of labelProblems(label)) {
                findings.push(
                    makeFinding({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        severity: rule.severity,
                        file: ctx.file,
                        line: label.line,
                        column: label.column,
                        text: label.fullName,
                        message,
                        context: { subrule }
                    })
                );
            }
        }
        return findings;
    }
};

export default rule;

/** The context problems of one label, at most one per subrule. Exported for tests. */
export function labelProblems(label) {
    const problems = [];

    if (label.shortDescription && squash(label.shortDescription) === squash(label.value)) {
        problems.push({
            subrule: 'description-repeats-value',
            message: 'The description only repeats the label value; say where the text appears and what it does, e.g. "Button in the filter panel that applies the selected filters".'
        });
    }

    if (!label.categoryTokens.ui) {
        problems.push({
            subrule: 'no-ui-category',
            message: 'No ui: category; add one such as ui:button or ui:heading to Categories so the translator knows what kind of UI element this is.'
        });
    }

    const unexplained = unexplainedPlaceholders(label.value, label.shortDescription);
    if (unexplained.length > 0) {
        problems.push({
            subrule: 'unexplained-placeholder',
            message: `The value has ${unexplained.join(', ')} but the description does not say what ${unexplained.length > 1 ? 'they stand' : 'it stands'} for; add e.g. "{0} is the number of records".`
        });
    }

    // Externalizing text doesn't help if the label is only a piece of a sentence. Real example
    // (offline-app-developer-starter-kit): "items", "of", "sorted by", whose description reads
    // "X items of Y". A UI string that starts in lower case is almost always such a piece.
    if (/^\p{Ll}/u.test(label.value.trim())) {
        problems.push({
            subrule: 'fragment-value',
            message: 'The value starts in lower case, so code probably glues it to other text (e.g. "X items of Y"); make the whole sentence one label with {0}/{1} placeholders so translators can reorder it.'
        });
    }

    return problems;
}

/**
 * Placeholders in the value that the description doesn't mention.
 * A description that names each placeholder ("{0} is the record count") explains it; one that
 * uses the word "placeholder" or "variable" is taken as explaining all of them.
 */
function unexplainedPlaceholders(value, description) {
    const placeholders = [...new Set(value.match(PLACEHOLDER) ?? [])];
    if (/placeholder|variable/i.test(description)) return [];
    return placeholders.filter((p) => !description.includes(p));
}

/** Lower case, no whitespace: "Start  Date" and "start date" compare equal. */
function squash(text) {
    return text.toLowerCase().replace(/\s+/g, '');
}
