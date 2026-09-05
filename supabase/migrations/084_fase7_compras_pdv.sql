-- 084_fase7_compras_pdv.sql
-- Fase 7: catálogo PDV + busca de clientes via Postgres (menos Base44 no LCP).

create or replace function public.pdv_catalogo_read()
returns jsonb language plpgsql security definer stable as $$
begin
  return coalesce((
    select jsonb_agg(row order by row->>'nome')
    from (
      select jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'codigo_interno', p.codigo_interno,
        'codigo_barras', p.codigo_barras,
        'preco_venda_padrao', p.preco_venda_padrao,
        'estoque_atual', p.estoque_atual,
        'ativo', coalesce(p.ativo, true),
        'categoria_nome', p.categoria_nome,
        'tags', coalesce(p.tags, '[]'::jsonb),
        'tipo', p.tipo,
        'preco_livre', p.preco_livre,
        'unidade_principal', p.unidade_principal,
        'unidade_vitrine', p.unidade_vitrine,
        'unidade_comercial_id', coalesce(p.dados->>'unidade_comercial_id', ''),
        'unidade_apresentacao_default', coalesce(p.dados->>'unidade_apresentacao_default', ''),
        'unidade_show_comercial', case
          when lower(coalesce(p.dados->>'unidade_show_comercial', '')) in ('true', 'false')
            then (p.dados->>'unidade_show_comercial')::boolean
          else null
        end,
        'unidades_alternativas', coalesce(p.unidades_alternativas, '[]'::jsonb),
        'unidades_por_pacote', p.unidades_por_pacote,
        'casas_decimais', p.casas_decimais,
        'imagem_url', p.imagem_url,
        'reserva_portal', coalesce(pc.reserva_portal, false)
      ) as row
      from public.produto p
      left join public.portal_catalog pc on pc.produto_id = p.id
      where coalesce(p.ativo, true)
    ) q
  ), '[]'::jsonb);
end;
$$;

create or replace function public.pdv_clientes_search(
  p_term text default '',
  p_limit int default 25
)
returns jsonb language plpgsql security definer stable as $$
declare
  v_term text := lower(trim(coalesce(p_term, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
begin
  if length(v_term) < 2 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row order by row->>'nome')
    from (
      select jsonb_build_object(
        'id', t.id,
        'nome', t.nome,
        'cpf_cnpj', t.cpf_cnpj,
        'telefone', t.telefone,
        'email', t.email,
        'endereco', t.endereco,
        'tipo', t.tipo,
        'perfil', t.perfil,
        'ativo', coalesce(t.ativo, true)
      ) as row
      from public.terceiro t
      where coalesce(t.ativo, true)
        and lower(trim(coalesce(t.tipo, ''))) in ('cliente', 'ambos')
        and (
          lower(coalesce(t.nome, '')) like '%' || v_term || '%'
          or lower(coalesce(t.cpf_cnpj, '')) like '%' || v_term || '%'
          or lower(coalesce(t.telefone, '')) like '%' || v_term || '%'
        )
      limit v_limit
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.pdv_catalogo_read() to authenticated, anon, service_role;
grant execute on function public.pdv_clientes_search(text, int) to authenticated, anon, service_role;
