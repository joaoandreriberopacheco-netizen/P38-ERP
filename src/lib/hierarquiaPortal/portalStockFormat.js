import { aggregateEstoqueDisplay } from '@/components/produtos/treegrid/useTreeGrid';
import { formatEstoqueDisponivelApresentacao } from '@/lib/productUnits';

/** Formata estoque de um SKU em unidade vitrine (ou base). */
export function portalEstoqueSku(produto) {
  const { sigla, quantidade } = formatEstoqueDisponivelApresentacao(produto);
  return {
    quantidade,
    sigla,
    label: `${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${sigla}`,
  };
}

/** Agrega estoque de vários SKUs para linhas de grupo (catálogo P38). */
export function portalEstoqueGrupo(skus) {
  const produtos = (skus || []).map((s) => s.produto || s);
  if (!produtos.length) return { label: '—', quantidade: 0, sigla: '', mixed: false };

  const disp = aggregateEstoqueDisplay(produtos);
  if (disp.mode === 'empty') return { label: '—', quantidade: 0, sigla: '', mixed: false };

  if (disp.mode === 'display' || disp.mode === 'base') {
    const sigla = disp.sigla || 'UN';
    const q = disp.quantidade ?? 0;
    return {
      quantidade: q,
      sigla,
      label: `${q.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${sigla}`,
      mixed: false,
    };
  }

  const q = disp.quantidade ?? 0;
  return {
    quantidade: q,
    sigla: disp.sigla || 'UN',
    label: `${q.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un. base`,
    mixed: true,
  };
}
