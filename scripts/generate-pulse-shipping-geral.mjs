#!/usr/bin/env node
/**
 * Gera docs/pulse/shipping-geral.json a partir de sensors-geral.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SENSORS_IN = path.join(ROOT, 'docs/pulse/sensors-geral.json');
const OUT = path.join(ROOT, 'docs/pulse/shipping-geral.json');

/** Roteiros dry run completos (substituem geração automática). */
const SHIPPING_OVERRIDES = {
  PedidosCompra: [
    { action: 'wait', sensor: 'PedidosCompra.shell', state: 'attached', label: 'Lista pedidos' },
    { action: 'click', sensor: 'pedidos-compra.novo-pedido', label: 'FAB novo pedido' },
    { action: 'wait_url', pattern: 'PedidoCompraDetalhe', label: 'Navegou para detalhe' },
    { action: 'wait', sensor: 'pedidos-compra.detalhe-titulo', label: 'Formulário novo' },
    { action: 'click', sensor: 'pedidos-compra.detalhe-voltar', label: 'Voltar sem gravar' },
    { action: 'wait', sensor: 'PedidosCompra.shell', state: 'attached', label: 'Voltou à lista' },
  ],
  FluxoCaixa: [
    { action: 'wait', sensor: 'FluxoCaixa.shell', state: 'attached', label: 'Shell financeiro' },
    { action: 'wait', sensor: 'fluxo-caixa.titulo', label: 'Título visível' },
    { action: 'click', sensor: 'fluxo-caixa.fab', label: 'Abrir FAB' },
    { action: 'click_text', text: 'Despesa', label: 'Escolher Despesa' },
    { action: 'wait', sensor: 'fluxo-caixa.novo-cancelar', label: 'Dialog novo lançamento' },
    { action: 'click', sensor: 'fluxo-caixa.novo-cancelar', label: 'Cancelar sem gravar' },
  ],
  PDV: [
    { action: 'wait', sensor: 'PDV.shell', state: 'attached', label: 'Shell PDV' },
    { action: 'wait', sensor: 'pdv.busca-produto', label: 'Campo busca' },
    { action: 'fill', sensor: 'pdv.busca-produto', value: 'a', label: 'Digitar busca' },
    { action: 'sleep', ms: 800, label: 'Aguardar sugestões' },
    { action: 'press', key: 'Escape', label: 'Fechar sugestões' },
    { action: 'fill', sensor: 'pdv.busca-produto', value: '', label: 'Limpar busca' },
    { action: 'wait', sensor: 'pdv.scanner-codigo', label: 'Scanner presente' },
  ],
  PDVVendedor: [
    { action: 'wait', sensor: 'PDVVendedor.shell', state: 'attached', label: 'Shell PDV vendedor' },
    { action: 'wait', sensor: 'pdv.busca-produto', label: 'Campo busca' },
    { action: 'fill', sensor: 'pdv.busca-produto', value: 'a', label: 'Digitar busca' },
    { action: 'fill', sensor: 'pdv.busca-produto', value: '', label: 'Limpar busca' },
  ],
};

const FILL_DRY = /\.(busca|codigo-pedido|busca-produto|busca-cliente|busca-pedido)/;
const CLICK_SAFE = /\.(atualizar|tab-consulta|tab-embarques|tab-sugestoes|tab-vendas|tab-contas|tab-mix|tab-codigos|tab-separacao|tab-produtos|tab-geral|modo-fluvial)/;

function shipmentId(screen) {
  if (screen.pageName === 'PDV') return 'pdv-vendedor';
  return screen.pageName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function buildSteps(screen) {
  if (SHIPPING_OVERRIDES[screen.pageName]) {
    return SHIPPING_OVERRIDES[screen.pageName];
  }

  const steps = [];
  const shell = screen.sensors.find((s) => s.id.endsWith('.shell'));
  if (shell) {
    steps.push({ action: 'wait', sensor: shell.id, state: 'attached', label: 'Shell página' });
  }

  for (const sensor of screen.sensors) {
    if (sensor.id.endsWith('.shell')) continue;

    const { id, label, type } = sensor;

    if (type === 'click' && CLICK_SAFE.test(id)) {
      steps.push({ action: 'click', sensor: id, label });
      continue;
    }

    if (FILL_DRY.test(id)) {
      steps.push({ action: 'wait', sensor: id, label });
      steps.push({ action: 'fill', sensor: id, value: 'a', label: `${label} — digitar (dry)` });
      steps.push({ action: 'fill', sensor: id, value: '', label: `${label} — limpar` });
      continue;
    }

    if (id.includes('atualizar')) {
      steps.push({ action: 'wait', sensor: id, label });
      steps.push({ action: 'click', sensor: id, label: `${label} (dry)` });
      continue;
    }

    steps.push({ action: 'wait', sensor: id, label });
  }

  return steps;
}

function main() {
  if (!fs.existsSync(SENSORS_IN)) {
    throw new Error(`Corra primeiro: npm run pulse:generate-sensors (${SENSORS_IN} em falta)`);
  }

  const { screens } = JSON.parse(fs.readFileSync(SENSORS_IN, 'utf8'));
  const shipments = screens.map((screen) => ({
    id: shipmentId(screen),
    label: screen.label,
    pageName: screen.pageName,
    module: screen.module || null,
    route: screen.route,
    warmupMs: screen.warmupMs ?? 6000,
    steps: buildSteps(screen),
  }));

  const manifest = {
    version: '1.0',
    description: 'Shipping geral — dry run dos 36 ecrãs (gerado a partir de sensors-geral.json).',
    shipments,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[pulse:generate-shipping] ${shipments.length} processos → ${OUT}`);
}

main();
