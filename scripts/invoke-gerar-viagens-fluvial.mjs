#!/usr/bin/env node
/**
 * Preenche o forecast fluvial (~3 meses) para todas as transportadoras ativas.
 * Usa Edge Function gerarViagensTransportadora (service role).
 */
import { requireP38SupabaseScriptClient } from './p38-supabase-script-client.mjs';
import { fluvialLimiteProspectivoKey } from '../src/lib/fluvialForecastHorizon.js';

const { entities, functions } = requireP38SupabaseScriptClient();

const limite = fluvialLimiteProspectivoKey();
console.log(`[viagens-fluvial] limite prospectivo (fim do mês +3): ${limite}`);

const transportadoras = await entities.Transportadora.filter({ ativo: true }, '-updated_date', 500);
const ativas = (transportadoras || []).filter((t) => t?.id && t.saida_referencia);

if (!ativas.length) {
  console.log('[viagens-fluvial] Nenhuma transportadora ativa com saída de referência.');
  process.exit(0);
}

let totalCreated = 0;
const resumo = [];

for (const transportadora of ativas) {
  const nome = transportadora.nome || transportadora.id;
  try {
    const { data } = await functions.invoke('gerarViagensTransportadora', {
      transportadoraId: transportadora.id,
    });
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
console.log(JSON.stringify({ limite, totalCreated, resumo }, null, 2));
