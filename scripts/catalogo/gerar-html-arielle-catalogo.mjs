#!/usr/bin/env node
/**
 * Gera HTML do catálogo Arielle (Carmelo Fior) — template Formigres.
 * npm run catalogo:html-arielle
 */
process.argv.push('--modo', 'arielle');
const { main } = await import('./gerar-html-tintao-catalogo.mjs');
main();
