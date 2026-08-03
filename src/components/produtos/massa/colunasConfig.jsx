// Configuração central de colunas para exportação/importação

// editavel: true = célula desbloqueada no Excel + campo incluído no diff

// tipo: 'string' | 'numero' | 'boolean'

// calculado: true = coluna bloqueada gerada na exportação (não importada)



import { MAX_EMBALAGENS_PLANILHA } from './embalagensPlanilhaUtils';



/** 1 base + 2 alternativas — planilha “Embalagens / unidades”. */

const EMB_SLOT_META = [

  {

    siglaLabel: 'Base sigla',

    fatorLabel: 'Base fator conversão',

    ajusteLabel: 'Base ajuste preço (×)',

    siglaAlt: ['Emb.1 Sigla'],

    fatorAlt: ['Emb.1 Fator', 'Emb.1 fator conversão', 'Base fator'],

    ajusteAlt: ['Emb.1 Ajuste preço (×)', 'Emb.1 Ajuste preço'],

  },

  {

    siglaLabel: 'Alt.1 sigla',

    fatorLabel: 'Alt.1 fator conversão',

    ajusteLabel: 'Alt.1 ajuste preço (×)',

    siglaAlt: ['Emb.2 Sigla'],

    fatorAlt: ['Emb.2 Fator', 'Emb.2 fator conversão', 'Alt.1 fator'],

    ajusteAlt: ['Emb.2 Ajuste preço (×)', 'Emb.2 Ajuste preço'],

  },

  {

    siglaLabel: 'Alt.2 sigla',

    fatorLabel: 'Alt.2 fator conversão',

    ajusteLabel: 'Alt.2 ajuste preço (×)',

    siglaAlt: ['Emb.3 Sigla'],

    fatorAlt: ['Emb.3 Fator', 'Emb.3 fator conversão', 'Alt.2 fator'],

    ajusteAlt: ['Emb.3 Ajuste preço (×)', 'Emb.3 Ajuste preço'],

  },

];



export const EMB_SLOT_COLS = [];

for (let n = 1; n <= MAX_EMBALAGENS_PLANILHA; n++) {

  const meta = EMB_SLOT_META[n - 1];

  EMB_SLOT_COLS.push(

    {

      key: `emb${n}_sigla`,

      label: meta.siglaLabel,

      altLabels: meta.siglaAlt,

      editavel: true,

      width: 14,

      tipo: 'string',

    },

    {

      key: `emb${n}_fator`,

      label: meta.fatorLabel,

      altLabels: meta.fatorAlt,

      editavel: true,

      width: 14,

      tipo: 'numero',

    },

    {

      key: `emb${n}_ajuste`,

      label: meta.ajusteLabel,

      altLabels: meta.ajusteAlt,

      editavel: true,

      width: 18,

      tipo: 'numero',

    },

  );

}



/** ID, referência, base + Alt.1–2 (sigla, fator de conversão, ajuste preço ×) e vitrine 0/1 por slot. */

export const COLUNAS_SOMENTE_EMBALAGENS = [

  { key: 'id', label: 'ID (não editar)', editavel: false, width: 28, tipo: 'string' },

  { key: 'codigo_interno', label: 'Cód. Interno', editavel: false, width: 14, tipo: 'string' },

  { key: 'nome', label: 'Nome (referência)', editavel: false, width: 36, tipo: 'string' },

  ...EMB_SLOT_COLS,

  {

    key: 'emb1_vitrine',

    label: 'Base vitrine (0/1)',

    altLabels: ['Base vitrine'],

    editavel: true,

    width: 18,

    tipo: 'numero',

  },

  {

    key: 'emb2_vitrine',

    label: 'Alt.1 vitrine (0/1)',

    altLabels: ['Alt.1 vitrine'],

    editavel: true,

    width: 18,

    tipo: 'numero',

  },

  {

    key: 'emb3_vitrine',

    label: 'Alt.2 vitrine (0/1)',

    altLabels: ['Alt.2 vitrine'],

    editavel: true,

    width: 18,

    tipo: 'numero',

  },

];



