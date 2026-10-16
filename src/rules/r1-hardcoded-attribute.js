// R1 hardcoded-attribute — owner: scanner agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R1',
    name: 'hardcoded-attribute',
    kinds: ['template'],
    severity: 'error',
    description: 'User-facing attribute (label, title, placeholder, alternative-text...) has a literal value instead of a Custom Label.',
    check(_ctx) {
        return [];
    }
};
