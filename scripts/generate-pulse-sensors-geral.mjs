#!/usr/bin/env node
/**
 * Gera docs/pulse/sensors-geral.json a partir dos lotes de rotas + mapa de controlos.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/pulse/sensors-geral.json');

/** Controlos críticos por pageName (além do .shell automático em P38LazyPage). */
const CONTROLS = {
  Home: { id: 'home.personalizar', label: 'Personalizar atalhos' },
  Compras: { id: 'compras.tab-sugestoes', label: 'Aba sugestões' },
  Estoque: { id: 'estoque.link-contagem', label: 'Atalho contagem express' },
  Configuracoes: { id: 'configuracoes.tab-vendas', label: 'Aba vendas' },
  PlanejamentoFinanceiro: { id: 'planejamento-financeiro.tab-contas', label: 'Aba contas' },
  PDVVendedor: { id: 'pdv.busca-produto', label: 'Busca produto' },
  PDVCaixa: { id: 'pdv-caixa.titulo', label: 'Título caixa' },
  AutoAtendimento: { id: 'auto-atendimento.iniciar', label: 'Iniciar' },
  TurnosFechados: { id: 'turnos-fechados.busca', label: 'Busca' },
  VendasGestao: { id: 'vendas-gestao.busca', label: 'Busca' },
  VendasPerdidas: { id: 'vendas-perdidas.tab-mix', label: 'Aba mix' },
  ControleEntregas: { id: 'controle-entregas.busca-cliente', label: 'Busca cliente' },
  DevolucaoTroca: { id: 'devolucao-troca.busca-pedido', label: 'Busca pedido' },
  SugestoesCompra: { id: 'sugestoes-compra.busca', label: 'Busca' },
  Cotacoes: { id: 'cotacoes.busca', label: 'Busca' },
  ConferenciaEntrada: { id: 'conferencia-entrada.tab-codigos', label: 'Aba códigos' },
  ConferenciaEstoque: { id: 'conferencia-estoque.nova', label: 'Nova conferência' },
  Armazenagem: { id: 'armazenagem.tab-separacao', label: 'Aba separação' },
  InterfaceSeparador: { id: 'interface-separador.codigo-pedido', label: 'Código pedido' },
  ItinerarioFluvial: { id: 'itinerario-fluvial.modo-fluvial', label: 'Modo fluvial' },
  Expedicao: { id: 'expedicao.titulo', label: 'Título expedição' },
  ImportacaoProdutos: { id: 'importacao-produtos.tab-produtos', label: 'Aba produtos' },
  FluxoCaixa: { id: 'fluxo-caixa.titulo', label: 'Título financeiro' },
  ContasFinanceiras: { id: 'contas-financeiras.busca', label: 'Busca' },
  AprovacoesFinanceiras: { id: 'aprovacoes-financeiras.aprovar-lote', label: 'Aprovar lote' },
  CaixasAtivos: { id: 'caixas-ativos.atualizar', label: 'Atualizar' },
  SuperAgefin: { id: 'agefin.titulo', label: 'Título Agefin' },
  ExtratoConta: { id: 'extrato-conta.voltar', label: 'Voltar (sem conta)' },
  Dashboard: { id: 'dashboard.tab-geral', label: 'Aba geral' },
  PainelGerente: { id: 'painel-gerente.busca-cliente', label: 'Busca cliente' },
  Produtos: { id: 'produtos.busca', label: 'Busca catálogo' },
  Relatorios: { id: 'relatorios.tab-vendas', label: 'Aba vendas' },
  RelatorioMargem: { id: 'relatorio-margem.busca', label: 'Busca' },
  RelatorioPerformance: { id: 'relatorio-performance.pdf', label: 'Exportar PDF' },
};

const DETAILED = {
  PedidosCompra: [
    { id: 'pedidos-compra.tab-embarques', type: 'presence', label: 'Aba embarques' },
    { id: 'pedidos-compra.tab-consulta', type: 'click', label: 'Aba consulta', expectVisible: 'pedidos-compra.tab-consulta' },
    { id: 'pedidos-compra.novo-pedido', type: 'click', label: 'FAB novo pedido' },
  ],
  PDV: null,
};

const PDV_SENSORS = {
  route: '/PDV?mode=vendedor',
  label: 'PDV vendedor',
  pageName: 'PDV',
  sensors: [
    { id: 'PDV.shell', type: 'attached', label: 'Shell página' },
    { id: 'pdv.busca-produto', type: 'presence', label: 'Busca produto' },
    { id: 'pdv.scanner-codigo', type: 'presence', label: 'Scanner' },
  ],
};

const SKIP = new Set(['Financeiro', 'Agefin', 'PDV']);

function loadRoutes(batch) {
  const file = path.join(ROOT, 'docs/pulse', `routes-${batch}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).routes;
}

function screenFromRoute(route) {
  const pageName = route.pageName;
  if (!pageName || SKIP.has(pageName)) return null;

  const sensors = [{ id: `${pageName}.shell`, type: 'attached', label: 'Shell página' }];

  if (DETAILED[pageName]) {
    sensors.push(...DETAILED[pageName]);
  } else if (CONTROLS[pageName]) {
    const c = CONTROLS[pageName];
    sensors.push({ id: c.id, type: c.type || 'presence', label: c.label });
  }

  return {
    route: route.path,
    label: route.label || pageName,
    pageName,
    module: route.module || null,
    warmupMs: 8000,
    sensors,
  };
}

const screens = [];
for (const batch of ['lote1', 'lote2']) {
  for (const route of loadRoutes(batch)) {
    const screen = screenFromRoute(route);
    if (screen) screens.push(screen);
  }
}

screens.push({ ...PDV_SENSORS, warmupMs: 8000 });

const agefinRoute = loadRoutes('lote2').find((r) => r.pageName === 'Agefin');
if (agefinRoute) {
  screens.push({
    route: '/SuperAgefin',
    label: 'SuperAgefin (destino Agefin)',
    pageName: 'SuperAgefin',
    module: 'financeiro',
    warmupMs: 8000,
    sensors: [
      { id: 'SuperAgefin.shell', type: 'attached', label: 'Shell página' },
      { id: 'agefin.titulo', type: 'presence', label: 'Título Agefin' },
    ],
  });
}

const manifest = {
  version: '1.0',
  description: 'Sensores gerais — todos os módulos (lote 1 + lote 2). Shell automático via P38LazyPage.',
  screens,
};

fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);

const corridorOut = path.join(ROOT, 'src/pulse/corridorManifest.generated.js');
const corridor = {
  version: manifest.version,
  description: 'Corredor vertical Pulso — estações e sacas de cartas (auto-gerado).',
  stations: screens.map((screen) => ({
    pageName: screen.pageName,
    route: screen.route,
    label: screen.label,
    module: screen.module || null,
    letters: screen.sensors.map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type || 'presence',
    })),
  })),
};

fs.writeFileSync(
  corridorOut,
  `// Auto-gerado por scripts/generate-pulse-sensors-geral.mjs — não editar à mão.\nexport const PULSE_CORRIDOR = ${JSON.stringify(corridor, null, 2)};\n`,
);

console.log(`[pulse:generate-sensors] ${screens.length} ecrãs → ${OUT}`);
console.log(`[pulse:generate-sensors] corredor → ${corridorOut}`);

// Shipping geral (dry run 36 processos)
import { spawnSync } from 'child_process';
const ship = spawnSync(process.execPath, [path.join(__dirname, 'generate-pulse-shipping-geral.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (ship.status !== 0) process.exit(ship.status ?? 1);
