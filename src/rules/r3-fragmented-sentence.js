// R3 fragmented-sentence: a sentence the translator can't see or reorder as a whole.
// Three shapes (context.subrule):
//   interpolated     "Beds: {beds} - Baths: {baths}"   words locked around {bindings}
//   split-by-markup  "days on <br />the market"         one sentence cut into sibling text nodes
//   plural           "{count} items", "30 days"         English plural glued to a number
import { makeFinding } from '../finding.js';
import { walkTemplate, childrenOf, isText, isElement, isTranslatableText, expressionsIn, textPosition } from '../scan/template.js';
import { shorten } from '../scan/text.js';

const rule = {
    id: 'R3',
    name: 'fragmented-sentence',
    kinds: ['template'],
    severity: 'error',
    description: 'One sentence is split by {expressions} or inline elements, so translators cannot reorder it; includes number+noun plurals.',
    check(ctx) {
        const findings = [];
        // Same `text` unit as R2 (the whole text node), so R2 and R3 can both fire on one node:
        // "the text is hardcoded" and "the sentence is fragmented" are two different fixes.
        const report = (node, parent, subrule, message, extra = {}) =>
            findings.push(
                makeFinding({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    file: ctx.file,
                    ...textPosition(ctx.source, node),
                    text: node.value,
                    message,
                    context: { element: parent?.tagName ?? null, subrule, ...extra }
                })
            );

        walkTemplate(ctx.ast, (node, parent) => {
            if (isTranslatableText(node, parent, ctx.config)) {
                const quoted = `"${shorten(node.value)}"`;
                // isTranslatableText already knows there are words besides the bindings.
                if (expressionsIn(node.value).length > 0 && !isLabelValuePair(node.value)) {
                    report(node, parent, 'interpolated',
                        `Text ${quoted} builds a sentence around {bindings}, so translators can't reorder it; ` +
                            'use one Custom Label with {0} placeholders and fill it in JS.');
                }
                const plurals = pluralPhrases(node.value, ctx.config);
                if (plurals.length > 0) {
                    report(node, parent, 'plural',
                        `"${plurals[0]}" hardcodes an English plural after a number; choose the label by count with Intl.PluralRules instead.`,
                        { phrases: plurals });
                }
            }
            // Split sentences are a property of a parent's children, so look at them from the parent.
            // An inline element inside another element is part of its parent's sentence, which was
            // already checked from the parent; checking it again would report the same sentence twice.
            const insideSentence =
                isElement(node) && isInline(node, ctx.config) && !isConditional(node) && parent && isElement(parent);
            if ((isElement(node) || node.nodeName === '#document-fragment') && !insideSentence) {
                for (const run of sentencesSplitByMarkup(node, ctx.config)) {
                    const start = shorten(run[0].value, 40);
                    report(run[0], node, 'split-by-markup',
                        `The sentence starting "${start}" is split by inline markup into ${run.length} text nodes; ` +
                            'keep it in one Custom Label (lightning-formatted-rich-text can render the markup).',
                        { pieces: run.length });
                }
            }
        });
        return findings;
    }
};

/**
 * Groups of 2+ text nodes (with letters) that belong to one sentence but sit in different nodes:
 * in "days on <br />the market" the translator would get "days on" and "the market" as two
 * unrelated strings. The text is collected in reading order, looking inside inline elements
 * (<b>, <strong>, <a>...), so "Distance to property: <b>{n} miles</b>" counts too. A value element
 * such as <lightning-formatted-number> sits inside the sentence like a {binding}. Anything else
 * (a <div>, another <lightning-*>, a <template>, a comment) ends the sentence, and so does an
 * element rendered conditionally: <a lwc:if>Log In</a><a lwc:else>Log Out</a> are alternatives,
 * never one sentence. Text without letters ("{price}", " - ") neither starts nor ends one.
 */
function sentencesSplitByMarkup(parent, config) {
    const runs = [];
    let current = [];
    const collect = (node) => {
        for (const child of childrenOf(node)) {
            if (isText(child)) {
                if (isTranslatableText(child, node, config)) current.push(child);
            } else if (isElement(child) && isInline(child, config) && !isConditional(child)) {
                collect(child);
            } else if (!(isElement(child) && isValueElement(child, config))) {
                runs.push(current);
                current = [];
            }
        }
    };
    collect(parent);
    runs.push(current);
    return runs.filter((run) => run.length >= 2);
}

const isInline = (element, config) => config.template.inlineElements.includes(element.tagName);
// lwc:if / lwc:elseif / lwc:else, and the older if:true / if:false.
const isConditional = (element) => element.attrs.some((attr) => /^(lwc:(if|elseif|else)|if:(true|false))$/.test(attr.name));
const isValueElement = (element, config) =>
    config.template.valueElementPrefixes.some((prefix) => element.tagName.startsWith(prefix));

/**
 * "Name: {contact.Name}" is a label followed by its value, not a sentence: the label can become
 * a Custom Label on its own ("Nom :", "名前：") and the value stays after it in every language.
 * Only a single pair counts; "Beds: {beds} - Baths: {baths}" is still reported.
 */
function isLabelValuePair(text) {
    return /^[^{}:]+:\s*\{[^{}]*\}$/.test(text.trim());
}

// A {binding} or a number, then a word, optionally followed by "(s)": "{count} items", "30 days", "{n} file(s)".
const NUMBER_THEN_WORD = /(\{[^{}]*\}|\b\d+)\s+(\p{L}+)(\(s\))?/gu;

/** The "number + plural noun" phrases in a text: "{count} items, 30 days" -> ["{count} items", "30 days"]. */
function pluralPhrases(text, config) {
    const phrases = [];
    for (const match of text.matchAll(NUMBER_THEN_WORD)) {
        const [phrase, , word, parenS] = match;
        if (parenS || looksPlural(word, config)) phrases.push(phrase.replace(/\s+/g, ' '));
    }
    return phrases;
}

/**
 * English plural nouns mostly end in "s". Rule out the endings and short words that usually
 * aren't plurals ("class", "status", "this", "has") so "{name} has" isn't flagged.
 */
function looksPlural(word, config) {
    const w = word.toLowerCase();
    if (config.plural.irregular.includes(w)) return true;
    if (config.plural.notPlural.includes(w)) return false;
    return w.length >= 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w);
}

export default rule;
