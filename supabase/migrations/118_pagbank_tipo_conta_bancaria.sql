-- 118: PagBank classificado como Conta Bancária (não Carteira Digital).

update public.contas_financeiras
set tipo = 'Conta Bancária'
where lower(coalesce(nome, dados->>'nome', '')) like '%pagbank%'
   or (
     lower(coalesce(nome, dados->>'nome', '')) like '%pag%'
     and lower(coalesce(nome, dados->>'nome', '')) like '%bank%'
   );
