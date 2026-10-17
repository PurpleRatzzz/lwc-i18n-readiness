#!/usr/bin/env node
// Score scanner findings against a hand-annotated gold set (eval/gold/*.csv).
//
//   node eval/score.js --repo dreamhouse-lwc --findings out/dreamhouse.json --gold eval/gold/dreamhouse.csv \
//       [--adjudication eval/adjudication/dreamhouse.csv] [--report eval/results/dreamhouse.md] [--json eval/results/dreamhouse.json]
//
// Method:
// - Findings and gold rows are matched on file + normalized text, within LINE_TOLERANCE lines.
// - Precision is per finding: is this finding pointing at a real problem?
//   Recall is per gold unit: was this problem found at least once?
// - Rows the annotator marked user_visible=maybe are excluded from both, and reported separately.
// - Disagreements are exported to an adjudication CSV. A human decides each one:
//     unmatched finding → scanner-fp (scanner wrong) | gold-miss (annotator missed it)
//     missed gold unit  → scanner-fn (scanner missed it) | gold-error (annotation was wrong)
//   Until every row is decided, the report shows raw numbers and says how many are pending.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { parseCsv, toCsv } from './csv.js';
import { normalizeText } from '../src/finding.js';

const LINE_TOLERANCE = 2;

const hasIssue = (row, issue) => row.issue.split(';').map((s) => s.trim()).includes(issue);

// Rules are scored in three families, because each family answers a different question.
export const FAMILIES = {
    strings: {
        label: 'Hardcoded user-facing strings (R1, R2, R4)',
        counts: (f) => ['R1', 'R2', 'R4'].includes(f.ruleId),
        units: (rows) => rows.filter((r) => hasIssue(r, 'hardcoded')).map((r) => [r])
    },
    fragments: {
        label: 'Fragmented sentences and plurals (R3, R4 concatenated)',
        // R3 covers templates. In JS, the contract has R4 report concatenations and template
        // literals with ${} and mark them context.concatenated: the same problem, found in JS.
        counts: (f) => f.ruleId === 'R3' || (f.ruleId === 'R4' && f.context?.concatenated === true),
        // One unit per fragment_group (all its rows), plus plural rows that have no group.
        units: (rows) => {
            const groups = new Map();
            const units = [];
            for (const r of rows) {
                if (r.fragment_group) {
                    if (!groups.has(r.fragment_group)) groups.set(r.fragment_group, []);
                    groups.get(r.fragment_group).push(r);
                } else if (r.plural === 'yes') {
                    units.push([r]);
                }
            }
            return [...groups.values(), ...units];
        }
    },
    locale: {
        label: 'Hardcoded currency/locale (R5)',
        counts: (f) => f.ruleId === 'R5',
        // Human review decision: a hardcoded currency code is a locale assumption to report to
        // developers, not an untranslated string. Matched and shown, but not part of the score.
        scored: false,
        units: (rows) => rows.filter((r) => hasIssue(r, 'locale')).map((r) => [r])
    }
};

// Annotators may copy text with entities as written (`MSRP:&nbsp;`); the scanner sees parse5's decoded text.
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decodeEntities = (text) => String(text).replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
const keyOf = (file, text) => `${file}\u0000${normalizeText(decodeEntities(text))}`;
const isMaybeUnit = (unit) => unit.every((r) => r.user_visible === 'maybe');
const unitText = (unit) => unit.map((r) => normalizeText(r.text)).join(' | ');
// Line and gold ids are part of the key: the same text can occur several times in one file
// (three toasts with .join(', ') in orderBuilder.js), and each occurrence has its own decision.
const disagreementKey = (d) => [d.family, d.kind, d.file, String(d.line), d.gold_ids ?? '', d.text].join('\u0000');

export function loadFindings(path) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(data) ? data : data.findings;
}

