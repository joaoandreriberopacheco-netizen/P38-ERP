import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Handshake, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { dataHoje } from '@/components/utils/dateUtils';

// itensOrfaos: [{ produto_id, produto_nome, qtd_pendente, unidade_medida }]
export default function AcordoFinanceiroOrfaoDialog({ isOpen, onClose, pedido, itensOrfaos, onSuccess }) {
  const [tipo, setTipo] = useState('saldo_fornecedor'); // 'saldo_fornecedor' | 'conta_receber'
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      base44.entities.ContasFinanceiras.list().then(setContas).catch(() => {});
    }
  }, [isOpen]);

  const handleConfirmar = async () => {
    if (!valor || parseFloat(valor) <= 0) return toast.error('Informe o valor do acordo');
    if (!contaId) return toast.error('Selecione a conta financeira');

    setLoading(true);
    try {
      const descricaoItens = itensOrfaos.map((i) => {
        const qtd = i.qtd_pendente_comercial ?? i.qtd_pendente;
        const un = i.unidade_pendente_exibicao || i.unidade_medida;
        return `${qtd} ${un} ${i.produto_nome}`;
      }).join(', ');

      if (tipo === 'saldo_fornecedor') {
        // Cria crédito (receita) vinculado ao fornecedor — saldo a favor da empresa
        await base44.entities.LancamentoFinanceiro.create({
          tipo: 'Receita',
          descricao: `Saldo Fornecedor — Itens não entregues (${pedido.numero})`,
          terceiro_id: pedido.fornecedor_id,
          terceiro_nome: pedido.fornecedor_nome,
          valor: parseFloat(valor),
          data_vencimento: dataHoje(),
          status: 'Em Aberto',
          conta_financeira_id: contaId,
          referencia_id: pedido.id,
          referencia_tipo: 'PedidoCompra',
          referencia_numero: pedido.numero,
          observacoes: `Acordo financeiro por itens órfãos: ${descricaoItens}. ${observacoes}`,
          is_custo_mercadoria: false,
          pedido_compra_vinculado_id: pedido.id,
          pedido_compra_vinculado_numero: pedido.numero,
        });
      } else {
        // Conta a receber do fornecedor
        await base44.entities.LancamentoFinanceiro.create({
          tipo: 'Receita',
          descricao: `A Receber do Fornecedor — Itens não entregues (${pedido.numero})`,
          terceiro_id: pedido.fornecedor_id,
          terceiro_nome: pedido.fornecedor_nome,
          valor: parseFloat(valor),
          data_vencimento: dataHoje(),
          status: 'Em Aberto',
          conta_financeira_id: contaId,
          referencia_id: pedido.id,
          referencia_tipo: 'PedidoCompra',
          referencia_numero: pedido.numero,
          observacoes: `Conta a receber por não entrega: ${descricaoItens}. ${observacoes}`,
          is_custo_mercadoria: false,
          pedido_compra_vinculado_id: pedido.id,
          pedido_compra_vinculado_numero: pedido.numero,
        });
      }

      await base44.functions.invoke('recalcularConclusaoPedidoCompra', { pedidoId: pedido.id });
      toast.success('Acordo financeiro registrado com sucesso!');
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
      <DialogContent className="max-w-md bg-card border-0 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-quicksand text-foreground text-base">
            <Handshake className="w-4 h-4 text-amber-500" />
            Acordo Financeiro — Itens Órfãos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aviso */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Itens pendentes</p>
              <ul className="space-y-0.5">
                {itensOrfaos.map(item => (
                  <li key={item.produto_id} className="text-[10px] text-amber-600 dark:text-amber-400">
                    {item.qtd_pendente_comercial ?? item.qtd_pendente}{' '}
                    {item.unidade_pendente_exibicao || item.unidade_medida} · {item.produto_nome}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tipo de acordo */}
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

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$) *</Label>
            <Input
              type="text" inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value.replace(',', '.'))}
              className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Conta financeira */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conta Financeira *</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="bg-muted/50 border-0 shadow-sm text-foreground dark:text-foreground">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-muted border-0 shadow-lg z-[9999]">
                {contas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Justificativa / Observações</Label>
            <Input
              placeholder="Motivo do acordo, referência NF, etc..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
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