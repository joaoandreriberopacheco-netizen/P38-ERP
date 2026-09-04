import {
  MODELO_PILOTO_CODIGOS_ATIVOS,
  MODELO_PILOTO_PREFIXO_PC,
} from '@/config/modeloCatalogoFlags';

export function isLinhaPilotoAtiva(linha) {
  const cod = String(linha?.codigo || '').trim();
  return MODELO_PILOTO_CODIGOS_ATIVOS.includes(cod);
}

export function isProdutoCompraPilotoAtivo(produtoCompra) {
  const nome = String(produtoCompra?.nome || '').trim();
  return nome.startsWith(MODELO_PILOTO_PREFIXO_PC);
}

export function filtrarDadosPilotoModelo({ linhas = [], produtosCompra = [], skus = [] } = {}) {
  const linhasAtivas = linhas.filter(isLinhaPilotoAtiva);
  const linhaIds = new Set(linhasAtivas.map((l) => l.id));
  const pcAtivos = produtosCompra.filter((pc) => linhaIds.has(pc.linha_id) && isProdutoCompraPilotoAtivo(pc));
  const pcIds = new Set(pcAtivos.map((p) => p.id));
  const skusAtivos = skus.filter(
    (s) => linhaIds.has(s.linha_id) && (!s.produto_compra_id || pcIds.has(s.produto_compra_id)),
  );
  return {
    linhas: linhasAtivas,
    produtosCompra: pcAtivos,
    skus: skusAtivos,
  };
}

export function produtoProducaoNoPilotoCeramica(produto) {
  const h1 = String(produto?.campo_hierarquico_1 || '').toUpperCase();
  const pc = String(produto?.nome || '').toUpperCase();
  return h1.includes('PISO') || h1.includes('CERAM') || h1.includes('PORCELAN') || pc.includes('CERAM');
}
