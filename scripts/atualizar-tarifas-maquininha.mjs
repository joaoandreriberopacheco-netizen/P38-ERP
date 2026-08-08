#!/usr/bin/env node
/**
 * Atualiza tarifas da maquininha no Supabase (recebimento na hora / D+1).
 * Uso: node scripts/atualizar-tarifas-maquininha.mjs
 */

const TAXA_MENSAL = 1.7;

const bandeiraTarifasPadrao = (nome) => ({
  bandeira: nome,
  taxa_debito: 1.14,
  taxa_credito_1x: 3.09,
  taxa_credito_2_6x: 2.25,
  taxa_credito_7_12x: 2.2,
  taxa_intermediacao_parcelado: 2.25,
  faixas_parcelamento: [
    { min_parcelas: 2, max_parcelas: 6, taxa_mensal_percentual: TAXA_MENSAL },
    { min_parcelas: 7, max_parcelas: 12, taxa_mensal_percentual: TAXA_MENSAL },
  ],
});

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];
const bandeiras = BANDEIRAS.map((b) => bandeiraTarifasPadrao(b));

const res = await fetch(`${url}/rest/v1/maquininha?ativo=eq.true&select=id,dados`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

const list = await res.json();
if (!Array.isArray(list) || list.length === 0) {
  console.error('Nenhuma maquininha ativa encontrada.');
  process.exit(1);
}

for (const maq of list) {
  const dados = {
    ...maq.dados,
    bandeiras,
    taxa_juros_cliente_mensal: TAXA_MENSAL,
    prazo_debito_dias: 1,
    prazo_credito_vista_dias: 1,
    prazo_credito_parcelado_dias: 1,
  };

  const patch = await fetch(`${url}/rest/v1/maquininha?id=eq.${maq.id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ dados }),
  });

  const updated = await patch.json();
  if (!patch.ok) {
    console.error('Erro ao atualizar', maq.id, updated);
    process.exit(1);
  }
  console.log(`Maquininha "${dados.nome}" atualizada (Visa débito ${bandeiras[0].taxa_debito}%, créd 1x ${bandeiras[0].taxa_credito_1x}%).`);
}
