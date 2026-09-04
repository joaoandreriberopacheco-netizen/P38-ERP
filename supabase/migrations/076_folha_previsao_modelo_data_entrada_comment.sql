-- Comentário da coluna data_entrada (075 já aplicou a coluna).

comment on column public.folha_previsao_modelo.data_entrada is
  'Data de início na empresa. NULL = direito integral (legados). Usado para salário, 13º e férias proporcionais.';
