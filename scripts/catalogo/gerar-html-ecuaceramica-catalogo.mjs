#!/usr/bin/env node
/**
 * Gera HTML do catálogo Ecuaceramica — portfolio white-label P38.
 * npm run catalogo:html-ecuaceramica
 */
process.argv.push('--modo', 'ecuaceramica');
const { main } = await import('./gerar-html-tintao-catalogo.mjs');
main();
