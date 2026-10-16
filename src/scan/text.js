// Small text and position helpers shared by the template and script rules.

// \p{L} is any Unicode letter, so "Größe" or "日本語" count as text, while "100", "—" or "×" don't.
const LETTER = /\p{L}/u;

export function hasLetters(text) {
    return LETTER.test(text);
}

/**
 * Is this string code rather than words (a URL, a CSS class, an API name...)?
 * `patterns` comes from the config, so each project can add its own shapes.
 */
export function looksLikeCode(text, patterns) {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    return patterns.some((pattern) => pattern.test(flat));
}

/** Shortens a string for use inside a one-line message. */
export function shorten(text, max = 60) {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Converts a 0-based character offset into the 1-based line and column of the Finding contract.
 * Parsers give us offsets; computing line/column ourselves keeps template and JS findings consistent.
 */
export function positionAt(source, offset) {
    const before = source.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    return { line, column };
}

// Whitespace as it can appear in source. In templates `&nbsp;` is written as an entity but
// parse5 decodes it to a space, and normalizeText then trims it away, so it counts as whitespace too.
const LEADING_SPACE = /^(?:\s|&nbsp;|&#160;|&#x[aA]0;)+/;

/**
 * Offset of the first non-whitespace character in source[offset, end).
 * The contract points findings at the text itself, not at the newline and indentation
 * Prettier puts in front of it. If the range is all whitespace, `offset` is returned unchanged.
 */
export function skipWhitespace(source, offset, end = source.length) {
    const lead = source.slice(offset, end).match(LEADING_SPACE);
    const skipped = lead ? lead[0].length : 0;
    return offset + skipped < end ? offset + skipped : offset;
}
