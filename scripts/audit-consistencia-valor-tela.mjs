#!/usr/bin/env node
/**
 * Audita consistência dos valores que a TELA mostra:
 * - Lista (_display_valor / card) vs total do pedido (detalhe)
 * - Consulta (_consulta_valor / visibilidade)
 * - Viagem (valor carga proporcional)
 *
 * Usa a mesma matemática de src/lib/embarqueValorFinanceiro.js (proporção base/comercial).
 *
 * Uso:
 *   npm run audit:valor-tela
 *   npm run audit:valor-tela -- --numero=EXC-FQZ
 *   npm run audit:valor-tela -- --apply   # alinha dados antes de auditar
 *   npm run compras:atualizar-consistencia  # align + fix E62 + audit
 */
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

const __dir = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const numeroFiltro = process.argv.find((a) => a.startsWith('--numero='))?.slice('--numero='.length)?.trim().toUpperCase().replace(/\s+/g, '') || '';
const TOLERANCIA_VALOR = 0.02;
const RATIO_DIVERGENCIA_USAR_BASE = 0.15;
const MIN_SALDO_BASE = 0.009;

const CODIGOS_EXCLUIDOS_CONSULTA = [
  'E62-67G', '49K-PKG', 'MHK-S8W', 'FKJ-2GF', 'WX7-A5N', '6DB-B2S', 'EHJ-BM9', 'G62-HUF', 'NXJ-53K',
];

