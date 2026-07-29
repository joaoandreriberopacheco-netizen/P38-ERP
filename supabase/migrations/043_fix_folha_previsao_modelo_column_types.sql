-- 043_fix_folha_previsao_modelo_column_types.sql
-- Corrige tipos de colunas promovidas em 031 que não batem com o schema da entidade FolhaPrevisaoModelo.
-- Sintoma: FolhaPrevisaoModelo.update falha com "invalid input syntax for type numeric: true" ao salvar custo_direto.

-- custo_direto: numeric -> boolean (campo é flag no app, não valor monetário)
alter table public.folha_previsao_modelo
  alter column custo_direto type boolean
  using (
    case
      when custo_direto is not null then custo_direto <> 0
      when lower(coalesce(dados->>'custo_direto', '')) in ('true', 't', '1', 'yes') then true
      when lower(coalesce(dados->>'custo_direto', '')) in ('false', 'f', '0', 'no') then false
      when lower(coalesce(classificacao_despesa, dados->>'classificacao_despesa', '')) = 'indireta' then false
      else true
    end
  );

-- decimo_terceiro_ativo: text -> boolean
alter table public.folha_previsao_modelo
  alter column decimo_terceiro_ativo type boolean
  using (
    case
      when decimo_terceiro_ativo is null or btrim(decimo_terceiro_ativo) = '' then
        case
          when lower(coalesce(dados->>'decimo_terceiro_ativo', '')) in ('false', 'f', '0', 'no') then false
          else true
        end
      when lower(decimo_terceiro_ativo) in ('true', 't', '1', 'yes') then true
      when lower(decimo_terceiro_ativo) in ('false', 'f', '0', 'no') then false
      else true
    end
  );

-- decimo_mes_parcela_1 / decimo_mes_parcela_2: text -> integer
alter table public.folha_previsao_modelo
  alter column decimo_mes_parcela_1 type integer
  using (
    case
      when decimo_mes_parcela_1 ~ '^-?[0-9]+$' then decimo_mes_parcela_1::integer
      when dados->>'decimo_mes_parcela_1' ~ '^-?[0-9]+$' then (dados->>'decimo_mes_parcela_1')::integer
      else null
    end
  );

alter table public.folha_previsao_modelo
  alter column decimo_mes_parcela_2 type integer
  using (
    case
      when decimo_mes_parcela_2 ~ '^-?[0-9]+$' then decimo_mes_parcela_2::integer
      when dados->>'decimo_mes_parcela_2' ~ '^-?[0-9]+$' then (dados->>'decimo_mes_parcela_2')::integer
      else null
    end
  );

-- decimo_percentual_parcela: text -> numeric
alter table public.folha_previsao_modelo
  alter column decimo_percentual_parcela type numeric
  using (
    case
      when decimo_percentual_parcela ~ '^-?[0-9]+(\.[0-9]+)?$' then decimo_percentual_parcela::numeric
      when dados->>'decimo_percentual_parcela' ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados->>'decimo_percentual_parcela')::numeric
      else null
    end
  );

-- retirada_valor_fixo: text -> numeric
alter table public.folha_previsao_modelo
  alter column retirada_valor_fixo type numeric
  using (
    case
      when retirada_valor_fixo ~ '^-?[0-9]+(\.[0-9]+)?$' then retirada_valor_fixo::numeric
      when dados->>'retirada_valor_fixo' ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados->>'retirada_valor_fixo')::numeric
      else null
    end
  );

-- ferias_programadas: text -> jsonb
alter table public.folha_previsao_modelo
  alter column ferias_programadas type jsonb
  using (
    case
      when ferias_programadas is null or btrim(ferias_programadas) = '' then
        case
          when jsonb_typeof(dados->'ferias_programadas') = 'array' then dados->'ferias_programadas'
          else '[]'::jsonb
        end
      when ferias_programadas ~ '^\s*\[' then ferias_programadas::jsonb
      else '[]'::jsonb
    end
  );
