import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, RotateCcw, Printer, CheckCircle2, AlertCircle, Minus, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';

// Step 1: Buscar pedido
function BuscarPedidoStep({ onFound, onClose }) {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const { toast } = useToast();

  const buscar = async () => {
    const termo = numeroPedido.trim().toUpperCase();
    if (!termo) return;
    setBuscando(true);
    const todos = await base44.entities.PedidoVenda.list();
    const encontrado = todos.find(p =>
      p.numero?.toUpperCase() === termo ||
      p.numero?.toUpperCase().includes(termo)
    );
    setBuscando(false);
    if (!encontrado) {
      toast({ title: 'Pedido não encontrado', variant: 'destructive' });
      return;
    }
    const statusOk = ['Financeiro OK', 'Em Separação', 'Em Rota de Entrega', 'Pedido Concluído'];
    if (!statusOk.includes(encontrado.status)) {
      toast({ title: `Este pedido não pode ser devolvido`, description: `Status: ${encontrado.status}`, variant: 'destructive' });
      return;
    }
    onFound(encontrado);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="bg-card rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-muted-foreground mb-3">Informe o número do pedido de venda</p>
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Ex: PV-00042"
            value={numeroPedido}
            onChange={e => setNumeroPedido(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            className="text-lg font-mono uppercase border-0 border-b border-border/40 rounded-none bg-transparent focus-visible:ring-0"
          />
          <Button onClick={buscar} disabled={buscando} className="bg-card text-card-foreground rounded-xl px-5">
            {buscando ? '...' : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 2: Selecionar itens e forma de reembolso
function SelecionarItensStep({ pedido, tipo, onConfirm }) {
  const [qtds, setQtds] = useState(
    Object.fromEntries((pedido.itens || []).map(i => [i.produto_id + '_' + i.produto_nome, 0]))
  );
  const [formaReembolso, setFormaReembolso] = useState('Vale Compra');
  const [motivo, setMotivo] = useState('');

  const totalDevolvido = (pedido.itens || []).reduce((sum, i) => {
    const key = i.produto_id + '_' + i.produto_nome;
    return sum + (qtds[key] || 0) * (i.preco_unitario_praticado || 0);
  }, 0);

  const itensSelecionados = (pedido.itens || []).filter(i => {
    const key = i.produto_id + '_' + i.produto_nome;
    return (qtds[key] || 0) > 0;
  });

  const formatValor = v => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[65vh]">
      {/* Cabeçalho do pedido */}
      <div className="bg-card rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold text-foreground">{pedido.numero}</div>
            <div className="text-xs text-muted-foreground">{pedido.cliente_nome}</div>
          </div>
          <div className="text-sm font-bold text-foreground/90">{formatValor(pedido.valor_total)}</div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-border/40">
          <p className="text-xs text-muted-foreground">Selecione os itens a devolver</p>
        </div>
        {(pedido.itens || []).map(item => {
          const key = item.produto_id + '_' + item.produto_nome;
          const qtd = qtds[key] || 0;
          return (
            <div key={key} className="px-4 py-3 flex items-center gap-3 border-b border-border/30 dark:border-border/40/50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{item.produto_nome}</div>
                <div className="text-xs text-muted-foreground">
                  {item.quantidade}x · {formatValor(item.preco_unitario_praticado)}/un
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQtds(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }))}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
                  style={{ minWidth: 32, minHeight: 32 }}>
                  <Minus className="w-3 h-3 text-muted-foreground" />
                </button>
                <span className={`w-6 text-center text-sm font-bold tabular-nums ${qtd > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{qtd}</span>
                <button
                  onClick={() => setQtds(prev => ({ ...prev, [key]: Math.min(item.quantidade, (prev[key] || 0) + 1) }))}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
                  style={{ minWidth: 32, minHeight: 32 }}>
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Forma de reembolso */}
      <div className="bg-card rounded-2xl px-4 py-4 shadow-sm space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Forma de reembolso</label>
          <Select value={formaReembolso} onValueChange={setFormaReembolso}>
            <SelectTrigger className="bg-muted/40 dark:bg-muted border-0 rounded-xl h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-muted">
              <SelectItem value="Vale Compra">Vale Compra (crédito na loja)</SelectItem>
              <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              <SelectItem value="PIX">PIX</SelectItem>
              <SelectItem value="Estorno Cartão">Estorno no Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Motivo</label>
          <Input
            placeholder="Ex: Produto com defeito, cliente desistiu..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="bg-muted/40 dark:bg-muted border-0 rounded-xl h-11"
          />
        </div>
      </div>

      {/* Total */}
      <div className="bg-card rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total a reembolsar</span>
          <span className="text-2xl font-bold text-red-600 dark:text-red-400 font-glacial">{formatValor(totalDevolvido)}</span>
        </div>
      </div>

      <Button
        disabled={itensSelecionados.length === 0 || totalDevolvido === 0}
        onClick={() => onConfirm({ itensSelecionados, qtds, formaReembolso, motivo, totalDevolvido })}
        className="w-full h-14 bg-card text-card-foreground rounded-2xl font-semibold text-base"
        style={{ minHeight: 56 }}>
        Confirmar {tipo}
      </Button>
    </div>
  );
}

// Step 3: Comprovante
function ComprovanteStep({ resultado, onClose }) {
  const formatValor = v => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const imprimir = async () => {
    const html = `<html><head><title>Comprovante ${resultado.tipo}</title>
      <style>body{font-family:monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto}
      .center{text-align:center}.dashed{border-top:2px dashed #aaa;margin:12px 0}.big{font-size:20px;font-weight:bold}.row{display:flex;justify-content:space-between;margin:6px 0}
      </style></head><body>
      <div class="center"><b>VAREJOSYNC</b><br/><small>Comprovante de ${resultado.tipo}</small></div>
      <div class="dashed"></div>
      <div class="row"><span>Nº:</span><b>${resultado.numero}</b></div>
      <div class="row"><span>Pedido Origem:</span><b>${resultado.pedidoNumero}</b></div>
      <div class="row"><span>Cliente:</span><span>${resultado.clienteNome}</span></div>
      <div class="row"><span>Data/Hora:</span><span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
      <div class="dashed"></div>
      <div class="row big"><span>VALOR:</span><span>-R$ ${(resultado.valorTotal || 0).toFixed(2).replace('.', ',')}</span></div>
      <div class="row"><span>Reembolso:</span><b>${resultado.formaReembolso}</b></div>
      ${resultado.valeCode ? `<div class="dashed"></div><div class="center"><b>VALE COMPRA: ${resultado.valeCode}</b><br/><small>Apresente este código na próxima compra</small></div>` : ''}
      <div class="dashed"></div>
      ${resultado.motivo ? `<p><small>Motivo: ${resultado.motivo}</small></p>` : ''}
      <div class="center"><small>Não é documento fiscal</small></div>
      </body></html>`;
    try {
      await openPrintWindowOrShareHtml(html, `comprovante-${resultado.tipo}-${resultado.numero}.html`, `Comprovante ${resultado.tipo}`, {
        windowFeatures: 'width=400,height=600',
      });
    } catch {
      /* popup bloqueado */
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 p-5">
      <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm overflow-hidden" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="px-5 py-4 text-center border-b-2 border-dashed border-border/40">
          <div className="text-sm font-bold text-foreground">VAREJOSYNC</div>
          <div className="text-xs text-muted-foreground">Comprovante de {resultado.tipo}</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          {[
            { l: 'Número', v: resultado.numero },
            { l: 'Pedido Origem', v: resultado.pedidoNumero },
            { l: 'Cliente', v: resultado.clienteNome },
            { l: 'Data/Hora', v: format(new Date(), 'dd/MM/yyyy HH:mm') },
          ].map(({ l, v }) => (
            <div key={l} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{l}:</span>
              <span className="font-semibold text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t-2 border-b-2 border-dashed border-border/40 space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Valor reembolsado:</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400 font-glacial">−{`R$ ${(resultado.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Forma:</span>
            <span className="font-semibold text-foreground">{resultado.formaReembolso}</span>
          </div>
        </div>
        {resultado.valeCode && (
          <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-center space-y-1">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Vale Compra Gerado</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">{resultado.valeCode}</p>
            <p className="text-xs text-muted-foreground">Apresente na próxima compra</p>
          </div>
        )}
        <div className="px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground">Não é documento fiscal</p>
        </div>
      </div>

      <div className="w-full max-w-sm flex gap-3">
        <button onClick={onClose} className="flex-1 h-12 bg-muted text-foreground/90 rounded-2xl font-medium" style={{ minHeight: 48 }}>
          Fechar
        </button>
        <button onClick={imprimir} className="flex-1 h-12 rounded-2xl font-medium text-white bg-background dark:bg-card dark:text-foreground flex items-center justify-center gap-2" style={{ minHeight: 48 }}>
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}

export default function DevolucaoTrocaDialog({ open, onClose, tipo = 'Devolução' }) {
  const [step, setStep] = useState('buscar'); // buscar | itens | comprovante
  const [pedido, setPedido] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [processando, setProcessando] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setStep('buscar');
    setPedido(null);
    setResultado(null);
    onClose();
  };

  const handleConfirm = async ({ itensSelecionados, qtds, formaReembolso, motivo, totalDevolvido }) => {
    setProcessando(true);
    try {
      const user = await base44.auth.me();
      const todos = await base44.entities.DevolucaoTroca.list();
      const nextNum = (todos.length > 0 ? Math.max(...todos.map(d => parseInt(d.numero?.split('-')[1] || 0) || 0)) : 0) + 1;
      const numeroDev = `DT-${String(nextNum).padStart(5, '0')}`;

      const itensDevolvidos = itensSelecionados.map(item => {
        const key = item.produto_id + '_' + item.produto_nome;
        const qtd = qtds[key] || 0;
        return {
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade_devolvida: qtd,
          preco_unitario: item.preco_unitario_praticado || 0,
          total: qtd * (item.preco_unitario_praticado || 0),
        };
      });

      // Criar vale compra se necessário
      let valeId = null;
      let valeCodigo = null;
      if (formaReembolso === 'Vale Compra') {
        const todosVales = await base44.entities.ValeCompra.list();
        const nextVale = (todosVales.length > 0 ? Math.max(...todosVales.map(v => parseInt(v.codigo?.split('-')[1] || 0) || 0)) : 0) + 1;
        valeCodigo = `VC-${String(nextVale).padStart(5, '0')}`;
        const vale = await base44.entities.ValeCompra.create({
          codigo: valeCodigo,
          valor_original: totalDevolvido,
          valor_disponivel: totalDevolvido,
          cliente_id: pedido.cliente_id,
          cliente_nome: pedido.cliente_nome,
          origem_tipo: tipo,
          pedido_origem_id: pedido.id,
          pedido_origem_numero: pedido.numero,
          status: 'Ativo',
        });
        valeId = vale.id;
      }

      // Criar registro de devolução
      await base44.entities.DevolucaoTroca.create({
        numero: numeroDev,
        tipo,
        pedido_origem_id: pedido.id,
        pedido_origem_numero: pedido.numero,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        itens_devolvidos: itensDevolvidos,
        valor_total_devolvido: totalDevolvido,
        forma_reembolso: formaReembolso,
        vale_compra_id: valeId,
        vale_compra_codigo: valeCodigo,
        motivo,
        operador_id: user?.id,
        operador_nome: user?.full_name,
        status: 'Processada',
      });

      // Retornar produtos ao estoque
      for (const item of itensDevolvidos) {
        const produto = await base44.entities.Produto.get(item.produto_id);
        if (produto) {
          await base44.entities.Produto.update(item.produto_id, {
            estoque_atual: (produto.estoque_atual || 0) + item.quantidade_devolvida,
          });
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: 'Entrada',
            motivo: 'Devolução',
            quantidade: item.quantidade_devolvida,
            custo_unitario: item.preco_unitario,
            referencia_tipo: 'PedidoVenda',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero,
            usuario_responsavel: user?.full_name,
          });
        }
      }

      // Se reembolso em Dinheiro, criar AutorizacaoEstorno para o caixa processar
      if (formaReembolso === 'Dinheiro') {
        const todosEstornos = await base44.entities.AutorizacaoEstorno.list();
        const nextEstorno = (todosEstornos.length > 0 ? Math.max(...todosEstornos.map(a => parseInt(a.numero?.split('-')[1] || 0) || 0)) : 0) + 1;
        const numeroEstorno = `AE-${String(nextEstorno).padStart(5, '0')}`;
        
        // Buscar turnos ativos para enviar a autorização
        const todossTurnos = await base44.entities.TurnoCaixa.list();
        const turnosAtivos = todossTurnos.filter(t => !t.data_fechamento);
        
        // Criar autorização para cada turno ativo
        for (const turno of turnosAtivos) {
          await base44.entities.AutorizacaoEstorno.create({
            numero: numeroEstorno,
            devolucao_id: numeroDev,
            devolucao_numero: numeroDev,
            pedido_origem_numero: pedido.numero,
            cliente_nome: pedido.cliente_nome,
            valor_autorizado: totalDevolvido,
            forma_reembolso: 'Dinheiro',
            motivo: tipo + (motivo ? ` - ${motivo}` : ''),
            turno_caixa_destino_id: turno.id,
            turno_caixa_destino_numero: turno.numero,
            gerente_aprovador_id: user?.id,
            gerente_aprovador_nome: user?.full_name,
            status: 'Pendente',
          });
        }
      } else if (formaReembolso === 'PIX') {
        // PIX: criar lançamento financeiro imediatamente
        const contas = await base44.entities.ContasFinanceiras.list();
        const caixaGeral = contas.find(c => c.is_caixa_geral) || contas[0];
        if (caixaGeral) {
          await base44.entities.LancamentoFinanceiro.create({
            tipo: 'Despesa',
            descricao: `${tipo} - ${numeroDev} - ${pedido.numero}`,
            valor: totalDevolvido,
            conta_financeira_id: caixaGeral.id,
            conta_financeira_nome: caixaGeral.nome,
            data_vencimento: format(new Date(), 'yyyy-MM-dd'),
            data_pagamento: format(new Date(), 'yyyy-MM-dd'),
            status: 'Pago',
            categoria: 'Outros',
            referencia_tipo: 'PedidoVenda',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero,
            observacoes: `Reembolso ${formaReembolso} por ${tipo}`,
          });
          await base44.entities.ContasFinanceiras.update(caixaGeral.id, {
            saldo_atual: (caixaGeral.saldo_atual || 0) - totalDevolvido,
          });
        }
      }

      setResultado({
        numero: numeroDev,
        pedidoNumero: pedido.numero,
        clienteNome: pedido.cliente_nome,
        valorTotal: totalDevolvido,
        formaReembolso,
        valeCode: valeCodigo,
        motivo,
        tipo,
      });
      setStep('comprovante');
    } catch (error) {
      toast({ title: 'Erro ao processar', description: error.message, variant: 'destructive' });
    }
    setProcessando(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
          <button
            onClick={step === 'itens' ? () => setStep('buscar') : handleClose}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: 44, minHeight: 44 }}>
            <ArrowLeft className="w-6 h-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">
            {tipo === 'Troca' ? 'Troca de Produto' : tipo === 'Cancelamento' ? 'Cancelamento de Venda' : 'Devolução de Produto'}
          </h2>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-auto">
          {processando && (
            <div className="absolute inset-0 bg-card/80 dark:bg-background/80 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40 dark:border-white" />
            </div>
          )}
          {step === 'buscar' && <BuscarPedidoStep onFound={p => { setPedido(p); setStep('itens'); }} onClose={handleClose} />}
          {step === 'itens' && pedido && <SelecionarItensStep pedido={pedido} tipo={tipo} onConfirm={handleConfirm} />}
          {step === 'comprovante' && resultado && <ComprovanteStep resultado={resultado} onClose={handleClose} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}