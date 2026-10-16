// R6 label-context — owner: labels agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R6',
    name: 'label-context',
    kinds: ['labels'],
    severity: 'warning',
    description: 'Custom Label lacks translator context: description repeats the value, no ui: category, unexplained {0} placeholders.',
    check(_ctx) {
        return [];
    }
};
