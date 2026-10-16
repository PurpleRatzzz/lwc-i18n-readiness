// `lwc-i18n scan <root> [--format text|json|github|markdown] [--baseline <file>]
//                       [--write-baseline <file>] [--rules R1,R2,...]`
// Scans an SFDX project for i18n problems and prints a report.
// Exit code: 0 = no new error-severity finding, 1 = at least one, 2 = usage error.
// "New" means not covered by --baseline; without a baseline every finding is new.
import { existsSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fingerprint } from '../finding.js';
import { readBaseline, writeBaseline, splitByBaseline } from '../baseline.js';
import { rules as allRules } from '../rules/index.js';
import { scan } from '../scan/index.js';
import { formatters } from '../report/index.js';

const USAGE =
    'Usage: lwc-i18n scan <root> [--format text|json|github|markdown] [--baseline <file>] [--write-baseline <file>] [--rules R1,R2,...]';

export async function run(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                format: { type: 'string', default: 'text' },
                baseline: { type: 'string' },
                'write-baseline': { type: 'string' },
                rules: { type: 'string' }
            }
        });
    } catch (err) {
        return usageError(err.message);
    }

    const [root, ...extra] = args.positionals;
    const { format, baseline: baselinePath, 'write-baseline': writePath } = args.values;
    if (!root || extra.length > 0) return usageError();
    if (!existsSync(root) || !statSync(root).isDirectory()) return usageError(`${root} is not a directory`);
    if (!formatters[format]) return usageError(`unknown format "${format}"`);

    const { rules, error } = selectRules(args.values.rules);
    if (error) return usageError(error);

    // A baseline that can't be read is a setup mistake, not "no baseline": treating it as empty
    // would suddenly fail every PR, so stop and say so.
    let baseline = {};
    if (baselinePath) {
        try {
            baseline = readBaseline(baselinePath);
        } catch (err) {
            return usageError(`cannot read baseline ${baselinePath}: ${err.message}`);
        }
    }

    const { findings, errors } = scan(root, { rules });
    // Files we couldn't parse are not findings, but the user must know they weren't checked.
    for (const e of errors) console.error(`scan: ${e.file}: ${e.message}`);

    const { fresh } = splitByBaseline(findings, baseline);
    const freshSet = new Set(fresh);
    const annotated = findings.map((f) => ({ ...f, fingerprint: fingerprint(f), isNew: freshSet.has(f) }));
    process.stdout.write(formatters[format](annotated));

    if (writePath) {
        writeBaseline(writePath, findings);
        console.error(`scan: wrote baseline with ${findings.length} findings to ${writePath}`);
        // Writing a baseline means "accept what exists today", so nothing is new against it.
        return 0;
    }
    return fresh.some((f) => f.severity === 'error') ? 1 : 0;
}

/** --rules R1,R4 -> { rules: those rule modules }; all rules when the option is absent; { error } for unknown ids. */
function selectRules(option) {
    if (option === undefined) return { rules: allRules };
    const ids = option.split(',').map((id) => id.trim().toUpperCase()).filter(Boolean);
    const unknown = ids.filter((id) => !allRules.some((rule) => rule.id === id));
    if (ids.length === 0 || unknown.length > 0) {
        return { error: `unknown rule "${unknown.join(', ') || option}"; known rules: ${allRules.map((r) => r.id).join(', ')}` };
    }
    return { rules: allRules.filter((rule) => ids.includes(rule.id)) };
}

function usageError(message) {
    if (message) console.error(`scan: ${message}`);
    console.error(USAGE);
    return 2;
}
