/**
 * Checksum de linha para export/import em massa de produtos (CRC16 sobre string canônica).
 * Ordem dos segmentos = fonte única para hash, import e fórmula visual no Excel.
 */

import { normalizeUnitCode } from '@/lib/productUnits';
import { vitrineArmazenadaDoProduto } from './embalagensPlanilhaUtils';

function normNum(value) {
  if (value === null || value === undefined || value === '') return '0';
  const normalized = String(value).trim().replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? '0' : Math.round(parsed * 100).toString();
}

function normStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Metadados de cada segmento (mesma ordem do concat). kind: str | num | ativo (= booleans como sim/não, igual à coluna na planilha) */
export const PRODUTO_CANON_SEGMENTS = [
  { key: 'campo_hierarquico_1', kind: 'str' },
  { key: 'campo_hierarquico_2', kind: 'str' },
  { key: 'campo_hierarquico_3', kind: 'str' },
  { key: 'campo_hierarquico_4', kind: 'str' },
  { key: 'campo_hierarquico_5', kind: 'str' },
  { key: 'codigo_barras', kind: 'str' },
  { key: 'marca', kind: 'str' },
  { key: 'tipo', kind: 'str' },
  { key: 'abcd', kind: 'str' },
  { key: 'categoria_nome', kind: 'str' },
  { key: 'area_codigo', kind: 'str' },
  { key: 'valor_compra', kind: 'num' },
  { key: 'casas_decimais', kind: 'num' },
  { key: 'desconto_perc', kind: 'num' },
  { key: 'custo_frete_padrao', kind: 'num' },
  { key: 'custo_imposto1_padrao', kind: 'num' },
  { key: 'custo_imposto2_padrao', kind: 'num' },
  { key: 'avaria_percentual', kind: 'num' },
  { key: 'desconto_compra_padrao', kind: 'num' },
  { key: 'preco_venda_padrao', kind: 'num' },
  { key: 'unidade_principal', kind: 'str' },
  { key: 'unidades_por_pacote', kind: 'num' },
  { key: 'estoque_minimo', kind: 'num' },
  { key: 'estoque_ideal', kind: 'num' },
  { key: 'estoque_maximo', kind: 'num' },
  { key: 'tempo_reposicao_dias', kind: 'num' },
  { key: 'peso_kg', kind: 'num' },
  { key: 'dimensoes_cm', kind: 'str' },
  // Colunas ~AE em diante na planilha (antes só entravam no Excel, não no canónico)
  { key: 'preco_livre', kind: 'ativo' },
  { key: 'controla_serial', kind: 'ativo' },
  { key: 'controla_lote', kind: 'ativo' },
  { key: 'controla_validade', kind: 'ativo' },
  { key: 'unidade_vitrine', kind: 'str' },
  { key: 'ativo', kind: 'ativo' },
];

function vitrineCanonSegment(produto) {
  const principal = normalizeUnitCode(produto?.unidade_principal) || 'UN';
  /** Mesmo contrato da coluna exportada / formulário: só `unidade_vitrine` persistida (vazio = vitrine na base). */
  return normStr(vitrineArmazenadaDoProduto(produto, principal));
}

function segmentValue(produto, seg) {
  if (seg.key === 'unidade_vitrine') return vitrineCanonSegment(produto);
  if (seg.kind === 'str') return normStr(produto[seg.key]);
  if (seg.kind === 'num') return normNum(produto[seg.key] ?? 0);
  if (seg.kind === 'ativo') return produto[seg.key] !== false ? 'sim' : 'não';
  return '';
}

/**
 * String canônica usada no CRC (deve bater com o texto guardado na coluna oculta na exportação).
 */
export function produtoLinhaCanonico(produto) {
  return PRODUTO_CANON_SEGMENTS.map(seg => segmentValue(produto, seg)).join('|');
}

/**
 * Monta expressão Excel (funções em inglês, vírgula) que reproduz o texto canônico da linha.
 * @param {number} rowNumber
 * @param {(key: string) => string} colLetter retorna letra(s) da coluna para cada key
 */
export function buildExcelCanonConcatExpr(rowNumber, colLetter) {
  const sep = '&"|"&';
  const parts = PRODUTO_CANON_SEGMENTS.map(({ key, kind }) => {
    const L = colLetter(key);
    const ref = `${L}${rowNumber}`;
    if (kind === 'str') return `TRIM(${ref}&"")`;
    if (kind === 'num') return `TEXT(IF(${ref}="",0,ROUND(${ref}*100,0)),"0")`;
    if (kind === 'ativo') {
      return `IF(OR(${ref}="false",${ref}="FALSE",${ref}="falso"),"não","sim")`;
    }
    return `TRIM(${ref}&"")`;
  });
  return parts.join(sep);
}

/**
 * CRC16 legado (4 hex) — só para comparar planilhas exportadas antes da mudança para FNV.
 */
export function computeLegacyCRC16Checksum(produto) {
  const concat = produtoLinhaCanonico(produto);
  let crc = 0;
  for (let i = 0; i < concat.length; i++) {
    crc = ((crc << 8) ^ concat.charCodeAt(i)) & 0xffff;
  }
  return crc.toString(16).padStart(4, '0').toUpperCase();
}

/**
 * Hash de linha (FNV-1a 32 bits → 8 hex) — bem menos colisões que CRC16 de 4 hex.
 */
export function computeProdutoLinhaChecksum(produto) {
  const concat = produtoLinhaCanonico(produto);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < concat.length; i++) {
    h ^= concat.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

/** Verifica se o produto corresponde ao valor guardado na planilha (FNV novo ou CRC antigo). */
export function produtoCombinaHashArmazenado(produto, hashArquivoNormalizado) {
  const h = hashArquivoNormalizado.trim().toUpperCase();
  if (!h) return false;
  if (h === computeProdutoLinhaChecksum(produto)) return true;
  if (/^[0-9A-F]{4}$/.test(h) && computeLegacyCRC16Checksum(produto) === h) return true;
  return false;
}

/**
 * Linha da planilha de produtos tem alteração real vs cadastro (só chaves presentes em `dadosPlanilha`).
 * Ignora espelho `is_comercial` em `unidades`/`unidades_alternativas` — só entra no canónico via `unidade_vitrine`.
 */
export function produtoMassaImportLinhaTemAlteracao(cadastro, dadosPlanilha) {
  if (!cadastro || !dadosPlanilha) return false;
  const merged = { ...cadastro, ...dadosPlanilha };
  for (const seg of PRODUTO_CANON_SEGMENTS) {
    if (!Object.prototype.hasOwnProperty.call(dadosPlanilha, seg.key)) continue;
    const cadVal = segmentValue(cadastro, seg);
    const linVal = segmentValue(merged, seg);
    if (cadVal !== linVal) return true;
  }
  return false;
}
