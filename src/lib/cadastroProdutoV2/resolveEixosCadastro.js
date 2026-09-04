import { mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';
import { resolveParametrosProdutoCompra } from '@/lib/modeloCatalogo/resolveParametrosModelo';

function axisEnabled(pcRotulo, linhaRotulo) {
  if (pcRotulo != null && pcRotulo !== undefined) {
    return String(pcRotulo).trim().length > 0;
  }
  return String(linhaRotulo || '').trim().length > 0;
}

function axisRotulo(pcRotulo, linhaRotulo, fallback) {
  const p = String(pcRotulo ?? '').trim();
  if (p) return p;
  const l = String(linhaRotulo ?? '').trim();
  if (l) return l;
  return fallback;
}

/**
 * Quantos eixos activos (0–2) e rótulos efectivos para a grade.
 * '' no PC = eixo desligado; null no PC = herda da LINHA.
 */
export function resolveEixosCadastro(produtoCompra, linha) {
  const solo = linha && mapTipoLinhaUi(linha.tipo) === 'solo';
  const params = resolveParametrosProdutoCompra(produtoCompra, linha);
  const pc = produtoCompra || {};
  const ln = linha || {};

  if (solo) {
    const useA = axisEnabled(pc.eixo_a_rotulo, ln.eixo_a_rotulo);
    const useB = axisEnabled(pc.eixo_a_rotulo === '' ? '' : pc.eixo_b_rotulo, ln.eixo_b_rotulo);
    return {
      solo: true,
      useA,
      useB,
      rotuloA: axisRotulo(pc.eixo_a_rotulo, ln.eixo_a_rotulo, 'Variante A'),
      rotuloB: axisRotulo(pc.eixo_b_rotulo, ln.eixo_b_rotulo, 'Variante B'),
      count: (useA ? 1 : 0) + (useB ? 1 : 0),
      params,
    };
  }

  let useA = axisEnabled(pc.eixo_a_rotulo, ln.eixo_a_rotulo);
  let useB = axisEnabled(pc.eixo_b_rotulo, ln.eixo_b_rotulo);

  let rotuloA = axisRotulo(pc.eixo_a_rotulo, ln.eixo_a_rotulo, 'Eixo A');
  let rotuloB = axisRotulo(pc.eixo_b_rotulo, ln.eixo_b_rotulo, 'Eixo B');

  // Portfolio com PC a herdar da LINHA (null): activa eixos por defeito
  if (mapTipoLinhaUi(ln.tipo) === 'portfolio') {
    const pcHerda = pc.eixo_a_rotulo == null && pc.eixo_b_rotulo == null;
    if (pcHerda && !useA && !useB) {
      useA = true;
      useB = true;
      rotuloA = axisRotulo(null, ln.eixo_a_rotulo, 'Formato');
      rotuloB = axisRotulo(null, ln.eixo_b_rotulo, 'Cor');
    }
  }

  return {
    solo: false,
    useA,
    useB,
    rotuloA,
    rotuloB,
    count: (useA ? 1 : 0) + (useB ? 1 : 0),
    params,
  };
}

export function isPortfolioLinha(linha) {
  return linha && mapTipoLinhaUi(linha.tipo) === 'portfolio';
}

export function isMixLinha(linha) {
  return linha && mapTipoLinhaUi(linha.tipo) === 'linha_mix';
}
