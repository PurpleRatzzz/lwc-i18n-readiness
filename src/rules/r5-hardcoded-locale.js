// R5 hardcoded-locale: the code fixes a currency or locale instead of using the user's.
//   template  currency-code="USD"
//   script    new Intl.NumberFormat('en-US'), date.toLocaleDateString('en-US'),
//             { currency: 'USD' } in Intl options or datatable typeAttributes,
//             japanLocale = 'ja-JP', const DEFAULT_CURRENCY = 'EUR'
// A locale only controls formatting, so the fix is to use the user's (@salesforce/i18n/locale).
// A currency code is different: it must match the currency the amount is stored in. Swapping in
// the user's currency without converting the amount turns $1,000 into €1,000. So R5 is a warning
// that asks a person to check where the amount comes from, not an automatic "replace with X".
import { makeFinding } from '../finding.js';
import { walkTemplate, isElement, isDynamic, attributePosition } from '../scan/template.js';
import { walkScript, keyName, thisPath, literalPosition, inIgnoredContext } from '../scan/script.js';

const LOCALE_FIX = 'the user\'s locale from @salesforce/i18n/locale';
const CURRENCY_ADVICE =
    'check that the amount is really stored in this currency. Take the code from where the amount comes from ' +
    '(the record\'s CurrencyIsoCode in multi-currency orgs, otherwise the org currency), and never switch it to the ' +
    'user\'s currency without converting the amount (e.g. SOQL convertCurrency()).';

const rule = {
    id: 'R5',
    name: 'hardcoded-locale',
    kinds: ['template', 'script'],
    severity: 'warning',
    description: 'Currency or locale is hardcoded (currency-code="USD", Intl/toLocale* with a literal locale).',
    check(ctx) {
        return ctx.kind === 'template' ? checkTemplate(ctx) : checkScript(ctx);
    }
};

export default rule;

function finding(ctx, position, text, message, context) {
    return makeFinding({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        file: ctx.file,
        ...position,
        text,
        message,
        context
    });
}

/** currency-code="USD" (but not currency-code={currencyCode}). */
function checkTemplate(ctx) {
    const findings = [];
    walkTemplate(ctx.ast, (node) => {
        if (!isElement(node)) return;
        for (const attr of node.attrs) {
            if (!ctx.config.template.currencyAttributes.includes(attr.name)) continue;
            if (isDynamic(attr.value) || attr.value.trim() === '') continue;
            findings.push(
                finding(
                    ctx,
                    attributePosition(node, attr.name),
                    attr.value,
                    `Currency "${attr.value.trim()}" is hardcoded in ${attr.name} on <${node.tagName}>: ${CURRENCY_ADVICE}`,
                    { element: node.tagName, attribute: attr.name }
                )
            );
        }
    });
    return findings;
}

function checkScript(ctx) {
    const { localeValuePattern, currencyValuePattern, localeNamePattern, currencyNamePattern, localeMethods } = ctx.config.locale;
    // Keyed by the literal's offset, so one literal is reported once even if two checks see it.
    const found = new Map();

    const reportLocale = (literal, sink) => {
        if (literal?.type !== 'StringLiteral' || !localeValuePattern.test(literal.value) || found.has(literal.start)) return;
        found.set(literal.start, finding(ctx, literalPosition(literal, ctx.source), literal.value,
            `Replace the hardcoded locale "${literal.value}" with ${LOCALE_FIX}.`, { sink }));
    };
    const reportCurrency = (literal, sink) => {
        if (literal?.type !== 'StringLiteral' || !currencyValuePattern.test(literal.value) || found.has(literal.start)) return;
        found.set(literal.start, finding(ctx, literalPosition(literal, ctx.source), literal.value,
            `Currency "${literal.value}" is hardcoded: ${CURRENCY_ADVICE}`, { sink }));
    };
    // A name that says "I hold a locale/currency" plus a value of that shape.
    const checkNamed = (name, value) => {
        if (!name) return;
        if (localeNamePattern.test(name)) reportLocale(value, 'locale-variable');
        if (currencyNamePattern.test(name)) reportCurrency(value, 'currency-variable');
    };

    walkScript(ctx.ast, (node, ancestors) => {
        if (inIgnoredContext(ancestors, ctx.config)) return;

        // new Intl.NumberFormat('en-US'), Intl.DateTimeFormat(['en-US']): the first argument is the locale.
        if ((node.type === 'NewExpression' || node.type === 'CallExpression') && isIntlMember(node.callee)) {
            const first = node.arguments[0];
            const literals = first?.type === 'ArrayExpression' ? first.elements : [first];
            for (const literal of literals) reportLocale(literal, `Intl.${node.callee.property.name}`);
        }

        // date.toLocaleDateString('en-US', { ... })
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed) {
            const method = node.callee.property.name;
            if (localeMethods.includes(method)) reportLocale(node.arguments[0], method);
        }

        // { currency: 'USD' }, { locale: 'en-US' }: Intl options, datatable typeAttributes...
        if (node.type === 'ObjectProperty') checkNamed(keyName(node), node.value);
        // japanLocale = 'ja-JP' (class field), const DEFAULT_CURRENCY = 'EUR', this.locale = 'en'
        if (node.type === 'ClassProperty') checkNamed(keyName(node), node.value);
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') checkNamed(node.id.name, node.init);
        if (node.type === 'AssignmentExpression') {
            const name = node.left.type === 'Identifier' ? node.left.name : thisPath(node.left)?.split('.').at(-1);
            checkNamed(name, node.right);
        }
    });
    return [...found.values()];
}

/** Intl.NumberFormat, Intl.DateTimeFormat, ... */
function isIntlMember(callee) {
    return (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Intl' &&
        callee.property.type === 'Identifier'
    );
}
