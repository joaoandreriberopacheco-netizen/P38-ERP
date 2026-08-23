import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Truck, ChevronDown, ChevronUp, Edit3, Plus, CheckCircle2, Clock, Handshake, Trash2, CalendarDays } from 'lucide-react';
import AcordoFinanceiroOrfaoDialog from './AcordoFinanceiroOrfaoDialog';
import InformarEmbarque from './InformarEmbarque';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { roundToTwoDecimals, formatQuantity } from '@/lib/financialUtils';
import { calcularPercentuaisLogistica, derivarStatusEmbarqueAgregado, qtyEmbarcadaBaseLinha, qtyEmbarcadaComercialLinha, calcularItensOrfaosAguardandoDespacho } from '@/lib/embarqueLogisticaHelpers';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';

// Calcula total embarcado por produto em TODOS os embarques
function calcularTotalEmbarcado(embarques) {
  const map = {};
  (embarques || []).forEach((emb) => {
    getEmbarqueItensLinhas(emb).forEach((item) => {
      const prev = map[item.produto_id] || 0;
      const add = qtyEmbarcadaBaseLinha(item);
      map[item.produto_id] = roundToTwoDecimals(prev + add);
    });
  });
  return map;
}

function EmbarqueCard({ embarque, nivel, pedido, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editandoEta, setEditandoEta] = useState(false);
  const [etaValue, setEtaValue] = useState('');
  const [salvandoEta, setSalvandoEta] = useState(false);
  const parseValidDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const dataEmb = parseValidDate(embarque.data_embarque);
  const eta = parseValidDate(embarque.eta);
  const itensEmbarque = getEmbarqueItensLinhas(embarque);
  const totalItens = roundToTwoDecimals(
    itensEmbarque.reduce((s, i) => s + qtyEmbarcadaComercialLinha(i), 0)
  );
  const codigoExibicao = embarque.codigo_exibicao || `${pedido?.numero || '-----'}-${String.fromCharCode(64 + nivel)}`;
  const statusRecebimento = embarque.status_recebimento || embarque.status_recebimento_embarque || 'Pendente';
  const podeExcluir = !['Recebido OK', 'Recebido Parcial', 'Concluído', 'Concluído OK', 'Concluído com Divergência'].includes(statusRecebimento);
  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Embarque.delete(embarque.id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  const handleEditarEta = () => {
    const etaAtual = embarque.eta ? String(embarque.eta).slice(0, 10) : '';
    setEtaValue(etaAtual);
    setEditandoEta(true);
  };

  const handleSalvarEta = async () => {
    if (!etaValue) { setEditandoEta(false); return; }
    setSalvandoEta(true);
    await base44.entities.Embarque.update(embarque.id, { eta: etaValue });
    setSalvandoEta(false);
    setEditandoEta(false);
    onDelete?.(); // recarrega
  };

  return (
    <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
      {/* Header do card */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">N{nivel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {codigoExibicao} • {embarque.transportadora_nome || 'Transportadora não informada'}
          </p>
          <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {dataEmb && <span>Emb: {format(dataEmb, 'dd/MM/yy')}</span>}
            {eta && !editandoEta && <span className="text-teal-500">ETA: {format(eta, 'dd/MM/yy HH:mm', { locale: ptBR })}</span>}
            {editandoEta && (
              <div className="flex items-center gap-1.5">
                <input autoComplete="off"
                  type="date"
                  value={etaValue}
                  onChange={e => setEtaValue(e.target.value)}
                  className="text-[0.75rem] border border-border/40 dark:border-border/40 rounded-lg px-1 py-0 bg-card dark:bg-muted text-foreground focus:outline-none focus:border-teal-400"
                  autoFocus
                />
                <button onClick={handleSalvarEta} disabled={salvandoEta} className="text-emerald-500 font-bold text-xs">{salvandoEta ? '…' : '✓'}</button>
                <button onClick={() => setEditandoEta(false)} className="text-muted-foreground text-xs">✕</button>
              </div>
            )}
            {Array.isArray(embarque.volumes_detalhados) && embarque.volumes_detalhados.length > 0 && (
              <span>{embarque.volumes_detalhados.length} tipo(s) de volume</span>
            )}
            {embarque.peso_kg > 0 && <span>{embarque.peso_kg} kg</span>}
            <span>{statusRecebimento}</span>
            <span className="text-muted-foreground">{formatQuantity(totalItens)} un. embarcadas</span>
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
           {!editandoEta && (
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditarEta} title="Editar ETA">
               <CalendarDays className="w-3.5 h-3.5 text-teal-400" />
             </Button>
           )}
           {podeExcluir && (
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDeleteConfirm(true)}>
               <Trash2 className="w-3.5 h-3.5 text-red-400" />
             </Button>
           )}
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(embarque)}>
             <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
           </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {/* Itens expandidos */}
      {expanded &&
      <div className="border-t border-border/40 px-4 py-2 space-y-1.5">
          {itensEmbarque.map((item) =>
        <div key={item.produto_id} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{item.produto_nome}</span>
              <span className="text-xs font-medium text-foreground whitespace-nowrap">
                {formatQuantity(item.quantidade_embarcada)} / {formatQuantity(item.quantidade_pedida)} {item.unidade_medida}
              </span>
            </div>
        )}
          {embarque.observacoes &&
        <p className="text-[10px] text-muted-foreground italic mt-1 pt-1 border-t border-border/40">{embarque.observacoes}</p>
        }
        </div>
      }

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl bg-card max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir embarque?</AlertDialogTitle>
            <AlertDialogDescription>
              O embarque <strong>{codigoExibicao}</strong> será removido da logística deste pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-0 shadow-sm bg-muted text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}

