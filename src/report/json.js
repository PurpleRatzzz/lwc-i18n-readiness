// Machine-readable output: { findings: [...] }, each finding with every Finding field plus
// `fingerprint` (its baseline identity) and `isNew`. The eval scripts and other tools read this.

export function formatJson(findings) {
    return JSON.stringify({ findings }, null, 2) + '\n';
}
