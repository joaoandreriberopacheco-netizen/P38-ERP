#!/usr/bin/env node
/**
 * Preenche o forecast fluvial (~3 meses) para todas as transportadoras ativas.
 * Usa Edge Function gerarViagensTransportadora (service role).
 *
 * Se `saida_referencia` estiver vazia no Postgres, infere pela grade 21d das viagens existentes.
 *
 * Uso: npx vite-node scripts/invoke-gerar-viagens-fluvial.mjs
 */
import { addDays, format, parseISO } from 'date-fns';
import { requireP38SupabaseScriptClient } from './p38-supabase-script-client.mjs';
import { fluvialLimiteProspectivoKey } from '../src/lib/fluvialForecastHorizon.js';
import { gerarViagensTransportadoraLocal } from './lib/gerarViagensTransportadoraLocal.mjs';

const DAY_MS = 86400000;

function inferSaidaReferenciaFromSaidas(saidas) {
  const unique = [...new Set(saidas.filter(Boolean))].sort();
  if (!unique.length) return null;
  const min = unique[0];
  for (let offset = 0; offset < 21; offset += 1) {
    const ref = format(addDays(parseISO(min), -offset), 'yyyy-MM-dd');
    const refTime = parseISO(ref).getTime();
    const aligned = unique.every((s) => {
      const diff = Math.round((parseISO(s).getTime() - refTime) / DAY_MS);
      return diff >= 0 && diff % 21 === 0;
    });
    if (aligned) return ref;
  }
  return min;
}

async function loadSaidasPorTransportadora(supabase) {
  const map = new Map();
  const pageSize = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('evento_logistico_sandbox')
      .select('transportadora_id, data_saida_origem, dados')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const tid = row.transportadora_id || row.dados?.transportadora_id;
      const saida = row.data_saida_origem || row.dados?.data_saida_origem;
      if (!tid || !saida) continue;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid).push(saida);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

const { supabase, entities } = requireP38SupabaseScriptClient();

const limite = fluvialLimiteProspectivoKey();
console.log(`[viagens-fluvial] limite prospectivo (fim do mês +3): ${limite}`);

const saidasPorId = await loadSaidasPorTransportadora(supabase);
const transportadoras = await entities.Transportadora.list('-updated_date', 500);
const ativas = (transportadoras || []).filter((t) => t?.id && t.ativo !== false);

if (!ativas.length) {
  console.log('[viagens-fluvial] Nenhuma transportadora ativa.');
  process.exit(0);
}

let backfilled = 0;
for (const transportadora of ativas) {
  if (transportadora.saida_referencia) continue;
  const saidas = saidasPorId.get(transportadora.id) || [];
  const inferred = inferSaidaReferenciaFromSaidas(saidas);
  if (!inferred) {
    console.warn(`  ⚠ ${transportadora.nome || transportadora.id}: sem saída de referência e sem viagens para inferir`);
    continue;
  }
  const { error } = await supabase
    .from('transportadora')
    .update({ saida_referencia: inferred, nome: transportadora.nome || undefined })
    .eq('id', transportadora.id);
  if (error) {
    console.error(`  ✗ backfill ${transportadora.nome}: ${error.message}`);
    continue;
  }
  transportadora.saida_referencia = inferred;
  backfilled += 1;
  console.log(`  ↻ ${transportadora.nome}: saida_referencia ← ${inferred}`);
}

console.log(`[viagens-fluvial] backfill saida_referencia: ${backfilled}`);

const elegiveis = ativas.filter((t) => t.saida_referencia);
if (!elegiveis.length) {
  console.log('[viagens-fluvial] Nenhuma transportadora com saída de referência.');
  process.exit(0);
}

let totalCreated = 0;
const resumo = [];

for (const transportadora of elegiveis) {
  const nome = transportadora.nome || transportadora.id;
  try {
    const data = await gerarViagensTransportadoraLocal(entities, transportadora);
    const created = Number(data?.created) || 0;
    totalCreated += created;
    resumo.push({ nome, transportadoraId: transportadora.id, created, limite_global: data?.limite_global });
    console.log(`  ✓ ${nome}: +${created} viagem(ns)`);
  } catch (error) {
    console.error(`  ✗ ${nome}: ${error?.message || error}`);
    resumo.push({ nome, transportadoraId: transportadora.id, error: String(error?.message || error) });
  }
}

console.log(`\n[viagens-fluvial] Total criadas: ${totalCreated}`);
console.log(JSON.stringify({ limite, backfilled, totalCreated, resumo }, null, 2));
