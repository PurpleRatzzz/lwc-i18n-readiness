// `lwc-i18n xliff-import <file.xlf> --labels <labelsFile> --out <dir> [--allow-warnings] [--report <file.json>]`
// Validates the translated units and merges the ones that pass into
// <dir>/<sfLang>.translation-meta.xml. See src/xliff/import.js for the checks and outcomes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { readLabelsFile } from '../labels/read.js';
import { writeTranslationFile } from '../labels/translations.js';
import { exitCode, formatReport, planImport } from '../xliff/import.js';
import { toSalesforceLang } from '../xliff/languages.js';
import { parseXliff } from '../xliff/parse.js';

const USAGE =
    'Usage: lwc-i18n xliff-import <file.xlf> --labels <labelsFile> --out <dir> [--allow-warnings] [--report <file.json>]';

export async function run(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                labels: { type: 'string' },
                out: { type: 'string' },
                'allow-warnings': { type: 'boolean', default: false },
                report: { type: 'string' }
            }
        });
    } catch (err) {
        return usageError(err.message);
    }
    const [xliffFile, ...extra] = args.positionals;
    const { labels: labelsFile, out, 'allow-warnings': allowWarnings, report: reportFile } = args.values;
    if (!xliffFile || extra.length > 0 || !labelsFile || !out) return usageError();

    try {
        const xliff = parseXliff(readFileSync(xliffFile, 'utf8'), xliffFile);
        // The language comes from the file itself, so the output can't end up under the wrong language.
        if (!xliff.targetLanguage) throw new Error(`${xliffFile} has no target-language on its <file> element`);
        const sfLang = toSalesforceLang(xliff.targetLanguage);
        const labels = readLabelsFile(labelsFile);

        const plan = planImport(xliff.units, labels, { allowWarnings });
        // Nothing passed (e.g. a batch that is not translated yet): leave any existing file alone.
        const output = plan.write.length > 0 ? writeTranslationFile(out, sfLang, plan.write) : null;

        const report = {
            xliff: xliffFile,
            labels: labelsFile,
            targetLanguage: xliff.targetLanguage,
            salesforceLanguage: sfLang,
            output,
            allowWarnings,
            summary: plan.summary,
            missingFromXliff: plan.missingFromXliff,
            units: plan.units
        };
        process.stdout.write(formatReport(report));
        if (reportFile) {
            mkdirSync(dirname(reportFile), { recursive: true });
            writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
        }
        return exitCode(plan.summary, allowWarnings);
    } catch (err) {
        console.error(`xliff-import: ${err.message}`);
        return 1;
    }
}

function usageError(message) {
    if (message) console.error(`xliff-import: ${message}`);
    console.error(USAGE);
    return 2;
}
