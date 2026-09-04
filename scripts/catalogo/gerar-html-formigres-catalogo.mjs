#!/usr/bin/env node
/**
 * Gera HTML do catálogo completo Formigres (demonstração P38).
 * npm run catalogo:html-formigres
 */
process.argv.push('--modo', 'formigres');
const { main } = await import('./gerar-html-tintao-catalogo.mjs');
main();
