#!/usr/bin/env node
/**
 * Cruza pisos do SQL (public.produto) com Formigres e grava URLs em produto_imagem.
 * A imagem principal (cerâmica solitária) também atualiza produto.imagem_url.
 *
 * Uso:
 *   node scripts/cruzar-formigres-imagens-produto.mjs              # dry-run + CSV
 *   node scripts/cruzar-formigres-imagens-produto.mjs --apply      # grava no Supabase
 *   node scripts/cruzar-formigres-imagens-produto.mjs --limit 20
 *   node scripts/cruzar-formigres-imagens-produto.mjs --apply --force-imagem-url
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  extractImagensFromDetalhe,
  fetchProdutoDetalhe,
  findBestMatch,
  FORMATOS_SITE,
} from './lib/formigresCatalog.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'formigres-produto-imagens');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const forceImagemUrl = args.includes('--force-imagem-url');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;

const SQL_PISOS = `
  select
    id,
    codigo_interno,
    nome,
    imagem_url,
    categoria_nome,
    campo_hierarquico_1,
    campo_hierarquico_2
  from public.produto
  where coalesce(ativo, true)
    and campo_hierarquico_1 in ('PISO', 'REVESTIMENTO')
  order by campo_hierarquico_1, nome
`;

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function loadPisos(client) {
  const { rows } = await client.query(SQL_PISOS);
  return limit ? rows.slice(0, limit) : rows;
}

async function upsertImagens(client, produtoId, imagens, formigresId) {
  const principal = imagens.find((i) => i.principal) || imagens[0];
  if (!principal) return { principalUrl: null, count: 0 };

  await client.query('begin');
  try {
    // Desativa imagens Formigres antigas deste produto (re-sync limpo)
    await client.query(
      `update public.produto_imagem
       set ativo = false, principal = false, updated_at = now()
       where produto_id = $1 and fonte = 'formigres' and ativo = true`,
      [produtoId],
    );

    let count = 0;
    for (const img of imagens) {
      await client.query(
        `insert into public.produto_imagem
          (produto_id, url, tipo, ordem, principal, fonte, fonte_ref, ativo)
         values ($1, $2, $3, $4, $5, 'formigres', $6, true)
         on conflict (produto_id, url) do update set
           tipo = excluded.tipo,
           ordem = excluded.ordem,
           principal = excluded.principal,
           fonte = 'formigres',
           fonte_ref = excluded.fonte_ref,
           ativo = true,
           updated_at = now()`,
        [produtoId, img.url, img.tipo, img.ordem, img.principal, String(formigresId)],
      );
      count++;
    }

    if (principal.url) {
      await client.query(
        `update public.produto
         set imagem_url = $2, updated_at = now()
         where id = $1
           and ($3::boolean or imagem_url is null or trim(imagem_url) = '')`,
        [produtoId, principal.url, forceImagemUrl],
      );
    }

    await client.query('commit');
    return { principalUrl: principal.url, count };
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL não definida.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const pisos = await loadPisos(client);
    const results = [];
    let stats = { total: pisos.length, match: 0, sem_match: 0, formato_ignorado: 0, imagens: 0 };

    for (let i = 0; i < pisos.length; i++) {
      const p = pisos[i];
      const { parsed, match, score, reason } = await findBestMatch(p.nome, { requireFormatoSite: true });

      if (reason === 'formato_fora_site') {
        stats.formato_ignorado++;
        results.push({
          produto_id: p.id,
          codigo_interno: p.codigo_interno,
          nome: p.nome,
          formato: parsed.formato,
          status: 'ignorado_formato',
          formigres_id: '',
          formigres_titulo: '',
          score: 0,
          qtd_imagens: 0,
          imagem_principal: '',
          imagens_extra: '',
        });
        continue;
      }

      if (!match) {
        stats.sem_match++;
        results.push({
          produto_id: p.id,
          codigo_interno: p.codigo_interno,
          nome: p.nome,
          formato: parsed.formato,
          status: 'sem_match',
          formigres_id: '',
          formigres_titulo: '',
          score,
          qtd_imagens: 0,
          imagem_principal: '',
          imagens_extra: '',
        });
        continue;
      }

      const detalhe = await fetchProdutoDetalhe(match.id);
      const imagens = extractImagensFromDetalhe(detalhe);
      const principal = imagens.find((x) => x.principal);
      const extras = imagens.filter((x) => !x.principal);

      stats.match++;
      stats.imagens += imagens.length;

      if (apply && imagens.length) {
        await upsertImagens(client, p.id, imagens, match.id);
      }

      results.push({
        produto_id: p.id,
        codigo_interno: p.codigo_interno,
        nome: p.nome,
        formato: parsed.formato,
        status: 'match',
        formigres_id: match.id,
        formigres_titulo: detalhe?.titulo || match.titulo,
        score,
        qtd_imagens: imagens.length,
        imagem_principal: principal?.url || '',
        imagens_extra: extras.map((x) => `${x.tipo}:${x.url}`).join(' | '),
      });

      if ((i + 1) % 25 === 0) process.stderr.write(`… ${i + 1}/${pisos.length}\n`);
    }

    const header = Object.keys(results[0] || {});
    const csv = [header.join(';'), ...results.map((r) => header.map((k) => csvEscape(r[k])).join(';'))].join('\n') + '\n';
    const csvPath = path.join(OUT_DIR, 'cruzamento-imagens.csv');
    fs.writeFileSync(csvPath, csv);

    const summary = { ...stats, apply, csv: csvPath };
    fs.writeFileSync(path.join(OUT_DIR, 'resumo.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
