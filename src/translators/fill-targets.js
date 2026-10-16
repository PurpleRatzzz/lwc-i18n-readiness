// Shared by the stub and pseudo translators: put a <target> after every <source> in an XLIFF text.
//
// We edit the text instead of parsing and re-serialising it, so everything else in the file
// (notes, attributes, comments, formatting) comes out exactly as it went in, as it would
// from a real translation tool.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { escapeXml, xmlToText } from '../labels/xml.js';

// One <source>…</source> (group 2, inner XML in group 3), its indentation (group 1), and an
// existing <target> right after it, if any, which gets replaced.
const SOURCE_AND_TARGET = /([ \t]*)(<source\b[^>]*>([\s\S]*?)<\/source>)(?:\s*<target\b[^>]*?(?:\/>|>[\s\S]*?<\/target>))?/g;

/**
 * Return the XLIFF text with a `<target state="…">` after each <source>.
 * `translateText(sourceText)` gets and returns plain text; escaping is done here.
 */
export function fillTargets(xliff, translateText, state) {
    return xliff.replace(SOURCE_AND_TARGET, (_match, indent, sourceElement, sourceXml) => {
        const target = escapeXml(translateText(xmlToText(sourceXml)));
        return `${indent}${sourceElement}\n${indent}<target state="${state}">${target}</target>`;
    });
}

/** Read `inFile`, fill targets, write `outFile`. */
export function fillTargetsInFile(inFile, outFile, translateText, state) {
    const filled = fillTargets(readFileSync(inFile, 'utf8'), translateText, state);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, filled);
}
