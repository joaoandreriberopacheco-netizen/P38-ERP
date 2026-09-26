import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Handshake, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { dataHoje } from '@/components/utils/dateUtils';
import {
  aplicarBaixaLogisticaAcordoFinanceiroOrfaos,
  calcularFolhaLogisticaLinha,
  particionarBaixaOrfaoAcordo,
} from '@/lib/aplicarAcordoFinanceiroOrfaos';
import { calculateBaseQuantity } from '@/lib/productUnits';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { listarAcordosOrfaoComBaixaPendente } from '@/lib/acordoFinanceiroOrfaoLancamento';
import { listarLancamentosPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';

// itensOrfaos: [{ produto_id, produto_nome, qtd_pendente, unidade_medida, qtd_pendente_comercial }]
export default function AcordoFinanceiroOrfaoDialog({
  isOpen,
  onClose,
  pedido,
  embarques = [],
  itensOrfaos,
  produtosMap = {},
  onSuccess,
}) {
  const [tipo, setTipo] = useState('saldo_fornecedor');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [qtdBaixaComercial, setQtdBaixaComercial] = useState({});
  /** Acordo financeiro já lançado sem baixa na folha — não se resolve neste ecrã (ex.: legado KA2-K4Q). */
  const [acordoLegadoSemBaixa, setAcordoLegadoSemBaixa] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    base44.entities.ContasFinanceiras.list().then(setContas).catch(() => {});
    listarLancamentosPedidoCompra(base44, pedido?.id)
      .then((lancs) => {
        const pendentes = listarAcordosOrfaoComBaixaPendente(pedido, lancs);
        setAcordoLegadoSemBaixa(pendentes[0]?.lancamento || null);
      })
      .catch(() => setAcordoLegadoSemBaixa(null));

    const init = {};
    (itensOrfaos || []).forEach((item) => {
      const q = item.qtd_pendente_comercial ?? item.qtd_pendente;
      init[item.produto_id] = String(q ?? '');
    });
    setQtdBaixaComercial(init);
  }, [isOpen, itensOrfaos, pedido?.id, pedido?.historico]);

  const bloqueadoLegado = Boolean(acordoLegadoSemBaixa);

  const buildItensComBaixa = () =>
    (itensOrfaos || []).map((orfao) => {
      const itemPedido = (pedido?.itens || []).find(
        (it) => String(it?.produto_id) === String(orfao?.produto_id),
      );
      const qCom = parseFloat(qtdBaixaComercial[orfao.produto_id]) || 0;
      const fator = Number(itemPedido?.fator_aplicado ?? itemPedido?.fator_conversao) || 1;
      return {
        ...orfao,
        qtd_baixa_base: calculateBaseQuantity(qCom, fator),
      };
    });

  const planoPorItem = useMemo(() => {
    return (itensOrfaos || []).map((orfao) => {
      const itemPedido = (pedido?.itens || []).find(
        (it) => String(it?.produto_id) === String(orfao?.produto_id),
      );
      if (!itemPedido) return null;
      const qCom = parseFloat(qtdBaixaComercial[orfao.produto_id]) || 0;
      const fator = Number(itemPedido?.fator_aplicado ?? itemPedido?.fator_conversao) || 1;
      const qBase = calculateBaseQuantity(qCom, fator);
      const plano = particionarBaixaOrfaoAcordo({
        itemPedido,
        embarques,
        qtdBaixaBase: qBase,
      });
      return { orfao, plano, qBase };
    }).filter(Boolean);
  }, [itensOrfaos, pedido?.itens, embarques, qtdBaixaComercial]);

  const handleConfirmar = async () => {
    if (bloqueadoLegado) return;
    if (!valor || parseFloat(valor) <= 0) return toast.error('Informe o valor do acordo');
    if (!contaId) return toast.error('Selecione a conta financeira');

    setLoading(true);
    try {
      const itensComBaixa = buildItensComBaixa();

      const descricaoItens = itensComBaixa.map((i) => {
        const qtd = qtdBaixaComercial[i.produto_id] ?? i.qtd_pendente_comercial ?? i.qtd_pendente;
        const un = i.unidade_pendente_exibicao || i.unidade_medida;
        return `${qtd} ${un} ${i.produto_nome}`;
      }).join(', ');

      const payloadBase = {
        tipo: 'Receita',
        terceiro_id: pedido.fornecedor_id,
        terceiro_nome: pedido.fornecedor_nome,
        valor: parseFloat(valor),
        data_vencimento: dataHoje(),
        status: 'Em Aberto',
        conta_financeira_id: contaId,
        referencia_id: pedido.id,
        referencia_tipo: 'PedidoCompra',
        referencia_numero: pedido.numero,
        is_custo_mercadoria: false,
        pedido_compra_vinculado_id: pedido.id,
        pedido_compra_vinculado_numero: pedido.numero,
      };

      const lancamento = await base44.entities.LancamentoFinanceiro.create(
        tipo === 'saldo_fornecedor'
          ? {
            ...payloadBase,
            descricao: `Saldo Fornecedor — Itens não entregues (${pedido.numero})`,
            observacoes: `Acordo financeiro por itens órfãos: ${descricaoItens}. ${observacoes}`,
          }
          : {
            ...payloadBase,
            descricao: `A Receber do Fornecedor — Itens não entregues (${pedido.numero})`,
            observacoes: `Conta a receber por não entrega: ${descricaoItens}. ${observacoes}`,
          },
      );

      const lancamentoId = lancamento?.id;
      if (lancamentoId) {
        const { ok, error, resumo } = await aplicarBaixaLogisticaAcordoFinanceiroOrfaos(base44, {
          pedido,
          embarques,
          itensOrfaos: itensComBaixa,
          lancamentoId,
          produtosMap,
          baixarQuantidades: true,
        });
        if (!ok) {
          toast.error(error || 'Acordo financeiro criado, mas o ajuste na folha logística falhou.');
        } else if (resumo?.some((r) => r.nao_aplicado_base > 0.009)) {
          toast.message('Acordo registrado com ressalva', {
            description: 'Parte da quantidade não pôde ser baixada na folha — revise o pedido.',
          });
        }
      }

      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);
      toast.success('Acordo financeiro registrado e folha do pedido atualizada.');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error('Erro ao registrar acordo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-0 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-quicksand text-foreground text-base">
            <Handshake className="w-4 h-4 text-amber-500" />
            Acordo Financeiro — Itens Órfãos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {bloqueadoLegado && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/40 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Acordo financeiro já registrado
              </p>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Valor: R$ {Number(acordoLegadoSemBaixa.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                A regularização na folha logística deste pedido{' '}
                <strong>não é feita neste ecrã</strong> — é tratada pela operação no Supabase
                {String(pedido?.numero || '').toUpperCase() === 'KA2-K4Q'
                  ? ' (pedido KA2-K4Q).'
                  : ' (acordo anterior ao fluxo único).'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Não crie outro lançamento aqui. Quando a folha estiver regularizada, o órfão deixa de aparecer.
              </p>
            </div>
          )}

          {!bloqueadoLegado && (
            <p className="text-[10px] text-muted-foreground leading-relaxed px-0.5">
              Um único passo: o lançamento financeiro e o ajuste na folha (saldo pendente e comprada)
              seguem juntos, no mesmo espírito de uma devolução parcial ao fornecedor.
            </p>
          )}

          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                Itens pendentes (folha 4 colunas)
              </p>
              <ul className="space-y-2">
                {(itensOrfaos || []).map((item) => {
                  const itemPedido = (pedido?.itens || []).find(
                    (it) => String(it?.produto_id) === String(item?.produto_id),
                  );
                  const folha = itemPedido
                    ? calcularFolhaLogisticaLinha(itemPedido, embarques)
                    : null;
                  return (
                    <li key={item.produto_id} className="text-[10px] text-amber-600 dark:text-amber-400">
                      <p className="font-medium text-foreground/90 truncate">{item.produto_nome}</p>
                      {folha && (
                        <p className="text-muted-foreground mt-0.5 leading-snug">
                          Comprada {folha.comprada} · Trânsito {folha.emTransito} · Recep. {folha.recebida}{' '}
                          · Pend. {folha.saldoPendente} · Acordo (máx.){' '}
                          {roundToTwoDecimals(Math.max(0, folha.comprada - folha.recebida))}
                        </p>
                      )}
                      {!bloqueadoLegado && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="h-7 w-16 text-xs bg-card border-0 shadow-sm text-center"
                            value={qtdBaixaComercial[item.produto_id] ?? ''}
                            onChange={(e) =>
                              setQtdBaixaComercial((prev) => ({
                                ...prev,
                                [item.produto_id]: e.target.value.replace(',', '.'),
                              }))
                            }
                          />
                          <span>{item.unidade_pendente_exibicao || item.unidade_medida} no acordo</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {!bloqueadoLegado && planoPorItem.length > 0 && (
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/80">Prévia do ajuste na folha (incluído no acordo)</p>
              {planoPorItem.map(({ orfao, plano }) => (
                <p key={orfao.produto_id}>
                  {orfao.produto_nome}: −{plano.qtd_baixa_total} base na folha (não recebido{' '}
                  {plano.saldo_nao_recebido_antes ?? plano.folha_antes.comprada - plano.folha_antes.recebida}{' '}
                  → após acordo)
                </p>
              ))}
            </div>
          )}

          {!bloqueadoLegado && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Acordo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted border-0 shadow-lg z-[9999]">
                    <SelectItem value="saldo_fornecedor">Saldo a Favor (crédito com o fornecedor)</SelectItem>
                    <SelectItem value="conta_receber">Conta a Receber do Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {tipo === 'saldo_fornecedor'
                    ? 'Crédito para compras futuras com este fornecedor.'
                    : 'Cobrança formal ao fornecedor pelos itens não entregues.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value.replace(',', '.'))}
                  className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Conta Financeira *</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted border-0 shadow-lg z-[9999]">
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Justificativa / Observações</Label>
                <Input
                  placeholder="Motivo do acordo, referência NF, etc..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} size="sm"
            className="border-0 shadow-sm text-foreground/90">
            {bloqueadoLegado ? 'Fechar' : 'Cancelar'}
          </Button>
          {!bloqueadoLegado && (
            <Button onClick={handleConfirmar} disabled={loading} size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm">
              {loading ? 'Registrando...' : 'Registrar acordo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
