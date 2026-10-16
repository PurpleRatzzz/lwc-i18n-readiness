import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFinding, fingerprint } from '../../src/finding.js';
import { formatText } from '../../src/report/text.js';
import { formatJson } from '../../src/report/json.js';
import { formatGithub, escapeData, escapeProperty } from '../../src/report/github.js';
import { formatMarkdown, escapeMarkdown } from '../../src/report/markdown.js';

const annotate = (finding, isNew = true) => ({ ...finding, fingerprint: fingerprint(finding), isNew });

const reset = annotate(
    makeFinding({
        ruleId: 'R1',
        ruleName: 'hardcoded-attribute',
        severity: 'error',
        file: 'lwc/a/a.html',
        line: 5,
        column: 13,
        text: 'Reset',
        message: 'Move label "Reset" on <lightning-button> into a Custom Label and import it via @salesforce/label.',
        context: { element: 'lightning-button', attribute: 'label' }
    })
);
const label = annotate(
    makeFinding({
        ruleId: 'R6',
        ruleName: 'label-context',
        severity: 'warning',
        file: 'labels/CustomLabels.labels-meta.xml',
        line: 4,
        column: 9,
        text: 'Apply',
        message: 'No ui: category; add one.',
        context: { subrule: 'no-ui-category' }
    })
);
const old = annotate(
    makeFinding({
        ruleId: 'R2',
        ruleName: 'hardcoded-text',
        severity: 'error',
        file: 'lwc/a/a.html',
        line: 9,
        column: 5,
        text: 'No data',
        message: 'Move the text "No data" in <p> into a Custom Label and import it via @salesforce/label.'
    }),
    false
);

test('json: { findings } with every Finding field plus fingerprint and isNew', () => {
    const parsed = JSON.parse(formatJson([reset, old]));
    assert.deepEqual(Object.keys(parsed), ['findings']);
    assert.deepEqual(Object.keys(parsed.findings[0]).sort(), [
        'column', 'context', 'file', 'fingerprint', 'isNew', 'line', 'message', 'ruleId', 'ruleName', 'severity', 'text'
    ]);
    assert.equal(parsed.findings[0].fingerprint, fingerprint(reset));
    assert.equal(parsed.findings[0].isNew, true);
    assert.equal(parsed.findings[1].isNew, false);
    assert.deepEqual(JSON.parse(formatJson([])), { findings: [] });
});

test('github: one workflow command per finding, by severity; baseline findings as notices', () => {
    const lines = formatGithub([reset, label, old]).trimEnd().split('\n');
    assert.equal(
        lines[0],
        '::error file=lwc/a/a.html,line=5,col=13,title=R1 hardcoded-attribute::Move label "Reset" on <lightning-button> into a Custom Label and import it via @salesforce/label.'
    );
    assert.match(lines[1], /^::warning file=labels\/CustomLabels\.labels-meta\.xml,line=4,col=9,title=R6 label-context::/);
    assert.match(lines[2], /^::notice file=lwc\/a\/a\.html,line=9,col=5,title=R2 hardcoded-text \(baseline\)::/);
    assert.equal(formatGithub([]), '');
});

test('github: escapes %, CR and LF in messages and also , and : in properties', () => {
    assert.equal(escapeData('50% done\r\nnext: a, b'), '50%25 done%0D%0Anext: a, b');
    assert.equal(escapeProperty('dir,x/a:b%.html'), 'dir%2Cx/a%3Ab%25.html');
    const tricky = { ...reset, file: 'lwc/a,b/a:b.html', message: 'Line one\nLine two at 100%' };
    assert.equal(
        formatGithub([tricky]),
        '::error file=lwc/a%2Cb/a%3Ab.html,line=5,col=13,title=R1 hardcoded-attribute::Line one%0ALine two at 100%25\n'
    );
});

test('text: one line per finding, baseline marker, summary', () => {
    const out = formatText([reset, old]);
    assert.equal(
        out,
        'lwc/a/a.html:5:13  error  R1 hardcoded-attribute  Move label "Reset" on <lightning-button> into a Custom Label and import it via @salesforce/label.\n' +
            'lwc/a/a.html:9:5  error  R2 hardcoded-text  Move the text "No data" in <p> into a Custom Label and import it via @salesforce/label.  (in baseline)\n' +
            '\n' +
            '2 findings (2 errors, 0 warnings), 1 new error.\n'
    );
    assert.equal(formatText([]), 'No i18n findings.\n');
});

test('markdown: summary table per rule and a list of new findings only', () => {
    const out = formatMarkdown([reset, old, label]);
    assert.match(out, /\| R1 \| hardcoded-attribute \| error \| 1 \| 1 \|/);
    assert.match(out, /\| R2 \| hardcoded-text \| error \| 1 \| 0 \|/);
    assert.match(out, /\| R6 \| label-context \| warning \| 1 \| 1 \|/);
    assert.match(out, /### New findings \(2\)/);
    // HTML-like text is escaped so GitHub doesn't swallow it as a tag.
    assert.ok(out.includes('- `lwc/a/a.html:5:13` **R1** error: Move label "Reset" on &lt;lightning-button&gt; into'));
    assert.ok(!out.includes('No data'), 'baseline findings are counted, not listed');
});

test('markdown: escapes characters that would become formatting', () => {
    assert.equal(escapeMarkdown('a|b *c* _d_ `e` [f] <g> & h'), 'a\\|b \\*c\\* \\_d\\_ \\`e\\` \\[f\\] &lt;g&gt; &amp; h');
    assert.match(formatMarkdown([]), /No i18n findings\./);
});
