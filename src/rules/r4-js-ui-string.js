// R4 js-ui-string: English text in JavaScript that ends up on the screen.
//
// Not every string literal is UI: most are field names, CSS classes, event names or keys.
// So R4 starts from the places where text is known to reach the user ("sinks") and reports
// the string literals that flow into them:
//   toast / modal     new ShowToastEvent({ title, message }), Toast.show({ label }), LightningAlert.open({ message })
//   display-key       { label: 'Name' } in datatable columns, combobox options, tree items...
//   rendered-field    this.errorMessage = '...', when the template shows {errorMessage}
//   field-default     greeting = 'World' / @api friendlyMessage = '...', when the template shows it
//   getter            get title() { return 'New Contact'; }, when the template shows {title}
//   method-argument   this.reportError('Failed to load'), when reportError() puts its argument in a shown field
//   dom-text          el.innerText = 'Text changed', el.innerHTML = '<p>...</p>'
//   html              `<h1>${name}</h1><p>Beds: ${beds}</p>`: markup with English built in JS
// What R4 deliberately does not do: follow values through local variables, function returns or
// other modules. Those need real data-flow analysis; guessing would cost precision.
import { makeFinding } from '../finding.js';
import {
    walkScript,
    importsOf,
    topLevelConstants,
    keyName,
    thisPath,
    stringPieces,
    carriesVariable,
    literalText,
    staticText,
    literalPosition,
    inIgnoredContext,
    isFunction
} from '../scan/script.js';
import { renderedBindings } from '../scan/template.js';
import { hasLetters, looksLikeCode, shorten } from '../scan/text.js';

const rule = {
    id: 'R4',
    name: 'js-ui-string',
    kinds: ['script'],
    severity: 'error',
    description: 'String literal or concatenated/template string in JS reaches the UI (toast, error message, rendered getter).',
    check(ctx) {
        const scope = analyze(ctx);
        // Keyed by the literal's offset: a string that reaches two sinks is still one finding.
        const found = new Map();

        const report = ({ node, concatenated }, where, context) => {
            if (found.has(node.start) || !isUiText(node, ctx.config)) return;
            const text = literalText(node, ctx.source);
            found.set(
                node.start,
                makeFinding({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    file: ctx.file,
                    ...literalPosition(node, ctx.source),
                    text,
                    message: messageFor(text, where, concatenated),
                    context: { ...context, concatenated }
                })
            );
        };
        // `glued`: the value is appended to something else (this.x += '...'), so it is a piece too.
        const reportAll = (expr, where, context, glued = false) => {
            for (const piece of stringPieces(expr, scope.constants, glued)) report(piece, where, context);
        };

        walkScript(ctx.ast, (node, ancestors) => {
            if (inIgnoredContext(ancestors, ctx.config)) return;

            // new ShowToastEvent({ title: '...' }), Toast.show({ label: '...' }), LightningAlert.open({ message: '...' })
            const uiCall = matchUiCall(node, scope.imports, ctx.config);
            if (uiCall && node.arguments[0]?.type === 'ObjectExpression') {
                for (const prop of node.arguments[0].properties) {
                    const key = prop.type === 'ObjectProperty' ? keyName(prop) : null;
                    if (uiCall.keys.includes(key)) {
                        reportAll(prop.value, `${uiCall.sink} ${key}`, { sink: uiCall.sink, key });
                    }
                }
            }

            // { label: 'Name', fieldName: 'Name' }: datatable column, combobox option, tree item...
            if (node.type === 'ObjectProperty' && ctx.config.script.displayKeys.includes(keyName(node))) {
                reportAll(node.value, `${keyName(node)} of an object the UI displays`, { sink: 'display-key', key: keyName(node) });
            }

            // this.errorMessage = '...', this.error = { message: '...' }
            const field = node.type === 'AssignmentExpression' && ['=', '+='].includes(node.operator) ? thisPath(node.left) : null;
            if (field) {
                for (const { path, value } of fieldValues(field, node.right)) {
                    if (!scope.isShown(path)) continue;
                    const context = { sink: 'rendered-field', field: path, via: scope.shownBy(path) };
                    reportAll(value, `assigned to this.${path}, which the template shows`, context, node.operator === '+=');
                }
            }

            // greeting = 'World'; @api friendlyMessage = 'Error retrieving data';
            if (node.type === 'ClassProperty' && !node.static && keyName(node) && node.value) {
                const api = (node.decorators ?? []).some((d) => d.expression.type === 'Identifier' && d.expression.name === 'api');
                for (const { path, value } of fieldValues(keyName(node), node.value)) {
                    if (!scope.isShown(path)) continue;
                    const context = { sink: 'field-default', field: path, api, via: scope.shownBy(path) };
                    reportAll(value, `default of ${api ? '@api ' : ''}${path}, which the template shows`, context);
                }
            }

            // get title() { return 'New Contact'; } with {title} in the template
            const getter = node.type === 'ClassMethod' && node.kind === 'get' ? keyName(node) : null;
            if (getter && scope.isShown(getter)) {
                const context = { sink: 'getter', getter, via: scope.shownBy(getter) };
                for (const value of returnedValues(node)) {
                    reportAll(value, `returned by getter ${getter}, which the template shows`, context);
                }
            }

            // element.innerText = '...': text written straight into the DOM
            if (node.type === 'AssignmentExpression' && isDomTextTarget(node.left, ctx.config)) {
                const property = node.left.property.name;
                reportAll(node.right, `written to ${property}`, { sink: 'dom-text', property }, node.operator === '+=');
            }

            // this.reportError('Failed to load'), where reportError() shows its argument
            const method = node.type === 'CallExpression' ? thisPath(node.callee) : null;
            const target = method && scope.messageMethods.get(method);
            if (target && node.arguments[target.index]) {
                const context = { sink: 'method-argument', method, field: target.field };
                reportAll(node.arguments[target.index], `passed to ${method}(), which shows it in this.${target.field}`, context);
            }

            // `<h1>${name}</h1><p>Beds: ${beds}</p>` anywhere in the file
            if ((node.type === 'StringLiteral' || node.type === 'TemplateLiteral') && isHtmlWithText(node, ctx.config)) {
                report({ node, concatenated: isGlued(node, ancestors.at(-1)) }, 'HTML markup built in JS', { sink: 'html' });
            }
        });
        return [...found.values()];
    }
};

