#!/usr/bin/env node
/**
 * Relatório global: falta operacional (ainda não «virou pizza»), por fornecedor.
 * Fonte: view pedido_compra_saldo_a_embarcar_v (migration 094).
 *
 * Uso: node scripts/saldo-pizza-por-fornecedor.mjs
 *      node scripts/saldo-pizza-por-fornecedor.mjs --json
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

const BASE = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

async function sbFetch(path) {
  const key = resolveP38Secrets().serviceRoleKey;
  const r = await fetch(`${BASE}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const msg = await r.text();
    if (r.status === 404 || msg.includes('42P01')) {
      throw new Error('View pedido_compra_saldo_a_embarcar_v não encontrada. Corra npm run supabase:deploy -- --migrations-only');
    }
    throw new Error(`${r.status} ${path}: ${msg}`);
  }
  return r.json();
}

function cxFromNome(nome, qtdComercial) {
  const m = String(nome || '').match(/([\d,\.]+)\s*m[²2]\s*\/\s*cx/i)
    || String(nome || '').match(/\(([\d,\.]+)\s*m[²2]/i);
  const m2cx = m ? parseFloat(m[1].replace(',', '.')) : null;
  if (m2cx && qtdComercial) return qtdComercial / m2cx;
  return null;
}

async function main() {
  const rows = await sbFetch(
    '/rest/v1/pedido_compra_saldo_a_embarcar_v?falta_operacional=gt.0.009&pedido_status=neq.Concluído&select=pedido_compra_numero,fornecedor_nome,pedido_status,produto_nome,unidade_sigla,falta_operacional,quantidade_em_transito,saldo_pos_recepcao,diagnostico,valor_linha_pedido&order=fornecedor_nome.asc,pedido_compra_numero.asc',
  );

  const porFornecedor = new Map();

  for (const row of rows) {
    const fornecedor = String(row.fornecedor_nome || 'Sem fornecedor').trim();
    const numero = row.pedido_compra_numero;

    if (!porFornecedor.has(fornecedor)) {
      porFornecedor.set(fornecedor, {
        fornecedor,
        pedidos: new Map(),
        totalPedidos: 0,
        totalLinhas: 0,
        totalCx: 0,
        totalFalta: 0,
      });
    }

    const grp = porFornecedor.get(fornecedor);
    if (!grp.pedidos.has(numero)) {
      grp.pedidos.set(numero, {
        numero,
        status: row.pedido_status,
        linhas: [],
        cx: 0,
        falta: 0,
      });
    }

    const ped = grp.pedidos.get(numero);
    const cx = cxFromNome(row.produto_nome, row.falta_operacional);
    ped.linhas.push({
      produto: (row.produto_nome || '').slice(0, 60),
      falta: Math.round(row.falta_operacional * 100) / 100,
      un: row.unidade_sigla,
      cx: cx != null ? Math.round(cx * 10) / 10 : null,
      em_transito: Math.round(row.quantidade_em_transito * 100) / 100,
      repor_pos_recepcao: Math.round(row.saldo_pos_recepcao * 100) / 100,
      diagnostico: row.diagnostico,
    });
    ped.falta += row.falta_operacional;
    if (cx != null) ped.cx += cx;
  }

  const fornecedores = [...porFornecedor.values()]
    .map((f) => {
      const pedidos = [...f.pedidos.values()].map((p) => ({
        ...p,
        falta: Math.round(p.falta * 100) / 100,
        cx: Math.round(p.cx * 10) / 10,
        linhas: p.linhas.length,
        detalhe: p.linhas,
      }));
      const totalCx = pedidos.reduce((s, p) => s + p.cx, 0);
      const totalFalta = pedidos.reduce((s, p) => s + p.falta, 0);
      return {
        fornecedor: f.fornecedor,
        totalPedidos: pedidos.length,
        totalLinhas: pedidos.reduce((s, p) => s + p.linhas, 0),
        totalCx: Math.round(totalCx * 10) / 10,
        totalFalta: Math.round(totalFalta * 100) / 100,
        pedidos: pedidos.sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR')),
      };
    })
    .sort((a, b) => b.totalFalta - a.totalFalta || a.fornecedor.localeCompare(b.fornecedor, 'pt-BR'));

  const totais = fornecedores.reduce(
    (acc, f) => ({
      fornecedores: acc.fornecedores + 1,
      pedidos: acc.pedidos + f.totalPedidos,
      linhas: acc.linhas + f.totalLinhas,
      cx: acc.cx + f.totalCx,
      falta: acc.falta + f.totalFalta,
    }),
    { fornecedores: 0, pedidos: 0, linhas: 0, cx: 0, falta: 0 },
  );

  const payload = {
    geradoEm: new Date().toISOString(),
    criterio: 'falta_operacional = pedido − recebido − em_trânsito (view pedido_compra_saldo_a_embarcar_v)',
    fonte: 'Supabase view 094 — consulta SQL directa',
    totais: {
      ...totais,
      cx: Math.round(totais.cx * 10) / 10,
      falta: Math.round(totais.falta * 100) / 100,
    },
    fornecedores,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('=== Saldo a embarcar por fornecedor (view 094) ===\n');
  console.log(`Fornecedores: ${totais.fornecedores} | Pedidos: ${totais.pedidos} | Linhas: ${totais.linhas}`);
  console.log(`Soma falta (un. comercial): ${payload.totais.falta} | ~cx (M²/CX): ${payload.totais.cx}\n`);

  for (const f of fornecedores.slice(0, 20)) {
    console.log(`${f.fornecedor}: ${f.totalPedidos} pedido(s), falta=${f.totalFalta}, ~${f.totalCx} cx`);
    for (const p of f.pedidos.slice(0, 5)) {
      console.log(`  ${p.numero} (${p.status}): falta=${p.falta}, ~${p.cx} cx, ${p.linhas} linha(s)`);
    }
    if (f.pedidos.length > 5) console.log(`  … +${f.pedidos.length - 5} pedido(s)`);
  }
  if (fornecedores.length > 20) console.log(`\n… +${fornecedores.length - 20} fornecedor(es) (use --json)`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
