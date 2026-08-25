#!/usr/bin/env node
import { buildCatalogTourSteps } from '../lib/catalogoTour.mjs';

function checkSkin(skin, { qtyLabelPl = 'paletes', expectRegime = true } = {}) {
  const steps = buildCatalogTourSteps({ skin, qtyLabelPl });
  const ids = steps.map((s) => s.id);
  const isTintao = skin === 'tintao' || skin === 'default';
  const welcomeOk = skin === 'arielle'
    ? steps[0].title.includes('Arielle')
    : (isTintao
      ? steps[0].title.includes('pedido Formigres')
      : steps[0].title.includes('Formigres'));
  const linhaOk = skin === 'arielle'
    ? steps.find((s) => s.id === 'catalogo')?.text.includes('Bold e Retificada')
    : (isTintao
      ? steps.find((s) => s.id === 'catalogo')?.text.includes('m²/cx')
      : steps.find((s) => s.id === 'catalogo')?.text.includes('Bold, Retificada e Polida'));
  const groupOk = skin === 'formigres'
    ? steps.find((s) => s.id === 'group')?.text.includes('Polida')
    : (isTintao
      ? steps.find((s) => s.id === 'group')?.text.includes('Bold, Retificada')
      : steps.find((s) => s.id === 'group')?.text.includes('Bold/Retificada'));
  const hasRegimeEdit = steps.some((s) => s.id === 'regime-edit' && s.prepare === 'regimeDialog');
  const hasPdf = steps.some((s) => s.id === 'pdf' && s.selector === '#pdf-pedido-panel');
  const hasEnviar = steps.some((s) => s.id === 'enviar' && (
    isTintao ? /vendedor/i.test(s.text || '') : /representante/i.test(s.text || '')
  ));
  const cartText = steps.find((s) => s.id === 'cart')?.text || '';
  const cartOk = isTintao
    ? cartText.includes('m²/cx') && !/peso/i.test(cartText)
    : /peso/i.test(cartText);
  const regimeOk = expectRegime ? hasRegimeEdit : !steps.some((s) => s.id === 'regime');
  return {
    skin,
    ok: steps.length >= (expectRegime ? 8 : 7) && steps.length <= 14
      && steps[0].center === true
      && steps.some((s) => s.selector === '#search' || s.selectorDesktop)
      && welcomeOk
      && linhaOk
      && groupOk
      && regimeOk
      && hasPdf
      && hasEnviar
      && cartOk
      && steps.some((s) => s.id === 'cart' && s.selector === '#cart-fab'),
    steps: steps.length,
    ids,
  };
}

const formigres = checkSkin('formigres');
const arielle = checkSkin('arielle');
const tintao = checkSkin('tintao', { qtyLabelPl: 'caixas', expectRegime: false });
const ok = formigres.ok && arielle.ok && tintao.ok;

console.log(JSON.stringify({ ok, formigres, arielle, tintao }, null, 2));
process.exit(ok ? 0 : 1);
