import { test } from 'node:test';
import assert from 'node:assert/strict';
import r4 from '../../src/rules/r4-js-ui-string.js';
import { scriptContext, inlineScript } from '../scan/helpers.js';

const findings = r4.check(scriptContext('uiStrings/uiStrings.js', ['uiStrings/uiStrings.html']));
const line = (f) => `${f.line}:${f.column} ${f.text} [${f.context.sink}]`;

test('R4 reports exactly the strings that reach a sink', () => {
    assert.deepEqual(findings.map(line).sort(byLine), [
        '11:20 Property Details [display-key]',
        '13:15 Property Name [display-key]',
        '19:23 Property [field-default]',
        '20:17 Welcome back [field-default]',
        '37:33 Property photo [getter]',
        '37:52 Photo of ${this.cardTitle} [getter]',
        '44:25 Success [toast]',
        '45:27 Property [toast]',
        '45:58 saved [toast]',
        '49:30 Saved [toast]',
        '49:48 Saved ${this.count} items [toast]',
        '54:38 This property was deleted [modal]',
        '54:89 Deleted [modal]',
        '55:61 Edit the property [modal]',
        '59:35 Could not load the property [rendered-field]',
        '60:25 Price is required [rendered-field]',
        '62:27 Failed to load properties [method-argument]',
        '77:13 <h1>${property.Name}</h1> <p>Beds: ${property.Beds__c} - Baths: ${property.Baths__c}</p> [html]'
    ]);
});

test('R4 marks concatenations and template literals with ${} as concatenated', () => {
    const concatenated = findings.filter((f) => f.context.concatenated).map((f) => f.text);
    assert.deepEqual(concatenated.sort(), [
        '<h1>${property.Name}</h1> <p>Beds: ${property.Beds__c} - Baths: ${property.Baths__c}</p>',
        'Photo of ${this.cardTitle}',
        'Property',
        'Saved ${this.count} items',
        'saved'
    ]);
    const piece = findings.find((f) => f.text === 'saved');
    assert.match(piece.message, /with one Custom Label that has \{0\} placeholders/);
});

test('R4 context explains why a field counts as shown', () => {
    const byText = (text) => findings.find((f) => f.text === text).context;
    assert.deepEqual(byText('Property'), { sink: 'field-default', field: 'cardTitle', api: true, via: 'template', concatenated: false });
    assert.equal(byText('Price is required').via, 'name');
    assert.equal(byText('Could not load the property').field, 'status.message');
    assert.deepEqual(byText('Failed to load properties'), { sink: 'method-argument', method: 'reportError', field: 'errorText', concatenated: false });
});

test('R4 ignores CSS classes, asset paths, input defaults, events, selectors, @wire and console', () => {
    const texts = findings.map((f) => f.text);
    for (const notUi of [
        'slds-path__item ',
        '${ASSETS}/logo.svg',
        'Harry Potter', // value={searchKey}: an input default, not a label
        'Saving property', // console.log
        'Property__c.Name',
        '.slds-path__item',
        'slds-is-current',
        'E_LOAD',
        '/lightning/n/Properties',
        'success',
        'dismissible',
        'small',
        '<br/>',
        'Map of the area', // mapCaption is not in the template and not named like a message
        'slds-box slds-box_small ${this.mode}-mode'
    ]) {
        assert.ok(!texts.includes(notUi), `should not report ${notUi}`);
    }
});

test('R4 needs the template: without it only message-named fields count as shown', () => {
    const blind = r4.check(scriptContext('uiStrings/uiStrings.js'));
    const texts = blind.map((f) => f.text);
    assert.ok(!texts.includes('Welcome back'));
    assert.ok(texts.includes('Price is required'));
    assert.ok(texts.includes('Could not load the property'));
});

test('R4 code-shaped strings are skipped even when they reach a sink', () => {
    const source = [
        "import ASSETS from '@salesforce/resourceUrl/assets';",
        'export default class X {',
        '    handle() {',
        "        this.errorMessage = 'slds-path__item ' + this.state;",
        '        this.message = `${ASSETS}/logo.svg`;',
        "        this.columns = [{ label: 'ALL_OPEN' }, { label: 'Account.Owner__r.Name' }, { label: 'en-US' }];",
        '    }',
        '}'
    ].join('\n');
    assert.deepEqual(r4.check(inlineScript(source)), []);
});

test('R4 += appends a piece; returns inside callbacks are not the getter\'s value', () => {
    const source = [
        'export default class X {',
        '    get summary() {',
        "        return this.items.map((item) => { return 'Item ' + item.name; }).join(', ');",
        '    }',
        '    add() {',
        "        this.status += ' (saved)';",
        '    }',
        '}'
    ].join('\n');
    const findings = r4.check(inlineScript(source, '<template><p>{summary} {status}</p></template>'));
    assert.deepEqual(findings.map((f) => `${f.text} ${f.context.sink} ${f.context.concatenated}`), ['(saved) rendered-field true']);
});

test('R4 dom-text, HTML pieces of a concatenation, and module constants', () => {
    const source = [
        "import { ShowToastEvent } from 'lightning/platformShowToastEvent';",
        "const SAVED_TITLE = 'Saved';",
        'export default class X {',
        '    show(name) {',
        "        this.refs.box.innerHTML = '<b>' + name + '</b> was added';",
        "        this.refs.hint.textContent = 'Drag a file here';",
        '        this.dispatchEvent(new ShowToastEvent({ title: SAVED_TITLE }));',
        '    }',
        '}'
    ].join('\n');
    // The constant is reported where it is declared (line 2), so sort by position.
    const findings = r4.check(inlineScript(source)).map((f) => `${f.line}:${f.column} ${f.text} ${f.context.sink}`);
    assert.deepEqual(findings.sort(byLine), [
        '2:22 Saved toast',
        // '<b>' alone has no words outside the tag, so only the second piece is reported.
        '5:51 </b> was added dom-text',
        '6:39 Drag a file here dom-text'
    ]);
});

function byLine(a, b) {
    const [la, ca] = a.split(' ')[0].split(':').map(Number);
    const [lb, cb] = b.split(' ')[0].split(':').map(Number);
    return la - lb || ca - cb;
}
