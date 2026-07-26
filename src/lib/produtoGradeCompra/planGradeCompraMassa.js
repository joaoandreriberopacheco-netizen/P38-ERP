import { buildGradePatch } from './buildGradePatch';

/**
 * Plano de updates em massa para atribuir linha / grelha aos produtos filtrados.
 */
export function planGradeCompraMassaUpdates(
  products = [],
  assignment = {},
  options = {},
) {
  const {
    somenteSemLinha = false,
    manterEixosExistentes = false,
    atualizarNome = true,
  } = options;

  const {
    linha,
    produtoCompra,
    eixoA,
    eixoB,
    eixoATexto,
    eixoBTexto,
    noMixAtivo,
    celulaObrigatoria,
  } = assignment;

  const skipped = { sem_linha_necessaria: 0, ja_na_linha: 0 };
  const updates = [];

  for (const produto of products) {
    if (somenteSemLinha && produto.linha_compra_id) {
      skipped.sem_linha_necessaria += 1;
      continue;
    }

    if (
      linha?.id
      && produto.linha_compra_id === linha.id
      && produto.produto_compra_id === (produtoCompra?.id || produto.produto_compra_id)
      && !eixoA?.id
      && !eixoB?.id
      && !eixoATexto
      && !eixoBTexto
      && noMixAtivo === undefined
      && celulaObrigatoria === undefined
    ) {
      skipped.ja_na_linha += 1;
      continue;
    }

    const patch = buildGradePatch({
      produto,
      linha,
      produtoCompra,
      eixoA,
      eixoB,
      eixoATexto,
      eixoBTexto,
      noMixAtivo,
      celulaObrigatoria,
      manterEixosExistentes,
      atualizarNome,
    });

    if (!Object.keys(patch).length) continue;

    updates.push({
      produto,
      patch,
      preview: {
        id: produto.id,
        nomeAtual: produto.nome || '',
        nomeNovo: patch.nome || produto.nome || '',
      },
    });
  }

  return { updates, skipped };
}
