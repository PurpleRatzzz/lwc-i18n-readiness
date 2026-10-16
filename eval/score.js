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
        rules: ['R1', 'R2', 'R4'],
        units: (rows) => rows.filter((r) => hasIssue(r, 'hardcoded')).map((r) => [r])
    },
    fragments: {
        label: 'Fragmented sentences and plurals (R3)',
        rules: ['R3'],
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
        rules: ['R5'],
        units: (rows) => rows.filter((r) => hasIssue(r, 'locale')).map((r) => [r])
    }
};

// Annotators may copy text with entities as written (`MSRP:&nbsp;`); the scanner sees parse5's decoded text.
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decodeEntities = (text) => String(text).replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
const keyOf = (file, text) => `${file}\u0000${normalizeText(decodeEntities(text))}`;
const isMaybeUnit = (unit) => unit.every((r) => r.user_visible === 'maybe');
const unitText = (unit) => unit.map((r) => normalizeText(r.text)).join(' | ');
const disagreementKey = (d) => [d.family, d.kind, d.file, d.text].join('\u0000');

export function loadFindings(path) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(data) ? data : data.findings;
}

/** Match one family's findings to its gold units. Pure function, no I/O. */
export function matchFamily(family, findings, goldRows) {
    const units = family.units(goldRows);
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
    for (const f of findings.filter((x) => family.rules.includes(x.ruleId))) {
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

/** Apply human decisions. Returns raw and (when complete) adjudicated precision/recall. */
export function summarize(result, rows) {
    const decided = (kind, decision) => rows.filter((d) => d.kind === kind && d.decision === decision).length;
    const pending = rows.filter((d) => !d.decision).length;
    const tp = result.matched.length;
    const unmatched = result.unmatched.length;

    const raw = {
        precision: ratio(tp, tp + unmatched),
        recall: ratio(result.detectedUnits.length, result.yesUnits.length)
    };

    const goldMiss = decided('unmatched-finding', 'gold-miss');
    const scannerFp = decided('unmatched-finding', 'scanner-fp');
    const goldError = decided('missed-gold', 'gold-error');
    const adjusted = {
        tp: tp + goldMiss,
        fp: scannerFp,
        precision: ratio(tp + goldMiss, tp + goldMiss + scannerFp),
        // Each finding the annotator missed is a real problem the scanner did find.
        recall: ratio(
            result.detectedUnits.length + goldMiss,
            result.yesUnits.length - goldError + goldMiss
        )
    };

    return {
        goldUnits: result.yesUnits.length,
        maybeUnits: result.maybeUnits.length,
        findings: tp + result.matchedMaybe.length + unmatched,
        matched: tp,
        matchedMaybe: result.matchedMaybe.length,
        unmatched,
        missed: result.missed.length,
        pending,
        raw,
        adjudicated: pending === 0 ? adjusted : null
    };
}

function ratio(a, b) {
    return b === 0 ? null : { value: a / b, numerator: a, denominator: b };
}

const pct = (r) => (r ? `${(r.value * 100).toFixed(1)}% (${r.numerator}/${r.denominator})` : 'n/a');

export function renderMarkdown(repo, summaries) {
    const lines = [`# Scanner evaluation: ${repo}`, ''];
    lines.push('| Family | Gold units | Maybe units | Findings | Matched | Matched maybe | Unmatched | Missed | Pending | Precision | Recall |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [name, s] of Object.entries(summaries)) {
        const final = s.adjudicated ?? s.raw;
        const tag = s.adjudicated ? '' : ' (raw)';
        lines.push(
            `| ${FAMILIES[name].label} | ${s.goldUnits} | ${s.maybeUnits} | ${s.findings} | ${s.matched} | ${s.matchedMaybe} | ${s.unmatched} | ${s.missed} | ${s.pending} | ${pct(final.precision)}${tag} | ${pct(final.recall)}${tag} |`
        );
    }
    lines.push('');
    lines.push(
        '"Raw" numbers count every disagreement against the scanner. Adjudicated numbers apply the human decisions in the adjudication file.'
    );
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
    if (values.json) write(values.json, JSON.stringify({ repo: values.repo, summaries }, null, 2) + '\n');
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