function ItensOrfaos({ itens, onAcordo }) {
  if (!itens.length) return null;
  return (
    <div className="rounded-2xl bg-muted/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Itens aguardando despacho</span>
        <span className="ml-auto text-xs text-muted-foreground">{itens.length} produto(s)</span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {itens.map((item) =>
        <div key={item.produto_id} className="flex items-start justify-between gap-3">
            <span className="text-sm text-foreground flex-1 leading-tight">{item.produto_nome}</span>
            <span className="text-sm font-semibold text-foreground dark:text-foreground whitespace-nowrap flex-shrink-0">
              {formatQuantity(item.qtd_pendente_comercial ?? item.qtd_pendente)}{' '}
              <span className="text-muted-foreground font-normal">{item.unidade_pendente_exibicao || item.unidade_medida}</span>{' '}
              <span className="text-xs text-muted-foreground">pend.</span>
            </span>
          </div>
        )}
      </div>
      {onAcordo &&
      <div className="px-4 pb-3">
          <Button variant="ghost" size="sm" onClick={onAcordo}
        className="w-full h-9 text-sm text-muted-foreground hover:bg-muted border border-dashed border-border/40 rounded-xl">
            <Handshake className="w-4 h-4 mr-2" /> Registrar Acordo Financeiro
          </Button>
        </div>
      }
    </div>);

}

