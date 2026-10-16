// R2 hardcoded-text — owner: scanner agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R2',
    name: 'hardcoded-text',
    kinds: ['template'],
    severity: 'error',
    description: 'Template text node contains literal user-facing text.',
    check(_ctx) {
        return [];
    }
};
