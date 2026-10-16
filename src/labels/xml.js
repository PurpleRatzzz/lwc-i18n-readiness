// Small XML text helpers shared by the Custom Labels, translation and XLIFF code.
// We parse with fast-xml-parser but keep entity handling here, in one place, because the
// parser's default only decodes the five named entities and leaves `&#169;` as-is.
import { XMLValidator } from 'fast-xml-parser';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Escape text for use inside an XML element or a double-quoted attribute.
 * `&` must be replaced first, otherwise the `&` of `&lt;` would be escaped again.
 * Quotes only matter in attributes, but escaping them everywhere is harmless and keeps one rule.
 */
export function escapeXml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

/**
 * Decode the XML entities: the five named ones plus numeric references (`&#169;`, `&#x4E2D;`).
 * One regex pass, so `&amp;lt;` correctly becomes the text `&lt;` and not `<`.
 */
export function decodeEntities(text) {
    return String(text).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_match, name) => {
        if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
        if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
        return NAMED_ENTITIES[name];
    });
}

/**
 * Turn the raw inner XML of an element into plain text: decode entities, and take
 * `<![CDATA[...]]>` content literally (entities inside CDATA are not entities).
 * Any real child element, e.g. an XLIFF `<g id="1">`, stays in the result as `<g id="1">`,
 * which lets the XLIFF tag check notice it.
 */
export function xmlToText(innerXml) {
    return String(innerXml)
        .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
        .map((part) => (part.startsWith('<![CDATA[') ? part.slice(9, -3) : decodeEntities(part)))
        .join('');
}

/**
 * Text of an element as fast-xml-parser returned it (we parse with processEntities off), decoded.
 * '' when the element is missing or empty. With trimValues off, an element that also has
 * whitespace or attributes comes back as an object, so we take its '#text' part.
 */
export function elementText(node) {
    if (node === undefined || node === null) return '';
    const raw = typeof node === 'object' ? (node['#text'] ?? '') : node;
    return decodeEntities(raw);
}

/**
 * Replace comments and CDATA sections with spaces of the same length, keeping line breaks.
 * Used before searching the raw text with regexes: a commented-out `<labels>` block must not
 * count, and offsets and line numbers must stay the same as in the original text.
 */
export function maskCommentsAndCdata(source) {
    return source.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, (chunk) => chunk.replace(/[^\n]/g, ' '));
}

/** 1-based line and column of a character offset in `source`. */
export function lineAndColumn(source, offset) {
    const before = source.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    return { line, column };
}

/** Throw a readable error if `source` is not well-formed XML. `what` names the file for the message. */
export function assertWellFormed(source, what) {
    const result = XMLValidator.validate(source);
    if (result !== true) {
        const { msg, line } = result.err;
        throw new Error(`${what} is not well-formed XML (line ${line}): ${msg}`);
    }
}
