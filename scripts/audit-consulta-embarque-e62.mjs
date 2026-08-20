#!/usr/bin/env node
/**
 * Audita alinhamento Supabase ↔ Consulta de embarques (pedido E62 / E62-67G).
 * Uso: node scripts/audit-consulta-embarque-e62.mjs
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();
const secrets = resolveP38Secrets('cloud-agent');

const PEDIDO = process.env.AUDIT_PEDIDO || 'E62-67G';
const EMBARQUE_ALVO = process.env.AUDIT_EMBARQUE || 'E62-67G';

function norm(v = '') {
  return String(v || '').trim().replace(/\s+/g, '').toUpperCase();
}

async function main() {
  const dbUrl = secrets.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const { rows: pedidos } = await client.query(
      `select id, numero, status, status_recebimento_geral, status_embarque, valor_total, fornecedor_nome
       from public.pedido_compra
       where upper(replace(coalesce(numero, ''), ' ', '')) = $1
          or upper(replace(coalesce(numero, ''), ' ', '')) like $2
       order by created_at desc limit 1`,
      [norm(PEDIDO), `${norm(PEDIDO.split('-')[0] || PEDIDO)}%`],
    );
    const pedido = pedidos[0];
    if (!pedido) {
      console.error(`Pedido ${PEDIDO} não encontrado.`);
      process.exit(1);
    }

    console.log('\n== A) Cabeçalho pedido ==');
    console.log(pedido);

    const { rows: embarques } = await client.query(
      `select
         e.id,
         e.numero,
         coalesce(nullif(trim(e.dados->>'codigo_exibicao'), ''), nullif(trim(pc.numero || '-' || e.numero), ''), e.numero) as codigo_exibicao,
         e.tipo,
         e.status,
         e.status_recebimento,
         e.data_embarque,
         e.eta,
         e.transportadora_nome,
         e.observacoes,
         e.created_at,
         (select count(*) from public.embarque_item ei where ei.embarque_id = e.id) as qtd_linhas_sql,
         coalesce(jsonb_array_length(e.dados->'itens_embarcados'), 0) as qtd_linhas_json
       from public.embarque e
       join public.pedido_compra pc on pc.id = e.pedido_compra_id
       where e.pedido_compra_id = $1
       order by e.created_at nulls last, e.id`,
      [pedido.id],
    );

    console.log('\n== B) Embarques ==');
    for (const e of embarques) {
      const destaque = norm(e.codigo_exibicao).startsWith(norm(EMBARQUE_ALVO)) ? ' >>> ALVO' : '';
      console.log(
        `${e.codigo_exibicao}${destaque} | tipo=${e.tipo} | status=${e.status} | receb=${e.status_recebimento} | sql=${e.qtd_linhas_sql} json=${e.qtd_linhas_json} | ${e.transportadora_nome || 'sem transp.'}`,
      );
    }

    const { rows: linhas } = await client.query(
      `select
         coalesce(nullif(trim(e.dados->>'codigo_exibicao'), ''), e.numero) as embarque,
         e.tipo as embarque_tipo,
         e.status_recebimento,
         ei.id as embarque_item_id,
         coalesce(nullif(trim(ei.produto_nome), ''), ei.dados->>'produto_nome') as produto_nome,
         ei.produto_id,
         coalesce(ei.quantidade_pedida_comercial, 0) as qtd_pedida,
         coalesce(ei.quantidade_embarcada_comercial, 0) as qtd_embarcada,
         coalesce(ei.quantidade_recebida_comercial, 0) as qtd_recebida,
         round(greatest(coalesce(ei.quantidade_embarcada_comercial, 0) - coalesce(ei.quantidade_recebida_comercial, 0), 0)::numeric, 4) as pendente_consulta,
         coalesce(nullif(trim(ei.unidade_sigla), ''), ei.dados->>'unidade_medida', 'UN') as unidade,
         ei.dados as espelho_dados
       from public.embarque e
       join public.embarque_item ei on ei.embarque_id = e.id
       where e.pedido_compra_id = $1
       order by e.created_at, ei.produto_nome`,
      [pedido.id],
    );

    console.log('\n== C) Linhas SQL (saldo Consulta = embarcado − recebido) ==');
    const porEmbarque = new Map();
    for (const l of linhas) {
      if (!porEmbarque.has(l.embarque)) porEmbarque.set(l.embarque, []);
      porEmbarque.get(l.embarque).push(l);
    }
    for (const [emb, rows] of porEmbarque) {
      const alvo = norm(emb).includes('67G') ? ' >>>' : '';
      const pendenteTotal = rows.reduce((a, r) => a + Number(r.pendente_consulta), 0);
      const concluido = pendenteTotal <= 0.009;
      console.log(`\n--- ${emb}${alvo} | receb=${rows[0]?.status_recebimento} | pendente_total=${pendenteTotal.toFixed(2)} | consulta=${concluido ? 'OCULTA' : 'VISÍVEL'} ---`);
      for (const r of rows) {
        if (Number(r.pendente_consulta) <= 0.009 && Number(r.qtd_embarcada) > 0) continue;
        console.log(
          `  ${r.produto_nome}: emb=${r.qtd_embarcada} rec=${r.qtd_recebida} pend=${r.pendente_consulta} ${r.unidade}`,
        );
      }
    }

    const { rows: consolidado } = await client.query(
      `with itens_pedido as (
         select pci.produto_id,
                coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
                coalesce(pci.quantidade_comercial, 0) as qtd_pedida,
                coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade
         from public.pedido_compra_item pci
         where pci.pedido_compra_id = $1
       ),
       totais_reais as (
         select ei.produto_id,
                sum(coalesce(ei.quantidade_embarcada_comercial, 0)) as embarcado,
                sum(coalesce(ei.quantidade_recebida_comercial, 0)) as recebido,
                sum(greatest(coalesce(ei.quantidade_embarcada_comercial, 0) - coalesce(ei.quantidade_recebida_comercial, 0), 0)) as em_transito
         from public.embarque e
         join public.embarque_item ei on ei.embarque_id = e.id
         where e.pedido_compra_id = $1 and coalesce(e.tipo, 'Embarque') is distinct from 'Necessidade'
         group by ei.produto_id
       ),
       totais_nec as (
         select ei.produto_id,
                sum(greatest(coalesce(ei.quantidade_embarcada_comercial, 0), coalesce(ei.quantidade_pedida_comercial, 0), 0)) as saldo_nec
         from public.embarque e
         join public.embarque_item ei on ei.embarque_id = e.id
         where e.pedido_compra_id = $1 and e.tipo = 'Necessidade'
         group by ei.produto_id
       )
       select ip.produto_nome,
              ip.unidade,
              ip.qtd_pedida as comprado,
              coalesce(tr.embarcado, 0) as embarcado_real,
              coalesce(tr.recebido, 0) as recebido_real,
              coalesce(tr.em_transito, 0) as em_transito,
              coalesce(tn.saldo_nec, 0) as saldo_necessidade,
              round(greatest(ip.qtd_pedida - coalesce(tr.recebido, 0) - coalesce(tr.em_transito, 0), 0)::numeric, 4) as falta_real
       from itens_pedido ip
       left join totais_reais tr on tr.produto_id = ip.produto_id
       left join totais_nec tn on tn.produto_id = ip.produto_id
       order by falta_real desc, ip.produto_nome`,
      [pedido.id],
    );

    console.log('\n== D) Consolidado por produto ==');
    for (const c of consolidado) {
      const diag =
        Number(c.falta_real) > 0.009 ? 'FALTA REAL'
          : Number(c.em_transito) > 0.009 ? 'SÓ TRÂNSITO'
            : 'OK/COMPLETO';
      console.log(
        `${c.produto_nome}: compr=${c.comprado} rec=${c.recebido_real} transito=${c.em_transito} nec=${c.saldo_necessidade} falta=${c.falta_real} ${c.unidade} → ${diag}`,
      );
    }

    const { rows: desalinhamentos } = await client.query(
      `select
         coalesce(nullif(trim(e.dados->>'codigo_exibicao'), ''), e.numero) as embarque,
         ei.id as embarque_item_id,
         ei.produto_nome,
         ei.quantidade_embarcada_comercial as sql_embarcada,
         ei.quantidade_recebida_comercial as sql_recebida,
         ei.unidade_sigla as sql_unidade,
         (j.value->>'quantidade_embarcada_apresentacao')::numeric as json_embarcada,
         (j.value->>'quantidade_recebida_apresentacao')::numeric as json_recebida,
         j.value->>'unidade_apresentacao' as json_unidade
       from public.embarque e
       join public.embarque_item ei on ei.embarque_id = e.id
       left join lateral jsonb_array_elements(coalesce(e.dados->'itens_embarcados', '[]'::jsonb)) j(value)
         on (j.value->>'produto_id') = ei.produto_id
       where e.pedido_compra_id = $1
         and (
           abs(coalesce(ei.quantidade_embarcada_comercial, 0) - coalesce((j.value->>'quantidade_embarcada_apresentacao')::numeric, -999)) > 0.05
           or abs(coalesce(ei.quantidade_recebida_comercial, 0) - coalesce((j.value->>'quantidade_recebida_apresentacao')::numeric, -999)) > 0.05
           or (j.value is null)
           or (coalesce(ei.unidade_sigla, '') <> coalesce(j.value->>'unidade_apresentacao', j.value->>'unidade_sigla', ei.unidade_sigla, ''))
         )`,
      [pedido.id],
    );

    console.log('\n== E) Desalinhamentos SQL ↔ JSON espelho ==');
    if (!desalinhamentos.length) {
      console.log('  ✓ Nenhum desalinhamento detectado entre embarque_item e dados.itens_embarcados');
    } else {
      for (const d of desalinhamentos) {
        console.log(
          `  ✗ ${d.embarque} | ${d.produto_nome}: sql emb/rec=${d.sql_embarcada}/${d.sql_recebida} ${d.sql_unidade} vs json ${d.json_embarcada ?? '—'}/${d.json_recebida ?? '—'} ${d.json_unidade ?? '—'}`,
        );
      }
    }

    const alvoRows = linhas.filter((r) => norm(r.embarque).includes('67G'));
    const alvoPendente = alvoRows.reduce((a, r) => a + Number(r.pendente_consulta), 0);
    const faltaRealTotal = consolidado.reduce((a, r) => a + Number(r.falta_real), 0);
    const transitoTotal = consolidado.reduce((a, r) => a + Number(r.em_transito), 0);

    console.log('\n== F) Veredito E62-67G / Consulta ==');
    console.log(`  Pedido status: ${pedido.status} | recebimento geral: ${pedido.status_recebimento_geral}`);
    console.log(`  Saldo pendente em embarques 67G (Consulta): ${alvoPendente.toFixed(2)} un. comerciais`);
    console.log(`  Falta real pós-trânsito (pedido): ${faltaRealTotal.toFixed(2)} un. comerciais`);
    console.log(`  Em trânsito total (pedido): ${transitoTotal.toFixed(2)} un. comerciais`);

    if (alvoPendente > 0.009 && faltaRealTotal <= 0.009) {
      console.log('  ⚠ E62-67G ainda tem saldo na Consulta mas falta real do pedido é zero → trata como TRÂNSITO (esperado).');
    } else if (alvoPendente <= 0.009) {
      console.log('  ✓ E62-67G não deve aparecer na Consulta (sem saldo pendente neste split).');
    } else {
      console.log('  → E62-67G deve aparecer na Consulta só com as linhas pendentes listadas acima.');
    }

    if (desalinhamentos.length) {
      console.log('  ✗ Corrigir espelho JSON ou embarque_item antes de confiar na Consulta.');
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