export default function PedidoCompraLogisticaTab({ pedido, onPedidoUpdated, onIrParaRecepcao }) {
  const [embarqueOpen, setEmbarqueOpen] = useState(false);
  const [embarqueEditando, setEmbarqueEditando] = useState(null);
  const [acordoOpen, setAcordoOpen] = useState(false);

  const embarques = Array.isArray(pedido?._embarques) ? pedido._embarques : [];
  const embarquesComDespacho = embarques.filter((emb) => !!(emb?.data_embarque || emb?.eta || emb?.transportadora_id || emb?.transportadora_nome));
  const embarquesComItensAssociados = embarquesComDespacho.filter((emb) => getEmbarqueItensLinhas(emb).some((item) => (Number(item?.quantidade_embarcada) || 0) > 0));
  const percentuaisCalculados = useMemo(
    () => calcularPercentuaisLogistica(pedido, embarques),
    [pedido?.id, pedido?.itens, embarques]
  );
  const percentualEmbarcado = percentuaisCalculados.despachado;
  const percentualConcluido = percentuaisCalculados.concluido;
  const percentualPendente = percentuaisCalculados.pendente;
  const temEmbarqueReal = embarquesComDespacho.length > 0;
  const statusEmbarqueAgregado = useMemo(() => {
    if (!temEmbarqueReal) return 'Nenhum';
    const derivado = derivarStatusEmbarqueAgregado(percentualEmbarcado);
    if (derivado !== 'Nenhum') return derivado;
    return pedido?.status_embarque || 'Nenhum';
  }, [temEmbarqueReal, percentualEmbarcado, pedido?.status_embarque]);
  const totalEmbarcado = useMemo(() => calcularTotalEmbarcado(embarquesComItensAssociados), [embarquesComItensAssociados]);

  // Itens órfãos: Necessidade (saldo pós-recepção) + pedido ainda não despachado
  const itensOrfaos = useMemo(
    () => calcularItensOrfaosAguardandoDespacho(pedido, embarques, totalEmbarcado),
    [pedido, embarques, totalEmbarcado],
  );

  const temOrfaos = itensOrfaos.length > 0;
  const semEmbarques = embarques.length === 0;

  const handleNovoEmbarque = () => {
    setEmbarqueEditando(null);
    setEmbarqueOpen(true);
  };

  const handleEditarEmbarque = (embarque) => {
    setEmbarqueEditando(embarque);
    setEmbarqueOpen(true);
  };

  const handleSuccess = () => {
    setEmbarqueOpen(false);
    setEmbarqueEditando(null);
    onPedidoUpdated?.();
  };

  return (
    <div className="space-y-4" data-pulse-sensor="pedidos-compra.logistica-panel">
      <div className="rounded-2xl bg-muted/50 px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard de embarques</p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-semibold text-foreground dark:text-foreground">{temEmbarqueReal ? percentualEmbarcado.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'}%</span>
              <span className="text-sm text-muted-foreground">despachado</span>
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{temEmbarqueReal ? percentualConcluido.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'}% concluído</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Status agregado</p>
            <p className="text-sm font-medium text-foreground/90">{statusEmbarqueAgregado}</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${temEmbarqueReal ? Math.max(0, Math.min(100, percentualConcluido)) : 0}%` }} />
          <div className="h-full bg-cyan-500 transition-all" style={{ width: `${temEmbarqueReal ? Math.max(0, Math.min(100, percentualEmbarcado - percentualConcluido)) : 0}%` }} />
          <div className="h-full bg-muted dark:bg-muted transition-all" style={{ width: `${temEmbarqueReal ? Math.max(0, Math.min(100, percentualPendente)) : 100}%` }} />
        </div>
      </div>

      {/* Header da aba com status e botões de ação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground/90 font-quicksand">
            Despachos
          </span>
          {embarques.length > 0 &&
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {embarques.length} nível(is)
            </span>
          }
          {/* LED âmbar se houver órfãos */}
          {temOrfaos &&
          <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          }
          {!temOrfaos && embarques.length > 0 &&
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
          }
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleNovoEmbarque}
            className="h-8 px-3 text-xs border-0 shadow-sm bg-card text-foreground/90 hover:bg-muted"
            data-pulse-sensor="pedidos-compra.logistica-informar-despacho"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Informar Despacho
          </Button>
        </div>
      </div>

      {/* Estado vazio */}
      {semEmbarques &&
      <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-muted/50 text-center space-y-2">
          <Clock className="w-8 h-8 text-muted-foreground dark:text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum despacho registrado</p>
          <p className="text-xs text-muted-foreground">Use o botão acima para registrar o primeiro embarque</p>
        </div>
      }

      {/* Cards de embarques por nível */}
      {embarques.map((emb, idx) =>
      <EmbarqueCard
        key={emb.id}
        embarque={emb}
        nivel={idx + 1}
        pedido={pedido}
        onEdit={handleEditarEmbarque}
        onDelete={handleSuccess} />

      )}

      {/* Itens órfãos — exibidos abaixo dos cards */}
      {!semEmbarques && temEmbarqueReal && <ItensOrfaos itens={itensOrfaos} onAcordo={temOrfaos ? () => setAcordoOpen(true) : undefined} />}

      {/* Todos despachados */}
      {!semEmbarques && !temOrfaos &&
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-teal-50 dark:bg-teal-900/20">
          <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
          <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
            Todos os itens estão cobertos pelos embarques registrados.
          </span>
        </div>
      }

      <InformarEmbarque
        pedido={pedido}
        isOpen={embarqueOpen}
        onClose={() => {setEmbarqueOpen(false);setEmbarqueEditando(null);}}
        onSuccess={handleSuccess}
        onIrParaRecepcao={onIrParaRecepcao}
        embarqueExistente={embarqueEditando} />
      

      <AcordoFinanceiroOrfaoDialog
        isOpen={acordoOpen}
        onClose={() => setAcordoOpen(false)}
        pedido={pedido}
        itensOrfaos={itensOrfaos}
        onSuccess={() => {setAcordoOpen(false);onPedidoUpdated?.();}} />
      
    </div>);

}