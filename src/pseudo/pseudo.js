// Pseudo-localization: turn "Save" into "[Šåvé ~~~~ ]" so a tester can spot, without knowing
// any foreign language,
//   - hardcoded text: anything still in plain English was never externalized;
//   - truncation: if the closing "]" is cut off, the UI has no room for a longer translation;
//   - encoding problems: accented letters that turn into "?" or mojibake.
// It is deterministic (no randomness), so the same input always gives the same output and
// the generated files can be committed and diffed.

/*
 * How much longer translated text gets, by length of the English source.
 * Source: IBM Globalization, "Guideline A3: Providing for UI expansion", table
 * "Additional Physical Space Required" (archived copy, the original page is gone):
 * http://web.archive.org/web/20180928123818/http://www-01.ibm.com/software/globalization/guidelines/a3.html
 *   Up to 10 chars: 100% to 200%   | 11 to 20: 80% to 100% | 21 to 30: 60% to 80%
 *   31 to 50: 40% to 60%           | 51 to 70: 31% to 40%  | over 70: 30%
 * IBM counts spaces and punctuation as characters. We take the upper bound of each range:
 * pseudo-localization is a stress test, and the upper bound is the room IBM says to leave.
 * (W3C's article "Text size in translation" reprints this table as total length, 200-300%
 * and so on, but its 51-70 row reads "151-170%", which looks like a typo for 131-140%.)
 */
export const EXPANSION_TIERS = [
    { maxChars: 10, extra: 2.0 },
    { maxChars: 20, extra: 1.0 },
    { maxChars: 30, extra: 0.8 },
    { maxChars: 50, extra: 0.6 },
    { maxChars: 70, extra: 0.4 },
    { maxChars: Infinity, extra: 0.3 }
];

// Accented look-alikes, one precomposed code point each, so the string length doesn't change
// and the text stays readable. Letters without a common look-alike (b, f, m, p, q, v, x) stay.
const ACCENTS = {
    a: 'å', c: 'ç', d: 'ð', e: 'é', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', n: 'ñ', o: 'ö',
    r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', w: 'ŵ', y: 'ý', z: 'ž',
    A: 'Å', C: 'Ç', D: 'Ð', E: 'É', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', N: 'Ñ', O: 'Ö',
    R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', W: 'Ŵ', Y: 'Ý', Z: 'Ž'
};

/*
 * Parts of a string that are code, not text, and must come through unchanged:
 *   {0} {1} and other {...} placeholders (also Salesforce merge fields like {!Name})
 *   HTML/XML tags: <b>, </b>, <br/>, <a href="...">
 *   entities: &amp; &#169; &#x4E2D;
 *   printf-style tokens: %s %d %1$s
 */
const PROTECTED = /\{[^{}]*\}|<\/?[A-Za-z][^<>]*>|&(?:[A-Za-z]+|#\d+|#x[0-9A-Fa-f]+);|%(?:\d+\$)?[sdif]/g;

// Padding: tildes are obviously not real text; a space every few characters lets long
// strings wrap at a space the way a real translation would, instead of one unbreakable run.
const PADDING_UNIT = ' ~~~~';

/** The `extra` growth factor for a source text of `length` translatable characters. */
export function expansionFor(length) {
    return EXPANSION_TIERS.find((tier) => length <= tier.maxChars).extra;
}

/**
 * Pseudo-localize one string: accent the letters, then wrap in [ ] and pad so the visible
 * length is the source length plus the IBM expansion. The brackets count as part of the
 * expansion, since they take up room in the UI just like longer words would.
 */
export function pseudoLocalize(source) {
    let accented = '';
    let textLength = 0; // characters that would be translated, so placeholders and tags don't count
    let last = 0;
    for (const match of source.matchAll(PROTECTED)) {
        const text = source.slice(last, match.index);
        accented += accent(text) + match[0];
        textLength += text.length;
        last = match.index + match[0].length;
    }
    const rest = source.slice(last);
    accented += accent(rest);
    textLength += rest.length;

    const extraChars = Math.ceil(textLength * expansionFor(textLength));
    const padLength = Math.max(0, extraChars - 2); // 2 = the brackets
    return `[${accented}${padding(padLength)}]`;
}

function accent(text) {
    return [...text].map((ch) => ACCENTS[ch] ?? ch).join('');
}

function padding(length) {
    const pad = PADDING_UNIT.repeat(Math.ceil(length / PADDING_UNIT.length)).slice(0, length);
    // A space right before "]" would look like the end of the text; end on a tilde instead.
    return pad.replace(/ $/, '~');
}