export const COLUNAS_CONFIG = [

  // --- Identificadores (somente-leitura) ---

  { key: 'id',                      label: 'ID (não editar)',        editavel: false, width: 28, tipo: 'string' },

  { key: 'codigo_interno',          label: 'Cód. Interno',           editavel: false, width: 14, tipo: 'string' },



  // --- Hierarquia (editável) ---

  { key: 'campo_hierarquico_1',     label: 'Nível 1 (*)',            editavel: true,  width: 28, tipo: 'string' },

  { key: 'campo_hierarquico_2',     label: 'Nível 2',                editavel: true,  width: 20, tipo: 'string' },

  { key: 'campo_hierarquico_3',     label: 'Nível 3',                editavel: true,  width: 18, tipo: 'string' },

  { key: 'campo_hierarquico_4',     label: 'Nível 4',                editavel: true,  width: 18, tipo: 'string' },

  { key: 'campo_hierarquico_5',     label: 'Nível 5',                editavel: true,  width: 18, tipo: 'string' },



  // --- Identificação complementar ---

  { key: 'codigo_barras',           label: 'Cód. Barras',            editavel: true,  width: 18, tipo: 'string' },

  { key: 'marca',                   label: 'Marca',                  editavel: true,  width: 16, tipo: 'string' },

  { key: 'tipo',                    label: 'Tipo',                   editavel: true,  width: 12, tipo: 'string' },



  // --- Categorização ---

  { key: 'categoria_nome',          label: 'Categoria',              editavel: true,  width: 20, tipo: 'string' },

  { key: 'area_codigo',             label: 'Área',                   editavel: true,  width: 14, tipo: 'string' },



  // --- Precificação ---

  { key: 'valor_compra',            label: 'Valor Compra (R$)',      editavel: true,  width: 18, tipo: 'numero' },

  { key: 'desconto_perc',           label: 'Desconto (%)',           editavel: true,  width: 14, tipo: 'numero' },

  { key: 'custo_frete_padrao',      label: 'Frete Padrão (R$)',      editavel: true,  width: 18, tipo: 'numero' },

  { key: 'custo_imposto1_padrao',   label: 'Imposto 1',              editavel: true,  width: 14, tipo: 'numero' },

  { key: 'custo_imposto2_padrao',   label: 'Imposto 2',              editavel: true,  width: 14, tipo: 'numero' },

  { key: 'avaria_percentual',       label: 'Avaria (%)',             editavel: true,  width: 14, tipo: 'numero' },

  { key: 'desconto_compra_padrao',  label: 'Desc. Comercial (R$)',  editavel: true,  width: 16, tipo: 'numero' },

  // coluna calculada (bloqueada) — injetada após os custos na exportação

  { key: 'custo_total_calculado',   label: 'Custo Total Calculado',  editavel: false, width: 22, tipo: 'numero', calculado: true },

  { key: 'preco_venda_padrao',      label: 'Preço Venda (*)',        editavel: true,  width: 18, tipo: 'numero' },



  // --- Estoque e Sistema ---

  { key: 'unidade_principal',       label: 'Unidade',                editavel: true,  width: 12, tipo: 'string' },

  { key: 'casas_decimais',          label: 'Casas Decimais',         editavel: true,  width: 16, tipo: 'numero' },

  { key: 'unidades_por_pacote',     label: 'Qtd/Pacote',             editavel: true,  width: 14, tipo: 'numero' },

  { key: 'estoque_minimo',          label: 'Estoque Mínimo',         editavel: true,  width: 16, tipo: 'numero' },

  { key: 'estoque_ideal',           label: 'Estoque Ideal',          editavel: true,  width: 16, tipo: 'numero' },

  { key: 'estoque_maximo',          label: 'Estoque Máximo',         editavel: true,  width: 16, tipo: 'numero' },

  { key: 'tempo_reposicao_dias',    label: 'Tempo Reposição (dias)', editavel: true,  width: 22, tipo: 'numero' },



  // --- Físico ---

  { key: 'peso_kg',                 label: 'Peso (kg)',              editavel: true,  width: 12, tipo: 'numero' },

  { key: 'dimensoes_cm',            label: 'Dimensões (cm)',         editavel: true,  width: 18, tipo: 'string' },



  // --- Classificação ---

  { key: 'abcd',                    label: 'Curva ABCD',             editavel: true,  width: 14, tipo: 'string', enum: ['A','B','C','D','E'] },



  // --- PDV e Comportamento ---

  { key: 'preco_livre',             label: 'Preço Livre (SIM/NÃO)',  editavel: true,  width: 18, tipo: 'boolean' },



  // --- Rastreabilidade ---

  { key: 'controla_serial',         label: 'Controla Serial (SIM/NÃO)',  editavel: true,  width: 20, tipo: 'boolean' },

  { key: 'controla_lote',           label: 'Controla Lote (SIM/NÃO)',    editavel: true,  width: 18, tipo: 'boolean' },

  { key: 'controla_validade',       label: 'Controla Validade (SIM/NÃO)', editavel: true,  width: 20, tipo: 'boolean' },



  // --- Status ---

  { key: 'ativo',                   label: 'Ativo (SIM/NÃO)',        editavel: true,  width: 14, tipo: 'boolean' },



  {

    key: 'unidade_vitrine',

    label: 'Unidade vitrine',

    altLabels: [
      'Unidade comercial (sigla)',
      'Unidade Vitrine',
      'Unidade vitrine (sigla)',
      'Unidade de vitrine (lista)',
      'Unidade de vitrine',
    ],

    editavel: true,

    width: 22,

    tipo: 'string',

  },



  // --- Verificação (somente leitura) ---

  { key: '_canon_snapshot',         label: '_base_hash',             editavel: false, width: 4, tipo: 'string', calculado: true },

  { key: '_hash_orig',              label: 'Hash Verificação',       editavel: false, width: 24, tipo: 'string', calculado: true },

  { key: 'alterado',                label: 'Alterado?',              editavel: false, width: 14, tipo: 'string', calculado: true },

];



// Mapa rápido key → config

export const COLUNAS_POR_KEY = {};

COLUNAS_CONFIG.forEach(c => { COLUNAS_POR_KEY[c.key] = c; });


