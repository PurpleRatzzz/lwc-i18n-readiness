// R5 hardcoded-locale — owner: scanner agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R5',
    name: 'hardcoded-locale',
    kinds: ['template', 'script'],
    severity: 'error',
    description: 'Currency or locale is hardcoded (currency-code="USD", Intl/toLocale* with a literal locale).',
    check(_ctx) {
        return [];
    }
};
