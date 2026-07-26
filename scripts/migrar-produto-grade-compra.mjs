#!/usr/bin/env node
/**
 * Fase 1: seed linhas/produtos_compra/eixo_valor e migra SKUs com cadastro claro.
 * Uso: node scripts/migrar-produto-grade-compra.mjs [--apply]
 */
import crypto from 'node:crypto';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');

function uuidFromCode(namespace, code) {
  const hash = crypto.createHash('sha256').update(`${namespace}:${code}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

function slug(s) {
  return norm(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const TINTA_H3_MAP = {
  ESMALTE: { codigo: 'TINTA_ESMALTE_SINTETICO', nome: 'TINTA ESMALTE SINTÉTICO' },
  'P/ PISO': { codigo: 'TINTA_P_PISO', nome: 'TINTA P/ PISO' },
  'ACR. FOSCO ECON.': { codigo: 'TINTA_ACR_FOSCO_ECON', nome: 'TINTA ACRÍLICA FOSCO ECONÔMICO' },
  'SEMI-BRILHO': { codigo: 'TINTA_SEMI_BRILHO', nome: 'TINTA SEMI-BRILHO' },
  STANDARD: { codigo: 'TINTA_STANDARD', nome: 'TINTA STANDARD' },
  'STANDARD POUPE+': { codigo: 'TINTA_STANDARD_POUPE', nome: 'TINTA STANDARD POUPE+' },
  'INT/EXT STAND': { codigo: 'TINTA_INT_EXT_STAND', nome: 'TINTA INT/EXT STANDARD' },
};

const LINHAS_SEED = [
  { codigo: 'CIMENTO', nome: 'CIMENTO', tipo: 'solo', ordem: 10, eixo_a: null, eixo_b: null },
  { codigo: 'ARGAMASSA', nome: 'ARGAMASSA', tipo: 'linha_mix', ordem: 20, eixo_a: 'Classe', eixo_b: 'Embalagem' },
  { codigo: 'PISO', nome: 'PISO', tipo: 'portfolio', ordem: 30, eixo_a: 'Formato', eixo_b: 'Modelo', meta: 80 },
  { codigo: 'CONEXAO_SOLDAVEL', nome: 'CONEXÃO SOLDÁVEL', tipo: 'linha_mix', ordem: 40, eixo_a: 'Peça', eixo_b: 'Medida' },
  { codigo: 'TINTA', nome: 'TINTA', tipo: 'portfolio', ordem: 50, eixo_a: 'Embalagem', eixo_b: 'Cor / detalhe', meta: 70 },
];

const PRODUTO_COMPRA_SEED = [
  { linha: 'CIMENTO', codigo: 'CIMENTO_PORTLAND', nome: 'CIMENTO PORTLAND' },
  { linha: 'CIMENTO', codigo: 'CIMENTO_BRANCO', nome: 'CIMENTO BRANCO' },
  { linha: 'ARGAMASSA', codigo: 'ARGAMASSA', nome: 'ARGAMASSA' },
  { linha: 'PISO', codigo: 'PISO', nome: 'PISO' },
  { linha: 'TINTA', codigo: 'TINTA_ESMALTE_SINTETICO', nome: 'TINTA ESMALTE SINTÉTICO' },
  { linha: 'TINTA', codigo: 'TINTA_P_PISO', nome: 'TINTA P/ PISO' },
  { linha: 'TINTA', codigo: 'TINTA_ACR_FOSCO_ECON', nome: 'TINTA ACRÍLICA FOSCO ECONÔMICO' },
  { linha: 'TINTA', codigo: 'TINTA_SEMI_BRILHO', nome: 'TINTA SEMI-BRILHO' },
  { linha: 'TINTA', codigo: 'TINTA_STANDARD', nome: 'TINTA STANDARD' },
  { linha: 'TINTA', codigo: 'TINTA_STANDARD_POUPE', nome: 'TINTA STANDARD POUPE+' },
  { linha: 'TINTA', codigo: 'TINTA_INT_EXT_STAND', nome: 'TINTA INT/EXT STANDARD' },
];

function soldavelProdutoCompraNome(h1, h3) {
  const peca = norm(h1);
  const d3 = norm(h3);
  if (peca === 'JOELHO') {
    if (d3 === 'MISTO') return 'JOELHO MISTO SOLDÁVEL';
    if (d3 === '45' || d3 === '90') return `JOELHO ${d3}° SOLDÁVEL`;
  }
  return `${peca} SOLDÁVEL`;
}

function soldavelEixoB(h1, h3, h4) {
  const peca = norm(h1);
  const d3 = String(h3 || '').trim();
  const d4 = String(h4 || '').trim();
  if (peca === 'JOELHO' && ['45', '90', 'MISTO'].includes(norm(h3))) return d4 || d3;
  return d3 || d4;
}

async function upsertLinha(client, row) {
  const id = uuidFromCode('linha', row.codigo);
  await client.query(
    `insert into linha_compra (id, codigo, nome, tipo, eixo_a_rotulo, eixo_b_rotulo, meta_cobertura_pct, ordem, ativo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,true)
     on conflict (codigo) do update set
       nome = excluded.nome, tipo = excluded.tipo,
       eixo_a_rotulo = excluded.eixo_a_rotulo, eixo_b_rotulo = excluded.eixo_b_rotulo,
       meta_cobertura_pct = excluded.meta_cobertura_pct, ordem = excluded.ordem, updated_at = now()`,
    [id, row.codigo, row.nome, row.tipo, row.eixo_a, row.eixo_b, row.meta ?? null, row.ordem],
  );
  return id;
}

async function upsertProdutoCompra(client, linhaId, codigo, nome) {
  const id = uuidFromCode('pc', `${linhaId}:${codigo}`);
  await client.query(
    `insert into produto_compra (id, linha_id, codigo, nome, ativo)
     values ($1,$2,$3,$4,true)
     on conflict (linha_id, codigo) do update set nome = excluded.nome, updated_at = now()`,
    [id, linhaId, codigo, nome],
  );
  return id;
}

async function getOrCreateEixoValor(client, { linhaId, produtoCompraId, eixo, codigo, nome }) {
  const scope = produtoCompraId ? `pc:${produtoCompraId}` : `ln:${linhaId}`;
  const id = uuidFromCode('eixo', `${scope}:${eixo}:${codigo}`);
  const existing = await client.query(
    `select id from eixo_valor
     where linha_id = $1 and eixo = $2 and codigo = $3
       and produto_compra_id is not distinct from $4
     limit 1`,
    [linhaId, eixo, codigo, produtoCompraId || null],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;
  await client.query(
    `insert into eixo_valor (id, linha_id, produto_compra_id, eixo, codigo, nome, ativo)
     values ($1, $2, $3, $4, $5, $6, true)`,
    [id, linhaId, produtoCompraId || null, eixo, codigo, nome],
  );
  return id;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const stats = {
    linhas: 0,
    produto_compra: 0,
    eixo_valor: 0,
    produtos_piso: 0,
    produtos_cimento: 0,
    produtos_argamassa: 0,
    produtos_soldavel: 0,
    produtos_tinta: 0,
  };

  const linhaIds = {};
  for (const l of LINHAS_SEED) {
    if (APPLY) linhaIds[l.codigo] = await upsertLinha(client, l);
    else linhaIds[l.codigo] = uuidFromCode('linha', l.codigo);
    stats.linhas += 1;
  }

  const pcIds = {};
  for (const pc of PRODUTO_COMPRA_SEED) {
    const lid = linhaIds[pc.linha];
    if (APPLY) pcIds[pc.codigo] = await upsertProdutoCompra(client, lid, pc.codigo, pc.nome);
    else pcIds[pc.codigo] = uuidFromCode('pc', `${lid}:${pc.codigo}`);
    stats.produto_compra += 1;
  }

  // --- PISO ---
  const pisoRows = (await client.query(
    `select id, campo_hierarquico_2 as formato, campo_hierarquico_3 as modelo
     from produto where ativo = true and upper(trim(campo_hierarquico_1)) = 'PISO'`,
  )).rows;

  const linhaPiso = linhaIds.PISO;
  const pcPiso = pcIds.PISO;

  for (const row of pisoRows) {
    const fmt = String(row.formato || '').trim();
    const mod = String(row.modelo || '').trim();
    if (!fmt || !mod) continue;
    const codA = slug(fmt);
    const codB = slug(mod).slice(0, 80);
    let eixoAId = null;
    let eixoBId = null;
    if (APPLY) {
      eixoAId = await getOrCreateEixoValor(client, {
        linhaId: linhaPiso,
        produtoCompraId: pcPiso,
        eixo: 'A',
        codigo: codA,
        nome: fmt,
      });
      eixoBId = await getOrCreateEixoValor(client, {
        linhaId: linhaPiso,
        produtoCompraId: pcPiso,
        eixo: 'B',
        codigo: codB,
        nome: mod,
      });
      await client.query(
        `update produto set
          linha_compra_id = $2, produto_compra_id = $3,
          eixo_a_valor_id = $4, eixo_b_valor_id = $5,
          eixo_a_texto = $6, eixo_b_texto = $7,
          no_mix_ativo = false
         where id = $1`,
        [row.id, linhaPiso, pcPiso, eixoAId, eixoBId, fmt, mod],
      );
      stats.eixo_valor += 2;
    }
    stats.produtos_piso += 1;
  }

  // --- CIMENTO ---
  const cimentoRows = (await client.query(
    `select id, upper(trim(campo_hierarquico_1)) h1, nome from produto
     where ativo = true and upper(trim(campo_hierarquico_1)) like '%CIMENTO%'`,
  )).rows;

  for (const row of cimentoRows) {
    const pcCod = norm(row.h1).includes('BRANCO') ? 'CIMENTO_BRANCO' : 'CIMENTO_PORTLAND';
    const pcId = pcIds[pcCod];
    if (APPLY) {
      await client.query(
        `update produto set linha_compra_id = $2, produto_compra_id = $3,
          eixo_a_valor_id = null, eixo_b_valor_id = null, eixo_a_texto = null, eixo_b_texto = null
         where id = $1`,
        [row.id, linhaIds.CIMENTO, pcId],
      );
    }
    stats.produtos_cimento += 1;
  }

  // --- ARGAMASSA ---
  const argRows = (await client.query(
    `select id, campo_hierarquico_2 emb, campo_hierarquico_3 classe from produto
     where ativo = true and upper(trim(campo_hierarquico_1)) = 'ARGAMASSA'`,
  )).rows;

  const linhaArg = linhaIds.ARGAMASSA;
  const pcArg = pcIds.ARGAMASSA;

  for (const row of argRows) {
    const emb = String(row.emb || '').trim();
    const classe = String(row.classe || '').trim();
    if (!classe || !emb) continue;
    if (APPLY) {
      const eixoAId = await getOrCreateEixoValor(client, {
        linhaId: linhaArg,
        produtoCompraId: pcArg,
        eixo: 'A',
        codigo: slug(classe),
        nome: classe,
      });
      const eixoBId = await getOrCreateEixoValor(client, {
        linhaId: linhaArg,
        produtoCompraId: pcArg,
        eixo: 'B',
        codigo: slug(emb),
        nome: emb,
      });
      await client.query(
        `update produto set linha_compra_id=$2, produto_compra_id=$3,
          eixo_a_valor_id=$4, eixo_b_valor_id=$5, eixo_a_texto=$6, eixo_b_texto=$7, celula_obrigatoria=true
         where id=$1`,
        [row.id, linhaArg, pcArg, eixoAId, eixoBId, classe, emb],
      );
      stats.eixo_valor += 2;
    }
    stats.produtos_argamassa += 1;
  }

  // --- SOLDÁVEL ---
  const soldRows = (await client.query(
    `select id, campo_hierarquico_1 h1, campo_hierarquico_2 h2, campo_hierarquico_3 h3, campo_hierarquico_4 h4
     from produto where ativo = true
       and upper(trim(campo_hierarquico_2)) in ('SOLDÁVEL', 'SOLDAVEL')`,
  )).rows;

  const linhaSold = linhaIds.CONEXAO_SOLDAVEL;
  const pcCache = {};

  for (const row of soldRows) {
    const pcNome = soldavelProdutoCompraNome(row.h1, row.h3);
    const pcCod = slug(pcNome);
    if (!pcCache[pcCod]) {
      if (APPLY) {
        pcCache[pcCod] = await upsertProdutoCompra(client, linhaSold, pcCod, pcNome);
        stats.produto_compra += 1;
      } else {
        pcCache[pcCod] = uuidFromCode('pc', `${linhaSold}:${pcCod}`);
      }
    }
    const pcId = pcCache[pcCod];
    const med = soldavelEixoB(row.h1, row.h3, row.h4);
    if (!med) continue;
    if (APPLY) {
      const eixoBId = await getOrCreateEixoValor(client, {
        linhaId: linhaSold,
        produtoCompraId: pcId,
        eixo: 'B',
        codigo: slug(med),
        nome: med,
      });
      await client.query(
        `update produto set linha_compra_id=$2, produto_compra_id=$3,
          eixo_b_valor_id=$4, eixo_b_texto=$5, celula_obrigatoria=true
         where id=$1`,
        [row.id, linhaSold, pcId, eixoBId, med],
      );
      stats.eixo_valor += 1;
    }
    stats.produtos_soldavel += 1;
  }

  // --- TINTA ---
  const tintaRows = (await client.query(
    `select id, campo_hierarquico_2 emb, campo_hierarquico_3 h3, campo_hierarquico_4 h4, nome
     from produto where ativo = true and upper(trim(campo_hierarquico_1)) = 'TINTA'`,
  )).rows;

  const linhaTinta = linhaIds.TINTA;
  const tintaPcCache = { ...pcIds };

  for (const row of tintaRows) {
    const h3 = norm(row.h3);
    const map = TINTA_H3_MAP[h3] || { codigo: `TINTA_${slug(h3)}`, nome: `TINTA ${h3 || 'SEM TIPO'}` };
    if (!tintaPcCache[map.codigo]) {
      if (APPLY) {
        tintaPcCache[map.codigo] = await upsertProdutoCompra(client, linhaTinta, map.codigo, map.nome);
        stats.produto_compra += 1;
      } else {
        tintaPcCache[map.codigo] = uuidFromCode('pc', `${linhaTinta}:${map.codigo}`);
      }
    }
    const pcId = tintaPcCache[map.codigo];
    const emb = String(row.emb || '').trim();
    const det = String(row.h4 || '').trim();
    if (APPLY && emb) {
      const eixoAId = await getOrCreateEixoValor(client, {
        linhaId: linhaTinta,
        produtoCompraId: pcId,
        eixo: 'A',
        codigo: slug(emb),
        nome: emb,
      });
      let eixoBId = null;
      if (det) {
        eixoBId = await getOrCreateEixoValor(client, {
          linhaId: linhaTinta,
          produtoCompraId: pcId,
          eixo: 'B',
          codigo: slug(det),
          nome: det,
        });
        stats.eixo_valor += 1;
      }
      await client.query(
        `update produto set linha_compra_id=$2, produto_compra_id=$3,
          eixo_a_valor_id=$4, eixo_b_valor_id=$5, eixo_a_texto=$6, eixo_b_texto=$7, no_mix_ativo=false
         where id=$1`,
        [row.id, linhaTinta, pcId, eixoAId, eixoBId, emb, det || null],
      );
      stats.eixo_valor += 1;
    }
    stats.produtos_tinta += 1;
  }

  await client.end();

  console.log(APPLY ? '\n=== APLICADO ===' : '\n=== DRY-RUN (use --apply) ===');
  console.table(stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
