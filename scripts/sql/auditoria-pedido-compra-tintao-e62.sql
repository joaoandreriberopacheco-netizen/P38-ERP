-- =============================================================================
-- Auditoria: Pedido Tintão E62 — comprado vs recebido vs o que realmente falta
-- =============================================================================
-- Onde correr: Supabase → SQL Editor (projecto P38)
-- Ajuste abaixo se o número do pedido for diferente de E62.
--
-- Objetivo:
--   1) Ver o que foi comprado (pedido_compra_item)
--   2) Ver embarques e quantidades embarcadas/recebidas por linha
--   3) Consolidar por produto: pedido | recebido (embarques reais) | em trânsito | saldo Necessidade
--   4) Listar só linhas com falta REAL pós-recepção (não confundir com em trânsito)
-- =============================================================================

-- ── Parâmetros (edite aqui) ─────────────────────────────────────────────────
with params as (
  select
    upper(trim('E62')) as pedido_numero,           -- ex.: E62
    upper(trim('E62-67G')) as embarque_codigo_alvo -- ex.: card E62-67G (opcional, só destaque)
),

pedido as (
  select pc.*
  from public.pedido_compra pc
  cross join params p
  where upper(replace(coalesce(pc.numero, ''), ' ', '')) = p.pedido_numero
     or (
       pc.fornecedor_nome ilike '%tint%'
       and upper(replace(coalesce(pc.numero, ''), ' ', '')) like p.pedido_numero || '%'
     )
  order by pc.created_at desc
  limit 1
),

embarques as (
  select
    e.*,
    coalesce(
      nullif(trim(e.dados->>'codigo_exibicao'), ''),
      nullif(trim(pc.numero || '-' || e.numero), ''),
      e.numero
    ) as codigo_exibicao_calc,
    row_number() over (order by e.created_at nulls last, e.id) as ordem_embarque
  from public.embarque e
  join pedido pc on pc.id = e.pedido_compra_id
),

-- Linhas SQL canónicas do pedido (fonte: pedido_compra_item)
itens_pedido as (
  select
    pci.id as pedido_item_id,
    pci.produto_id,
    coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
    coalesce(pci.quantidade_comercial, 0) as qtd_pedida_comercial,
    coalesce(pci.quantidade_base, 0) as qtd_pedida_base,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade,
    coalesce(pci.total, 0) as valor_linha_pedido
  from public.pedido_compra_item pci
  join pedido pc on pc.id = pci.pedido_compra_id
),

-- Movimentos de estoque ligados ao pedido (entrada na recepção)
movimentos_recebimento as (
  select
    me.produto_id,
    sum(coalesce(me.quantidade_comercial, me.quantidade, 0)) as qtd_entrada_estoque_comercial,
    sum(coalesce(me.quantidade_base, 0)) as qtd_entrada_estoque_base,
    count(*) as qtd_movimentos
  from public.movimentacao_estoque me
  join pedido pc on pc.id = me.referencia_id
  where me.referencia_tipo = 'PedidoCompra'
    and coalesce(me.quantidade, me.quantidade_comercial, 0) > 0
  group by me.produto_id
),

-- Detalhe por embarque × produto (fonte: embarque_item)
linhas_embarque as (
  select
    e.id as embarque_id,
    e.codigo_exibicao_calc,
    e.tipo as embarque_tipo,
    e.status as embarque_status,
    e.status_recebimento,
    e.data_embarque,
    e.eta,
    e.transportadora_nome,
    ei.produto_id,
    coalesce(nullif(trim(ei.produto_nome), ''), ei.dados->>'produto_nome') as produto_nome,
    coalesce(ei.quantidade_pedida_comercial, 0) as qtd_pedida_emb,
    coalesce(ei.quantidade_embarcada_comercial, 0) as qtd_embarcada,
    coalesce(ei.quantidade_recebida_comercial, 0) as qtd_recebida,
    coalesce(ei.divergencia_tipo, 'Nenhuma') as divergencia_tipo,
    coalesce(nullif(trim(ei.unidade_sigla), ''), ei.dados->>'unidade_medida', 'UN') as unidade,
    (e.tipo is distinct from 'Necessidade') as embarque_real
  from embarques e
  join public.embarque_item ei on ei.embarque_id = e.id
),

