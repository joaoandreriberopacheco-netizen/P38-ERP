#!/usr/bin/env node
/**
 * Cancela lançamento financeiro em aberto (ex.: acordo duplicado).
 *
 *   npx vite-node scripts/cancelar-lancamento-financeiro.mjs --id=<uuid>
 *   npx vite-node scripts/cancelar-lancamento-financeiro.mjs --id=<uuid> --apply
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { isLancamentoPago } from '../src/lib/lancamentoFinanceiroStatus.js';

const apply = process.argv.includes('--apply');
const id = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
const motivo = (process.argv.find((a) => a.startsWith('--motivo=')) || '').slice(9).trim()
  || 'Cancelado — lançamento duplicado (acordo órfão já registrado no outro título).';

if (!id) {
  console.error('Use --id=<uuid do LancamentoFinanceiro>');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const rows = await p38.entities.LancamentoFinanceiro.filter({ id });
const lanc = rows?.[0];
if (!lanc) {
  console.error('Lançamento não encontrado');
  process.exit(1);
}

console.log(JSON.stringify({
  id: lanc.id,
  descricao: lanc.descricao,
  valor: lanc.valor ?? lanc.valor_liquido,
  status: lanc.status,
  pedido: lanc.pedido_compra_vinculado_numero || lanc.referencia_numero,
  apply,
}, null, 2));

if (isLancamentoPago(lanc)) {
  console.error('Não cancelar: lançamento já está pago.');
  process.exit(1);
}

if (!apply) {
  console.log('\nAdicione --apply para cancelar (status → Cancelado).');
  process.exit(0);
}

await p38.entities.LancamentoFinanceiro.update(lanc.id, {
  status: 'Cancelado',
  observacoes: `${lanc.observacoes || ''}\n[${motivo} | ${new Date().toLocaleString('pt-BR')}]`.trim(),
});

console.log('OK — lançamento cancelado.');
