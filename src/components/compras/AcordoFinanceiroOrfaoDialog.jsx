import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Handshake, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { dataHoje } from '@/components/utils/dateUtils';
import {
  aplicarBaixaLogisticaAcordoFinanceiroOrfaos,
  calcularFolhaLogisticaLinha,
  particionarBaixaOrfaoAcordo,
} from '@/lib/aplicarAcordoFinanceiroOrfaos';
import { calculateBaseQuantity } from '@/lib/productUnits';
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
  const [baixarLogistica, setBaixarLogistica] = useState(true);
  const [qtdBaixaComercial, setQtdBaixaComercial] = useState({});

  useEffect(() => {
    if (isOpen) {
      base44.entities.ContasFinanceiras.list().then(setContas).catch(() => {});
      const init = {};
      (itensOrfaos || []).forEach((item) => {
        const q = item.qtd_pendente_comercial ?? item.qtd_pendente;
        init[item.produto_id] = String(q ?? '');
      });
      setQtdBaixaComercial(init);
    }
  }, [isOpen, itensOrfaos]);

  const planoPorItem = useMemo(() => {
    if (!baixarLogistica) return [];
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
  }, [baixarLogistica, itensOrfaos, pedido?.itens, embarques, qtdBaixaComercial]);

  const handleConfirmar = async () => {
    if (!valor || parseFloat(valor) <= 0) return toast.error('Informe o valor do acordo');
    if (!contaId) return toast.error('Selecione a conta financeira');

    setLoading(true);
    try {
      const itensComBaixa = (itensOrfaos || []).map((orfao) => {
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
      if (baixarLogistica && lancamentoId) {
        const { ok, error, resumo } = await aplicarBaixaLogisticaAcordoFinanceiroOrfaos(base44, {
          pedido,
          embarques,
          itensOrfaos: itensComBaixa,
          lancamentoId,
          produtosMap,
          baixarQuantidades: true,
        });
        if (!ok) {
          toast.error(error || 'Acordo financeiro criado, mas a baixa logística falhou.');
        } else if (resumo?.some((r) => r.nao_aplicado_base > 0.009)) {
          toast.message('Acordo registrado com ressalva', {
            description: 'Parte da quantidade não pôde ser baixada na folha — revise o pedido.',
          });
        }
      }

      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);
      toast.success(
        baixarLogistica
          ? 'Acordo financeiro registrado e quantidades órfãs atualizadas.'
          : 'Acordo financeiro registrado com sucesso!',
      );
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
                          Comprada {folha.comprada} · Desp. {folha.despachada} · Rec. {folha.recebida} ·
                          Pend. {folha.saldoPendente}
                        </p>
                      )}
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
                          disabled={!baixarLogistica}
                        />
                        <span>{item.unidade_pendente_exibicao || item.unidade_medida} a baixar</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-border"
              checked={baixarLogistica}
              onChange={(e) => setBaixarLogistica(e.target.checked)}
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Zerar ou reduzir o saldo pendente no pedido (recomendado): baixa primeiro embarques
              Necessidade e depois reduz a quantidade comprada, como na folha logística.
            </span>
          </label>

          {baixarLogistica && planoPorItem.length > 0 && (
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/80">Prévia da baixa</p>
              {planoPorItem.map(({ orfao, plano }) => (
                <p key={orfao.produto_id}>
                  {orfao.produto_nome}: Necessidade −{plano.baixa_necessidade_base}, comprada −
                  {plano.baixa_comprada_base} (pend. {plano.folha_antes.saldoPendente} → estimado após acordo)
                </p>
              ))}
            </div>
          )}

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
                ? 'Registra um crédito para uso em compras futuras com este fornecedor.'
                : 'Registra uma cobrança formal ao fornecedor pelos itens não entregues.'}
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
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} size="sm"
            className="border-0 shadow-sm text-foreground/90">Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={loading} size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm">
            {loading ? 'Registrando...' : 'Confirmar Acordo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