/** Match one family's findings to its gold units. Pure function, no I/O. */
export function matchFamily(family, findings, goldRows) {
    // user_visible=no: rows a human reviewer removed (kept in the file, with the reason, for the record).
    const units = family.units(goldRows.filter((r) => r.user_visible !== 'no'));
    const rowIndex = new Map(); // key -> [{ row, unit }]
    for (const unit of units) {
        for (const row of unit) {
            const key = keyOf(row.file, row.text);
            if (!rowIndex.has(key)) rowIndex.set(key, []);
            rowIndex.get(key).push({ row, unit });
        }
    }

    const hitUnits = new Set();
    const matched = [];
    const matchedMaybe = [];
    const unmatched = [];
    for (const f of findings.filter(family.counts)) {
        const candidates = (rowIndex.get(keyOf(f.file, f.text)) ?? [])
            .map((c) => ({ ...c, delta: Math.abs(Number(c.row.line) - f.line) }))
            .filter((c) => c.delta <= LINE_TOLERANCE)
            .sort((a, b) => a.delta - b.delta);
        if (candidates.length === 0) {
            unmatched.push(f);
            continue;
        }
        const best = candidates[0];
        hitUnits.add(best.unit);
        (isMaybeUnit(best.unit) ? matchedMaybe : matched).push({ finding: f, row: best.row, delta: best.delta });
    }

    const yesUnits = units.filter((u) => !isMaybeUnit(u));
    const missed = yesUnits.filter((u) => !hitUnits.has(u));
    return {
        units,
        yesUnits,
        maybeUnits: units.filter(isMaybeUnit),
        detectedUnits: yesUnits.filter((u) => hitUnits.has(u)),
        matched,
        matchedMaybe,
        unmatched,
        missed
    };
}

export function disagreements(familyName, result) {
    return [
        ...result.unmatched.map((f) => ({
            family: familyName,
            kind: 'unmatched-finding',
            rule: f.ruleId,
            file: f.file,
            line: f.line,
            text: f.text,
            gold_ids: '',
            decision: '',
            note: ''
        })),
        ...result.missed.map((unit) => ({
            family: familyName,
            kind: 'missed-gold',
            rule: '',
            file: unit[0].file,
            line: unit[0].line,
            text: unitText(unit),
            gold_ids: unit.map((r) => r.id).join(' '),
            decision: '',
            note: ''
        }))
    ];
}

/**
 * Apply human decisions and count two different things, never mixed in one number:
 * - units: problems in the gold set. Recall = found / total.
 * - findings: what the scanner reported. Precision = correct / (correct + wrong).
 * One unit can be hit by several findings (R3 'interpolated' and 'plural' on the same text
 * node), so `correct` can be larger than `found`.
 * Until every disagreement is decided, the counts are raw: every disagreement counts against
 * the scanner. After that they are adjudicated:
 *   gold-error  the unit leaves the gold set          gold-miss   the finding is correct, and adds a unit
 *   scanner-fn  the unit stays missed                 scanner-fp  the finding is wrong
 */
export function summarize(result, rows) {
    const count = (kind, decision) => rows.filter((d) => d.kind === kind && d.decision === decision).length;
    const pending = rows.filter((d) => !d.decision).length;
    const adjudicated = pending === 0;
    const goldMiss = adjudicated ? count('unmatched-finding', 'gold-miss') : 0;
    const goldError = adjudicated ? count('missed-gold', 'gold-error') : 0;

    const unitsTotal = result.yesUnits.length - goldError + goldMiss;
    const unitsFound = result.detectedUnits.length + goldMiss;
    const correct = result.matched.length + goldMiss;
    const wrong = adjudicated ? count('unmatched-finding', 'scanner-fp') : result.unmatched.length;

    return {
        adjudicated,
        pending,
        units: { total: unitsTotal, found: unitsFound, missed: unitsTotal - unitsFound },
        findings: {
            total: result.matched.length + result.matchedMaybe.length + result.unmatched.length,
            correct,
            wrong,
            notScored: result.matchedMaybe.length // findings on rows the annotator marked 'maybe'
        },
        maybeUnits: result.maybeUnits.length,
        precision: ratio(correct, correct + wrong),
        recall: ratio(unitsFound, unitsTotal),
        decisions: rows.filter((d) => d.decision)
    };
}

function ratio(a, b) {
    return b === 0 ? null : { value: a / b, numerator: a, denominator: b };
}

const pct = (r) => (r ? `${(r.value * 100).toFixed(1)}% (${r.numerator}/${r.denominator})` : 'n/a');

