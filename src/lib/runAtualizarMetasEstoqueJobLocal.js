import { base44 } from '@/api/base44Client';
import { calcularMetasEstoqueParaProduto } from '@/lib/calcularMetasEstoqueVendas';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';
import { isRateLimitApiError, withRateLimitRetry } from '@/lib/p38ApiErrors';

/** Gravações sequenciais com pausa — evita rate limit no Base44 em catálogos grandes. */
const WRITE_DELAY_MS = 150;
const BATCH_PAUSE_MS = 800;
const DEFAULT_LOCAL_BATCH_SIZE = 10;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function produtoMetasVazio(produto) {
  const em = Number(produto?.estoque_minimo) || 0;
  const ei = Number(produto?.estoque_ideal) || 0;
  return em <= 0 && ei <= 0;
}

function buildUpdatePayload(metas) {
  return {
    estoque_minimo: metas.estoque_minimo,
    estoque_ideal: metas.estoque_ideal,
  };
}

function computeLocalUpdates(produtos, pedidos90d, options = {}) {
  const { somenteMetasVazias = false, sobrescrever = false } = options;
  const mediaFallbackDiasJanela = sobrescrever;
  const updates = [];
  let ignorados_trava_manual = 0;
  let ignorados_sem_venda = 0;

  for (const produto of produtos) {
    if (produto.estoque_trava_manual === true) {
      ignorados_trava_manual += 1;
      continue;
    }
    if (somenteMetasVazias && !produtoMetasVazio(produto)) continue;

    const metas = calcularMetasEstoqueParaProduto(produto, pedidos90d, {
      mediaFallbackDiasJanela,
      zerarSemVelocidade: sobrescrever,
    });

    if (!metas.atualizar) {
      ignorados_sem_venda += 1;
      continue;
    }

    updates.push({
      id: produto.id,
      data: buildUpdatePayload(metas),
    });
  }

  return {
    updates,
    ignorados_trava_manual,
    ignorados_sem_venda,
    total_produtos: produtos.length,
  };
}

async function gravarBlocoLocal(payload) {
  const minimalPayload = (data) => ({
    estoque_minimo: data.estoque_minimo,
    estoque_ideal: data.estoque_ideal,
  });

  for (const { id, data } of payload) {
    await withRateLimitRetry(
      () => base44.entities.Produto.update(id, minimalPayload(data)),
      { maxAttempts: 6, baseDelayMs: 1200 },
    );
    await sleep(WRITE_DELAY_MS);
  }
}

/**
 * Fallback no browser quando o job servidor não consegue guardar cache em ConfiguracoesVenda.
 */
export async function runAtualizarMetasEstoqueJobLocal(options = {}) {
  const {
    somenteMetasVazias = false,
    sobrescrever = false,
    produtos: produtosFornecidos,
    batchSize = DEFAULT_LOCAL_BATCH_SIZE,
    onProgress,
    shouldAbort,
  } = options;

  onProgress?.({
    phase: 'preparing',
    etapa: 'Calculando metas (vendas 60d)…',
  });

  const produtos = await fetchProdutosAtivos({ provided: produtosFornecidos });
  await sleep(300);
  const pedidos90d = await withRateLimitRetry(() => fetchPedidosVenda90d(), {
    maxAttempts: 5,
    baseDelayMs: 1500,
  });

  const { updates, ignorados_trava_manual, ignorados_sem_venda, total_produtos } =
    computeLocalUpdates(produtos, pedidos90d, {
      somenteMetasVazias,
      sobrescrever,
    });

  if (!updates.length) {
    const mensagem = total_produtos === 0
      ? 'Não foi possível carregar produtos do catálogo.'
      : somenteMetasVazias
        ? 'Nenhum produto sem metas de estoque para preencher.'
        : `Nenhum produto com venda nos últimos 60 dias para recalcular (${total_produtos} analisado(s); ${ignorados_sem_venda} sem venda).`;

    return {
      status: 'sem_alteracao',
      mensagem,
      somente_metas_vazias: somenteMetasVazias,
      sobrescrever,
      atualizados: 0,
      total_pendentes: 0,
      total_produtos,
      ignorados_trava_manual,
      ignorados_sem_venda,
      modo: 'local',
    };
  }

  const totalPendentes = updates.length;
  const totalBlocos = Math.ceil(totalPendentes / batchSize);
  let totalAtualizados = 0;

  onProgress?.({
    phase: 'writing',
    bloco: 0,
    totalBlocos,
    atualizados: 0,
    totalPendentes,
    etapa: 'Gravando ponto de pedido e estoque ideal nos produtos…',
  });

  for (let offset = 0; offset < totalPendentes; offset += batchSize) {
    if (shouldAbort?.()) throw new Error('Operação cancelada.');

    const bloco = updates.slice(offset, offset + batchSize);
    try {
      await gravarBlocoLocal(bloco);
    } catch (error) {
      if (isRateLimitApiError(error)) {
        throw new Error(
          'Limite de requisições do servidor (rate limit). Aguarde 1–2 minutos e tente de novo; o processo grava em lotes pequenos para evitar sobrecarga.',
        );
      }
      throw error;
    }
    totalAtualizados += bloco.length;

    onProgress?.({
      phase: 'writing',
      bloco: Math.ceil((offset + bloco.length) / batchSize),
      totalBlocos,
      atualizados: totalAtualizados,
      totalPendentes,
      etapa: 'Gravando ponto de pedido e estoque ideal nos produtos…',
    });

    if (offset + batchSize < totalPendentes) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  return {
    status: 'sucesso',
    atualizados: totalAtualizados,
    total_pendentes: totalPendentes,
    total_blocos: totalBlocos,
    somente_metas_vazias: somenteMetasVazias,
    sobrescrever,
    total_produtos,
    ignorados_trava_manual,
    ignorados_sem_venda,
    modo: 'local',
    timestamp: new Date().toISOString(),
  };
}
