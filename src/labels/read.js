// Read a Salesforce CustomLabels file (`*.labels-meta.xml`) into plain objects.
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { assertWellFormed, elementText, lineAndColumn, maskCommentsAndCdata } from './xml.js';

const parser = new XMLParser({
    ignoreAttributes: true,
    // Keep every value a string: a label whose value is "10" or "true" must not become a number or boolean.
    parseTagValue: false,
    // Keep leading/trailing spaces in values exactly as written; translators need the real string.
    trimValues: false,
    // We decode entities ourselves (see xml.js) so numeric references like &#169; are handled too.
    processEntities: false,
    // A file with a single label must still give an array.
    isArray: (name) => name === 'labels'
});

/** Read and parse a CustomLabels file from disk. */
export function readLabelsFile(path) {
    return parseLabels(readFileSync(path, 'utf8'), path);
}

/**
 * Parse CustomLabels XML. Returns one object per <labels> element:
 * { fullName, value, shortDescription, categories, categoryTokens, language, protected, line, column }
 * `line`/`column` point at the label's <fullName> tag (1-based).
 */
export function parseLabels(source, what = 'CustomLabels file') {
    assertWellFormed(source, what);
    const root = parser.parse(source).CustomLabels;
    if (root === undefined) throw new Error(`${what} has no <CustomLabels> root element`);
    const parsed = root.labels ?? [];
    const positions = fullNamePositions(source);

    // The n-th parsed label is the n-th <labels> block in the text. If the counts differ,
    // our position finder misread the file, and wrong line numbers are worse than an error.
    if (positions.length !== parsed.length) {
        throw new Error(`${what}: found ${parsed.length} labels but ${positions.length} <labels> blocks`);
    }

    return parsed.map((raw, i) => {
        const categories = elementText(raw.categories);
        return {
            fullName: elementText(raw.fullName),
            value: elementText(raw.value),
            shortDescription: elementText(raw.shortDescription),
            categories,
            categoryTokens: parseCategories(categories),
            language: elementText(raw.language),
            protected: elementText(raw.protected) === 'true',
            line: positions[i].line,
            column: positions[i].column
        };
    });
}

/**
 * Split the `categories` field into the tokens of our convention (docs/ARCHITECTURE.md):
 * `component:<name>`, `ui:<type>`, `maxlen:<n>`. Anything else, a repeated key, or a maxlen
 * that is not a positive whole number goes to `other`, so nothing is silently dropped.
 */
export function parseCategories(categories) {
    const tokens = { component: null, ui: null, maxlen: null, other: [] };
    for (const token of String(categories ?? '').split(',').map((t) => t.trim()).filter(Boolean)) {
        const colon = token.indexOf(':');
        const key = colon > 0 ? token.slice(0, colon).trim().toLowerCase() : '';
        const value = colon > 0 ? token.slice(colon + 1).trim() : '';

        if (key === 'maxlen' && /^[1-9]\d*$/.test(value) && tokens.maxlen === null) {
            tokens.maxlen = Number(value);
        } else if ((key === 'component' || key === 'ui') && value && tokens[key] === null) {
            tokens[key] = value;
        } else {
            tokens.other.push(token);
        }
    }
    return tokens;
}

/**
 * fast-xml-parser gives no source positions, so we find them in the raw text:
 * each <labels>…</labels> block, then the <fullName tag inside it. Comments and CDATA are
 * blanked out first so a commented-out label can't shift the count.
 * A label without <fullName> (invalid metadata) gets the line of its <labels> tag.
 */
function fullNamePositions(source) {
    const masked = maskCommentsAndCdata(source);
    const positions = [];
    for (const block of masked.matchAll(/<labels\b[\s\S]*?<\/labels\s*>/g)) {
        const inside = block[0].search(/<fullName\b/);
        const offset = block.index + Math.max(inside, 0);
        positions.push(lineAndColumn(source, offset));
    }
    return positions;
}
