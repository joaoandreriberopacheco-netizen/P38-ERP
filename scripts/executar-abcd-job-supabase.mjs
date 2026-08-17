#!/usr/bin/env node
/**
 * Executa o job Curva ABCD (calcularIEP) no Supabase — grava `abcd` em Produto.
 *
 * Uso:
 *   node scripts/executar-abcd-job-supabase.mjs              # recalcula TODOS
 *   node scripts/executar-abcd-job-supabase.mjs --somente-vazios
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

const BATCH_SIZE = 50;
const args = new Set(process.argv.slice(2));
const somenteAbcdVazio = args.has('--somente-vazios');

const { viteSupabaseUrl, serviceRoleKey } = resolveP38Secrets();
if (!viteSupabaseUrl || !serviceRoleKey) {
  console.error('[abcd:job] VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  process.exit(1);
}

const baseUrl = `${viteSupabaseUrl.replace(/\/$/, '')}/functions/v1/calcular-iep`;

async function invoke(body) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || text || `HTTP ${res.status}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log('[abcd:job] Iniciando…', {
  somente_abcd_vazio: somenteAbcdVazio,
  batch_size: BATCH_SIZE,
});

const listado = await invoke({
  fase: 'listar',
  somente_abcd_vazio: somenteAbcdVazio,
  modo: 'manual',
  batch_size: BATCH_SIZE,
});

if (listado.status === 'sem_alteracao' || listado.concluido) {
  console.log(JSON.stringify(listado, null, 2));
  process.exit(0);
}

if (listado.status === 'erro' || listado.error) {
  console.error('[abcd:job] Falha na listagem:', listado);
  process.exit(1);
}

console.log('[abcd:job] Listado:', {
  run_id: listado.run_id,
  total_pendentes: listado.total_pendentes,
  total_produtos: listado.total_produtos,
  grupos_nivel_2: listado.grupos_nivel_2,
  cache_no_servidor: listado.cache_no_servidor,
});

const classificado = await invoke({
  fase: 'classificar',
  run_id: listado.run_id,
  modo: 'manual',
  ...(listado.job_cache ? { job_cache: listado.job_cache } : {}),
});

if (classificado.status === 'erro' || classificado.error) {
  console.error('[abcd:job] Falha na classificação:', classificado);
  process.exit(1);
}

const jobCache = classificado.job_cache || listado.job_cache;
const cacheNoServidor = Boolean(classificado.cache_no_servidor ?? listado.cache_no_servidor);
const runId = classificado.run_id || listado.run_id;
const totalPendentes = classificado.total_pendentes ?? jobCache?.produto_ids?.length ?? 0;

if (!totalPendentes) {
  console.log('[abcd:job] Nenhum produto para gravar.');
  process.exit(0);
}

console.log('[abcd:job] Gravando', totalPendentes, 'produtos…');

let offset = 0;
let totalAtualizados = 0;
let bloco = 0;

while (offset < totalPendentes) {
  bloco += 1;
  const gravado = await invoke({
    fase: 'gravar',
    run_id: runId,
    offset,
    batch_size: BATCH_SIZE,
    modo: 'manual',
    ...(cacheNoServidor ? {} : { job_cache: jobCache }),
  });

  if (gravado.status === 'erro' || gravado.error) {
    console.error('[abcd:job] Falha no bloco', bloco, gravado);
    process.exit(1);
  }

  totalAtualizados += gravado.atualizados ?? 0;
  offset = gravado.proximo_offset ?? offset + BATCH_SIZE;
  console.log(
    `[abcd:job] Bloco ${bloco}/${gravado.total_blocos ?? '?'} — ${totalAtualizados}/${totalPendentes} (versão ${gravado.versao || classificado.versao})`,
  );

  if (gravado.concluido) break;
  await sleep(150);
}

const resumo = await invoke({ fase: 'diagnostico' });
console.log('\n[abcd:job] ✅ Concluído —', totalAtualizados, 'produtos atualizados.');
console.log(JSON.stringify({
  atualizados: totalAtualizados,
  versao: classificado.versao,
  diagnostico: resumo,
}, null, 2));
