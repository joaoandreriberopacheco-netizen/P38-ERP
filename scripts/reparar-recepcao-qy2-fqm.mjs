#!/usr/bin/env node
/**
 * Repara recepção QY2-FQM (PLASMEG / PVC) quando a Edge save-embarque-item falhou:
 *  - sincroniza quantidade_recebida em embarque_item
 *  - recalcula conclusão do pedido
 *  - recalcula estoque dos produtos
 *
 * Uso:
 *   node scripts/reparar-recepcao-qy2-fqm.mjs
 *   node scripts/reparar-recepcao-qy2-fqm.mjs --apply
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const PEDIDO_NUMERO = 'QY2-FQM';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const pedRes = await client.query(
      `SELECT id, numero, status, status_recebimento_geral, historico, itens
       FROM pedido_compra WHERE numero = $1 LIMIT 1`,
      [PEDIDO_NUMERO],
    );
    const pedido = pedRes.rows[0];
    if (!pedido) {
      console.error(`Pedido ${PEDIDO_NUMERO} não encontrado`);
      process.exit(1);
    }

    const embRes = await client.query(
      `SELECT id, numero, status, status_recebimento, itens
       FROM embarque WHERE pedido_compra_id = $1`,
      [pedido.id],
    );
    const embarques = embRes.rows;
    console.log(
      JSON.stringify(
        {
          dryRun: !APPLY,
          pedido: {
            id: pedido.id,
            numero: pedido.numero,
            status: pedido.status,
            status_recebimento_geral: pedido.status_recebimento_geral,
          },
          embarques: embarques.map((e) => ({
            id: e.id,
            numero: e.numero,
            status: e.status,
            status_recebimento: e.status_recebimento,
          })),
        },
        null,
        2,
      ),
    );

    const updates = [];
    for (const emb of embarques) {
      const itens = Array.isArray(emb.itens) ? emb.itens : [];
      for (const it of itens) {
        const qRec = Number(it.quantidade_recebida) || 0;
        if (!it.produto_id) continue;
        updates.push({
          embarque_id: emb.id,
          produto_id: it.produto_id,
          quantidade_recebida_comercial: qRec,
          divergencia_tipo: it.divergencia_tipo || 'Nenhuma',
        });
      }
    }

    const eiBefore = await client.query(
      `SELECT id, produto_id, quantidade_recebida_comercial
       FROM embarque_item WHERE embarque_id = ANY($1::text[])`,
      [embarques.map((e) => e.id)],
    );
    console.log(
      'embarque_item antes:',
      eiBefore.rows.map((r) => ({
        id: r.id,
        produto_id: r.produto_id,
        rec: Number(r.quantidade_recebida_comercial),
      })),
    );

    if (!APPLY) {
      console.log(`Dry-run: ${updates.length} linha(s) EmbarqueItem a sincronizar. Passe --apply para gravar.`);
      return;
    }

    await client.query('BEGIN');
    let n = 0;
    for (const u of updates) {
      const r = await client.query(
        `UPDATE embarque_item
         SET quantidade_recebida_comercial = $1,
             divergencia_tipo = $2,
             updated_at = NOW()
         WHERE embarque_id = $3 AND produto_id = $4`,
        [u.quantidade_recebida_comercial, u.divergencia_tipo, u.embarque_id, u.produto_id],
      );
      n += r.rowCount || 0;
    }

    const recebimentos = embarques.map((e) => e.status_recebimento).filter(Boolean);
    let statusReceb = 'Nenhum';
    if (recebimentos.some((s) => s === 'Com Divergência')) statusReceb = 'Concluído com Divergência';
    else if (recebimentos.length > 0 && recebimentos.every((s) => s === 'Recebido OK')) statusReceb = 'Concluído OK';
    else if (recebimentos.some((s) => s === 'Recebido Parcial')) statusReceb = 'Recebido Parcial';
    else if (embarques.length) statusReceb = 'Pendente';

    const concluido = statusReceb === 'Concluído OK' || statusReceb === 'Concluído com Divergência';
    const nowIso = new Date().toISOString();
    const histTag = `\n[REPARO RECEPÇÃO BACKEND | QY2-FQM | recebimento=${statusReceb} | embarque_item=${n} | ${nowIso}]`;

    await client.query(
      `UPDATE pedido_compra
       SET status_recebimento_geral = $1,
           status = CASE WHEN $2 THEN 'Concluído' ELSE status END,
           data_conclusao = CASE WHEN $2 THEN $3::timestamptz ELSE data_conclusao END,
           historico = COALESCE(historico, '') || $4,
           updated_at = NOW()
       WHERE id = $5`,
      [statusReceb, concluido, nowIso, histTag, pedido.id],
    );

    const produtoIds = [
      ...new Set(
        updates.map((u) => u.produto_id).filter(Boolean),
      ),
    ];
    const stockResults = [];
    for (const pid of produtoIds) {
      const { rows } = await client.query(`SELECT public.recalcular_estoque_produto($1) AS r`, [pid]);
      stockResults.push({ produto_id: pid, result: rows[0]?.r });
    }

    await client.query('COMMIT');

    const after = await client.query(
      `SELECT id, numero, status, status_recebimento_geral FROM pedido_compra WHERE id = $1`,
      [pedido.id],
    );
    const eiAfter = await client.query(
      `SELECT id, produto_nome, quantidade_recebida_comercial
       FROM embarque_item WHERE embarque_id = ANY($1::text[]) ORDER BY ordem`,
      [embarques.map((e) => e.id)],
    );
    const stock = await client.query(
      `SELECT id, nome, estoque_atual FROM produto WHERE id = ANY($1::text[])`,
      [produtoIds],
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          embarque_item_atualizados: n,
          pedido: after.rows[0],
          embarque_item: eiAfter.rows,
          estoque: stock.rows,
          stockResults,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
