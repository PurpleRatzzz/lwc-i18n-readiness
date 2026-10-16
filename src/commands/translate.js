// `lwc-i18n translate <in.xlf> --out <out.xlf> --lang <bcp47> --translator stub|pseudo|command`
// Fills <target> elements using one of the adapters in src/translators/.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { translators } from '../translators/index.js';
import { toSalesforceLang } from '../xliff/languages.js';
import { parseXliff } from '../xliff/parse.js';

const USAGE = `Usage: lwc-i18n translate <in.xlf> --out <out.xlf> --lang <bcp47> --translator ${Object.keys(translators).join('|')}`;

export async function run(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            allowPositionals: true,
            options: { out: { type: 'string' }, lang: { type: 'string' }, translator: { type: 'string' } }
        });
    } catch (err) {
        return usageError(err.message);
    }
    const [inFile, ...extra] = args.positionals;
    const { out: outFile, lang, translator: name } = args.values;
    if (!inFile || extra.length > 0 || !outFile || !lang || !name) return usageError();
    if (!Object.hasOwn(translators, name)) return usageError(`Unknown translator "${name}"`);
    try {
        toSalesforceLang(lang); // fail now if the result could never be imported
    } catch (err) {
        return usageError(err.message);
    }

    let input;
    try {
        input = parseXliff(readFileSync(inFile, 'utf8'), inFile);
    } catch (err) {
        console.error(`translate: ${err.message}`);
        return 1;
    }
    // Translating a zh-CN file "into de" is almost certainly a mistake in the command line.
    if (String(input.targetLanguage).toLowerCase() !== lang.toLowerCase()) {
        return usageError(`--lang ${lang} does not match the file's target-language ${input.targetLanguage}`);
    }

    try {
        await translators[name]({ inFile, outFile, lang: input.targetLanguage });
        const output = parseXliff(readFileSync(outFile, 'utf8'), outFile);
        console.log(`Translated ${output.units.length} units with "${name}": ${outFile}`);
        return 0;
    } catch (err) {
        console.error(`translate: ${err.message}`);
        return 1;
    }
}

function usageError(message) {
    if (message) console.error(`translate: ${message}`);
    console.error(USAGE);
    return 2;
}
