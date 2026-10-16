// Read and write `translations/<sfLang>.translation-meta.xml` (Salesforce source format).
//
// Only the <customLabels> entries are ours. A real translation file can also hold translated
// tab names, quick actions and so on, maintained by someone else, so when the file exists we
// edit it as text: cut out the old <customLabels> blocks, put the merged ones back, and leave
// every other byte alone. Re-serialising the whole file would reformat other people's entries
// and make every import a noisy diff.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertWellFormed, elementText, escapeXml, maskCommentsAndCdata } from './xml.js';

const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
    processEntities: false,
    isArray: (name) => name === 'customLabels'
});

export function translationFileName(sfLang) {
    return `${sfLang}.translation-meta.xml`;
}

/** The custom label translations in a translation-meta.xml text: [{ name, label }]. */
export function parseTranslations(xml, what = 'translation file') {
    assertWellFormed(xml, what);
    const root = parser.parse(xml).Translations;
    if (root === undefined) throw new Error(`${what} has no <Translations> root element`);
    return (root.customLabels ?? []).map((entry) => ({ name: elementText(entry.name), label: elementText(entry.label) }));
}

/**
 * Return the new file text. `entries` ([{ name, label }]) win over existing entries with the
 * same name; existing entries for other labels are kept. Entries are sorted by name so the
 * output doesn't depend on input order and diffs stay small.
 */
export function mergeTranslations(existingXml, entries) {
    const merged = new Map();
    if (existingXml) {
        for (const { name, label } of parseTranslations(existingXml)) merged.set(name, label);
    }
    for (const { name, label } of entries) merged.set(name, label);
    const block = renderCustomLabels(merged);

    if (!existingXml) return newFile(block);

    const masked = maskCommentsAndCdata(existingXml);
    const children = topLevelChildren(masked);
    const oldBlocks = children
        .filter((child) => child.name === 'customLabels')
        .map((child) => ({ start: startOfLine(existingXml, child.start), end: endOfLine(existingXml, child.end) }));

    if (oldBlocks.length > 0) {
        // Put the merged block where the first old one was, and drop the other old ones.
        let result = existingXml.slice(0, oldBlocks[0].start) + block;
        for (let i = 0; i < oldBlocks.length; i++) {
            const nextStart = i + 1 < oldBlocks.length ? oldBlocks[i + 1].start : existingXml.length;
            result += existingXml.slice(oldBlocks[i].end, nextStart);
        }
        return result;
    }

    // No <customLabels> yet. The Metadata API expects the child elements of <Translations> in
    // a fixed order, which is alphabetical (customApplications, customDataTypeTranslations,
    // customLabels, customPageWebLinks, customTabs, flowDefinitions, quickActions, ...), so we
    // insert before the first element whose name sorts after "customLabels".
    const next = children.find((child) => child.name > 'customLabels');
    const closingRoot = masked.lastIndexOf('</Translations');
    if (!next && closingRoot === -1) return newFile(block); // <Translations/>: nothing to keep
    const at = startOfLine(existingXml, next ? next.start : closingRoot);
    return existingXml.slice(0, at) + block + existingXml.slice(at);
}

/**
 * Merge `entries` into `<dir>/<sfLang>.translation-meta.xml`, creating the directory and file
 * if needed. Returns the file path.
 */
export function writeTranslationFile(dir, sfLang, entries) {
    const path = join(dir, translationFileName(sfLang));
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, mergeTranslations(existing, entries));
    return path;
}

function newFile(block) {
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Translations xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
        block +
        '</Translations>\n'
    );
}

/** One <customLabels> element per entry, children in Salesforce's order: label, then name. */
function renderCustomLabels(merged) {
    return [...merged.keys()]
        .sort()
        .map(
            (name) =>
                '    <customLabels>\n' +
                `        <label>${escapeXml(merged.get(name))}</label>\n` +
                `        <name>${escapeXml(name)}</name>\n` +
                '    </customLabels>\n'
        )
        .join('');
}

/**
 * Direct children of the root element, with their start/end offsets in the text.
 * A small tag walker: every opening tag goes one level deeper, every closing tag one level up.
 * `masked` must have comments and CDATA blanked out (see maskCommentsAndCdata).
 */
function topLevelChildren(masked) {
    const children = [];
    let depth = 0;
    for (const match of masked.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
        const [tag, closing, name, selfClosing] = match;
        if (closing) {
            depth -= 1;
            if (depth === 1) children.at(-1).end = match.index + tag.length;
        } else {
            if (depth === 1) children.push({ name, start: match.index, end: match.index + tag.length });
            if (!selfClosing) depth += 1;
        }
    }
    return children;
}

/**
 * When only whitespace is before `offset` on its line, the start of that line; else `offset`.
 * Removing an element from its line start doesn't leave an empty indented line behind, and
 * inserting there keeps the indentation. In a file written on one line, nothing moves.
 */
function startOfLine(text, offset) {
    const from = text.lastIndexOf('\n', offset - 1) + 1;
    return text.slice(from, offset).trim() === '' ? from : offset;
}

/** When only whitespace is after `offset` on its line, just past the line break; else `offset`. */
function endOfLine(text, offset) {
    const newline = text.indexOf('\n', offset);
    const to = newline === -1 ? text.length : newline + 1;
    return text.slice(offset, to).trim() === '' ? to : offset;
}
