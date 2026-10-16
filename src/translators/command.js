// "command" translator: runs an external program, e.g. project A's AI translation pipeline.
//
// The contract is files, not function calls (docs/ARCHITECTURE.md): the program reads XLIFF 1.2
// from {in} and writes XLIFF 1.2 to {out}. Which program runs is set in one environment
// variable, so swapping translators is a config change, not a code change:
//
//   export LWC_I18N_TRANSLATOR_CMD='python -m l10n_pipeline translate --in {in} --out {out} --target-lang {lang}'
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseXliff } from '../xliff/parse.js';

export const ENV_VAR = 'LWC_I18N_TRANSLATOR_CMD';

export default async function commandTranslator({ inFile, outFile, lang, env = process.env }) {
    const template = env[ENV_VAR];
    if (!template) {
        throw new Error(`Set ${ENV_VAR} to the translator command, with {in}, {out} and {lang} where the values go`);
    }

    // Absolute paths, so a command that starts with `cd somewhere &&` still finds the files.
    // Each value is shell-quoted, so a path with spaces or a ";" can't break the command line.
    const command = template
        .replaceAll('{in}', shellQuote(resolve(inFile)))
        .replaceAll('{out}', shellQuote(resolve(outFile)))
        .replaceAll('{lang}', shellQuote(lang));

    // Remove an old output first: otherwise a command that silently does nothing would
    // pass the "output exists" check with last run's file.
    rmSync(outFile, { force: true });

    // shell: true because the variable holds a whole command line (it may use cd, &&, pipes).
    // stdio: 'inherit' shows the translator's own progress and errors to the user.
    const result = spawnSync(command, { shell: true, stdio: 'inherit', env });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Translator command exited with code ${result.status}: ${command}`);
    if (!existsSync(outFile)) throw new Error(`Translator command finished but did not write ${outFile}`);

    // Throws if the output is not well-formed XLIFF 1.2 with one <file>.
    parseXliff(readFileSync(outFile, 'utf8'), `Translator output ${outFile}`);
}

/** POSIX shell single quotes: everything inside is literal; a ' itself becomes '\''. */
export function shellQuote(value) {
    return `'${String(value).replaceAll("'", "'\\''")}'`;
}
