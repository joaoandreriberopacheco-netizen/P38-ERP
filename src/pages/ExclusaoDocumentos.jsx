import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Search, Trash2, AlertTriangle, CheckCircle2, ChevronRight, FileText, ShoppingCart, DollarSign, Package, Calendar, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

const TIPOS = [
  { value: 'PedidoVenda', label: 'Pedido de Venda', icon: ShoppingCart, cor: 'emerald' },
  { value: 'PedidoCompra', label: 'Pedido de Compra', icon: Package, cor: 'blue' },
  { value: 'ConsumoInterno', label: 'Consumo Interno', icon: ShoppingCart, cor: 'amber' },
  { value: 'LancamentoFinanceiro', label: 'Lançamento Financeiro', icon: DollarSign, cor: 'purple' },
  { value: 'MovimentacaoEstoque', label: 'Movimentação de Estoque', icon: FileText, cor: 'amber' },
  { value: 'MovimentosCaixaReforco', label: 'Reforço de Caixa', icon: Plus, cor: 'emerald' },
  { value: 'MovimentosCaixaRecolhimento', label: 'Recolhimento de Caixa', icon: Minus, cor: 'blue' },
  { value: 'DespesaTurno', label: 'Despesa do Turno', icon: DollarSign, cor: 'red' },
  { value: 'Embarque', label: 'Recebimento de Embarque', icon: Package, cor: 'blue' },
  { value: 'AgendaLogistica', label: 'Agenda de Entrega', icon: Calendar, cor: 'red' },
];

// Retorna quais entidades-filhas serão apagadas junto
async function buscarFilhos(tipo, doc) {
  const filhos = [];

  if (tipo === 'PedidoVenda') {
    const [lancamentos, movEst, agendas, ordens, protocolos] = await Promise.all([
      base44.entities.LancamentoFinanceiro.filter({ referencia_id: doc.id }),
      base44.entities.MovimentacaoEstoque.filter({ referencia_id: doc.id }),
      base44.entities.AgendaLogistica.filter({ pedido_venda_id: doc.id }),
      base44.entities.OrdemSeparacao.filter({ pedido_venda_id: doc.id }),
      base44.entities.ProtocoloEntrega.filter({ pedido_venda_id: doc.id }),
    ]);
    lancamentos.forEach(l => filhos.push({ tipo: 'LancamentoFinanceiro', label: `Lançamento: ${l.descricao}`, id: l.id }));
    movEst.forEach(m => filhos.push({ tipo: 'MovimentacaoEstoque', label: `Mov. Estoque: ${m.produto_nome}`, id: m.id }));
    agendas.forEach(a => filhos.push({ tipo: 'AgendaLogistica', label: `Agenda: ${a.data_agendada}`, id: a.id }));
    ordens.forEach(o => filhos.push({ tipo: 'OrdemSeparacao', label: `Ordem Separação: ${o.pedido_numero}`, id: o.id }));
    protocolos.forEach(p => filhos.push({ tipo: 'ProtocoloEntrega', label: `Protocolo Entrega: ${p.pedido_numero}`, id: p.id }));
  }

  if (tipo === 'PedidoCompra') {
    const [lancamentos, movEst] = await Promise.all([
      base44.entities.LancamentoFinanceiro.filter({ referencia_id: doc.id }),
      base44.entities.MovimentacaoEstoque.filter({ referencia_id: doc.id }),
    ]);
    lancamentos.forEach(l => filhos.push({ tipo: 'LancamentoFinanceiro', label: `Lançamento: ${l.descricao}`, id: l.id }));
    movEst.forEach(m => filhos.push({ tipo: 'MovimentacaoEstoque', label: `Mov. Estoque: ${m.produto_nome}`, id: m.id }));
  }

  if (tipo === 'ConsumoInterno') {
    const [movEst, anexos] = await Promise.all([
      base44.entities.MovimentacaoEstoque.filter({ referencia_tipo: 'ConsumoInterno', referencia_id: doc.id }),
      base44.entities.AnexoDocumento.filter({ referencia_tipo: 'Outro', referencia_id: doc.id }),
    ]);
    movEst.forEach((m) => filhos.push({ tipo: 'MovimentacaoEstoque', label: `Mov. Estoque: ${m.produto_nome}`, id: m.id }));
    anexos.forEach((a) => filhos.push({ tipo: 'AnexoDocumento', label: `Anexo: ${a.nome_arquivo || a.descricao || a.id?.slice(0, 8)}`, id: a.id }));
  }

  if (tipo === 'Embarque') {
    const movEst = await base44.entities.MovimentacaoEstoque.filter({
      referencia_tipo: 'PedidoCompra',
      referencia_id: doc.pedido_compra_id,
    });
    const produtoIds = new Set((doc.itens || doc.itens_embarcados || []).map((item) => item.produto_id));
    movEst
      .filter((m) => produtoIds.has(m.produto_id) && m.tipo === 'Entrada' && m.motivo === 'Compra')
      .forEach((m) => filhos.push({ tipo: 'MovimentacaoEstoque', label: `Mov. Estoque: ${m.produto_nome}`, id: m.id }));
  }

  return filhos;
}