const PEDIDOS_ALVO = numeroFiltro ? [numeroFiltro] : ['EXC-FQZ', 'E62-67G'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function normCodigo(c = '') {
  return String(c || '').trim().replace(/\s+/g, '').toUpperCase();
}

function codigoExcluidoConsulta(codigo = '') {
  const n = normCodigo(codigo);
  return CODIGOS_EXCLUIDOS_CONSULTA.some((ex) => n === ex || n.startsWith(`${ex}-`));
}

function resolveValorLinhaProporcional(pedItem, embLine, lineTotal) {
  const fator = Number(embLine.fator_aplicado ?? pedItem.fator_aplicado ?? 1) || 1;
  const pedBase = Number(pedItem.quantidade_base) || 0;
  const pedCom = Number(pedItem.quantidade_comercial) || 0;
  const embBase = Number(embLine.quantidade_embarcada_base)
    || round2(Number(embLine.quantidade_embarcada_comercial || 0) * fator);
  const embCom = Number(embLine.quantidade_embarcada_comercial) || 0;

  const ratioBase = pedBase > 0 && embBase > 0 ? embBase / pedBase : null;
  const ratioCom = pedCom > 0 && embCom > 0 ? embCom / pedCom : null;

  let ratio = null;
  if (ratioBase != null && ratioCom != null) {
    const maxR = Math.max(ratioBase, ratioCom, 0.001);
    const diverge = Math.abs(ratioCom - ratioBase) / maxR;
    ratio = diverge > RATIO_DIVERGENCIA_USAR_BASE ? ratioBase : ratioCom;
  } else if (ratioBase != null) {
    ratio = ratioBase;
  } else if (ratioCom != null) {
    ratio = ratioCom;
  }

  if (ratio == null) return lineTotal;
  return round2(Math.min(ratio * lineTotal, lineTotal));
}

function calcValorPedido(pedido, itens) {
  const somaItens = itens.reduce((a, i) => a + Number(i.total || 0), 0);
  const frete = Number(pedido.valor_frete ?? pedido.dados?.valor_frete ?? 0);
  const desconto = Number(pedido.valor_desconto ?? pedido.dados?.valor_desconto ?? 0);
  const calc = round2(somaItens + frete - desconto);
  const gravado = round2(Number(pedido.valor_total) || 0);
  return { somaItens, frete, desconto, calc, gravado };
}

function calcValorCard(pedido, itens, embLinhas, ehNecessidade = false) {
  if (!embLinhas.length) return calcValorPedido(pedido, itens).calc;

  let valorItens = 0;
  for (const line of embLinhas) {
    const pedItem = itens.find((i) => i.produto_id === line.produto_id) || {};
    const lineTotal = Number(pedItem.total || 0);
    const qtyKind = ehNecessidade && !(Number(line.quantidade_embarcada_comercial) > 0) ? 'pedida' : 'embarcada';
    const embForCalc = qtyKind === 'pedida'
      ? { ...line, quantidade_embarcada_comercial: line.quantidade_pedida_comercial }
      : line;
    valorItens += resolveValorLinhaProporcional(pedItem, embForCalc, lineTotal);
  }
  valorItens = round2(valorItens);
  const somaItens = itens.reduce((a, i) => a + Number(i.total || 0), 0);
  if (!somaItens) return valorItens;
  const frete = Number(pedido.valor_frete ?? pedido.dados?.valor_frete ?? 0);
  const desconto = Number(pedido.valor_desconto ?? pedido.dados?.valor_desconto ?? 0);
  const proporcao = valorItens / somaItens;
  const card = round2(valorItens + proporcao * (frete - desconto));
  return round2(Math.min(card, calcValorPedido(pedido, itens).calc));
}

function calcValorConsulta(pedido, itens, embLinhas, codigoEmbarque) {
  if (codigoExcluidoConsulta(codigoEmbarque)) return { valor: 0, motivo: 'excluido_operacional' };

  let total = 0;
  for (const line of embLinhas) {
    const pedItem = itens.find((i) => i.produto_id === line.produto_id) || {};
    const fator = Number(line.fator_aplicado ?? pedItem.fator_aplicado ?? 1) || 1;
    const embBase = Number(line.quantidade_embarcada_base)
      || round2(Number(line.quantidade_embarcada_comercial || 0) * fator);
    const recBase = Number(line.quantidade_recebida_base)
      || round2(Number(line.quantidade_recebida_comercial || 0) * fator);
    const saldoBase = round2(Math.max(0, embBase - recBase));
    if (saldoBase <= MIN_SALDO_BASE) continue;
    const pedBase = Number(pedItem.quantidade_base) || 1;
    const pedTotal = Number(pedItem.total || 0);
    total += round2((saldoBase / pedBase) * pedTotal);
  }
  return { valor: round2(total), motivo: total > 0 ? 'saldo_pendente' : 'sem_saldo' };
}

function runScript(name, args = []) {
  const script = join(__dir, name);
  console.log(`\n▶ node ${name} ${args.join(' ')}`);
  const r = spawnSync('node', [script, ...args], { stdio: 'inherit', cwd: join(__dir, '..') });
  return r.status === 0;
}

async function carregarPedido(client, numero) {
  const { rows: [pc] } = await client.query(
    `select id, numero, status, valor_total, dados,
            coalesce((dados->>'valor_frete')::numeric, 0) as valor_frete,
            coalesce((dados->>'valor_desconto')::numeric, 0) as valor_desconto,
            fornecedor_nome
     from public.pedido_compra
     where upper(replace(coalesce(numero,''),' ','')) = $1
     limit 1`,
    [normCodigo(numero)],
  );
  if (!pc) return null;

  const { rows: itens } = await client.query(
    `select id, produto_id, produto_nome, quantidade_comercial, quantidade_base, total,
            coalesce((dados->>'fator_conversao')::numeric, fator_aplicado, 1) as fator_aplicado,
            dados
     from public.pedido_compra_item
     where pedido_compra_id = $1
     order by ordem nulls last, created_at`,
    [pc.id],
  );

  const { rows: embarques } = await client.query(
    `select e.id,
            coalesce(nullif(trim(e.dados->>'codigo_exibicao'),''), e.numero) as codigo,
            e.tipo, e.status, e.status_recebimento, e.eta, e.data_embarque,
            e.transportadora_nome, e.evento_logistico_id,
            (select count(*) from public.embarque_item ei where ei.embarque_id = e.id) as qtd_sql,
            coalesce(jsonb_array_length(e.dados->'itens_embarcados'), 0) as qtd_json
     from public.embarque e
     where e.pedido_compra_id = $1
     order by e.created_at`,
    [pc.id],
  );

  const embarquesComLinhas = [];
  for (const emb of embarques) {
    const { rows: linhas } = await client.query(
      `select produto_id, produto_nome,
              quantidade_embarcada_comercial, quantidade_recebida_comercial, quantidade_pedida_comercial,
              unidade_sigla, dados
       from public.embarque_item where embarque_id = $1 order by ordem nulls last, id`,
      [emb.id],
    );
    const linhasNorm = linhas.map((l) => {
      const d = l.dados || {};
      return {
        ...l,
        fator_aplicado: Number(d.fator_aplicado ?? 1),
        quantidade_embarcada_base: Number(d.quantidade_embarcada_base ?? 0),
        quantidade_recebida_base: Number(d.quantidade_recebida_base ?? 0),
      };
    });
    embarquesComLinhas.push({ ...emb, linhas: linhasNorm });
  }

  return { pedido: pc, itens, embarques: embarquesComLinhas };
}

async function main() {
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL em falta. Configure secrets e rode numa sessão com acesso Supabase.');
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    process.exit(1);
  }

  if (APPLY) {
    console.log('═══ Fase 1: alinhar dados legados ═══');
    for (const n of ['EXC-FQZ', 'E62-67G']) {
      if (numeroFiltro && normCodigo(n) !== normCodigo(numeroFiltro.split('-')[0]) && normCodigo(n) !== numeroFiltro) continue;
      runScript('align-pedido-valor-embarque.mjs', [`--numero=${n.split('-')[0] === 'E62' ? 'E62-67G' : n}`, '--apply']);
    }
    runScript('fix-embarque-e62-67g-dados.mjs');
  }

  console.log('\n═══ Fase 2: auditoria consistência tela ═══');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const problemas = [];
  const ok = [];

  try {
    for (const numero of PEDIDOS_ALVO) {
      const pack = await carregarPedido(client, numero);
      if (!pack) {
        problemas.push({ codigo: numero, tipo: 'pedido_nao_encontrado' });
        continue;
      }

      const { pedido, itens, embarques } = pack;
      const vp = calcValorPedido(pedido, itens);

      console.log(`\n── ${pedido.numero} (${pedido.fornecedor_nome || '?'}) ──`);
      console.log(`  Pedido total gravado: R$ ${vp.gravado.toFixed(2)} | calc: R$ ${vp.calc.toFixed(2)}`);

      if (Math.abs(vp.gravado - vp.calc) > TOLERANCIA_VALOR) {
        problemas.push({
          codigo: pedido.numero,
          tipo: 'pedido_total_diverge_calc',
          gravado: vp.gravado,
          calc: vp.calc,
        });
        console.log(`  ⚠ Cabeçalho valor_total ≠ soma linhas+frete-desconto`);
      }

      for (const emb of embarques) {
        const ehNecessidade = emb.tipo === 'Necessidade';
        const valorCard = calcValorCard(pedido, itens, emb.linhas, ehNecessidade);
        const consulta = calcValorConsulta(pedido, itens, emb.linhas, emb.codigo);
        const deltaPedido = round2(valorCard - vp.calc);
        const ratioCardPedido = vp.calc > 0 ? valorCard / vp.calc : 0;

        console.log(`\n  ${emb.codigo} | ${emb.tipo} | receb=${emb.status_recebimento}`);
        console.log(`    Card (lista):     R$ ${valorCard.toFixed(2)}`);
        console.log(`    Pedido (detalhe): R$ ${vp.calc.toFixed(2)} | Δ ${deltaPedido >= 0 ? '+' : ''}${deltaPedido.toFixed(2)}`);
        console.log(`    Consulta:         R$ ${consulta.valor.toFixed(2)} (${consulta.motivo})`);
        console.log(`    SQL linhas: ${emb.qtd_sql} | JSON espelho: ${emb.qtd_json}`);

        if (emb.qtd_sql === 0 && emb.qtd_json > 0) {
          problemas.push({ codigo: emb.codigo, tipo: 'legado_só_json', qtd_json: emb.qtd_json });
          console.log('    ⚠ Só espelho JSON — viagem/lista podem divergir');
        }

        if (Math.abs(ratioCardPedido - 1) > 0.05 && ratioCardPedido > 1.05) {
          problemas.push({
            codigo: emb.codigo,
            tipo: 'card_maior_que_pedido',
            valorCard,
            valorPedido: vp.calc,
            ratio: ratioCardPedido,
          });
          console.log(`    ⚠ Card > pedido (${(ratioCardPedido * 100).toFixed(0)}%) — sintoma EXC-FQZ 36k vs 18k`);
        } else if (Math.abs(deltaPedido) <= TOLERANCIA_VALOR || Math.abs(ratioCardPedido - 1) <= 0.05) {
          ok.push({ codigo: emb.codigo, tipo: 'card_alinhado_pedido' });
          console.log('    ✓ Card alinhado com pedido');
        }

        if (consulta.motivo === 'excluido_operacional') {
          console.log('    ℹ Oculto na Consulta (lista operacional legado)');
        } else if (consulta.valor > 0) {
          console.log('    ✓ Deve aparecer na Consulta');
        } else if (emb.status_recebimento === 'Recebido OK' || emb.status === 'Concluído') {
          ok.push({ codigo: emb.codigo, tipo: 'consulta_ok_concluido' });
        }

        const recebOk = String(emb.status_recebimento || '').toLowerCase() === 'recebido ok';
        const temSaldo = emb.linhas.some((l) => {
          const embB = Number(l.quantidade_embarcada_base) || 0;
          const recB = Number(l.quantidade_recebida_base) || 0;
          return embB - recB > MIN_SALDO_BASE;
        });
        if (recebOk && temSaldo) {
          problemas.push({ codigo: emb.codigo, tipo: 'recebido_mas_saldo_pendente', temSaldo });
          console.log('    ⚠ Recebido OK mas saldo pendente > 0 — pode ficar Despachado (E62-67G)');
        }
      }
    }

    console.log('\n═══ Resumo ═══');
    console.log(`  OK: ${ok.length} | Problemas: ${problemas.length}`);
    if (problemas.length) {
      console.log('\nProblemas:');
      for (const p of problemas) {
        console.log(`  - [${p.tipo}] ${p.codigo || p.numero || ''}`, p.ratio ? `(${(p.ratio * 100).toFixed(0)}%)` : '');
      }
      if (!APPLY) {
        console.log('\nPara corrigir dados e re-auditar: npm run compras:atualizar-consistencia');
      }
      process.exit(1);
    }
    console.log('\n✓ Nenhuma inconsistência relevante nos pedidos alvo.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