export default rule;

/**
 * Everything the sinks need to know about the file, computed once:
 * - imports and module-level string constants
 * - isShown(path): does the template display this field? Either the component's templates
 *   bind it ({greeting}, {error.message}, label={buttonLabel}), or, because we can't see every
 *   template (the field may be passed to <c-error-panel errors={error}>), its name says it is a
 *   message: errorMessage, successMsg, error, friendlyMessage. A field only used in class={...},
 *   lwc:if={...} or value={...} is not shown, which keeps CSS classes and input defaults out.
 * - messageMethods: methods that put their argument into a shown field (see below)
 */
function analyze(ctx) {
    const templates = ctx.componentTemplates ?? (ctx.templateAst ? [ctx.templateAst] : []);
    const rendered = new Set(templates.flatMap((ast) => [...renderedBindings(ast, ctx.config)]));
    const namePattern = ctx.config.script.messageFieldPattern;
    const shownBy = (path) => {
        if (!path) return null;
        if (rendered.has(path)) return 'template';
        return namePattern.test(path.split('.').at(-1)) ? 'name' : null;
    };
    const isShown = (path) => shownBy(path) !== null;
    return {
        imports: importsOf(ctx.ast),
        constants: topLevelConstants(ctx.ast),
        shownBy,
        isShown,
        messageMethods: findMessageMethods(ctx.ast, isShown)
    };
}

/**
 * Is `node` a call whose object argument the platform displays (config.script.uiCalls)?
 * Matches on the module the callee was imported from, so `import Alert from 'lightning/alert'`
 * works under any local name. Returns the matching uiCalls entry or null.
 */
function matchUiCall(node, imports, config) {
    let local = null;
    let call = null;
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier') {
        local = node.callee.name;
        call = 'new';
    } else if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed) {
        if (node.callee.object.type !== 'Identifier' || node.callee.property.type !== 'Identifier') return null;
        local = node.callee.object.name;
        call = node.callee.property.name;
    } else {
        return null;
    }
    const module = imports.get(local);
    if (!module) return null;
    return (
        config.script.uiCalls.find((entry) => {
            const sameModule = entry.module.endsWith('/*') ? module.startsWith(entry.module.slice(0, -1)) : module === entry.module;
            return sameModule && entry.call === call;
        }) ?? null
    );
}

