import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets, P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';
import {
  qtyCaixaFromQuantidadeBase,
  qtyComercialPedidoItem,
  resolveUnidadeCaixaRelatorio,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';
import { buildPurchaseUnitOptions } from '../src/lib/productUnits.js';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';

loadDotEnvFiles();
const secrets = resolveP38Secrets('cloud-agent');
const url = secrets.supabaseUrl || `https://${secrets.projectRef || P38_CANONICAL_PROJECT_REF}.supabase.co`;
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, secrets.serviceRoleKey, { auth: { persistSession: false } });

function mapProd(row) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  let unidades = row.unidades ?? dados.unidades;
  if (typeof unidades === 'string') {
    try { unidades = JSON.parse(unidades); } catch { unidades = []; }
  }
  return { id: row.id, nome: row.nome, unidades: Array.isArray(unidades) ? unidades : [], ...dados };
}

const pid = process.argv[2] || '69bd5c9f6be3592380f4d4f0';
const { data: p } = await sb.from('produto').select('*').eq('id', pid).maybeSingle();
const prod = p ? mapProd(p) : null;
console.log('produto', prod?.nome);
console.log('options', buildPurchaseUnitOptions(prod).map((o) => ({ u: o.unidade, f: o.fator_conversao })));
console.log('unidade relatorio', resolveUnidadeCaixaRelatorio(prod, 'UN'));
console.log('200 m2 -> cx', qtyCaixaFromQuantidadeBase(200, prod, 'UN'));

const { data: pci } = await sb.from('pedido_compra_item').select('*').eq('produto_id', pid).limit(1).maybeSingle();
if (pci) {
  const item = pedidoCompraItemToLegacyMirror(pci);
  console.log('item', item.quantidade, item.quantidade_base, item.fator_conversao, item.unidade_medida);
  console.log('qty pedido cx', qtyComercialPedidoItem(item, prod));
}
