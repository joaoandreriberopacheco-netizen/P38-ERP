-- 047_linha_analise.sql
-- LINHA de análise/compra (formação por corredor) — fase 1: tabela + produto.linha_id.
-- Produto compra e eixos continuam derivados da hierarquia h1–h5 até fase 2.

create table if not exists public.linha (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('solo', 'mix', 'portfolio')),
  eixo_a_rotulo text,
  eixo_b_rotulo text,
  chave_agrupamento text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_linha_ordem on public.linha(ordem);
create index if not exists idx_linha_ativo on public.linha(ativo) where ativo = true;

alter table public.produto add column if not exists linha_id uuid references public.linha(id);
create index if not exists idx_produto_linha_id on public.produto(linha_id);

insert into public.linha (codigo, nome, tipo, chave_agrupamento, ordem, notas) values
  ('CIMENTO', 'CIMENTO', 'solo', 'h1 contém CIMENTO', 10, 'Sem grelha na 1ª fase'),
  ('ARGAMASSA', 'ARGAMASSA', 'mix', 'h1 = ARGAMASSA', 20, 'Classe × embalagem'),
  ('CERAMICA', 'CERÂMICA / PISO / REVESTIMENTO', 'portfolio', 'h1 = PISO | PORCELANATO | REVESTIMENTO', 30, 'Formato × modelo'),
  ('SOLDAVEL', 'SOLDÁVEL', 'mix', 'h2 = SOLDÁVEL ou h1 contém SOLDÁVEL', 40, 'Peça × medida'),
  ('ESGOTO', 'ESGOTO', 'mix', 'h2 = ESGOTO ou h1 contém ESGOTO', 50, 'Tubos e conexões esgoto'),
  ('ROSCAVEL', 'ROSCÁVEL', 'mix', 'h2 = ROSCÁVEL ou h1 contém ROSC', 60, 'Conexões roscáveis'),
  ('TINTA', 'TINTA & VERNIZ', 'portfolio', 'TINTA | VERNIZ | THINNER | SELADOR', 70, 'Apresentação × cor'),
  ('MASSA', 'MASSA CORRIDA / ACRÍLICA', 'mix', 'MASSA CORRIDA ou MASSA ACR', 80, null),
  ('REJUNTE', 'REJUNTE', 'mix', 'h1 contém REJUNTE', 90, 'Marca × cor'),
  ('HIDRAULICA', 'TORNEIRA & METAIS SANITÁRIOS', 'portfolio', 'TORNEIRA, CHUVEIRO, CAIXA D''ÁGUA…', 100, 'Aplicação × modelo'),
  ('FIXACAO', 'PREGO & PARAFUSO', 'mix', 'PREGO | PARAFUSO', 110, null),
  ('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', 'DISJUNTOR, CABO, FIO, ELETRODUTO…', 120, null),
  ('FERRAGEM', 'FERRAGEM', 'mix', 'FECHADURA, DOBRADIÇA…', 130, null),
  ('IMPERMEABILIZACAO', 'IMPERMEABILIZANTE & ADESIVO', 'mix', 'IMPERMEAB | ADESIVO | COLA', 140, null),
  ('OUTROS', 'OUTROS / A CLASSIFICAR', 'solo', 'sem chave clara — IA + massa', 900, null)
on conflict (codigo) do update set
  nome = excluded.nome,
  tipo = excluded.tipo,
  chave_agrupamento = excluded.chave_agrupamento,
  ordem = excluded.ordem,
  notas = excluded.notas,
  updated_at = now();

grant select, insert, update, delete on public.linha to anon, authenticated, service_role;
