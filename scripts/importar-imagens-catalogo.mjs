#!/usr/bin/env node
/**
 * Passeio no catálogo: importa fotos onde couber (Formigres, Cerbras, Japi…).
 * Grava em produto_imagem + produto.imagem_url via Supabase REST.
 *
 * npm run import:imagens-catalogo
 * npm run import:imagens-catalogo -- --apply
 * npm run import:imagens-catalogo -- --apply --force-imagem-url
 * npm run import:imagens-catalogo -- --sync-galeria   # imagem_url → produto_imagem
 * npm run import:imagens-catalogo -- --categoria E    # só pisos/revestimentos
 * npm run import:imagens-catalogo -- --limit 50
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  preloadFormigresSnapshot,
  resolveCatalogoProdutoImagens,
  shouldTryResolve,
} from './lib/catalogoImagensResolvers.mjs';
import {
  fetchAllProdutosAtivos,
  sbFetch,
  syncImagemUrlToGaleria,
  upsertProdutoImagens,
} from './lib/supabaseProdutoImagensRest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'catalogo-imagens-report.json');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const forceImagemUrl = args.has('--force-imagem-url');
const syncGaleria = args.has('--sync-galeria');
const onlyMissing = !args.has('--all') && !forceImagemUrl;
const categoriaFilter = args.has('--categoria') ? process.argv[process.argv.indexOf('--categoria') + 1] : null;
const limit = args.has('--limit') ? Number(process.argv[process.argv.indexOf('--limit') + 1]) : null;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('[import-imagens-catalogo] Defina SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

function matchesCategoria(produto) {
  if (!categoriaFilter) return true;
  const cat = String(produto.categoria_nome || '');
  if (categoriaFilter.length === 1) return cat.startsWith(`${categoriaFilter.toUpperCase()} -`);
  return cat.toLowerCase().includes(categoriaFilter.toLowerCase());
}

async function main() {
  console.log('[import-imagens-catalogo] Carregando produtos…');
  let produtos = await fetchAllProdutosAtivos();
  produtos = produtos.filter(matchesCategoria);
  if (limit) produtos = produtos.slice(0, limit);

  const snapshot = await preloadFormigresSnapshot();
  console.log(`[import-imagens-catalogo] Formigres snapshot: ${snapshot.count} itens`);

  const report = {
    generated_at: new Date().toISOString(),
    apply,
    onlyMissing,
    forceImagemUrl,
    syncGaleria,
    categoriaFilter,
    total: produtos.length,
    stats: {
      sync_galeria: 0,
      match: 0,
      sem_match: 0,
      ignorado_ja_tem: 0,
      ignorado_fora_escopo: 0,
      erro: 0,
      imagens_gravadas: 0,
    },
    items: [],
  };

  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    const entry = {
      codigo_interno: p.codigo_interno,
      nome: p.nome,
      categoria: p.categoria_nome,
      status: 'pendente',
      resolver: '',
      qtd_imagens: 0,
      imagem_principal: '',
      erro: '',
    };

    try {
      if (syncGaleria && p.imagem_url) {
        const existing = await sbFetch(
          `produto_imagem?select=id&produto_id=eq.${p.id}&ativo=eq.true&limit=1`,
        );
        if (existing?.length) {
          entry.status = 'ignorado_ja_tem';
          report.stats.ignorado_ja_tem += 1;
        } else {
          if (apply) await syncImagemUrlToGaleria(p);
          entry.status = 'sync_galeria';
          entry.imagem_principal = p.imagem_url;
          entry.qtd_imagens = 1;
          report.stats.sync_galeria += 1;
        }
        report.items.push(entry);
        continue;
      }

      if (onlyMissing && p.imagem_url) {
        entry.status = 'ignorado_ja_tem';
        report.stats.ignorado_ja_tem += 1;
        report.items.push(entry);
        continue;
      }

      if (!shouldTryResolve(p)) {
        entry.status = 'ignorado_fora_escopo';
        report.stats.ignorado_fora_escopo += 1;
        report.items.push(entry);
        continue;
      }

      const resolved = await resolveCatalogoProdutoImagens(p, { snapshot });
      if (!resolved?.imagens?.length) {
        entry.status = 'sem_match';
        report.stats.sem_match += 1;
        report.items.push(entry);
        continue;
      }

      entry.status = 'match';
      entry.resolver = resolved.resolver;
      entry.qtd_imagens = resolved.imagens.length;
      entry.imagem_principal = resolved.imagens.find((x) => x.principal)?.url || resolved.imagens[0].url;
      report.stats.match += 1;
      report.stats.imagens_gravadas += resolved.imagens.length;

      if (apply) {
        await upsertProdutoImagens(p.id, resolved.imagens, {
          fonte: resolved.fonte,
          fonte_ref: resolved.fonte_ref,
          forceImagemUrl,
        });
      }

      report.items.push(entry);
    } catch (err) {
      entry.status = 'erro';
      entry.erro = err.message;
      report.stats.erro += 1;
      report.items.push(entry);
    }

    if ((i + 1) % 50 === 0) {
      process.stderr.write(`… ${i + 1}/${produtos.length}\n`);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n[import-imagens-catalogo] Resumo:');
  console.log(JSON.stringify(report.stats, null, 2));
  console.log(`Relatório: ${REPORT_PATH}`);
  if (!apply) console.log('\nDry-run. Para aplicar: npm run import:imagens-catalogo -- --apply');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
