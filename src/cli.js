#!/usr/bin/env node
// Entry point: `lwc-i18n <command> [options]`. Each command lives in src/commands/<name>.js
// and exports `run(argv) -> Promise<exitCode>`. Commands are loaded lazily so `scan`
// doesn't pay for the XML/XLIFF code and vice versa.

const commands = {
    scan: () => import('./commands/scan.js'),
    pseudo: () => import('./commands/pseudo.js'),
    'xliff-export': () => import('./commands/xliff-export.js'),
    'xliff-import': () => import('./commands/xliff-import.js'),
    translate: () => import('./commands/translate.js')
};

const [name, ...argv] = process.argv.slice(2);

if (!name || !commands[name]) {
    console.error(`Usage: lwc-i18n <${Object.keys(commands).join('|')}> [options]`);
    process.exit(2);
}

const { run } = await commands[name]();
process.exitCode = await run(argv);
