-- Mescla ROLO DE LÃ 23 CM: anti-respingo (043-5GC) + sintética (FD0-O28).
-- Preço: fica o maior preco_venda_padrao / valor_compra entre os dois; empate → 043-5GC.

DO $$
DECLARE
  a RECORD;
  b RECORD;
  win_id uuid;
  lose_id uuid;
  win_cod text;
  best_venda numeric;
  best_compra numeric;
  best_custo numeric;
  sum_estoque numeric;
BEGIN
  SELECT * INTO a FROM produto WHERE codigo_interno = '043-5GC' LIMIT 1;
  SELECT * INTO b FROM produto WHERE codigo_interno = 'FD0-O28' LIMIT 1;

  IF a.id IS NULL OR b.id IS NULL THEN
    RAISE NOTICE 'merge rolo la 23cm: SKUs em falta — salta';
    RETURN;
  END IF;

  IF GREATEST(
    COALESCE(a.preco_venda_padrao, 0),
    COALESCE(a.valor_compra, 0),
    COALESCE(a.preco_custo_calculado, 0)
  ) >= GREATEST(
    COALESCE(b.preco_venda_padrao, 0),
    COALESCE(b.valor_compra, 0),
    COALESCE(b.preco_custo_calculado, 0)
  ) THEN
    win_id := a.id;
    lose_id := b.id;
    win_cod := a.codigo_interno;
  ELSE
    win_id := b.id;
    lose_id := a.id;
    win_cod := b.codigo_interno;
  END IF;

  best_venda := GREATEST(COALESCE(a.preco_venda_padrao, 0), COALESCE(b.preco_venda_padrao, 0));
  best_compra := GREATEST(COALESCE(a.valor_compra, 0), COALESCE(b.valor_compra, 0));
  best_custo := GREATEST(COALESCE(a.preco_custo_calculado, 0), COALESCE(b.preco_custo_calculado, 0));
  sum_estoque := COALESCE(a.estoque_atual, 0) + COALESCE(b.estoque_atual, 0);

  UPDATE produto SET
    nome = 'ROLO DE LÃ 23 CM',
    preco_venda_padrao = CASE WHEN best_venda > 0 THEN best_venda ELSE preco_venda_padrao END,
    valor_compra = CASE WHEN best_compra > 0 THEN best_compra ELSE valor_compra END,
    preco_custo_calculado = CASE WHEN best_custo > 0 THEN best_custo ELSE preco_custo_calculado END,
    estoque_atual = sum_estoque,
    ativo = true,
    updated_at = now()
  WHERE id = win_id;

  UPDATE produto SET
    ativo = false,
    observacoes = COALESCE(observacoes, '') || E'\n[merge] Mesclado em ' || win_cod || ' (ROLO DE LÃ 23 CM).',
    updated_at = now()
  WHERE id = lose_id;

  RAISE NOTICE 'merge rolo la 23cm: vencedor % · arquivado %', win_cod,
    CASE WHEN win_id = a.id THEN b.codigo_interno ELSE a.codigo_interno END;
END $$;
