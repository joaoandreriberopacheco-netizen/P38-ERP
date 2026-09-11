-- 089_produto_imagem_thumb.sql
-- Miniatura leve para listas; URL completa só na galeria (clique).

alter table public.produto
  add column if not exists imagem_thumb_url text;

alter table public.produto_imagem
  add column if not exists url_thumb text;

comment on column public.produto.imagem_thumb_url is
  'Miniatura (~96px) para listas e PDV. imagem_url permanece a foto completa (galeria).';
comment on column public.produto_imagem.url_thumb is
  'Miniatura desta imagem da galeria; url continua sendo a versão completa.';
