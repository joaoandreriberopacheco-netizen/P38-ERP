import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Processa uma venda no caixa de forma atômica e segura.
 * Para pagamentos em cartão (débito/crédito), cria LancamentoFinanceiro "Em Aberto"
 * com data de vencimento = próximo dia útil conforme prazo da maquininha.
 * Os lançamentos são agrupados por maquininha+dia no fluxo de caixa como previsão.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    rascunho_id,
    pagamentos,       // array de { forma_pagamento, valor, parcelas, vale_id?, vale_codigo?, maquininha_id?, maquininha_nome?, bandeira?, taxa_maquininha?, prazo_maquininha_dias? }
    turno_id,
    conta_caixa_id,
    saldo_atual_caixa,
    config_venda,
    substitui_pedido_id,
    substitui_pedido_numero,
  } = await req.json();

  if (!rascunho_id || !pagamentos || !turno_id) {
    return Response.json({ error: 'Parâmetros obrigatórios ausentes.' }, { status: 400 });
  }

  const svc = base44.asServiceRole;

  // ── Helpers de data ──────────────────────────────────────────────────────────
  const getHoje = () => {
    const agora = new Date();
    const offsetMs = -5 * 60 * 60 * 1000; // UTC-5 America/Rio_Branco
    return new Date(agora.getTime() + offsetMs).toISOString().split('T')[0];
  };

  // Soma 'dias' dias úteis (pula sábado=6 e domingo=0) a partir de uma data ISO
  const addDiasUteis = (dataISO, dias) => {
    const d = new Date(dataISO + 'T12:00:00Z');
    let adicionados = 0;
    while (adicionados < dias) {
      d.setUTCDate(d.getUTCDate() + 1);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) adicionados++;
    }
    return d.toISOString().split('T')[0];
  };

  /** Conta da maquininha — nunca o Caixa PDV (igual PIX → Banco do Brasil). */
  const resolveContaDestinoCartao = async (pag) => {
    let contaDestinoId = pag.maquininha_conta_id || null;
    let contaDestinoNome = pag.maquininha_conta_nome || pag.maquininha_nome || 'Maquininha';
    if (!contaDestinoId && pag.maquininha_id) {
      try {
        const maq = await svc.entities.Maquininha.get(pag.maquininha_id);
        if (maq?.conta_destino_id) {
          contaDestinoId = maq.conta_destino_id;
          contaDestinoNome = maq.conta_destino_nome || maq.nome || contaDestinoNome;
        }
      } catch (_) { /* ignore */ }
    }
    if (!contaDestinoId) {
      throw new Error(
        `Maquininha "${pag.maquininha_nome || '?'}" sem conta destino. Configure em Maquininhas (ex.: Banco do Brasil).`
      );
    }
    return { id: contaDestinoId, nome: contaDestinoNome };
  };

  // ── PASSO 1: Buscar rascunho e aplicar selo frio ─────────────────────────────
  let rascunho;
  try { rascunho = await svc.entities.RascunhoPedidoVenda.get(rascunho_id); } catch (_) { rascunho = null; }

  if (!rascunho) return Response.json({ error: 'Rascunho não encontrado.' }, { status: 404 });
  if (rascunho.status === 'Convertido') return Response.json({ error: 'Este pedido já foi processado.', ja_processado: true }, { status: 409 });
  if (rascunho.status === 'Em Processamento') return Response.json({ error: 'Este pedido já está sendo processado.', em_processamento: true }, { status: 409 });

  await svc.entities.RascunhoPedidoVenda.update(rascunho_id, {
    status: 'Em Processamento',
    data_inicio_processamento: new Date().toISOString(),
    operador_processamento: user.full_name,
  });

  // ── PASSO 2: Gerar número único ──────────────────────────────────────────────
  let numeroPedido;
  try {
    const todosPedidos = await svc.entities.PedidoVenda.list();
    let maxNum = 0;
    for (const p of todosPedidos) {
      const match = (p.numero || '').match(/^PV-(\d+)$/);
      if (match) { const n = parseInt(match[1], 10); if (n > maxNum) maxNum = n; }
    }
    numeroPedido = `PV-${String(maxNum + 1).padStart(5, '0')}`;
  } catch (err) {
    await svc.entities.RascunhoPedidoVenda.update(rascunho_id, { status: 'Aguardando Caixa' });
    return Response.json({ error: `Erro ao gerar número do pedido: ${err.message}` }, { status: 500 });
  }

  // Vínculo de troca (vale ou devolução com substituto pendente)
  let substituiId = substitui_pedido_id || null;
  let substituiNumero = substitui_pedido_numero || null;
  const pagValeRef = pagamentos.find((p: { forma_pagamento?: string; vale_id?: string }) =>
    p.forma_pagamento === 'Vale Troca' && p.vale_id
  );
  if (pagValeRef?.vale_id && !substituiId) {
    try {
      const valeOrigem = await svc.entities.ValeCompra.get(pagValeRef.vale_id);
      if (valeOrigem?.pedido_origem_id) {
        substituiId = valeOrigem.pedido_origem_id;
        substituiNumero = valeOrigem.pedido_origem_numero || substituiNumero;
      }
    } catch (_) { /* não bloqueia venda */ }
  }

  // ── PASSO 3: Criar PedidoVenda ───────────────────────────────────────────────
  let pedidoVenda;
  try {
    pedidoVenda = await svc.entities.PedidoVenda.create({
      numero: numeroPedido,
      senha_atendimento: rascunho.senha_atendimento,
      cliente_id: rascunho.cliente_id,
      cliente_nome: rascunho.cliente_nome,
      vendedor_id: rascunho.vendedor_id,
      vendedor_nome: rascunho.vendedor_nome,
      tabela_preco_id: rascunho.tabela_preco_id,
      tipo: rascunho.tipo,
      status: 'Financeiro OK',
      metodo_entrega: rascunho.metodo_entrega,
      turno_caixa_id: turno_id,
      itens: rascunho.itens,
      subtotal: rascunho.subtotal,
      valor_desconto: rascunho.valor_desconto,
      valor_frete: rascunho.valor_frete,
      valor_total: rascunho.valor_total,
      pagamentos: pagamentos,
      observacoes: rascunho.observacoes,
      ...(substituiId ? { substitui_pedido_id: substituiId, substitui_pedido_numero: substituiNumero } : {}),
    });
  } catch (err) {
    await svc.entities.RascunhoPedidoVenda.update(rascunho_id, { status: 'Aguardando Caixa' });
    return Response.json({ error: `Erro ao criar pedido de venda: ${err.message}` }, { status: 500 });
  }

  // ── PASSO 3.5: Sincronia canonica em PedidoVendaItem ─────────────────────────
  // Cria uma linha em PedidoVendaItem para cada item do rascunho, resolvendo
  // unidade pelo `produto_unidade_id` (ou sigla como fallback). Erros aqui nao
  // bloqueiam a venda — sao reportados como avisos.
  try {
    const round6 = (n: any) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
    const asNumberLocal = (v: any, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
    const SMAP: Record<string, string> = {
      CAIXA: 'CX', CAIXAS: 'CX', 'M²': 'M2', 'METRO QUADRADO': 'M2', 'METROS QUADRADOS': 'M2',
      PEÇA: 'PC', PEÇAS: 'PC', PECA: 'PC', PECAS: 'PC', UNIDADE: 'UN', UNIDADES: 'UN',
    };
    const normSigla = (raw: any) => {
      const s = String(raw || '').trim().toUpperCase();
      if (!s) return '';
      const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return SMAP[s] || SMAP[noAccents] || s.replace('²', '2');
    };
    let ordem = 0;
    for (const it of (rascunho.itens || [])) {
      try {
        const produto = await svc.entities.Produto.get(it.produto_id);
        if (!produto) continue;
        const unidades = Array.isArray(produto.unidades) && produto.unidades.length > 0
          ? produto.unidades
          : [{
              id: 'principal',
              sigla: normSigla(produto.unidade_principal || 'UN') || 'UN',
              fator_conversao: 1,
              fator_preco: 1,
              is_principal: true,
              is_comercial: true,
              ativo: true,
            }];
        let unidade = it.produto_unidade_id ? unidades.find((u: any) => u.id === it.produto_unidade_id) : null;
        if (!unidade) {
          const sigla = normSigla(it.unidade_medida || it.unidade_apresentacao);
          unidade = sigla ? unidades.find((u: any) => normSigla(u.sigla) === sigla) : null;
        }
        if (!unidade) {
          unidade = unidades.find((u: any) => u.is_comercial && u.ativo !== false)
            || unidades.find((u: any) => u.is_principal)
            || unidades[0];
        }
        const fator = asNumberLocal(unidade?.fator_conversao, 1) || 1;
        const fatorPreco = asNumberLocal(unidade?.fator_preco, 1) || 1;
        const qComercial = asNumberLocal(it.quantidade, 0);
        const qBase = round6(qComercial * fator);
        const precoFator1 = asNumberLocal(it.preco_unitario_praticado, 0);
        const desconto = asNumberLocal(it.desconto_unitario, 0);
        const precoFinal = round6(precoFator1 - desconto);
        const total = round6(qBase * precoFinal);
        await svc.entities.PedidoVendaItem.create({
          pedido_venda_id: pedidoVenda.id,
          pedido_venda_numero: numeroPedido,
          produto_id: produto.id,
          produto_nome: produto.nome || it.produto_nome || '',
          produto_unidade_id: unidade?.id || '',
          unidade_sigla: normSigla(unidade?.sigla) || 'UN',
          fator_aplicado: fator,
          fator_preco_aplicado: fatorPreco,
          quantidade_comercial: round6(qComercial),
          quantidade_base: qBase,
          preco_unitario_fator1: round6(precoFator1),
          preco_unitario_comercial: round6(precoFator1 * fator),
          desconto_unitario_fator1: round6(desconto),
          preco_final_unitario_fator1: precoFinal,
          tabela_preco_id: rascunho.tabela_preco_id || '',
          tabela_preco_multiplicador: 1,
          total,
          ordem: ordem++,
          observacoes: typeof it.observacoes === 'string' ? it.observacoes : '',
        });
      } catch (e) {
        console.warn('PedidoVendaItem canonico falhou para item:', it?.produto_id, (e as Error).message);
      }
    }
  } catch (e) {
    console.warn('Sincronia canonica de PedidoVendaItem (PDV) falhou:', (e as Error).message);
  }

  // ── PASSO 4: Operações paralelas ─────────────────────────────────────────────
  const erros = [];
  const hoje = getHoje();

  // 4a. Confirmar rascunho como Convertido
  try {
    await svc.entities.RascunhoPedidoVenda.update(rascunho_id, {
      status: 'Convertido',
      pedido_venda_final_id: pedidoVenda.id,
      data_conversao: new Date().toISOString(),
    });
  } catch (err) { erros.push(`Rascunho não atualizado: ${err.message}`); }

  // 4b. Vincular venda ao turno
  try {
    const turno = await svc.entities.TurnoCaixa.get(turno_id);
    await svc.entities.TurnoCaixa.update(turno_id, { vendas_ids: [...(turno?.vendas_ids || []), pedidoVenda.id] });
  } catch (err) { erros.push(`Turno não atualizado: ${err.message}`); }

  // 4c. Movimentações de estoque
  for (const item of (rascunho.itens || [])) {
    try {
      const quantidadeBase = item.quantidade_base || item.quantidade;
      await svc.entities.MovimentacaoEstoque.create({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        tipo: 'Saída',
        motivo: 'Venda',
        quantidade: quantidadeBase,
        custo_unitario: item.custo_unitario_momento || 0,
        referencia_tipo: 'PedidoVenda',
        referencia_id: pedidoVenda.id,
        referencia_numero: numeroPedido,
        ...(rascunho.cliente_nome
          ? {
              cliente_nome: rascunho.cliente_nome,
              referencia_cliente_nome: rascunho.cliente_nome,
              terceiro_nome: rascunho.cliente_nome,
            }
          : {}),
        observacoes: item.unidade_medida ? `Venda em ${item.unidade_medida} (${item.quantidade} ${item.unidade_medida})` : undefined,
        usuario_responsavel: user.full_name,
      });
      const produto = await svc.entities.Produto.get(item.produto_id);
      if (produto) {
        await svc.entities.Produto.update(item.produto_id, {
          estoque_atual: Math.max(0, (produto.estoque_atual || 0) - quantidadeBase),
        });
      }
    } catch (err) { erros.push(`Estoque ${item.produto_nome}: ${err.message}`); }
  }

  // 4d. Atualizar saldo do caixa (dinheiro físico)
  const pagDinheiro = pagamentos.find(p => p.forma_pagamento === 'Dinheiro');
  if (pagDinheiro && pagDinheiro.valor > 0 && conta_caixa_id) {
    try {
      const conta = await svc.entities.ContasFinanceiras.get(conta_caixa_id);
      await svc.entities.ContasFinanceiras.update(conta_caixa_id, {
        saldo_atual: (conta?.saldo_atual || 0) + pagDinheiro.valor,
      });
    } catch (err) { erros.push(`Saldo caixa: ${err.message}`); }
  }

  // 4e. Vale Troca
  let saldoResidualVale = null;
  const pagVale = pagamentos.find(p => p.forma_pagamento === 'Vale Troca' && p.vale_id);
  if (pagVale) {
    try {
      const vale = await svc.entities.ValeCompra.get(pagVale.vale_id);
      if (vale) {
        const novoSaldo = Math.max(0, (vale.valor_disponivel || 0) - pagVale.valor);
        await svc.entities.ValeCompra.update(pagVale.vale_id, {
          valor_disponivel: novoSaldo,
          status: novoSaldo <= 0.01 ? 'Utilizado' : 'Utilizado Parcialmente',
          historico_uso: [...(vale.historico_uso || []), { data: new Date().toISOString(), valor_usado: pagVale.valor, pedido_id: pedidoVenda.id, pedido_numero: numeroPedido }],
        });
        if (novoSaldo > 0.01) saldoResidualVale = { codigo: vale.codigo, saldo: novoSaldo, vale_id: pagVale.vale_id };
      }
    } catch (err) { erros.push(`Vale troca: ${err.message}`); }
  }

  // 4e-bis. Atualizar devolução que aguardava substituto (fluxo dinheiro/PIX)
  if (substituiId && pedidoVenda?.id) {
    try {
      const devolucoes = await svc.entities.DevolucaoTroca.list();
      const pendente = devolucoes.find((d: {
        aguarda_substituto?: boolean;
        pedido_substituto_id?: string;
        pedido_origem_id?: string;
      }) =>
        d.aguarda_substituto &&
        !d.pedido_substituto_id &&
        d.pedido_origem_id === substituiId
      );
      if (pendente) {
        await svc.entities.DevolucaoTroca.update(pendente.id, {
          pedido_substituto_id: pedidoVenda.id,
          pedido_substituto_numero: numeroPedido,
        });
      }
    } catch (err) { erros.push(`Vínculo troca: ${err.message}`); }
  }

  // 4f. Lançamentos financeiros por forma de pagamento
  for (const pag of pagamentos) {
    if (!pag.valor || pag.valor <= 0) continue;
    if (pag.forma_pagamento === 'Vale Troca') continue;

    try {
      const isCartao = pag.forma_pagamento === 'Cartão de Débito' || pag.forma_pagamento === 'Cartão de Crédito';
      const isFiado = pag.forma_pagamento === 'Conta a Pagar';

      // ── FIADO: lançamento Em Aberto, sem conta destino real ─────────────────
      if (isFiado) {
        await svc.entities.LancamentoFinanceiro.create({
          tipo: 'Receita',
          descricao: `Fiado - Venda ${numeroPedido}${rascunho.cliente_nome ? ` - ${rascunho.cliente_nome}` : ''}`,
          terceiro_id: rascunho.cliente_id || null,
          terceiro_nome: rascunho.cliente_nome || null,
          valor: pag.valor,
          valor_liquido: pag.valor,
          data_vencimento: hoje,
          status: 'Em Aberto',
          status_conciliacao: 'N/A',
          forma_pagamento: 'Conta a Pagar',
          forma_pagamento_tipo: 'Boleto',
          categoria: 'Venda de Produto',
          tags: ['FIADO'],
          conta_financeira_id: conta_caixa_id,
          conta_financeira_nome: 'A Receber',
          turno_caixa_id: turno_id,
          referencia_id: pedidoVenda.id,
          referencia_tipo: 'PedidoVenda',
          referencia_numero: numeroPedido,
        });
        continue;
      }

      // ── CARTÃO (DÉBITO / CRÉDITO): conta a receber com prazo da maquininha ──
      if (isCartao) {
        const taxa = pag.taxa_maquininha || 0;
        const valorBruto = pag.valor;
        const valorTarifa = parseFloat((valorBruto * taxa / 100).toFixed(2));
        const valorLiquido = parseFloat((valorBruto - valorTarifa).toFixed(2));

        // Data de vencimento = próximo dia útil (D+1; sexta–domingo credita na segunda)
        const prazoDias = pag.prazo_maquininha_dias ?? 1;
        const dataVencimento = addDiasUteis(hoje, prazoDias);
        const isCredito = pag.forma_pagamento === 'Cartão de Crédito';

        const maquininhaNome = pag.maquininha_nome || pag.forma_pagamento;
        const bandeira = pag.bandeira || '';
        const descricao = `${pag.forma_pagamento}${bandeira ? ` ${bandeira}` : ''}${pag.parcelas > 1 ? ` ${pag.parcelas}x` : ''} - ${maquininhaNome} - Venda ${numeroPedido}`;

        const { id: contaDestinoId, nome: contaDestinoNome } = await resolveContaDestinoCartao(pag);

        await svc.entities.LancamentoFinanceiro.create({
          tipo: 'Receita',
          descricao,
          terceiro_id: rascunho.cliente_id || null,
          terceiro_nome: rascunho.cliente_nome || null,
          valor: valorBruto,
          valor_liquido: valorLiquido,
          data_vencimento: dataVencimento,
          data_liquidacao_prevista: dataVencimento,
          status: 'Em Aberto',
          status_conciliacao: 'Pendente',
          forma_pagamento: pag.forma_pagamento,
          forma_pagamento_tipo: pag.forma_pagamento === 'Cartão de Débito' ? 'Cartão Débito' : 'Cartão Crédito',
          categoria: 'Venda de Produto',
          tags: [
            'CARTAO',
            ...(isCredito ? ['conta_receber'] : []),
            maquininhaNome,
            ...(bandeira ? [bandeira] : []),
          ],
          conta_financeira_id: contaDestinoId,
          conta_financeira_nome: contaDestinoNome,
          turno_caixa_id: turno_id,
          referencia_id: pedidoVenda.id,
          referencia_tipo: 'PedidoVenda',
          referencia_numero: numeroPedido,
          observacoes: JSON.stringify({
            maquininha_id: pag.maquininha_id,
            maquininha_nome: maquininhaNome,
            bandeira,
            taxa_pct: taxa,
            parcelas: pag.parcelas || 1,
            data_venda: hoje,
          }),
        });

        if (valorTarifa > 0) {
          await svc.entities.LancamentoFinanceiro.create({
            tipo: 'Despesa',
            descricao: `Tarifa Maquininha ${maquininhaNome} — ${taxa.toFixed(2)}% — ${bandeira} ${pag.forma_pagamento} — Venda ${numeroPedido}`,
            valor: valorTarifa,
            valor_liquido: valorTarifa,
            data_vencimento: dataVencimento,
            data_liquidacao_prevista: dataVencimento,
            status: 'Em Aberto',
            status_conciliacao: 'Pendente',
            categoria: 'Custos de Maquininha',
            tags: ['tarifa', 'taxa-maquininha', maquininhaNome, ...(bandeira ? [bandeira] : [])],
            conta_financeira_id: contaDestinoId,
            conta_financeira_nome: contaDestinoNome,
            turno_caixa_id: turno_id,
            referencia_id: pedidoVenda.id,
            referencia_tipo: 'PedidoVenda',
            referencia_numero: numeroPedido,
          });
        }
        continue;
      }

      // ── PIX: receita líquida + despesa de tarifa ─────────────────────────────
      if (pag.forma_pagamento === 'PIX') {
        const taxaPix = pag.taxa_tarifa ?? 0.2;
        const valorBruto = pag.valor;
        const valorTarifa = parseFloat((valorBruto * taxaPix / 100).toFixed(2));
        const valorLiquido = parseFloat((valorBruto - valorTarifa).toFixed(2));

        let contaDestinoId = conta_caixa_id;
        let contaDestinoNome = 'Caixa';
        let formaPgId = null;

        const formasList = await svc.entities.FormasDePagamento.filter({ nome: 'PIX' });
        const forma = formasList[0];
        if (forma) {
          contaDestinoId = forma.conta_destino_id;
          contaDestinoNome = forma.conta_destino_nome || 'PIX';
          formaPgId = forma.id;
        }

        await svc.entities.LancamentoFinanceiro.create({
          tipo: 'Receita',
          descricao: `PIX - Venda ${numeroPedido}${rascunho.cliente_nome ? ` - ${rascunho.cliente_nome}` : ''}`,
          terceiro_id: rascunho.cliente_id || null,
          terceiro_nome: rascunho.cliente_nome || null,
          valor: valorBruto,
          valor_liquido: valorLiquido,
          data_vencimento: hoje,
          data_pagamento: hoje,
          status: 'Pago',
          status_conciliacao: 'Pendente',
          forma_pagamento: 'PIX',
          forma_pagamento_id: formaPgId,
          forma_pagamento_tipo: 'PIX',
          categoria: 'Venda de Produto',
          conta_financeira_id: contaDestinoId,
          conta_financeira_nome: contaDestinoNome,
          turno_caixa_id: turno_id,
          referencia_id: pedidoVenda.id,
          referencia_tipo: 'PedidoVenda',
          referencia_numero: numeroPedido,
          observacoes: JSON.stringify({ taxa_pct: taxaPix, data_venda: hoje }),
        });

        if (valorTarifa > 0) {
          await svc.entities.LancamentoFinanceiro.create({
            tipo: 'Despesa',
            descricao: `Tarifa PIX — ${taxaPix.toFixed(2)}% — Venda ${numeroPedido}`,
            valor: valorTarifa,
            valor_liquido: valorTarifa,
            data_vencimento: hoje,
            data_pagamento: hoje,
            status: 'Pago',
            status_conciliacao: 'Pendente',
            categoria: 'Custos Financeiros',
            tags: ['tarifa', 'taxa-pix', 'PIX'],
            conta_financeira_id: contaDestinoId,
            conta_financeira_nome: contaDestinoNome,
            turno_caixa_id: turno_id,
            referencia_id: pedidoVenda.id,
            referencia_tipo: 'PedidoVenda',
            referencia_numero: numeroPedido,
          });
        }
        continue;
      }

      // ── DINHEIRO / Outros: Pago imediatamente ─────────────────────────────
      let contaDestinoId = conta_caixa_id;
      let contaDestinoNome = 'Caixa';
      let formaPgId = null;

      if (pag.forma_pagamento !== 'Dinheiro') {
        const formasList = await svc.entities.FormasDePagamento.filter({ nome: pag.forma_pagamento });
        const forma = formasList[0];
        if (forma) {
          contaDestinoId = forma.conta_destino_id;
          contaDestinoNome = forma.conta_destino_nome || pag.forma_pagamento;
          formaPgId = forma.id;
        }
      }

      await svc.entities.LancamentoFinanceiro.create({
        tipo: 'Receita',
        descricao: `Venda ${numeroPedido}${rascunho.cliente_nome ? ` - ${rascunho.cliente_nome}` : ''}`,
        terceiro_id: rascunho.cliente_id || null,
        terceiro_nome: rascunho.cliente_nome || null,
        valor: pag.valor,
        valor_liquido: pag.valor_liquido_recebido || pag.valor,
        data_vencimento: hoje,
        data_pagamento: hoje,
        status: 'Pago',
        status_conciliacao: pag.forma_pagamento === 'Dinheiro' ? 'N/A' : 'Pendente',
        forma_pagamento: pag.forma_pagamento,
        forma_pagamento_id: formaPgId,
        forma_pagamento_tipo: pag.forma_pagamento,
        categoria: 'Venda de Produto',
        conta_financeira_id: contaDestinoId,
        conta_financeira_nome: contaDestinoNome,
        turno_caixa_id: turno_id,
        referencia_id: pedidoVenda.id,
        referencia_tipo: 'PedidoVenda',
        referencia_numero: numeroPedido,
      });
    } catch (err) {
      erros.push(`Lançamento financeiro (${pag.forma_pagamento}): ${err.message}`);
    }
  }

  // 4g. Criar OrdemSeparacao se fluxo Completo
  if (config_venda?.fluxo_venda_padrao === 'Completo') {
    try {
      await svc.entities.OrdemSeparacao.create({
        pedido_venda_id: pedidoVenda.id,
        pedido_numero: numeroPedido,
        status: 'Pendente',
        itens: (rascunho.itens || []).map(item => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade_solicitada: item.quantidade_base || item.quantidade,
          quantidade_separada: 0,
          observacao: item.unidade_medida ? `${item.quantidade} ${item.unidade_medida}` : undefined,
        })),
      });
    } catch (err) { erros.push(`Ordem de separação: ${err.message}`); }
  }

  return Response.json({
    success: true,
    pedido_venda: pedidoVenda,
    numero: numeroPedido,
    saldo_residual_vale: saldoResidualVale,
    avisos: erros.length > 0 ? erros : undefined,
  });
});