// Parsing and walking LWC JavaScript with @babel/parser.
import { parse } from '@babel/parser';
import { positionAt, skipWhitespace } from './text.js';

/**
 * LWC files are ES modules with decorators (@api, @wire, @track). Decorators are not plain
 * JavaScript yet, so the parser needs the 'decorators' plugin; class fields, optional chaining
 * and top-level await are on by default in Babel 8. With these options every non-test .js file
 * in lwc-recipes parses (without the plugin, about half of them fail on the first @api).
 */
export function parseScript(source) {
    return parse(source, { sourceType: 'module', plugins: ['decorators'] });
}

// Keys on Babel nodes that hold metadata rather than child nodes.
const NOT_CHILDREN = new Set(['loc', 'extra', 'errors', 'comments', 'leadingComments', 'trailingComments', 'innerComments']);

const isNode = (value) => value !== null && typeof value === 'object' && typeof value.type === 'string';

/**
 * Depth-first walk that calls visit(node, ancestors) on every AST node, in source order.
 * `ancestors` runs from the root down to the node's parent, so a rule can ask
 * "is this string inside console.log()?" without a separate parent map.
 * The array is reused during the walk: copy it if you need to keep it.
 * (A tiny replacement for @babel/traverse, which we don't need.)
 */
export function walkScript(node, visit, ancestors = []) {
    visit(node, ancestors);
    ancestors.push(node);
    for (const [key, value] of Object.entries(node)) {
        if (NOT_CHILDREN.has(key)) continue;
        if (Array.isArray(value)) {
            for (const child of value) if (isNode(child)) walkScript(child, visit, ancestors);
        } else if (isNode(value)) {
            walkScript(value, visit, ancestors);
        }
    }
    ancestors.pop();
}

/** Local name -> module it was imported from: { ShowToastEvent: 'lightning/platformShowToastEvent' }. */
export function importsOf(ast) {
    const imports = new Map();
    for (const statement of ast.program.body) {
        if (statement.type !== 'ImportDeclaration') continue;
        for (const specifier of statement.specifiers) imports.set(specifier.local.name, statement.source.value);
    }
    return imports;
}

/**
 * Module-level `const NAME = 'text'` declarations: { NAME: <the literal node> }.
 * Lets a rule see through `label: TAB_LABEL` to the string. Only top-level consts, because they
 * can't be reassigned and are rarely shadowed; tracking `let` or locals would need real data-flow.
 */
export function topLevelConstants(ast) {
    const constants = new Map();
    for (let statement of ast.program.body) {
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) statement = statement.declaration;
        if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') continue;
        for (const declarator of statement.declarations) {
            const init = declarator.init;
            if (declarator.id.type === 'Identifier' && (init?.type === 'StringLiteral' || init?.type === 'TemplateLiteral')) {
                constants.set(declarator.id.name, init);
            }
        }
    }
    return constants;
}

/** Name of a non-computed object key or class member: `label: x`, `'label': x`, `get label()`. */
export function keyName(node) {
    if (node.computed) return null;
    if (node.key?.type === 'Identifier') return node.key.name;
    if (node.key?.type === 'StringLiteral') return node.key.value;
    return null;
}

/** For `this.x` returns "x", for `this.error.message` returns "error.message"; otherwise null. */
export function thisPath(node) {
    if (node?.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier') return null;
    if (node.object.type === 'ThisExpression') return node.property.name;
    const parent = thisPath(node.object);
    return parent ? `${parent}.${node.property.name}` : null;
}

/** Name of the method called: `a.b.querySelector(x)` -> "querySelector", `foo(x)` -> "foo". */
export function calleeName(callee) {
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
        return callee.property.name;
    }
    return null;
}

/**
 * The string literals whose text ends up in the value of `expr`.
 * - 'a' + b + 'c' gives 'a' and 'c' (each reported separately, as the contract says)
 * - cond ? 'a' : 'b' and x || 'a' give every branch; ['a', 'b'] gives every element
 * - a template literal is one piece, ${...} included
 * - NAME gives the literal of a module-level `const NAME = '...'` (from topLevelConstants)
 * `concatenated` is true when a piece is glued to other values: a sentence assembled
 * from pieces can't be translated as a whole, which is worth telling the engineer.
 */
export function stringPieces(expr, constants = new Map(), concatenated = false) {
    switch (expr?.type) {
        case 'StringLiteral':
            return [{ node: expr, concatenated }];
        case 'TemplateLiteral':
            return [{ node: expr, concatenated: concatenated || expr.expressions.length > 0 }];
        case 'Identifier':
            return constants.has(expr.name) ? stringPieces(constants.get(expr.name), constants, concatenated) : [];
        case 'BinaryExpression':
            if (expr.operator !== '+') return [];
            return [...stringPieces(expr.left, constants, true), ...stringPieces(expr.right, constants, true)];
        case 'ConditionalExpression':
            return [...stringPieces(expr.consequent, constants, concatenated), ...stringPieces(expr.alternate, constants, concatenated)];
        case 'LogicalExpression':
            return [...stringPieces(expr.left, constants, concatenated), ...stringPieces(expr.right, constants, concatenated)];
        case 'ArrayExpression':
            return expr.elements.flatMap((element) => stringPieces(element, constants, concatenated));
        default:
            return [];
    }
}

/** Does the value of `expr` contain one of the variables in `names` (directly, concatenated or in ${})? */
export function carriesVariable(expr, names) {
    switch (expr?.type) {
        case 'Identifier':
            return names.has(expr.name);
        case 'TemplateLiteral':
            return expr.expressions.some((e) => carriesVariable(e, names));
        case 'BinaryExpression':
            return expr.operator === '+' && (carriesVariable(expr.left, names) || carriesVariable(expr.right, names));
        case 'ConditionalExpression':
            return carriesVariable(expr.consequent, names) || carriesVariable(expr.alternate, names);
        case 'LogicalExpression':
            return carriesVariable(expr.left, names) || carriesVariable(expr.right, names);
        default:
            return false;
    }
}

/**
 * A literal's content without quotes. For template literals we cut the source between the
 * backticks, so `${value}` stays exactly as written (the contract's text unit).
 */
export function literalText(node, source) {
    if (node.type === 'TemplateLiteral') return source.slice(node.start + 1, node.end - 1);
    return node.value;
}

/**
 * The fixed part of a literal, the same for every user: a template literal without its ${...}.
 * Rules test this part for letters, so `${firstName} ${lastName}` has nothing to translate.
 */
export function staticText(node) {
    if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(' ');
    return node.value;
}

/** Line/column of a literal's first non-whitespace character (after the opening quote). */
export function literalPosition(node, source) {
    return positionAt(source, skipWhitespace(source, node.start + 1, node.end - 1));
}

/**
 * Strings in these places are code, not UI: import paths, decorator arguments (@wire configs),
 * console.* output, DOM selectors, and tagged templates such as gql`...`.
 */
export function inIgnoredContext(ancestors, config) {
    return ancestors.some((node) => {
        if (node.type === 'ImportDeclaration' || node.type === 'Decorator') return true;
        if (node.type === 'TaggedTemplateExpression') return true;
        if (node.type !== 'CallExpression') return false;
        const callee = node.callee;
        if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'console') {
            return true;
        }
        return config.script.ignoredCallees.includes(calleeName(callee));
    });
}

const FUNCTION_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ClassMethod',
    'ClassPrivateMethod',
    'ObjectMethod'
]);

export const isFunction = (node) => FUNCTION_TYPES.has(node.type);
