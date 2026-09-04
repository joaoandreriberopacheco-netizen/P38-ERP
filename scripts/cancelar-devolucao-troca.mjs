#!/usr/bin/env node
/**
 * Cancela uma DevolucaoTroca pelo número (ex.: DT-00001):
 * - marca status Cancelada e limpa aguarda_substituto
 * - reverte estoque dos itens devolvidos (entrada) e substitutos (saída)
 * - regista movimentações de estorno para auditoria
 *
 * Uso: node scripts/cancelar-devolucao-troca.mjs DT-00001 [--apply]
 */
import pg from 'pg';
import { resolveP38Secrets } from './p38-secrets.mjs';

const numero = process.argv[2];
const apply = process.argv.includes('--apply');

if (!numero || numero.startsWith('--')) {
  console.error('Uso: node scripts/cancelar-devolucao-troca.mjs DT-00001 [--apply]');
  process.exit(1);
}

const { databaseUrl } = resolveP38Secrets();
if (!databaseUrl) {
  console.error('DATABASE_URL em falta.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query(
    `SELECT id, numero, status, tipo, pedido_origem_id, pedido_origem_numero,
            cliente_nome, itens_devolvidos, dados, operador_nome
     FROM devolucao_troca WHERE numero = $1 LIMIT 1`,
    [numero]
  );
  const dt = rows[0];
  if (!dt) {
    console.error(`Não encontrado: ${numero}`);
    process.exit(1);
  }
  if (dt.status === 'Cancelada') {
    console.log(JSON.stringify({ ok: true, ja_cancelada: true, id: dt.id }, null, 2));
    process.exit(0);
  }

  const dados = dt.dados && typeof dt.dados === 'object' ? dt.dados : {};
  const itensDevolvidos = Array.isArray(dt.itens_devolvidos) ? dt.itens_devolvidos : [];
  const itensSubstitutos = Array.isArray(dados.itens_substitutos) ? dados.itens_substitutos : [];

  const reversoes = [
    ...itensDevolvidos.map((item) => ({
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      delta: -Number(item.quantidade_devolvida || 0),
      tipo: 'Saída',
      motivo: `Estorno cancelamento ${numero}`,
    })),
    ...itensSubstitutos.map((item) => ({
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      delta: Number(item.quantidade || 0),
      tipo: 'Entrada',
      motivo: `Estorno cancelamento ${numero}`,
    })),
  ].filter((r) => r.produto_id && r.delta !== 0);

  const preview = {
    ok: true,
    apply,
    devolucao_id: dt.id,
    numero: dt.numero,
    tipo: dt.tipo,
    status_atual: dt.status,
    reversoes,
  };

  if (!apply) {
    console.log(JSON.stringify({ ...preview, modo: 'dry-run' }, null, 2));
    console.error('\nReexecute com --apply para aplicar.');
    process.exit(0);
  }

  await client.query('BEGIN');

  for (const rev of reversoes) {
    const prod = await client.query(
      'SELECT id, nome, estoque_atual FROM produto WHERE id = $1 FOR UPDATE',
      [rev.produto_id]
    );
    const row = prod.rows[0];
    if (!row) throw new Error(`Produto não encontrado: ${rev.produto_id}`);

    const estoqueAtual = Number(row.estoque_atual || 0);
    const novoEstoque = estoqueAtual + rev.delta;
    await client.query('UPDATE produto SET estoque_atual = $1, updated_at = now() WHERE id = $2', [
      novoEstoque,
      rev.produto_id,
    ]);

    await client.query(
      `INSERT INTO movimentacao_estoque (
        id, produto_id, produto_nome, tipo, motivo, quantidade,
        referencia_tipo, referencia_id, referencia_numero,
        usuario_responsavel, dados, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        'DevolucaoTroca', $6, $7,
        $8, '{}'::jsonb, now(), now()
      )`,
      [
        rev.produto_id,
        rev.produto_nome || row.nome,
        rev.tipo,
        rev.motivo,
        Math.abs(rev.delta),
        dt.id,
        dt.numero,
        dt.operador_nome || 'script-cancelar-devolucao-troca',
      ]
    );
  }

  await client.query(
    `UPDATE devolucao_troca
     SET status = 'Cancelada',
         aguarda_substituto = 'false',
         pedido_substituto_id = NULL,
         pedido_substituto_numero = NULL,
         dados = COALESCE(dados, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [
      dt.id,
      JSON.stringify({
        cancelado_em: new Date().toISOString(),
        cancelado_motivo: 'Cancelado para refazer troca com fluxo de senha no caixa',
      }),
    ]
  );

  await client.query('COMMIT');
  console.log(JSON.stringify({ ...preview, status_novo: 'Cancelada', aplicado: true }, null, 2));
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
