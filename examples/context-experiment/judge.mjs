// Turn the three translated XLIFF files into one blind judging sheet (see PREREGISTRATION.md).
//   node examples/context-experiment/judge.mjs <set> sheet   -> <set>/judging.csv (for the judge) + judging-key.json (sealed)
//   node examples/context-experiment/judge.mjs <set> score   -> <set>/results.md, from the filled-in judging.csv
// The judge sees the UI position, the English a user would see and one Chinese text,
// never the condition. Units of all conditions are shuffled together with a fixed seed.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseXliff } from '../../src/xliff/parse.js';
import { parseCsv, toCsv } from '../../eval/csv.js';

const [SET, mode] = process.argv.slice(2);
if (!['dreamhouse', 'starterkit'].includes(SET)) throw new Error('Usage: judge.mjs <dreamhouse|starterkit> <sheet|score>');
const HERE = `examples/context-experiment/${SET}`;
const design = JSON.parse(readFileSync(`${HERE}/design.json`, 'utf8'));
const CONDITIONS = ['c1', 'c2', 'c3'];
const SEED = 20261018;

// Translation, state and QA notes of every unit, per condition.
function load(condition) {
    const { units } = parseXliff(readFileSync(`${HERE}/runs/${condition}.zh-CN.xlf`, 'utf8'));
    return new Map(units.map((u) => [u.id, u]));
}

// Label names that can appear in an assemble template, longest first so LMR_filters wins over LMR_filter.
const PIECE_NAMES = [...new Set(design.fragments.flatMap((f) => f.pieces.map((p) => p.name)).concat(design.singles.map((l) => l.name)))]
    .sort((a, b) => b.length - a.length);
const TOKEN = new RegExp(`\\{(\\w+)\\}|(${PIECE_NAMES.join('|')})`, 'g');

/** "{total} DH_Pager_Items • DH_Pager_Page {page}" with values -> text, plus the units it used. */
function assemble(template, valueOf, example) {
    const used = [];
    const text = template.replace(TOKEN, (_m, key, name) => {
        if (key) return example[key];
        used.push(name);
        return valueOf(name);
    });
    return { text, used };
}

function fillPlaceholders(text, args, example, valueOf) {
    return text.replace(/\{(\d+)\}/g, (_m, i) => {
        const arg = args[Number(i)];
        return arg.startsWith('label:') ? `**${valueOf(arg.slice(6))}**` : example[arg];
    });
}

function unitsFor(condition) {
    const units = load(condition);
    const zh = (name) => units.get(name)?.target ?? '[missing]';
    const en = (name) => [...design.singles, ...design.fragments.flatMap((f) => f.pieces)].find((l) => l.name === name)?.value;
    const flags = (names) => names.map((n) => units.get(n)).filter((u) => u && u.state !== 'translated');
    const rows = design.singles.map((l) => ({ unit: l.name, where: l.where, english: l.value, chinese: zh(l.name), review: flags([l.name]) }));
    for (const f of design.fragments) {
        if (condition === 'c3') {
            const c3 = units.get(f.c3.name);
            rows.push({
                unit: f.unit,
                where: f.where,
                english: fillPlaceholders(f.c3.value, f.c3Args, f.example, en),
                chinese: fillPlaceholders(c3?.target ?? '[missing]', f.c3Args, f.example, zh),
                review: flags([f.c3.name])
            });
        } else {
            const english = assemble(f.assemble, en, f.example);
            const chinese = assemble(f.assemble, zh, f.example);
            rows.push({ unit: f.unit, where: f.where, english: english.text, chinese: chinese.text, review: flags(chinese.used) });
        }
    }
    return rows.map((r) => ({ ...r, condition }));
}

// mulberry32: a tiny seeded PRNG, so the shuffle is the same every time.
function shuffled(items, seed) {
    let a = seed;
    const random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

if (mode === 'sheet') {
    const all = shuffled(CONDITIONS.flatMap(unitsFor), SEED).map((r, i) => ({ id: `J${String(i + 1).padStart(2, '0')}`, ...r }));
    writeFileSync(`${HERE}/judging.csv`, toCsv(all.map((r) => ({ ...r, acceptable: '', error_type: '', note: '' })), ['id', 'where', 'english', 'chinese', 'acceptable', 'error_type', 'note']));
    const key = all.map((r) => ({ id: r.id, condition: r.condition, unit: r.unit, review: r.review.map((u) => ({ id: u.id, state: u.state, qa: u.notes.filter((n) => n.from === 'qa').map((n) => n.text) })) }));
    writeFileSync(`${HERE}/judging-key.json`, JSON.stringify(key, null, 2) + '\n');
    console.log(`judging.csv: ${all.length} units; judging-key.json written (don't open it before judging)`);
} else if (mode === 'score') {
    const verdicts = parseCsv(readFileSync(`${HERE}/judging.csv`, 'utf8'));
    const key = new Map(JSON.parse(readFileSync(`${HERE}/judging-key.json`, 'utf8')).map((k) => [k.id, k]));
    const undecided = verdicts.filter((v) => !['yes', 'no'].includes(v.acceptable.trim().toLowerCase()));
    if (undecided.length > 0) throw new Error(`${undecided.length} units have no verdict (acceptable = yes/no): ${undecided.map((v) => v.id).join(', ')}`);
    const lines = [`# Context experiment: results (${SET})`, '', '| Condition | Acceptable | Not acceptable | Error types | Sent to human review by A |', '|---|---:|---:|---|---:|'];
    for (const c of CONDITIONS) {
        const rows = verdicts.filter((v) => key.get(v.id).condition === c);
        const ok = rows.filter((v) => v.acceptable.trim().toLowerCase() === 'yes').length;
        const errors = {};
        // The judge may give more than one type ("meaning;order"); each one is counted.
        for (const v of rows.filter((r) => r.acceptable.trim().toLowerCase() === 'no')) {
            for (const type of (v.error_type || 'unspecified').split(/[;,]\s*/)) errors[type] = (errors[type] ?? 0) + 1;
        }
        const reviewed = rows.filter((v) => key.get(v.id).review.length > 0).length;
        lines.push(`| ${c.toUpperCase()} | ${ok}/${rows.length} | ${rows.length - ok} | ${Object.entries(errors).map(([k, n]) => `${k} ${n}`).join(', ') || '-'} | ${reviewed} |`);
    }
    lines.push('', '## Every unit', '', '| Unit | Condition | English | Chinese | Acceptable | Error | Note |', '|---|---|---|---|---|---|---|');
    const order = (v) => [key.get(v.id).unit, key.get(v.id).condition].join(' ');
    for (const v of [...verdicts].sort((a, b) => order(a).localeCompare(order(b)))) {
        const k = key.get(v.id);
        const cell = (s) => String(s).replace(/\|/g, '\\|');
        lines.push(`| ${k.unit} | ${k.condition.toUpperCase()} | ${cell(v.english)} | ${cell(v.chinese)} | ${v.acceptable} | ${v.error_type} | ${cell(v.note)} |`);
    }
    writeFileSync(`${HERE}/results.md`, lines.join('\n') + '\n');
    console.log(lines.slice(0, 7).join('\n'));
} else {
    console.error('Usage: node examples/context-experiment/judge.mjs <dreamhouse|starterkit> sheet|score');
    process.exitCode = 2;
}