export function renderMarkdown(repo, summaries) {
    const all = Object.values(summaries);
    const pending = all.reduce((sum, s) => sum + s.pending, 0);
    const lines = [`# Scanner evaluation: ${repo}`, ''];
    lines.push(
        pending === 0
            ? 'All disagreements between scanner and gold set are decided; every number below is adjudicated.'
            : `**Raw numbers**: ${pending} disagreement(s) still undecided, each counted against the scanner.`,
        ''
    );
    lines.push('| Family | Gold units | Found | Missed | Findings | Correct | Wrong | Not scored | Precision | Recall |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [name, s] of Object.entries(summaries)) {
        if (FAMILIES[name].scored === false) continue;
        lines.push(
            `| ${FAMILIES[name].label} | ${s.units.total} | ${s.units.found} | ${s.units.missed} | ${s.findings.total} | ${s.findings.correct} | ${s.findings.wrong} | ${s.findings.notScored} | ${pct(s.precision)} | ${pct(s.recall)} |`
        );
    }
    lines.push(
        '',
        '- **Gold units, Found, Missed** count problems in the gold set. Recall = Found / Gold units.',
        '- **Findings, Correct, Wrong** count scanner reports. Precision = Correct / (Correct + Wrong). One problem can be hit by more than one finding (R3 `interpolated` and `plural` on the same text node), so Correct can be larger than Found.',
        '- **Not scored**: findings on rows the annotator marked `maybe`.'
    );

    const decisions = Object.entries(summaries).flatMap(([name, s]) => s.decisions.map((d) => ({ ...d, family: name })));
    if (decisions.length > 0) {
        lines.push('', '## Human decisions applied', '');
        for (const d of decisions) {
            const where = `${d.file.split('/').pop()}:${d.line}`;
            const ids = d.gold_ids ? ` ${d.gold_ids}` : '';
            lines.push(`- ${d.family} · ${d.kind}${ids} · \`${where}\` "${d.text}" → **${d.decision}**. ${d.note}`);
        }
    }

    const unscored = Object.entries(summaries).filter(([name]) => FAMILIES[name].scored === false);
    if (unscored.length > 0) {
        lines.push('', '## Reported, not scored', '');
        for (const [name, s] of unscored) {
            lines.push(`- ${FAMILIES[name].label}: ${s.units.total} in the gold set, ${s.units.found} found, ${s.units.missed} missed, ${s.findings.wrong} not in the gold set.`);
        }
    }
    return lines.join('\n') + '\n';
}

const ADJ_COLUMNS = ['family', 'kind', 'rule', 'file', 'line', 'text', 'gold_ids', 'decision', 'note'];

async function main() {
    const { values } = parseArgs({
        options: {
            repo: { type: 'string' },
            findings: { type: 'string' },
            gold: { type: 'string' },
            adjudication: { type: 'string' },
            report: { type: 'string' },
            json: { type: 'string' }
        }
    });
    if (!values.repo || !values.findings || !values.gold) {
        console.error('Usage: node eval/score.js --repo <name> --findings <scan.json> --gold <gold.csv> [--adjudication <csv>] [--report <md>] [--json <file>]');
        return 2;
    }

    const findings = loadFindings(values.findings);
    const gold = parseCsv(readFileSync(values.gold, 'utf8'));
    const previous = values.adjudication && existsSync(values.adjudication)
        ? parseCsv(readFileSync(values.adjudication, 'utf8'))
        : [];
    const previousByKey = new Map(previous.map((d) => [disagreementKey(d), d]));

    const summaries = {};
    const allRows = [];
    for (const [name, family] of Object.entries(FAMILIES)) {
        const result = matchFamily(family, findings, gold);
        // Keep decisions already made; new disagreements start undecided.
        const rows = disagreements(name, result).map((d) => {
            const old = previousByKey.get(disagreementKey(d));
            return old ? { ...d, decision: old.decision, note: old.note } : d;
        });
        allRows.push(...rows);
        summaries[name] = summarize(result, rows);
    }

    if (values.adjudication) write(values.adjudication, toCsv(allRows, ADJ_COLUMNS));
    const markdown = renderMarkdown(values.repo, summaries);
    if (values.report) write(values.report, markdown);
    const scored = Object.fromEntries(Object.keys(FAMILIES).map((name) => [name, FAMILIES[name].scored !== false]));
    if (values.json) write(values.json, JSON.stringify({ repo: values.repo, scored, summaries }, null, 2) + '\n');
    process.stdout.write(markdown);
    return 0;
}

function write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = await main();
}
