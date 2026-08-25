#!/usr/bin/env node
import { buildCatalogTourSteps } from '../lib/catalogoTour.mjs';

function checkSkin(skin) {
  const steps = buildCatalogTourSteps({ skin, qtyLabelPl: 'paletes' });
  const ids = steps.map((s) => s.id);
  const welcomeOk = skin === 'arielle'
    ? steps[0].title.includes('Arielle')
    : steps[0].title.includes('Formigres');
  const linhaOk = skin === 'arielle'
    ? steps.find((s) => s.id === 'catalogo')?.text.includes('Bold e Retificada')
    : steps.find((s) => s.id === 'catalogo')?.text.includes('Bold, Retificada e Polida');
  const groupOk = skin === 'formigres'
    ? steps.find((s) => s.id === 'group')?.text.includes('Polida')
    : steps.find((s) => s.id === 'group')?.text.includes('Bold/Retificada');
  return {
    skin,
    ok: steps.length >= 5 && steps.length <= 8
      && steps[0].center === true
      && steps.some((s) => s.selector === '#search' || s.selectorDesktop)
      && welcomeOk
      && linhaOk
      && groupOk,
    steps: steps.length,
    ids,
  };
}

const formigres = checkSkin('formigres');
const arielle = checkSkin('arielle');
const ok = formigres.ok && arielle.ok;

console.log(JSON.stringify({ ok, formigres, arielle }, null, 2));
process.exit(ok ? 0 : 1);
