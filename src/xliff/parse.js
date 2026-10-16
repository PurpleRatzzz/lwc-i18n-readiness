// Read an XLIFF 1.2 file into plain objects, for import and for checking translator output.
import { XMLParser } from 'fast-xml-parser';
import { assertWellFormed, decodeEntities, xmlToText } from '../labels/xml.js';
import { XLIFF_NAMESPACE } from './export.js';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: false,
    // Keep the inside of <source> and <target> as raw XML. If a tool put inline elements such as
    // <g id="1"> in a target, we want to see them (the tag check rejects them), not lose them.
    stopNodes: ['*.source', '*.target'],
    isArray: (name) => name === 'file' || name === 'trans-unit'
});

/**
 * Returns { original, sourceLanguage, targetLanguage, units }, where each unit is
 * { id, maxwidth, sizeUnit, source, target, state }. `target` is null when there is no
 * <target> element; `state` is null when the target has no state attribute.
 * Throws if the text is not XLIFF 1.2 or has a shape we don't handle (several <file>s, <group>s).
 */
export function parseXliff(xml, what = 'XLIFF file') {
    assertWellFormed(xml, what);
    const root = parser.parse(xml).xliff;
    if (root === undefined) throw new Error(`${what} has no <xliff> root element`);
    if (attr(root, 'version') !== '1.2' || attr(root, 'xmlns') !== XLIFF_NAMESPACE) {
        throw new Error(`${what} is not XLIFF 1.2 (version="1.2", xmlns="${XLIFF_NAMESPACE}")`);
    }

    // One labels file -> one <file> element (docs/ARCHITECTURE.md). Anything else is not ours.
    const files = root.file ?? [];
    if (files.length !== 1) throw new Error(`${what} must have exactly one <file> element, found ${files.length}`);
    const file = files[0];
    const body = typeof file.body === 'object' ? file.body : {};
    if (body.group !== undefined) throw new Error(`${what} uses <group> elements, which are not supported`);

    return {
        original: attr(file, 'original'),
        sourceLanguage: attr(file, 'source-language'),
        targetLanguage: attr(file, 'target-language'),
        units: (body['trans-unit'] ?? []).map(readUnit)
    };
}

function readUnit(node) {
    const hasTarget = node.target !== undefined;
    const maxwidth = attr(node, 'maxwidth');
    return {
        id: attr(node, 'id'),
        maxwidth: maxwidth ? Number(maxwidth) : null,
        // XLIFF 1.2: when size-unit is absent, maxwidth is in pixels.
        sizeUnit: attr(node, 'size-unit') ?? 'pixel',
        source: xmlToText(innerXml(node.source)),
        target: hasTarget ? xmlToText(innerXml(node.target)) : null,
        state: hasTarget ? (attr(node.target, 'state') ?? null) : null
    };
}

/** Raw inner XML of a stop node: a string, or { '#text': ... } when the element has attributes. */
function innerXml(node) {
    if (node === undefined || node === null) return '';
    return typeof node === 'object' ? (node['#text'] ?? '') : node;
}

/** A decoded attribute value, or undefined when the attribute is absent. */
function attr(node, name) {
    const value = typeof node === 'object' && node !== null ? node[`@_${name}`] : undefined;
    return value === undefined ? undefined : decodeEntities(value);
}
