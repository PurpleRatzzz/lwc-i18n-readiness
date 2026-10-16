// "stub" translator: copies the source into <target state="needs-translation">.
// Simulates a batch that came back with nothing translated yet; the import must skip every unit.
import { fillTargetsInFile } from './fill-targets.js';

export default async function stubTranslator({ inFile, outFile }) {
    fillTargetsInFile(inFile, outFile, (source) => source, 'needs-translation');
}