-- Totais por produto em embarques REAIS (exclui tipo Necessidade)
totais_reais as (
  select
    le.produto_id,
    sum(le.qtd_embarcada) as total_embarcado_comercial,
    sum(le.qtd_recebida) as total_recebido_comercial,
    sum(greatest(le.qtd_embarcada - le.qtd_recebida, 0)) as total_em_transito_comercial
  from linhas_embarque le
  where le.embarque_real
  group by le.produto_id
),

-- Saldo registado em embarques tipo Necessidade (pós-recepção / divergência)
totais_necessidade as (
  select
    le.produto_id,
    sum(greatest(le.qtd_embarcada, le.qtd_pedida_emb, 0)) as saldo_necessidade_comercial
  from linhas_embarque le
  where not le.embarque_real
  group by le.produto_id
),

consolidado as (
  select
    ip.produto_id,
    ip.produto_nome,
    ip.unidade,
    ip.qtd_pedida_comercial,
    coalesce(tr.total_embarcado_comercial, 0) as embarcado_embarques_reais,
    coalesce(tr.total_recebido_comercial, 0) as recebido_embarques_reais,
    coalesce(tr.total_em_transito_comercial, 0) as em_transito,
    coalesce(tn.saldo_necessidade_comercial, 0) as saldo_embarque_necessidade,
    coalesce(mr.qtd_entrada_estoque_comercial, 0) as entrada_estoque_movimentos,
    round(
      greatest(ip.qtd_pedida_comercial - coalesce(tr.total_recebido_comercial, 0), 0)::numeric,
      4
    ) as falta_pos_recepcao_comercial,
    round(
      greatest(
        ip.qtd_pedida_comercial
        - coalesce(tr.total_recebido_comercial, 0)
        - coalesce(tr.total_em_transito_comercial, 0),
        0
      )::numeric,
      4
    ) as falta_sem_contar_transito,
    ip.valor_linha_pedido
  from itens_pedido ip
  left join totais_reais tr on tr.produto_id = ip.produto_id
  left join totais_necessidade tn on tn.produto_id = ip.produto_id
  left join movimentos_recebimento mr on mr.produto_id = ip.produto_id
)

-- =============================================================================
-- A) Cabeçalho do pedido
-- =============================================================================
select
  'A_cabecalho_pedido' as secao,
  pc.id,
  pc.numero,
  pc.fornecedor_nome,
  pc.status,
  pc.status_aprovacao_financeira,
  pc.status_embarque,
  pc.status_recebimento_geral,
  pc.valor_total,
  pc.data_emissao,
  pc.data_aprovacao_financeira,
  pc.created_at
from pedido pc;

-- =============================================================================
-- B) Embarques do pedido (inclui E62-67G se existir)
-- =============================================================================
select
  'B_embarques' as secao,
  e.id,
  e.codigo_exibicao_calc as codigo_exibicao,
  e.tipo,
  e.status,
  e.status_recebimento,
  e.data_embarque,
  e.eta,
  e.transportadora_nome,
  e.observacoes,
  e.ordem_embarque,
  case
    when upper(replace(e.codigo_exibicao_calc, ' ', '')) = (select embarque_codigo_alvo from params)
      then '>>> ALVO E62-67G'
    else ''
  end as destaque
from embarques e
order by e.ordem_embarque;

-- =============================================================================
-- C) Detalhe linha a linha por embarque
-- =============================================================================
select
  'C_linhas_por_embarque' as secao,
  le.codigo_exibicao_calc as embarque,
  le.embarque_tipo,
  le.status_recebimento,
  le.produto_nome,
  le.produto_id,
  le.qtd_pedida_emb,
  le.qtd_embarcada,
  le.qtd_recebida,
  le.qtd_embarcada - le.qtd_recebida as pendente_receber_neste_embarque,
  le.unidade,
  le.divergencia_tipo
