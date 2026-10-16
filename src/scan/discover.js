// Finds the files the rules care about under a scan root.
import { readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Which kind of rule input a file is, from its path (see the file-kind table in docs/ARCHITECTURE.md):
 * - template: any .html under lwc/<c>/, including subfolders like lwc/errorPanel/templates/
 * - script:   a .js directly in lwc/<c>/ that is not a Jest test
 * - labels:   labels/*.labels-meta.xml
 * Returns { kind, component, componentDir } or null for files we don't scan.
 * (__tests__ folders never get here: discoverFiles doesn't enter them.)
 */
export function classify(absPath) {
    const parts = absPath.split(sep);
    const name = parts.at(-1);
    if (parts.at(-2) === 'labels' && name.endsWith('.labels-meta.xml')) {
        return { kind: 'labels', component: null, componentDir: null };
    }

    // The last "lwc" folder in the path is the one that holds the components.
    const lwcIndex = parts.lastIndexOf('lwc');
    if (lwcIndex === -1) return null;
    const depth = parts.length - lwcIndex - 2; // 1 = directly in lwc/<c>/, 2+ = in a subfolder of it
    if (depth < 1) return null; // files directly in lwc/, such as jsconfig.json

    const component = parts[lwcIndex + 1];
    const componentDir = parts.slice(0, lwcIndex + 2).join(sep);
    if (name.endsWith('.html')) return { kind: 'template', component, componentDir };
    if (depth === 1 && name.endsWith('.js') && !name.endsWith('.test.js')) return { kind: 'script', component, componentDir };
    return null;
}

/**
 * Walks `root` and returns [{ kind, component, componentDir, absPath, file }], where `file` is
 * relative to the root with forward slashes (so findings and baselines look the same on Windows).
 * Directories are visited in sorted order so the output is stable from run to run.
 */
export function discoverFiles(root, config) {
    const absRoot = resolve(root);
    const files = [];
    const visit = (dir) => {
        const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
        for (const entry of entries) {
            const absPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || config.excludeDirs.includes(entry.name)) continue;
                visit(absPath);
            } else if (entry.isFile()) {
                const kind = classify(absPath);
                if (kind) files.push({ ...kind, absPath, file: relative(absRoot, absPath).split(sep).join('/') });
            }
        }
    };
    visit(absRoot);
    return files;
}
