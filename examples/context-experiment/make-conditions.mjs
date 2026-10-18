// Build the three labels files of the context experiment from design.json (see PREREGISTRATION.md):
//   C1  as found: a label's `c1` if the design gives one, otherwise shortDescription = value, no categories
//   C2  same labels, with the context rule R6 asks for
//   C3  C2, but each sentence that code glues together from pieces becomes one label with placeholders
// Run from the repo root: node examples/context-experiment/make-conditions.mjs <dreamhouse|starterkit>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { escapeXml } from '../../src/labels/xml.js';

const SET = process.argv[2];
if (!['dreamhouse', 'starterkit'].includes(SET)) throw new Error('Usage: make-conditions.mjs <dreamhouse|starterkit>');
const HERE = `examples/context-experiment/${SET}`;
const design = JSON.parse(readFileSync(`${HERE}/design.json`, 'utf8'));

// A piece can belong to two sentences (starter kit: "items" in the header and in the filtered count).
const pieces = [...new Map(design.fragments.flatMap((f) => f.pieces).map((p) => [p.name, p])).values()];
const others = design.notJudged ?? []; // in the files, but not scored (e.g. a test label)
const asC1 = (l) => ({ name: l.name, value: l.value, ...(l.c1 ?? { shortDescription: l.value, categories: '' }) });
const asC2 = (l) => ({ name: l.name, value: l.value, ...l.c2 });

const conditions = {
    c1: [...design.singles, ...pieces, ...others].map(asC1),
    c2: [...design.singles, ...pieces, ...others].map(asC2),
    c3: [...design.singles.map(asC2), ...design.fragments.flatMap((f) => [f.c3, ...(f.c3Extra ?? [])]), ...others.map(asC2)]
};

mkdirSync(`${HERE}/conditions`, { recursive: true });
for (const [name, labels] of Object.entries(conditions)) {
    writeFileSync(`${HERE}/conditions/${name}.labels-meta.xml`, toLabelsXml(labels));
    console.log(`${SET} ${name}: ${labels.length} labels`);
}

/** Salesforce source format (*.labels-meta.xml). */
function toLabelsXml(labels) {
    const blocks = labels.map((l) =>
        [
            '    <labels>',
            `        <fullName>${escapeXml(l.name)}</fullName>`,
            l.categories ? `        <categories>${escapeXml(l.categories)}</categories>` : null,
            '        <language>en_US</language>',
            '        <protected>false</protected>',
            `        <shortDescription>${escapeXml(l.shortDescription)}</shortDescription>`,
            `        <value>${escapeXml(l.value)}</value>`,
            '    </labels>'
        ]
            .filter(Boolean)
            .join('\n')
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n${blocks.join('\n')}\n</CustomLabels>\n`;
}
