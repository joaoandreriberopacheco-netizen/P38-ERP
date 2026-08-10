-- 053: despesas de turnos antigos foram puxadas para o TC-00120 (efeito colateral da 050).
-- Restaura turno_caixa_id pelo intervalo do turno histórico; mantém só despesas de hoje no turno aberto.

do $$
declare
  v_caixa_pdv text := '69b9311927ebd3bc12ed37f5';
  v_turno_hoje text := '975e9968-b1f5-4bd5-ae9f-ccad8c11545e';
  v_hoje date := '2026-08-05';
begin
  -- Despesas antigas → turno em que foram lançadas
  update public.lancamento_financeiro l
  set turno_caixa_id = sub.turno_id,
      dados = coalesce(l.dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', sub.turno_id)
  from (
    select distinct on (l2.id)
      l2.id as lanc_id,
      t.id as turno_id
    from public.lancamento_financeiro l2
    join public.turno_caixa t
      on t.conta_caixa_pdv_id = v_caixa_pdv
     and l2.created_at >= t.data_abertura
     and (t.data_fechamento is null or l2.created_at <= t.data_fechamento + interval '2 hours')
    where l2.turno_caixa_id = v_turno_hoje
      and l2.tipo = 'Despesa'
      and l2.created_at::date < v_hoje
    order by l2.id, t.data_abertura desc
  ) sub
  where l.id = sub.lanc_id;

  -- Despesas antigas sem turno encontrado: remover vínculo errado
  update public.lancamento_financeiro
  set turno_caixa_id = null,
      dados = coalesce(dados, '{}'::jsonb) - 'turno_caixa_id'
  where turno_caixa_id = v_turno_hoje
    and tipo = 'Despesa'
    and created_at::date < v_hoje;

  -- Receitas antigas (não vinculadas a pedido de hoje): restaurar pelo intervalo do turno
  update public.lancamento_financeiro l
  set turno_caixa_id = sub.turno_id,
      dados = coalesce(l.dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', sub.turno_id)
  from (
    select distinct on (l2.id)
      l2.id as lanc_id,
      t.id as turno_id
    from public.lancamento_financeiro l2
    join public.turno_caixa t
      on t.conta_caixa_pdv_id = v_caixa_pdv
     and l2.created_at >= t.data_abertura
     and (t.data_fechamento is null or l2.created_at <= t.data_fechamento + interval '2 hours')
    where l2.turno_caixa_id = v_turno_hoje
      and l2.tipo = 'Receita'
      and l2.created_at::date < v_hoje
      and coalesce(l2.referencia_tipo, '') <> 'PedidoVenda'
    order by l2.id, t.data_abertura desc
  ) sub
  where l.id = sub.lanc_id;

  -- despesas_ids do turno de hoje
  update public.turno_caixa t
  set despesas_ids = coalesce((
    select jsonb_agg(l.id::text order by l.created_at)
    from public.lancamento_financeiro l
    where l.turno_caixa_id = v_turno_hoje
      and l.tipo = 'Despesa'
      and coalesce(l.referencia_tipo, '') <> 'MovimentosCaixa'
  ), '[]'::jsonb)
  where t.id = v_turno_hoje;
end $$;
