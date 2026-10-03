#!/usr/bin/env node
/**
 * Ajuste de inventário: zera saldo (físico 0) em produtos com estoque negativo
 * nas categorias indicadas — via movimento documentado (extrato → 0).
 *
 * Uso: node scripts/zerar-estoque-negativo-categorias-once.mjs [--apply]
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

const apply = process.argv.includes('--apply');
const BATCH_REF = 'NEG-ZERO-CDFHIJ-20261003';

const CATEGORIAS = [
  'C - HIDRÁULICA BRUTA',
  'D - ELÉTRICA BRUTA',
  'F - ESQUADRIAS E FERRAGENS',
  'H - ACABAMENTOS PARA ÁREAS MOLHADAS',
  'I - ILUMINAÇÃO E ACABAMENTOS',
  'J - FERRAMENTAS E CONSUMÍVEIS',
];

function saldoMovimentacoes(rows) {
  return (rows || []).reduce((acc, mov) => {
    const q = Number(mov.quantidade) || 0;
    if (mov.tipo === 'Entrada') return acc + q;
    if (mov.tipo === 'Saída') return acc - q;
    return acc;
  }, 0);
}

async function fetchMovs(supabase, produtoId) {
  const todos = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movimentacao_estoque')
      .select('tipo, quantidade')
      .eq('produto_id', produtoId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    todos.push(...data);
    if (data.length < pageSize) break;
    from += data.length;
  }
  return todos;
}

loadDotEnvFiles();
loadP38SecretsBundle();
const secrets = resolveP38Secrets();
const url = secrets.supabaseUrl || `https://${secrets.projectRef}.supabase.co`;
const key = secrets.serviceRoleKey;
if (!url || !key) {
  console.error('Supabase URL ou service role em falta.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: produtos, error: prodErr } = await supabase
  .from('produto')
  .select('id, codigo_interno, nome, estoque_atual, estoque_avariado, categoria_nome')
  .lt('estoque_atual', 0)
  .in('categoria_nome', CATEGORIAS)
  .order('categoria_nome')
  .order('estoque_atual', { ascending: true });
if (prodErr) throw prodErr;

const plano = [];
for (const p of produtos || []) {
  const movs = await fetchMovs(supabase, p.id);
  const saldoExtrato = saldoMovimentacoes(movs);
  const avariado = Number(p.estoque_avariado) || 0;
  const saldoLiquido = saldoExtrato - avariado;
  const delta = 0 - saldoLiquido;
  if (Math.abs(delta) < 1e-6) {
    plano.push({
      ...p,
      saldoExtrato,
      saldoLiquido,
      delta: 0,
      acao: 'recalc_only',
    });
    continue;
  }
  plano.push({
    ...p,
    saldoExtrato,
    saldoLiquido,
    delta,
    acao: 'movimento',
    tipo: delta > 0 ? 'Entrada' : 'Saída',
    quantidade: Math.abs(delta),
  });
}

console.log(`Modo: ${apply ? 'APLICAR' : 'dry-run'}`);
console.log(`Referência batch: ${BATCH_REF}`);
console.log(`Produtos elegíveis: ${plano.length}`);
console.log(JSON.stringify(plano, null, 2));

if (!apply) {
  console.log('\nNada gravado. Passe --apply para criar movimentos.');
  process.exit(0);
}

const criados = [];
const recalcs = [];

for (const item of plano) {
  if (item.acao === 'recalc_only') {
    const { data, error } = await supabase.rpc('recalcular_estoque_produto', {
      p_produto_id: item.id,
    });
    if (error) throw error;
    recalcs.push({ codigo: item.codigo_interno, rpc: data });
    continue;
  }

  const payload = {
    id: randomUUID(),
    produto_id: item.id,
    produto_nome: item.nome,
    tipo: item.tipo,
    motivo: 'Ajuste de Inventário',
    quantidade: item.quantidade,
    referencia_tipo: 'RevisaoEstoqueNegativo',
    referencia_id: BATCH_REF,
    referencia_numero: BATCH_REF,
    observacoes: `Zerar estoque negativo (${item.categoria_nome}) — físico 0; saldo extrato ${item.saldoLiquido} → 0 · lista refs 2026-10-03`,
    usuario_responsavel: 'script-zerar-estoque-negativo-categorias',
  };

  const { error: insErr } = await supabase.from('movimentacao_estoque').insert(payload);
  if (insErr) throw insErr;
  criados.push({
    codigo: item.codigo_interno,
    tipo: item.tipo,
    quantidade: item.quantidade,
    estoque_antes: item.estoque_atual,
  });
}

const { data: restantes, error: chkErr } = await supabase
  .from('produto')
  .select('id, codigo_interno, estoque_atual')
  .lt('estoque_atual', 0)
  .in('categoria_nome', CATEGORIAS);
if (chkErr) throw chkErr;

console.log('\n=== Resultado ===');
console.log(`Movimentos criados: ${criados.length}`);
console.log(`Recálculos só (extrato já 0): ${recalcs.length}`);
console.log(`Ainda negativos nas categorias: ${restantes?.length ?? '?'}`);
if (restantes?.length) {
  console.log(JSON.stringify(restantes, null, 2));
}