/**
 * The (path, value) pairs a field assignment creates. For an object literal, each property
 * gets its own path, so `this.error = { message: 'x' }` is checked as "error.message",
 * matching what the template binds ({error.message}).
 */
function fieldValues(path, value) {
    if (value?.type !== 'ObjectExpression') return [{ path, value }];
    return value.properties
        .filter((prop) => prop.type === 'ObjectProperty' && keyName(prop))
        .flatMap((prop) => fieldValues(`${path}.${keyName(prop)}`, prop.value));
}

/** What a getter returns: the argument of each `return`, but not of returns in nested callbacks. */
function returnedValues(getter) {
    const values = [];
    walkScript(getter.body, (node, ancestors) => {
        if (node.type === 'ReturnStatement' && node.argument && !ancestors.some(isFunction)) values.push(node.argument);
    });
    return values;
}

/**
 * Methods that show their argument, e.g.
 *     reportError(baseMessage) {
 *         let message = baseMessage;
 *         if (this.error) message += ': ' + this.error.body.message;
 *         this.errorMessage = message;
 *     }
 * We follow the parameter through `let x = param`, `x = param + ...` and `x += ...` inside the
 * method, in source order, and record the method if a shown field receives it.
 * Returns Map(methodName -> { index: parameter position, field }).
 */
function findMessageMethods(ast, isShown) {
    const methods = new Map();
    walkScript(ast, (method) => {
        if (method.type !== 'ClassMethod' || method.kind !== 'method' || !keyName(method)) return;
        method.params.forEach((param, index) => {
            if (param.type !== 'Identifier' || methods.has(keyName(method))) return;
            const carriers = new Set([param.name]); // local variables that hold (part of) the argument
            walkScript(method.body, (node) => {
                if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && carriesVariable(node.init, carriers)) {
                    carriers.add(node.id.name);
                }
                if (node.type !== 'AssignmentExpression' || !carriesVariable(node.right, carriers)) return;
                if (node.left.type === 'Identifier') carriers.add(node.left.name);
                const field = thisPath(node.left);
                if (field && isShown(field) && !methods.has(keyName(method))) {
                    methods.set(keyName(method), { index, field });
                }
            });
        });
    });
    return methods;
}

/** Is this literal one piece of a bigger string: a template literal with ${...}, or an operand of +? */
function isGlued(node, parent) {
    if (node.type === 'TemplateLiteral') return node.expressions.length > 0;
    return parent?.type === 'BinaryExpression' && parent.operator === '+';
}

/** el.innerText, this.refs.title.textContent... (a property in config.script.domTextProperties). */
function isDomTextTarget(left, config) {
    return (
        left.type === 'MemberExpression' &&
        !left.computed &&
        left.property.type === 'Identifier' &&
        config.script.domTextProperties.includes(left.property.name)
    );
}

/**
 * Text a translator would need to see: the fixed part (without ${...}, HTML tags and entities)
 * has letters and isn't shaped like code. So '<b>' or `${first} ${last}` is not text.
 */
function isUiText(node, config) {
    const words = withoutMarkup(staticText(node), config);
    if (!hasLetters(words)) return false;
    return !looksLikeCode(words, [...config.codeLikePatterns, ...config.script.codeLikePatterns]);
}

/** A string with HTML tags and words outside them: '<p>No results</p>' yes, '<br/>' or '<div class="x">' no. */
function isHtmlWithText(node, config) {
    const fixed = staticText(node);
    return htmlTag(config).test(fixed) && hasLetters(withoutMarkup(fixed, config));
}

/** Removes HTML tags and entities such as &nbsp; (so "nbsp" isn't a word). */
function withoutMarkup(text, config) {
    return text.replace(htmlTag(config, 'g'), ' ').replace(/&#?\w+;/g, ' ');
}

/** Matches an opening or closing tag from config.script.htmlTags: <p>, </b>, <a href="...">. */
function htmlTag(config, flags = '') {
    return new RegExp(`</?(?:${config.script.htmlTags.join('|')})\\b[^>]*>`, `i${flags}`);
}

/** One actionable sentence: concatenated text needs a placeholder label, plain text just a label. */
function messageFor(text, where, concatenated) {
    const quoted = `"${shorten(text)}"`;
    if (concatenated) {
        return `Replace ${quoted} (${where}) with one Custom Label that has {0} placeholders, so translators see the whole sentence.`;
    }
    return `Move ${quoted} (${where}) into a Custom Label and import it via @salesforce/label.`;
}
