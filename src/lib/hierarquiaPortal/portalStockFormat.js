import { aggregateEstoqueDisplay } from '@/components/produtos/treegrid/useTreeGrid';
import { formatEstoqueDisponivelApresentacao } from '@/lib/productUnits';
import {
  aggregateCatalogEstoqueExibicao,
  isCatalogEstoqueVirtualAtivo,
  resolveCatalogEstoqueExibicao,
} from '@/lib/catalogEstoqueVirtual';

function formatQtyLabel(quantidade, sigla, { virtual = false, pendente = 0 } = {}) {
  const q = Number(quantidade) || 0;
  const unit = sigla || 'UN';
  const prefix = virtual && pendente > 0 ? '~' : '';
  return `${prefix}${q.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;
}

/** Formata estoque de um SKU em unidade vitrine (ou base), com suporte a estoque virtual. */
export function portalEstoqueSku(produto, catalogStockContext = null) {
  if (catalogStockContext && isCatalogEstoqueVirtualAtivo(catalogStockContext)) {
    const ex = resolveCatalogEstoqueExibicao(produto, catalogStockContext);
    const sigla = ex.unidade || 'UN';
    return {
      quantidade: Number(ex.quantidade) || 0,
      sigla,
      label: formatQtyLabel(ex.quantidade, sigla, { virtual: ex.virtual, pendente: ex.pendente }),
      virtual: ex.virtual,
      pendente: ex.pendente,
      fisico: ex.fisico,
    };
  }

  const { sigla, quantidade } = formatEstoqueDisponivelApresentacao(produto);
  return {
    quantidade,
    sigla,
    label: formatQtyLabel(quantidade, sigla),
    virtual: false,
    pendente: 0,
    fisico: quantidade,
  };
}

/** Agrega estoque de vários SKUs para linhas de grupo (catálogo P38). */
export function portalEstoqueGrupo(skus, catalogStockContext = null) {
  const enrichedRows = skus || [];
  const produtos = enrichedRows.map((s) => s.produto || s);
  if (!produtos.length) return { label: '—', quantidade: 0, sigla: '', mixed: false };

  if (catalogStockContext && isCatalogEstoqueVirtualAtivo(catalogStockContext)) {
    const disp = aggregateCatalogEstoqueExibicao(produtos, catalogStockContext);
    if (disp.mode === 'empty') return { label: '—', quantidade: 0, sigla: '', mixed: false };
    if (disp.mode === 'display') {
      const sigla = disp.sigla || 'UN';
      const q = disp.quantidade ?? 0;
      return {
        quantidade: q,
        sigla,
        label: formatQtyLabel(q, sigla, { virtual: disp.virtual, pendente: disp.pendente }),
        mixed: false,
        virtual: disp.virtual,
        pendente: disp.pendente,
      };
    }
    const q = disp.quantidade ?? 0;
    return {
      quantidade: q,
      sigla: 'UN',
      label: formatQtyLabel(q, 'UN', { virtual: disp.virtual }),
      mixed: true,
      virtual: disp.virtual,
    };
  }

  const disp = aggregateEstoqueDisplay(produtos);
  if (disp.mode === 'empty') return { label: '—', quantidade: 0, sigla: '', mixed: false };

  if (disp.mode === 'display' || disp.mode === 'base') {
    const sigla = disp.sigla || 'UN';
    const q = disp.quantidade ?? 0;
    return {
      quantidade: q,
      sigla,
      label: formatQtyLabel(q, sigla),
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
