// Parsing and walking LWC templates with parse5.
import { parseFragment } from 'parse5';
import { hasLetters, looksLikeCode, positionAt, skipWhitespace } from './text.js';

/**
 * An LWC template is an HTML fragment wrapped in <template>. parse5 is a spec-compliant HTML
 * parser: it never throws, and with sourceCodeLocationInfo every node knows its offsets.
 */
export function parseTemplate(source) {
    return parseFragment(source, { sourceCodeLocationInfo: true });
}

/**
 * Children of a node. HTML puts the children of <template> in a separate DocumentFragment
 * (`node.content`) and leaves `childNodes` empty, and LWC uses <template> everywhere
 * (the root, lwc:if, for:each), so every walk has to look there too.
 */
export function childrenOf(node) {
    if (node.content) return node.content.childNodes;
    return node.childNodes ?? [];
}

/** Depth-first walk that calls visit(node, parent) on every node, including text and comments. */
export function walkTemplate(node, visit, parent = null) {
    visit(node, parent);
    for (const child of childrenOf(node)) walkTemplate(child, visit, node);
}

export const isText = (node) => node.nodeName === '#text';
export const isElement = (node) => typeof node.tagName === 'string';

// LWC bindings look like {greeting} or {contact.Name}; they can't contain braces themselves.
const EXPRESSION = /\{[^{}]*\}/g;

/** The text that stays the same for every user: the node minus its {expressions}. */
export function stripExpressions(text) {
    return text.replace(EXPRESSION, '');
}

/** Expressions used in a text node, without braces: "Hi {a.b}!" -> ["a.b"]. */
export function expressionsIn(text) {
    return (text.match(EXPRESSION) ?? []).map((expr) => expr.slice(1, -1).trim());
}

/**
 * A text node a translator would need to see: it still has letters once the {bindings} are
 * removed ("{contact.Name}, {contact.Title}" has none), it isn't CSS, script or a code sample,
 * and it isn't shaped like code (a URL, a component tag name...).
 * R2 and R3 both use this, so they agree on what a piece of text is.
 */
export function isTranslatableText(node, parent, config) {
    if (!isText(node)) return false;
    if (parent && config.template.nonTextElements.includes(parent.tagName)) return false;
    const words = stripExpressions(node.value);
    return hasLetters(words) && !looksLikeCode(words, config.codeLikePatterns);
}

/** In LWC an attribute is either a literal or exactly one {binding}; a binding is not hardcoded. */
export function isDynamic(value) {
    return /^\s*\{[^{}]*\}\s*$/.test(value);
}

/** Where a text node's first non-whitespace character is (the contract's line/column). */
export function textPosition(source, node) {
    // parse5 gives every text node from the source a location; this guard is for nodes it
    // invents while repairing broken HTML, so they can't crash a rule.
    if (!node.sourceCodeLocation) return { line: 1, column: 1 };
    const { startOffset, endOffset } = node.sourceCodeLocation;
    return positionAt(source, skipWhitespace(source, startOffset, endOffset));
}

/** Where an attribute's name starts. parse5 keys attribute locations by lowercased name. */
export function attributePosition(element, name) {
    const loc = element.sourceCodeLocation.attrs[name];
    return { line: loc.startLine, column: loc.startCol };
}

/** Does this attribute's value reach the user (on screen or through a screen reader)? */
export function isUiAttribute(tagName, attrName, config) {
    const t = config.template;
    if (t.nonUiAttributePrefixes.some((prefix) => attrName.startsWith(prefix))) return false;
    if (t.uiAttributes.includes(attrName)) return true;
    if (t.uiAttributePrefixes.some((prefix) => attrName.startsWith(prefix))) return true;
    if (t.uiAttributeSuffixes.some((suffix) => attrName.endsWith(suffix))) return true;
    if (tagName.startsWith('c-') && t.customComponentProps.includes(attrName)) return true;
    return (t.elementAttributes[tagName] ?? []).includes(attrName);
}

/**
 * Bindings the template shows to the user: {x} in text nodes and in user-facing attributes.
 * R4 uses this to tell a field that is displayed ({errorMessage}) from one that only feeds
 * a CSS class, an lwc:if or an input's value ({boxClass}, {isLoading}, {searchKey}).
 * Returns a Set of expressions as written: "greeting", "error.message".
 */
export function renderedBindings(templateAst, config) {
    const rendered = new Set();
    walkTemplate(templateAst, (node) => {
        if (isText(node)) {
            for (const expr of expressionsIn(node.value)) rendered.add(expr);
        } else if (isElement(node)) {
            for (const attr of node.attrs) {
                if (isDynamic(attr.value) && isUiAttribute(node.tagName, attr.name, config)) {
                    rendered.add(attr.value.trim().slice(1, -1).trim());
                }
            }
        }
    });
    return rendered;
}
