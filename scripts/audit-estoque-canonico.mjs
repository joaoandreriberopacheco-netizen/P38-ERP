#!/usr/bin/env node
/**
 * Audita estoque canónico em toda a base de produtos (Supabase/Postgres).
 *
 * Verifica:
 * - cadastro (estoque_atual) vs extrato completo (soma de movimentacao_estoque)
 * - produtos com >1000 movimentos (risco histórico de contagem truncada)
 * - contagens express aplicadas
 *
 * Uso: npm run audit:estoque-canonico
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const { rows: totais } = await pool.query(`
    select
      (select count(*)::int from public.produto where coalesce(ativo, true)) as produtos_ativos,
      (select count(distinct produto_id)::int from public.movimentacao_estoque) as produtos_com_mov,
      (select count(*)::int from public.movimentacao_estoque) as total_movimentos
  `);

  const { rows: alinhamento } = await pool.query(`
    select
      count(*)::int as com_movimento,
      count(*) filter (where abs(cadastro - extrato) <= 0.01)::int as cadastro_igual_extrato,
      count(*) filter (where cadastro > 0 and abs(cadastro - extrato) > 0.01)::int as divergencia_real,
      count(*) filter (where cadastro = 0 and extrato < -0.01)::int as cadastro_zero_extrato_negativo
    from (
      select p.id, p.estoque_atual::numeric as cadastro,
        sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end) as extrato
      from public.produto p
      join public.movimentacao_estoque m on m.produto_id = p.id
      where coalesce(p.ativo, true)
      group by p.id, p.estoque_atual
    ) t
  `);

  const { rows: riscoTruncagem } = await pool.query(`
    select p.codigo_interno, p.nome, count(m.id)::int as movimentos,
           p.estoque_atual::numeric as cadastro,
           sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end) as extrato
    from public.produto p
    join public.movimentacao_estoque m on m.produto_id = p.id
    where coalesce(p.ativo, true)
    group by p.id, p.codigo_interno, p.nome, p.estoque_atual
    having count(m.id) > 1000
    order by count(m.id) desc
  `);

  const { rows: divergenciaReal } = await pool.query(`
    select p.codigo_interno, p.nome, p.estoque_atual::numeric as cadastro,
           sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end) as extrato,
           count(m.id)::int as movimentos
    from public.produto p
    join public.movimentacao_estoque m on m.produto_id = p.id
    where coalesce(p.ativo, true)
    group by p.id, p.codigo_interno, p.nome, p.estoque_atual
    having p.estoque_atual::numeric > 0
       and abs(p.estoque_atual::numeric - sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end)) > 0.01
    order by abs(p.estoque_atual::numeric - sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end)) desc
    limit 25
  `);

  await pool.end();

  const report = {
    gerado_em: new Date().toISOString(),
    regra: 'cadastro = soma(movimentacao_estoque); contagem física prevalece via Ajuste de Inventário',
    totais: totais[0],
    alinhamento: alinhamento[0],
    interpretacao: {
      divergencia_real:
        'Produtos com estoque > 0 mas cadastro ≠ extrato — exigem investigação ou contagem física',
      cadastro_zero_extrato_negativo:
        'Extrato negativo com cadastro zerado (Math.max no recálculo) — não é o bug do cimento',
      risco_truncagem_1000:
        'Só produtos com >1000 movimentos podiam ter contagem express errada antes da correção do código',
    },
    produtos_risco_truncagem_historico: riscoTruncagem.map((r) => ({
      codigo: r.codigo_interno,
      nome: r.nome,
      movimentos: r.movimentos,
      cadastro: Number(r.cadastro),
      extrato: Number(r.extrato),
    })),
    divergencias_reais: divergenciaReal.map((r) => ({
      codigo: r.codigo_interno,
      nome: r.nome,
      cadastro: Number(r.cadastro),
      extrato: Number(r.extrato),
      movimentos: r.movimentos,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
