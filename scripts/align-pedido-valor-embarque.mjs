#!/usr/bin/env node
/**
 * Sincroniza quantidades base em embarque_item (dados JSON) a partir do fator comercial.
 * Corrige valor do card quando base SQL diverge (ex.: EXC-FQZ BELLA GOLD 35 CX vs 75,6 M²).
 *
 * Uso:
 *   node scripts/align-pedido-valor-embarque.mjs --numero=EXC-FQZ
 *   node scripts/align-pedido-valor-embarque.mjs --numero=EXC-FQZ --apply
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

const APPLY = process.argv.includes('--apply');
const numeroArg = process.argv.find((a) => a.startsWith('--numero='))?.slice('--numero='.length)?.trim().toUpperCase().replace(/\s+/g, '');

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

function mirrorFromSqlRow(row) {
  const d = row.dados || {};
  const fator = Number(d.fator_aplicado || row.fator_aplicado) || 1;
  const unidade = row.unidade_sigla || 'UN';
  const qEmbCom = Number(row.quantidade_embarcada_comercial) || 0;
  const qRecCom = Number(row.quantidade_recebida_comercial) || 0;
  const qPedCom = Number(row.quantidade_pedida_comercial) || 0;
  const qEmbBase = Number(d.quantidade_embarcada_base) || round6(qEmbCom * fator);
  const qRecBase = Number(d.quantidade_recebida_base) || round6(qRecCom * fator);
  const qPedBase = Number(d.quantidade_pedida_base) || round6(qPedCom * fator);
  return {
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    produto_unidade_id: d.produto_unidade_id || '',
    pedido_compra_item_id: row.pedido_compra_item_id || '',
    fator_aplicado: fator,
    fator_apresentacao: fator,
    fator_conversao: fator,
    quantidade_pedida: qPedBase,
    quantidade_embarcada: qEmbBase,
    quantidade_recebida: qRecBase,
    quantidade_base: qEmbBase,
    quantidade_pedida_base: qPedBase,
    quantidade_embarcada_base: qEmbBase,
    quantidade_recebida_base: qRecBase,
    quantidade_pedida_apresentacao: qPedCom,
    quantidade_embarcada_apresentacao: qEmbCom,
    quantidade_recebida_apresentacao: qRecCom,
    unidade_medida: d.unidade_medida || 'M2',
    unidade_apresentacao: unidade,
    unidade_sigla: unidade,
    divergencia_tipo: row.divergencia_tipo || 'Nenhuma',
    embarque_item_id: row.id,
  };
}

async function syncPedido(client, pedidoId, numero) {
  console.log(`\n== ${numero} (${pedidoId}) ==`);

  const { rows: pciRows } = await client.query(
    `select id, produto_id, produto_nome, quantidade_comercial, quantidade_base, fator_aplicado, dados
     from public.pedido_compra_item where pedido_compra_id = $1`,
    [pedidoId],
  );
  const pciByProd = new Map(pciRows.map((r) => [r.produto_id, r]));

  const { rows: embarques } = await client.query(
    `select id, coalesce(dados->>'codigo_exibicao', numero) as codigo
     from public.embarque where pedido_compra_id = $1 order by created_at`,
    [pedidoId],
  );

  let fixes = 0;
  for (const emb of embarques) {
    const { rows: eiRows } = await client.query(
      `select * from public.embarque_item where embarque_id = $1 order by ordem nulls last, id`,
      [emb.id],
    );

    for (const row of eiRows) {
      const pci = pciByProd.get(row.produto_id);
      const fator = Number(row.dados?.fator_aplicado ?? pci?.fator_aplicado ?? pci?.dados?.fator_conversao) || 1;
      const embCom = Number(row.quantidade_embarcada_comercial) || 0;
      const recCom = Number(row.quantidade_recebida_comercial) || 0;
      const pedCom = Number(row.quantidade_pedida_comercial) || Number(pci?.quantidade_comercial) || 0;
      const embBaseOk = round6(embCom * fator);
      const recBaseOk = round6(recCom * fator);
      const pedBaseOk = round6(pedCom * fator);
      const d = row.dados || {};
      const embBaseAtual = Number(d.quantidade_embarcada_base) || 0;

      if (Math.abs(embBaseAtual - embBaseOk) > 0.01) {
        console.log(`  ${emb.codigo} | ${row.produto_nome?.slice(0, 35)}`);
        console.log(`    emb_base ${embBaseAtual} → ${embBaseOk} (com=${embCom} × fator=${fator})`);
        fixes += 1;
        if (APPLY) {
          const novosDados = {
            ...d,
            fator_aplicado: fator,
            quantidade_embarcada_base: embBaseOk,
            quantidade_recebida_base: recBaseOk,
            quantidade_pedida_base: pedBaseOk,
          };
          await client.query(
            `update public.embarque_item set dados = $2::jsonb, updated_at = now() where id = $1`,
            [row.id, JSON.stringify(novosDados)],
          );
        }
      }

      if (pci) {
        const pedBaseAtual = Number(pci.quantidade_base) || 0;
        const pedBaseCalc = round6(Number(pci.quantidade_comercial) * fator);
        if (pedBaseCalc > 0 && Math.abs(pedBaseAtual - pedBaseCalc) > 0.01 && pedBaseAtual === Number(pci.quantidade_comercial)) {
          console.log(`  pedido_item ${pci.produto_nome?.slice(0, 35)}: base ${pedBaseAtual} → ${pedBaseCalc}`);
          fixes += 1;
          if (APPLY) {
            await client.query(
              `update public.pedido_compra_item set quantidade_base = $2, updated_at = now() where id = $1`,
              [pci.id, pedBaseCalc],
            );
          }
        }
      }
    }

    if (APPLY && eiRows.length) {
      const { rows: fresh } = await client.query(
        `select * from public.embarque_item where embarque_id = $1 order by ordem nulls last, id`,
        [emb.id],
      );
      const mirror = fresh.map(mirrorFromSqlRow);
      await client.query(
        `update public.embarque
         set dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('itens_embarcados', $2::jsonb),
             itens = $2::jsonb,
             updated_at = now()
         where id = $1`,
        [emb.id, JSON.stringify(mirror)],
      );
      console.log(`  ✓ espelho JSON ${emb.codigo} (${mirror.length} linhas)`);
    }
  }

  return fixes;
}

async function main() {
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    let pedidos;
    if (numeroArg) {
      const { rows } = await client.query(
        `select id, numero from public.pedido_compra
         where upper(replace(coalesce(numero,''),' ','')) = $1`,
        [numeroArg],
      );
      pedidos = rows;
    } else {
      console.error('Indique --numero=CODIGO');
      process.exit(1);
    }

    if (!pedidos.length) {
      console.error('Pedido não encontrado:', numeroArg);
      process.exit(1);
    }

    let totalFixes = 0;
    for (const p of pedidos) {
      totalFixes += await syncPedido(client, p.id, p.numero);
    }

    console.log(`\n${totalFixes} correção(ões)${APPLY ? ' aplicadas' : ' (dry-run)'}.`);
    if (!APPLY && totalFixes > 0) console.log('Use --apply para gravar.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
