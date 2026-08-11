import { mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';
import { avaliarProdutoCompraCeramica } from '@/lib/modeloCatalogo/regrasCeramica';
import { resolveParametrosProdutoCompra } from '@/lib/modeloCatalogo/resolveParametrosModelo';

export function buildModeloTree({ linhas, produtosCompra, skus }) {
  const pcByLinha = new Map();
  for (const pc of produtosCompra || []) {
    if (!pcByLinha.has(pc.linha_id)) pcByLinha.set(pc.linha_id, []);
    pcByLinha.get(pc.linha_id).push(pc);
  }

  const skusByPc = new Map();
  const skusSoloByLinha = new Map();
  for (const sku of skus || []) {
    if (sku.produto_compra_id) {
      if (!skusByPc.has(sku.produto_compra_id)) skusByPc.set(sku.produto_compra_id, []);
      skusByPc.get(sku.produto_compra_id).push(sku);
    } else {
      if (!skusSoloByLinha.has(sku.linha_id)) skusSoloByLinha.set(sku.linha_id, []);
      skusSoloByLinha.get(sku.linha_id).push(sku);
    }
  }

  const categorias = new Map();

  for (const linha of linhas || []) {
    const cat = linha.categoria_nome || '(sem categoria)';
    if (!categorias.has(cat)) categorias.set(cat, []);
    const tipo = mapTipoLinhaUi(linha.tipo);
    const solo = tipo === 'solo';
    const pcs = (pcByLinha.get(linha.id) || []).map((pc) => {
      const pcSkus = skusByPc.get(pc.id) || [];
      const params = resolveParametrosProdutoCompra(pc, linha);
      const avaliacao = avaliarProdutoCompraCeramica(pcSkus, {
        massaCritica: params.massa_critica,
        metaVagas: params.meta_vagas,
        minLinhasSaldavel: params.min_linhas_saldavel,
      });
      return { ...pc, ...params, skus: pcSkus, avaliacao };
    });
    const soloSkus = skusSoloByLinha.get(linha.id) || [];
    categorias.get(cat).push({
      linha,
      tipo,
      solo,
      produtosCompra: pcs,
      soloSkus,
      skuCount: solo ? soloSkus.length : pcs.reduce((n, p) => n + p.skus.length, 0),
    });
  }

  return [...categorias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoria, linhasNodes]) => ({
      categoria,
      linhas: linhasNodes.sort((a, b) => (a.linha.ordem || 0) - (b.linha.ordem || 0)),
    }));
}

export function filterModeloTree(tree, { filtroLinha, search }) {
  const q = String(search || '').trim().toLowerCase();
  const filtro = String(filtroLinha || '').trim();

  return tree
    .map((cat) => ({
      ...cat,
      linhas: cat.linhas.filter((node) => {
        if (filtro && node.linha.codigo !== filtro && node.linha.id !== filtro) return false;
        if (!q) return true;
        const inLinha = node.linha.nome.toLowerCase().includes(q) || node.linha.codigo.toLowerCase().includes(q);
        if (inLinha) return true;
        if (node.solo) {
          return node.soloSkus.some((s) => s.nome.toLowerCase().includes(q));
        }
        return node.produtosCompra.some(
          (pc) =>
            pc.nome.toLowerCase().includes(q)
            || pc.skus.some((s) => s.nome.toLowerCase().includes(q) || (s.eixo_b_texto || '').toLowerCase().includes(q)),
        );
      }),
    }))
    .filter((cat) => cat.linhas.length > 0);
}
