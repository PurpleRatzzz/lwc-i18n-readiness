// Translator adapters. Each one is `async ({ inFile, outFile, lang }) => void`: read XLIFF 1.2
// from inFile, write XLIFF 1.2 with <target> elements to outFile. Nothing else is shared.
import commandTranslator from './command.js';
import pseudoTranslator from './pseudo.js';
import stubTranslator from './stub.js';

export const translators = {
    stub: stubTranslator,
    pseudo: pseudoTranslator,
    command: commandTranslator
};
