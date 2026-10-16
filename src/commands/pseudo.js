// `lwc-i18n pseudo <labelsFile> --locale <sfLocale> --out <dir>`
// Writes <dir>/<locale>.translation-meta.xml with a pseudo-localized translation of every label.
// Deploy it, switch a test user to that language, and look for English text, cut-off "]"s and
// broken characters.
import { parseArgs } from 'node:util';
import { readLabelsFile } from '../labels/read.js';
import { writeTranslationFile } from '../labels/translations.js';
import { pseudoLocalize } from '../pseudo/pseudo.js';

const USAGE = 'Usage: lwc-i18n pseudo <labelsFile> --locale <sfLocale> --out <dir>';
// Salesforce label values (and their translations) are limited to 1000 characters.
const SALESFORCE_MAX_LABEL = 1000;

export async function run(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            allowPositionals: true,
            options: { locale: { type: 'string' }, out: { type: 'string' } }
        });
    } catch (err) {
        return usageError(err.message);
    }
    const [labelsFile, ...extra] = args.positionals;
    const { locale, out } = args.values;
    // No default locale on purpose: which language to use for pseudo text depends on what the
    // org can enable, and a silent default would overwrite a real language's translations.
    if (!labelsFile || extra.length > 0 || !locale || !out) return usageError();
    // Salesforce codes use an underscore (zh_CN). Checking the shape also keeps the value safe
    // to use in a file name.
    if (!/^[a-z]{2,3}(_[A-Za-z0-9]+)*$/.test(locale)) {
        return usageError(`--locale must be a Salesforce language code such as eo, de or zh_CN, got "${locale}"`);
    }

    try {
        const labels = readLabelsFile(labelsFile);
        const entries = labels.map((label) => ({ name: label.fullName, label: pseudoLocalize(label.value) }));
        const path = writeTranslationFile(out, locale, entries);
        console.log(`Wrote ${entries.length} pseudo-localized labels to ${path}`);

        const tooLong = entries.filter((e) => [...e.label].length > SALESFORCE_MAX_LABEL);
        if (tooLong.length > 0) {
            console.error(`Warning: ${tooLong.length} pseudo labels exceed ${SALESFORCE_MAX_LABEL} characters and will not deploy: ${tooLong.map((e) => e.name).join(', ')}`);
        }
        return 0;
    } catch (err) {
        console.error(`pseudo: ${err.message}`);
        return 1;
    }
}

function usageError(message) {
    if (message) console.error(`pseudo: ${message}`);
    console.error(USAGE);
    return 2;
}