async function excluirTudo(tipo, doc, filhos) {
  for (const filho of filhos) {
    await base44.entities[filho.tipo].delete(filho.id);
  }

  if (tipo === 'MovimentosCaixaReforco' || tipo === 'MovimentosCaixaRecolhimento') {
    await base44.entities.MovimentosCaixa.delete(doc.id);
    return;
  }

  if (tipo === 'DespesaTurno') {
    await base44.entities.LancamentoFinanceiro.delete(doc.id);
    return;
  }

  await base44.entities[tipo].delete(doc.id);
}

export default function ExclusaoDocumentosPage() {
  const [tipoSelecionado, setTipoSelecionado] = useState('PedidoVenda');
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [documento, setDocumento] = useState(null);
  const [filhos, setFilhos] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [excluido, setExcluido] = useState(false);
  const { toast } = useToast();

  const tipoConfig = TIPOS.find(t => t.value === tipoSelecionado);

  const buscar = async () => {
    if (!termo.trim()) return;
    setBuscando(true);
    setDocumento(null);
    setFilhos([]);
    setConfirmando(false);
    setExcluido(false);

    try {
      const t = termo.trim().toUpperCase();
      let docs = [];

      if (tipoSelecionado === 'PedidoVenda') docs = await base44.entities.PedidoVenda.list();
      else if (tipoSelecionado === 'PedidoCompra') docs = await base44.entities.PedidoCompra.list();
      else if (tipoSelecionado === 'ConsumoInterno') docs = await base44.entities.ConsumoInterno.list();
      else if (tipoSelecionado === 'LancamentoFinanceiro') docs = await base44.entities.LancamentoFinanceiro.list();
      else if (tipoSelecionado === 'MovimentacaoEstoque') docs = await base44.entities.MovimentacaoEstoque.list();
      else if (tipoSelecionado === 'MovimentosCaixaReforco') docs = (await base44.entities.MovimentosCaixa.list()).filter(d => d.tipo === 'Reforço');
      else if (tipoSelecionado === 'MovimentosCaixaRecolhimento') docs = (await base44.entities.MovimentosCaixa.list()).filter(d => d.tipo === 'Sangria' || d.tipo === 'Recolhimento de Caixa');
      else if (tipoSelecionado === 'DespesaTurno') docs = (await base44.entities.LancamentoFinanceiro.list()).filter(d => d.tipo === 'Despesa' && d.turno_caixa_id);
      else if (tipoSelecionado === 'Embarque') docs = await base44.entities.Embarque.list();
      else if (tipoSelecionado === 'AgendaLogistica') docs = await base44.entities.AgendaLogistica.list();

      const encontrado = docs.find(d =>
        (d.numero || d.descricao || d.produto_nome || d.pedido_numero || d.observacao || '')
          .toUpperCase().includes(t) ||
        d.id === t
      );

      if (!encontrado) {
        toast({ title: 'Documento não encontrado', variant: 'destructive' });
        return;
      }

      const fs = await buscarFilhos(tipoSelecionado, encontrado);
      setDocumento(encontrado);
      setFilhos(fs);
    } catch (error) {
      console.error('[ExclusaoDocumentos] buscar:', error);
      toast({
        title: 'Erro ao buscar documento',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBuscando(false);
    }
  };

  const handleExcluir = async () => {
    setExcluindo(true);
    await excluirTudo(tipoSelecionado, documento, filhos);
    setExcluindo(false);
    setExcluido(true);
    toast({ title: 'Documento excluído com sucesso', className: 'bg-emerald-100 text-emerald-800' });
  };

  const resetar = () => {
    setDocumento(null);
    setFilhos([]);
    setConfirmando(false);
    setExcluido(false);
    setTermo('');
  };

  const formatValor = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const getDocLabel = (doc) => {
    if (!doc) return '';
    return doc.codigo_exibicao || doc.numero || doc.descricao?.slice(0, 40) || doc.observacao?.slice(0, 40) || doc.produto_nome || doc.pedido_numero || doc.id?.slice(0, 8);
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground font-glacial">Exclusão de Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Busque e exclua um documento e todos os seus registros relacionados.</p>
        </div>

        {/* Tipo + Busca */}
        <div className="bg-card rounded-2xl shadow-sm p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tipo de documento</label>
            <Select value={tipoSelecionado} onValueChange={v => { setTipoSelecionado(v); resetar(); }}>
              <SelectTrigger className="h-11 bg-muted/40 dark:bg-muted border-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-muted">
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Número / descrição / ID</label>
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder={tipoSelecionado === 'PedidoVenda' ? 'Ex: PV-00042' : 'Número ou descrição...'}
                value={termo}
                onChange={e => setTermo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                className="bg-muted/40 dark:bg-muted border-0 rounded-xl h-11 uppercase font-mono"
              />
              <Button onClick={buscar} disabled={buscando} className="bg-card text-card-foreground rounded-xl px-5 h-11">
                {buscando ? '...' : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {excluido && (
          <div className="bg-card rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#4A5D23] dark:text-[#a4ce33]" />
            </div>
            <p className="text-base font-semibold text-foreground">Excluído com sucesso</p>
            <button onClick={resetar} className="text-sm text-muted-foreground underline">Excluir outro documento</button>
          </div>
        )}

        {documento && !excluido && (
          <div className="space-y-3">
            {/* Card do documento principal */}
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                {React.createElement(tipoConfig.icon, { className: 'w-4 h-4 text-muted-foreground' })}
                <span className="text-xs font-semibold text-foreground/90">{tipoConfig.label} — Documento Principal</span>
              </div>
              <div className="px-4 py-4 space-y-1">
                <div className="text-base font-bold text-foreground font-mono">{getDocLabel(documento)}</div>
                {documento.cliente_nome && <div className="text-sm text-muted-foreground">{documento.cliente_nome}</div>}
                {documento.fornecedor_nome && <div className="text-sm text-muted-foreground">{documento.fornecedor_nome}</div>}
                {documento.valor_total != null && <div className="text-sm text-foreground/90">{formatValor(documento.valor_total)}</div>}
                {documento.valor != null && <div className="text-sm text-foreground/90">{formatValor(documento.valor)}</div>}
                {documento.observacao && <div className="text-sm text-muted-foreground">{documento.observacao}</div>}
                {documento.status && <div className="text-xs text-muted-foreground">{documento.status}</div>}
                {documento.status_registro && <div className="text-xs text-muted-foreground">{documento.status_registro}</div>}
                {documento.created_date && <div className="text-xs text-muted-foreground">{format(new Date(documento.created_date), 'dd/MM/yyyy HH:mm')}</div>}
              </div>
            </div>

            {/* Filhos */}
            {filhos.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {filhos.length} registro{filhos.length > 1 ? 's' : ''} relacionado{filhos.length > 1 ? 's' : ''} também serão excluídos
                  </span>
                </div>
                <P38MobileLineList>
                  {filhos.map((f, idx) => (
                    <P38MobileLine
                      key={idx}
                      striped={idx % 2 === 1}
                      accent={p38AccentKeyFromTone('danger')}
                      title={f.label}
                      trailing={<ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                    />
                  ))}
                </P38MobileLineList>
              </div>
            )}

            {filhos.length === 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">Nenhum registro relacionado encontrado.</div>
            )}

            {/* Botão confirmar */}
            {!confirmando ? (
              <button
                onClick={() => setConfirmando(true)}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 text-base"
                style={{ minHeight: 56 }}>
                <Trash2 className="w-5 h-5" />
                Excluir documento{filhos.length > 0 ? ` + ${filhos.length} relacionados` : ''}
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">Confirmar exclusão permanente</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Esta ação não pode ser desfeita. O documento e seus {filhos.length} registro(s) relacionado(s) serão excluídos permanentemente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmando(false)}
                    className="flex-1 h-11 bg-muted text-foreground/90 rounded-xl font-medium text-sm">
                    Cancelar
                  </button>
                  <button
                    onClick={handleExcluir}
                    disabled={excluindo}
                    className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                    style={{ minHeight: 44 }}>
                    {excluindo ? 'Excluindo...' : 'Sim, excluir'}
                  </button>
                </div>
              </div>
            )}

            <button onClick={resetar} className="w-full text-sm text-muted-foreground py-2">
              Cancelar e limpar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}