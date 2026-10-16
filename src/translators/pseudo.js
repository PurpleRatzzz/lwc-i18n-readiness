// "pseudo" translator: pseudo-localized targets with state="translated".
// Exercises the whole import and write path without any translation API or cost.
import { pseudoLocalize } from '../pseudo/pseudo.js';
import { fillTargetsInFile } from './fill-targets.js';

export default async function pseudoTranslator({ inFile, outFile }) {
    fillTargetsInFile(inFile, outFile, pseudoLocalize, 'translated');
}
