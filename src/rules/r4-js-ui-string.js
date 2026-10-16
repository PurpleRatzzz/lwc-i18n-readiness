// R4 js-ui-string — owner: scanner agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R4',
    name: 'js-ui-string',
    kinds: ['script'],
    severity: 'error',
    description: 'String literal or concatenated/template string in JS reaches the UI (toast, error message, rendered getter).',
    check(_ctx) {
        return [];
    }
};
