#!/usr/bin/env node
/**
 * Corrige PV-03114: maquininha cobrou R$ 61 (crédito), sistema tinha R$ 59.
 * Atualiza pedido (nominal 61) e lançamento financeiro (líquido 59,12).
 *
 * Uso: node scripts/corrigir-pv-03114-pagamento-61-once.mjs [--apply]
 */
import pg from 'pg';

const PEDIDO_ID = 'bd43b19a-8f86-4c38-9b7e-2ef3185bc6ef';
const LANCAMENTO_ID = 'd4362007-69ba-4239-a585-8980080a733e';
const NUMERO = 'PV-03114';
const VALOR_NOMINAL = 61;
const TAXA_PCT = 3.09;
const VALOR_LIQUIDO = Math.round(VALOR_NOMINAL * (1 - TAXA_PCT / 100) * 100) / 100;

const apply = process.argv.includes('--apply');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const pv = await client.query('SELECT * FROM pedido_venda WHERE id = $1', [PEDIDO_ID]);
  if (!pv.rows.length) throw new Error(`${NUMERO} não encontrado`);

  const pagamentos = [
    {
      valor: VALOR_NOMINAL,
      valor_liquido_recebido: VALOR_LIQUIDO,
      bandeira: 'Visa',
      parcelas: 1,
      maquininha_id: '69be30ba037de7622949c1cc',
      forma_pagamento: 'Cartão de Crédito',
      maquininha_nome: 'Moderninha',
      taxa_maquininha: TAXA_PCT,
      maquininha_conta_id: '69b930f634faf2cab5dba8af',
      maquininha_conta_nome: 'Banco do Brasil',
      prazo_maquininha_dias: 1,
    },
  ];

  const obsLanc = JSON.stringify({
    bandeira: 'Visa',
    parcelas: 1,
    taxa_pct: TAXA_PCT,
    data_venda: '2026-08-12',
    maquininha_id: '69be30ba037de7622949c1cc',
    maquininha_nome: 'Moderninha',
    valor_nominal: VALOR_NOMINAL,
    valor_liquido: VALOR_LIQUIDO,
    correcao: 'Maquininha cobrou R$ 61; ajuste manual 2026-08-14',
  });

  console.log(`[${NUMERO}] nominal R$ ${VALOR_NOMINAL} → líquido R$ ${VALOR_LIQUIDO}`);
  console.log(`Modo: ${apply ? 'APLICAR' : 'DRY-RUN'}`);

  if (!apply) {
    console.log('Use --apply para gravar.');
    process.exit(0);
  }

  await client.query('BEGIN');

  await client.query(
    `UPDATE pedido_venda SET
      total = $2::numeric,
      pagamentos = $3::jsonb,
      dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
        'valor_total', to_jsonb($2::numeric),
        'subtotal', to_jsonb($2::numeric),
        'pagamentos', $3::jsonb
      ),
      updated_at = now()
    WHERE id = $1`,
    [PEDIDO_ID, VALOR_NOMINAL, JSON.stringify(pagamentos)],
  );

  await client.query(
    `UPDATE pedido_venda_item SET
      preco_unitario_fator1 = $2,
      preco_final_unitario_fator1 = $2,
      total = $2,
      updated_at = now()
    WHERE pedido_venda_id = $1`,
    [PEDIDO_ID, VALOR_NOMINAL],
  );

  await client.query(
    `UPDATE lancamento_financeiro SET
      valor = $2::numeric,
      valor_liquido = $2::numeric,
      observacoes = $3,
      dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
        'valor', to_jsonb($2::numeric),
        'valor_liquido', to_jsonb($2::numeric),
        'observacoes', to_jsonb($3::text)
      ),
      updated_at = now()
    WHERE id = $1`,
    [LANCAMENTO_ID, VALOR_LIQUIDO, obsLanc],
  );

  await client.query('COMMIT');
  console.log(`[${NUMERO}] Corrigido com sucesso.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('[erro]', err.message);
  process.exit(1);
} finally {
  await client.end();
}
