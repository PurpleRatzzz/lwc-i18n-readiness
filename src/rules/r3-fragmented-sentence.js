// R3 fragmented-sentence — owner: scanner agent. Stub until implemented; see docs/ARCHITECTURE.md for the rule contract.
export default {
    id: 'R3',
    name: 'fragmented-sentence',
    kinds: ['template'],
    severity: 'error',
    description: 'One sentence is split by {expressions} or inline elements, so translators cannot reorder it; includes number+noun plurals.',
    check(_ctx) {
        return [];
    }
};
