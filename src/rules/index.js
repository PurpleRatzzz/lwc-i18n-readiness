// Registry of all rules. The scan orchestrator runs every rule whose `kinds` include the file's kind.
import r1 from './r1-hardcoded-attribute.js';
import r2 from './r2-hardcoded-text.js';
import r3 from './r3-fragmented-sentence.js';
import r4 from './r4-js-ui-string.js';
import r5 from './r5-hardcoded-locale.js';
import r6 from './r6-label-context.js';

export const rules = [r1, r2, r3, r4, r5, r6];
