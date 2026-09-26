-- Desactiva zumbis reais do cadastro (sem estoque · sem mov. 4 meses).
-- Lista gerada em 2026-09-21 via buildZumbisFilter / P38-catalogo-zumbis-filter.json

DO $$
DECLARE
  cod text;
  codigos text[] := ARRAY[
    'SF1-94T','9RL-L6C','KOK-ML9','JGW-WK2','E61-M3X','GJV-9VV','NPH-H9H','W1X-SW3','0MM-9Y1','8T0-BZ8',
    'H9D-I9B','UQA-25Q','2FZ-SBM','3HN-RAN','I3V-4UE','7RL-R5W','SS7-6Y2','L0L-B7T','0NL-YTJ','MKI-P3W',
    'JGO-LM0','S56-FAX','LBZ-M7Y','GCE-8D1','4Z6-PMT','JX4-XOF','8ST-MNF','9C8-BY4','0YM-46O','0ZR-3E1',
    'O10-QWQ','64M-Q0T','8D1-0J6','S0Z-ORY','KPM-NZ3','I1E-U8K','T9I-93U','SD9-LN0','QSE-Q2E','QS4-PSR',
    'TJH-S7T','FHQ-02Z','44J-C1D','8Z8-SWC','HGT-9Z5','SSP-VX8','NQQ-YM9','S0X-O7X','WZD-9Y0','1ZB-0D2',
    'I6P-F8P','2Z9-R34','8U7-7RA','JN9-Z8W','OD8-H9J','X9I-UEC','XKC-NP3','OM7-3JE','G4Y-ETP','CQN-I1Y',
    'K4P-LKM','LDU-3YU','NIW-49X','T6T-JOG','T8G-H5W','LYL-72N','RF9-AF0','XCR-G1U','7KM-GBT','Y83-94T',
    '81T-X0E','A33-5XE','A6R-ELC','XM9-J8O','421-C85','RT1-3TP','RAY-B40','W05-F32','RZD-4CB','DN0-8DH',
    '0R4-XH1','MX7-JWJ','J1L-291','X9S-AEY','ZTL-1BK','EYP-G25','L95-XEY','NEO-I1G','OR1-RAN','TZZ-H82',
    'RD0-IAB'
  ];
  rec record;
  mov_count int;
BEGIN
  FOREACH cod IN ARRAY codigos LOOP
    SELECT p.id, p.estoque_atual, p.ativo
    INTO rec
    FROM produto p
    WHERE upper(trim(p.codigo_interno)) = upper(trim(cod))
    LIMIT 1;

    IF rec.id IS NULL THEN
      RAISE NOTICE 'zumbi %: SKU em falta — salta', cod;
      CONTINUE;
    END IF;

    IF COALESCE(rec.estoque_atual, 0) > 0 THEN
      RAISE NOTICE 'zumbi %: estoque % > 0 — salta', cod, rec.estoque_atual;
      CONTINUE;
    END IF;

    SELECT count(*)::int INTO mov_count
    FROM movimentacao_estoque m
    WHERE m.produto_id = rec.id
      AND m.created_at >= now() - interval '4 months';

    IF mov_count > 0 THEN
      RAISE NOTICE 'zumbi %: % mov. recentes — salta', cod, mov_count;
      CONTINUE;
    END IF;

    UPDATE produto SET
      ativo = false,
      tags = CASE
        WHEN COALESCE(tags, '{}') @> ARRAY['zumbi-removido']::text[] THEN tags
        ELSE array_append(COALESCE(tags, '{}'), 'zumbi-removido')
      END,
      dados = COALESCE(dados, '{}'::jsonb) || jsonb_build_object(
        'zumbi_removido_em', '2026-09-21',
        'zumbi_removido_motivo', 'sem estoque · sem mov. 4 meses'
      ),
      updated_at = now()
    WHERE id = rec.id;

    RAISE NOTICE 'zumbi %: desactivado', cod;
  END LOOP;
END $$;
