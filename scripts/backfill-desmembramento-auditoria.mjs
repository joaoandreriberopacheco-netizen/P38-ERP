#!/usr/bin/env node
/**
 * Auditoria / backfill read-only de desmembramentos a partir de embarques legacy.
 *
 * NÃO reprocessa movimentacao_estoque nem recepções históricas.
 * Cria registos em pedido_compra_desmembramento(+item) espelhando embarques reais.
 *
 * Pré-requisito: migration 102 aplicada no Supabase.
 *
 * Uso:
 *   npm run compras:desmembramento:auditoria              # dry-run (default)
 *   npm run compras:desmembramento:auditoria -- --apply   # grava desmembramentos em falta
 *   npm run compras:desmembramento:auditoria -- --pedido=ABC-123
 */
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const pedidoFilter = [...args].find((a) => a.startsWith('--pedido='))?.split('=')[1]?.trim();

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[desmembramento:auditoria] DATABASE_URL em falta.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function newId(prefix = 'pcd') {
  return `${prefix}_${randomBytes(9).toString('hex')}`;
}

function roundQty(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function listEmbarquesLegacy() {
  const params = [];
  let where = `e.tipo is distinct from 'Necessidade'`;
  if (pedidoFilter) {
    params.push(pedidoFilter);
    where += ` and pc.numero ilike $${params.length}`;
  }

  const { rows } = await pool.query(
    `
    select
      e.id as embarque_id,
      e.numero as embarque_numero,
      e.status,
      e.status_recebimento,
      e.pedido_compra_id,
      coalesce(pc.numero, pc.dados->>'numero') as pedido_numero,
      pc.fornecedor_nome,
      e.created_at
    from public.embarque e
    join public.pedido_compra pc on pc.id = e.pedido_compra_id
    where ${where}
    order by e.pedido_compra_id, e.created_at
    `,
    params,
  );
  return rows;
}

async function listEmbarqueItens(embarqueId) {
  const { rows } = await pool.query(
    `
    select
      ei.*,
      pci.fator_aplicado,
      pci.quantidade_base as pedido_item_qtd_base
    from public.embarque_item ei
    left join public.pedido_compra_item pci on pci.id = ei.pedido_compra_item_id
    where ei.embarque_id = $1
    order by ei.ordem nulls last, ei.created_at
    `,
    [embarqueId],
  );
  return rows;
}

async function desmembramentoExistsForEmbarque(embarqueId) {
  const { rows } = await pool.query(
    `select id from public.pedido_compra_desmembramento where embarque_id = $1 limit 1`,
    [embarqueId],
  );
  return rows[0]?.id || null;
}

function toBase(commercial, fator) {
  const f = Number(fator) > 0 ? Number(fator) : 1;
  return roundQty((Number(commercial) || 0) * f);
}

async function applyDesmembramento(emb, itens) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: seqRows } = await client.query(
      `select coalesce(max(sequencia), 0) + 1 as seq from public.pedido_compra_desmembramento where pedido_compra_id = $1`,
      [emb.pedido_compra_id],
    );
    const seq = seqRows[0].seq;
    const desmId = newId('pcd');
    const codigo = `${emb.pedido_numero || emb.pedido_compra_id}-${seq}`;

    await client.query(
      `
      insert into public.pedido_compra_desmembramento (
        id, pedido_compra_id, pedido_compra_numero, sequencia, codigo,
        status, embarque_id, origem, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,'backfill',now(),now())
      `,
      [
        desmId,
        emb.pedido_compra_id,
        emb.pedido_numero,
        seq,
        codigo,
        emb.status || 'Pendente',
        emb.embarque_id,
      ],
    );

    let ordem = 0;
    for (const ei of itens) {
      const fator = Number(ei.fator_aplicado) > 0 ? Number(ei.fator_aplicado) : 1;
      const compradaBase = toBase(ei.quantidade_pedida_comercial, fator);
      const despachadaBase = toBase(ei.quantidade_embarcada_comercial, fator);
      const recebidaBase = toBase(ei.quantidade_recebida_comercial, fator);

      await client.query(
        `
        insert into public.pedido_compra_desmembramento_item (
          id, desmembramento_id, pedido_compra_id, pedido_compra_item_id,
          produto_id, produto_nome, unidade_vitrine_sigla, fator_vitrine,
          quantidade_comprada_base, quantidade_despachada_base, quantidade_recebida_base,
          ordem, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
        `,
        [
          newId('pcdi'),
          desmId,
          emb.pedido_compra_id,
          ei.pedido_compra_item_id,
          ei.produto_id,
          ei.produto_nome,
          ei.unidade_sigla || 'UN',
          fator,
          compradaBase > 0 ? compradaBase : toBase(ei.quantidade_embarcada_comercial, fator),
          despachadaBase,
          recebidaBase,
          ordem,
        ],
      );
      ordem += 1;
    }

    await client.query('commit');
    return { desmId, codigo, itens: itens.length };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`=== Desmembramento backfill/auditoria (${apply ? 'APPLY' : 'dry-run'}) ===\n`);

  let embarques;
  try {
    embarques = await listEmbarquesLegacy();
  } catch (e) {
    if (String(e.message).includes('pedido_compra_desmembramento')) {
      console.error('Tabelas não encontradas. Aplique migration 102 primeiro.');
      process.exit(2);
    }
    throw e;
  }

  console.log(`Embarques reais encontrados: ${embarques.length}\n`);

  let pendentes = 0;
  let aplicados = 0;
  const resumo = [];

  for (const emb of embarques) {
    const existente = await desmembramentoExistsForEmbarque(emb.embarque_id);
    if (existente) continue;

    const itens = await listEmbarqueItens(emb.embarque_id);
    if (!itens.length) continue;

    pendentes += 1;
    const preview = {
      pedido: emb.pedido_numero,
      embarque: emb.embarque_numero,
      embarque_id: emb.embarque_id,
      linhas: itens.length,
      transito_base: roundQty(
        itens.reduce(
          (s, ei) =>
            s +
            Math.max(
              toBase(ei.quantidade_embarcada_comercial, ei.fator_aplicado) -
                toBase(ei.quantidade_recebida_comercial, ei.fator_aplicado),
              0,
            ),
          0,
        ),
      ),
    };
    resumo.push(preview);

    console.log(
      `  ${preview.pedido} / ${preview.embarque}: ${preview.linhas} linha(s), trânsito≈${preview.transito_base} base`,
    );

    if (apply) {
      const r = await applyDesmembramento(emb, itens);
      console.log(`    → criado ${r.desmId} (${r.codigo})`);
      aplicados += 1;
    }
  }

  console.log('\n--- Resumo ---');
  console.log(`Sem desmembramento espelhado: ${pendentes}`);
  if (apply) console.log(`Criados nesta corrida: ${aplicados}`);
  else if (pendentes > 0) console.log('Correr com --apply para gravar (não mexe em estoque).');

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
