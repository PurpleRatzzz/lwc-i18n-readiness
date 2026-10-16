// Build an XLIFF 1.2 file from parsed Custom Labels (see src/labels/read.js).
//
// Each label becomes one <trans-unit>:
//   id / resname          the label's fullName, the key we match on when importing
//   <source>              the English value; {0} placeholders stay plain text (docs/ARCHITECTURE.md)
//   <note from=developer> the shortDescription, i.e. what the developer says the text is for
//   <note from=context>   the categories (component:, ui:, maxlen: tokens)
//   maxwidth + size-unit  from maxlen:N. XLIFF 1.2's default size-unit is "pixel", so we must
//                         say "char" explicitly or a tool would read maxwidth="20" as 20 pixels.
//
// No <target> is written. In XLIFF 1.2 <target> is optional, and leaving it out is the
// clearest way to say "not translated yet": an empty <target state="new"/> can be read by
// some tools or scripts as "the translation is the empty string". Translators add <target>.
import { escapeXml } from '../labels/xml.js';

export const XLIFF_NAMESPACE = 'urn:oasis:names:tc:xliff:document:1.2';

/**
 * @param labels       output of parseLabels / readLabelsFile
 * @param original     path of the labels file, relative to the working directory
 * @param targetLang   BCP 47 tag, e.g. 'zh-CN'
 */
export function buildXliff(labels, { original, targetLang }) {
    assertUniqueNames(labels);
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<xliff version="1.2" xmlns="${XLIFF_NAMESPACE}">`,
        `    <file original="${escapeXml(original)}" source-language="en-US" target-language="${escapeXml(targetLang)}" datatype="xml">`,
        '        <body>',
        ...labels.flatMap(transUnit),
        '        </body>',
        '    </file>',
        '</xliff>',
        ''
    ].join('\n');
}

function transUnit(label) {
    const id = escapeXml(label.fullName);
    const maxlen = label.categoryTokens.maxlen;
    const maxwidth = maxlen ? ` maxwidth="${maxlen}" size-unit="char"` : '';
    const lines = [
        `            <trans-unit id="${id}" resname="${id}"${maxwidth}>`,
        // xml:space="preserve": leading/trailing spaces in a label are meaningful, keep them.
        `                <source xml:space="preserve">${escapeXml(label.value)}</source>`
    ];
    if (label.shortDescription) {
        lines.push(`                <note from="developer">${escapeXml(label.shortDescription)}</note>`);
    }
    if (label.categories) {
        lines.push(`                <note from="context">${escapeXml(label.categories)}</note>`);
    }
    lines.push('            </trans-unit>');
    return lines;
}

/** trans-unit ids must be unique within a <file>; Salesforce would reject duplicate names anyway. */
function assertUniqueNames(labels) {
    const seen = new Set();
    for (const { fullName } of labels) {
        if (seen.has(fullName)) throw new Error(`Duplicate label fullName: ${fullName}`);
        seen.add(fullName);
    }
}
