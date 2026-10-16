// The output formats of `lwc-i18n scan --format <name>`.
import { formatText } from './text.js';
import { formatJson } from './json.js';
import { formatGithub } from './github.js';
import { formatMarkdown } from './markdown.js';

export const formatters = {
    text: formatText,
    json: formatJson,
    github: formatGithub,
    markdown: formatMarkdown
};
