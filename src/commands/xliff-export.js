// `lwc-i18n xliff-export <labelsFile> --target-lang <bcp47> --out <file.xlf>`
// Writes the labels as an XLIFF 1.2 file to hand to a translator (person, vendor or AI pipeline).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { readLabelsFile } from '../labels/read.js';
import { buildXliff } from '../xliff/export.js';
import { toBcp47, toSalesforceLang } from '../xliff/languages.js';

const USAGE = 'Usage: lwc-i18n xliff-export <labelsFile> --target-lang <bcp47> --out <file.xlf>';

export async function run(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            allowPositionals: true,
            options: { 'target-lang': { type: 'string' }, out: { type: 'string' } }
        });
    } catch (err) {
        return usageError(err.message);
    }
    const [labelsFile, ...extra] = args.positionals;
    const { 'target-lang': targetLang, out } = args.values;
    if (!labelsFile || extra.length > 0 || !targetLang || !out) return usageError();

    // Check the language now, not at import time: finding out after translation that the
    // language has no Salesforce code would waste the whole round trip.
    let canonicalLang;
    try {
        canonicalLang = toBcp47(toSalesforceLang(targetLang)); // also normalises 'zh-cn' to 'zh-CN'
    } catch (err) {
        return usageError(err.message);
    }

    try {
        const labels = readLabelsFile(labelsFile);
        // `original` tells whoever gets the file where the strings came from. Forward slashes
        // so the file is the same on every OS.
        const original = relative(process.cwd(), resolve(labelsFile)).split(sep).join('/');
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, buildXliff(labels, { original, targetLang: canonicalLang }));
        console.log(`Exported ${labels.length} labels to ${out} (target ${canonicalLang})`);
        return 0;
    } catch (err) {
        console.error(`xliff-export: ${err.message}`);
        return 1;
    }
}

function usageError(message) {
    if (message) console.error(`xliff-export: ${message}`);
    console.error(USAGE);
    return 2;
}