from linhas_embarque le
order by le.codigo_exibicao_calc, le.produto_nome;

-- =============================================================================
-- D) Consolidado por produto — comprado vs recebido vs falta
-- =============================================================================
select
  'D_consolidado_produto' as secao,
  c.produto_nome,
  c.unidade,
  c.qtd_pedida_comercial as comprado,
  c.embarcado_embarques_reais as embarcado_real,
  c.recebido_embarques_reais as recebido_real,
  c.em_transito as ainda_em_transito,
  c.saldo_embarque_necessidade as saldo_necessidade_bd,
  c.entrada_estoque_movimentos as entrada_estoque,
  c.falta_pos_recepcao_comercial as falta_pos_recepcao,
  c.falta_sem_contar_transito as falta_excl_transito,
  case
    when c.falta_sem_contar_transito > 0.009 then 'FALTA REAL (reposição)'
    when c.em_transito > 0.009 then 'EM TRÂNSITO (não é necessidade)'
    when c.qtd_pedida_comercial - c.recebido_embarques_reais <= 0.009 then 'OK / COMPLETO'
    else 'REVISAR'
  end as diagnostico,
  c.valor_linha_pedido
from consolidado c
order by c.falta_sem_contar_transito desc, c.produto_nome;

-- =============================================================================
-- E) Só o que REALMENTE falta (exclui trânsito — ex.: E62-67G embarcado a caminho)
-- =============================================================================
select
  'E_falta_real' as secao,
  c.produto_nome,
  c.unidade,
  c.qtd_pedida_comercial as comprado,
  c.recebido_embarques_reais as recebido,
  c.em_transito,
  c.falta_sem_contar_transito as falta_real,
  c.saldo_embarque_necessidade as ja_registrado_necessidade
from consolidado c
where c.falta_sem_contar_transito > 0.009
order by c.falta_sem_contar_transito desc;

-- =============================================================================
-- F) Foco no embarque E62-67G (card Tintão em trânsito / alvo da exclusão)
-- =============================================================================
select
  'F_embarque_alvo' as secao,
  le.codigo_exibicao_calc as embarque,
  le.embarque_tipo,
  le.status_recebimento,
  le.transportadora_nome,
  le.produto_nome,
  le.qtd_embarcada,
  le.qtd_recebida,
  le.qtd_embarcada - le.qtd_recebida as pendente_receber,
  le.unidade,
  case
    when le.qtd_embarcada > 0 and le.qtd_recebida <= 0 then 'EM TRÂNSITO — não contar como Necessidade'
    when le.qtd_recebida > 0 and le.qtd_embarcada > le.qtd_recebida then 'PARCIAL — falta receber restante'
    else 'OK ou sem qty'
  end as interpretacao
from linhas_embarque le
cross join params p
where upper(replace(le.codigo_exibicao_calc, ' ', '')) = p.embarque_codigo_alvo
   or le.codigo_exibicao_calc ilike '%67G%'
order by le.produto_nome;

-- =============================================================================
-- G) Resumo executivo (1 linha)
-- =============================================================================
select
  'G_resumo' as secao,
  (select numero from pedido) as pedido,
  (select count(*) from itens_pedido) as qtd_itens_pedido,
  (select count(*) from embarques) as qtd_embarques,
  (select count(*) from consolidado where falta_sem_contar_transito > 0.009) as produtos_com_falta_real,
  (select count(*) from consolidado where em_transito > 0.009 and falta_sem_contar_transito <= 0.009) as produtos_so_em_transito,
  (select coalesce(sum(falta_sem_contar_transito), 0) from consolidado) as soma_falta_real_unidades,
  (select coalesce(sum(em_transito), 0) from consolidado) as soma_em_transito_unidades;
