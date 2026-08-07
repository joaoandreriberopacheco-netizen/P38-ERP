/**
 * Extrato de estoque: saldo após cada movimentação reconciliado com estoque_atual do produto.
 */

import { normalizeSearchText } from '@/lib/normalizeSearchText';

function localDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'sem-data';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Delta em unidades (positivo = entrada no estoque). */
export function deltaQuantidadeMovimento(mov) {
  const q = Number(mov?.quantidade) || 0;
  const t = mov?.tipo;
  if (t === 'Entrada') return q;
  if (t === 'Saída') return -q;
  return 0;
}

export function ordenarMovimentacoesCronologico(movimentacoes) {
  return [...(movimentacoes || [])].sort((a, b) => {
    const ta = new Date(a?.created_date || 0).getTime();
    const tb = new Date(b?.created_date || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

/**
 * @returns {{
 *   linhas: { mov: object, saldoApos: number }[],
 *   saldoInicial: number,
 *   somaDeltas: number,
 *   estoqueReconciliado: number,
 *   divergencia: number,
 * }}
 */
export function calcularExtratoComSaldo(movimentacoes, estoqueAtual) {
  const ordenadas = ordenarMovimentacoesCronologico(movimentacoes);
  let somaDeltas = 0;
  for (const m of ordenadas) {
    somaDeltas += deltaQuantidadeMovimento(m);
  }
  const atual = Number(estoqueAtual) || 0;
  const saldoInicial = atual - somaDeltas;

  const linhas = [];
  let acumulado = saldoInicial;
  for (const m of ordenadas) {
    acumulado += deltaQuantidadeMovimento(m);
    linhas.push({ mov: m, saldoApos: acumulado });
  }

  const divergencia = Math.abs(acumulado - atual) > 0.0001 ? acumulado - atual : 0;

  return {
    linhas,
    saldoInicial,
    somaDeltas,
    estoqueReconciliado: atual,
    divergencia,
  };
}

export function textoReferenciaTipo(mov) {
  return mov?.referencia_tipo || mov?.motivo || mov?.tipo || '—';
}

/** Nome do cliente, fornecedor ou outro terceiro ligado ao movimento. */
export function textoTerceiroEnvolvido(mov) {
  const candidatos = [
    mov?.cliente_nome,
    mov?.terceiro_nome,
    mov?.referencia_cliente_nome,
    mov?.fornecedor_nome,
    mov?.nome_terceiro,
  ];
  const nome = candidatos.find((v) => v && String(v).trim());
  return nome ? String(nome).trim() : '';
}

/** Rótulo contextual (Cliente, Fornecedor, etc.) para o terceiro do movimento. */
export function rotuloTerceiroEnvolvido(mov) {
  const ref = String(mov?.referencia_tipo || mov?.motivo || '').toLowerCase();
  if (ref.includes('compra') || ref.includes('pedidocompra') || ref.includes('embarque')) return 'Fornecedor';
  if (ref.includes('venda') || ref.includes('pedidovenda') || ref.includes('devolu')) return 'Cliente';
  if (ref.includes('consumo')) return 'Destino';
  return 'Terceiro';
}

export function saldoFimDiaLinhas(linhasDia) {
  const result = (linhasDia || []).reduce((acc, l) => {
    const t = new Date(l.mov?.created_date || 0).getTime();
    const best = acc?.t ?? -Infinity;
    return t >= best ? { t, saldo: l.saldoApos } : acc;
  }, null);
  return result?.saldo ?? null;
}

/** Agrupa linhas do extrato por dia (yyyy-MM-dd). */
export function agruparLinhasPorDia(linhas, ordemLista) {
  const grupos = new Map();
  for (const linha of linhas || []) {
    const dia = linha.mov?.created_date ? localDateKey(linha.mov.created_date) : 'sem-data';
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(linha);
  }

  const dias = [...grupos.keys()].sort((a, b) => {
    if (a === 'sem-data') return 1;
    if (b === 'sem-data') return -1;
    return ordemLista === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  });

  return dias.map((dia) => {
    const linhasDia = [...grupos.get(dia)];
    linhasDia.sort((a, b) => {
      const ta = new Date(a.mov?.created_date || 0).getTime();
      const tb = new Date(b.mov?.created_date || 0).getTime();
      const cmp = ta - tb;
      return ordemLista === 'asc' ? cmp : -cmp;
    });
    return { dia, linhas: linhasDia };
  });
}

/**
 * Lista plana para virtualização: cabeçalho de dia + movimentos.
 * @returns {{ kind: 'day' | 'mov', key: string, ... }[]}
 */
export function buildExtratoItensVirtuais(diasExtratoMobile) {
  const items = [];
  for (const { dia, linhas: linhasDia } of diasExtratoMobile || []) {
    items.push({
      kind: 'day',
      key: `day-${dia}`,
      dia,
      count: linhasDia.length,
      saldoFimDia: saldoFimDiaLinhas(linhasDia),
    });
    linhasDia.forEach((linha, idx) => {
      items.push({
        kind: 'mov',
        key: linha.mov?.id != null ? String(linha.mov.id) : `mov-${dia}-${idx}`,
        mov: linha.mov,
        saldoApos: linha.saldoApos,
        dia,
        idx,
      });
    });
  }
  return items;
}

export function movimentacaoPassaFiltros(mov, { busca, tipoFiltro, refTipo, dataIni, dataFim }) {
  const q = normalizeSearchText(busca);
  if (q) {
    const blob = normalizeSearchText(
      [
        mov?.referencia_numero,
        mov?.documento_referencia,
        mov?.referencia_id,
        mov?.cliente_nome,
        mov?.terceiro_nome,
        mov?.referencia_cliente_nome,
        mov?.fornecedor_nome,
        mov?.nome_terceiro,
        mov?.produto_nome,
        mov?.referencia_tipo,
        mov?.motivo,
        mov?.usuario_responsavel,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!blob.includes(q)) return false;
  }

  if (tipoFiltro === 'Entrada' && mov?.tipo !== 'Entrada') return false;
  if (tipoFiltro === 'Saída' && mov?.tipo !== 'Saída') return false;

  if (refTipo && refTipo !== 'todos' && (mov?.referencia_tipo || '') !== refTipo) return false;

  if (dataIni) {
    const d = new Date(mov?.created_date);
    const i = new Date(`${dataIni}T00:00:00`);
    if (d < i) return false;
  }
  if (dataFim) {
    const d = new Date(mov?.created_date);
    const f = new Date(`${dataFim}T23:59:59.999`);
    if (d > f) return false;
  }

  return true;
}
