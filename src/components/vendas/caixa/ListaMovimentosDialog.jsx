import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { ArrowLeft, Plus, Minus, DollarSign, Pencil, RefreshCw } from 'lucide-react';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { codigoDespesaTurno } from '@/lib/codigoDespesaTurno';

export default function ListaMovimentosDialog({ open, onOpenChange, tipo, movimentos, despesasLista, formatValor, onSelectMovimento, onRefresh }) {

  const isReforcos = tipo === 'reforcos';
  const isSangrias = tipo === 'sangrias';
  const isDespesas = tipo === 'despesas';

  const titulo = isReforcos ? 'Reforços do Turno' : isSangrias ? 'Recolhimentos do Turno' : isDespesas ? 'Despesas do Turno' : 'Movimentações';

  const listaFiltrada = isReforcos
    ? movimentos.filter(m => m.tipo === 'Reforço')
    : isSangrias
    ? movimentos.filter(m => m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa')
    : isDespesas
    ? (despesasLista || [])
    : [];

  const corTotal = isReforcos ? caixaClasses('success').text : isSangrias ? caixaClasses('info').text : caixaClasses('danger').text;
  const toneDanger = caixaClasses('danger');
  const sinal = isReforcos ? '+' : '−';

  const EmptyIcon = isReforcos ? Plus : isSangrias ? Minus : DollarSign;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CaixaDialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
        <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
          <button onClick={() => onOpenChange(false)} className="p-2 -ml-2 hover:bg-muted rounded-lg" style={{ minWidth: '44px', minHeight: '44px' }}>
            <ArrowLeft className="w-6 h-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">{titulo}</h2>
          <button onClick={onRefresh} className="p-2 hover:bg-muted rounded-lg" style={{ minWidth: '44px', minHeight: '44px' }}>
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {listaFiltrada.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <EmptyIcon className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-muted-foreground">Nenhum registro encontrado</p>
            </div>
          ) : (
            <VirtualizedList
              items={listaFiltrada}
              estimateSize={isDespesas ? 112 : 132}
              className="h-[calc(100vh-190px)] pr-1"
              contentClassName="max-w-4xl mx-auto"
              itemClassName="pb-3"
              getItemKey={(item) => item.id}
              renderItem={(item) => {
                if (isDespesas) {
                  const codigo = codigoDespesaTurno(item);
                  return (
                    <div className="bg-card rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {codigo && (
                            <div className="text-xs font-mono font-semibold text-muted-foreground mb-1">{codigo}</div>
                          )}
                          <div className="text-sm font-semibold text-foreground">{item.descricao}</div>
                          <div className="text-xs text-muted-foreground mt-1">{item.categoria} · {item.created_date ? formatarDataHora(item.created_date).split(' ')[1] : ''}</div>
                        </div>
                        <div className={`text-2xl font-bold font-glacial ${toneDanger.text}`}>−{formatValor(item.valor)}</div>
                      </div>
                    </div>
                  );
                }

                const cancelado = item.status_registro === 'Cancelado';
                const editado = item.status_registro === 'Editado';

                return (
                  <div className="bg-card rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`text-sm font-semibold ${cancelado ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.numero}</span>
                          <span className="text-xs text-muted-foreground">{formatarDataHora(item.created_date).split(' ')[1]}</span>
                          {cancelado && <span className={`text-[10px] px-2 py-1 rounded-full ${toneDanger.pill}`}>Cancelado</span>}
                          {editado && <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Editado</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.usuario_responsavel_nome}</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className={`text-2xl font-bold font-glacial ${cancelado ? 'line-through opacity-50 ' : ''}${corTotal}`}>
                          {sinal}{formatValor(item.valor)}
                        </div>
                        {onSelectMovimento && (
                          <button onClick={() => onSelectMovimento(item)} className="p-2 rounded-xl hover:bg-muted">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.observacao && (
                      <div className={`text-sm pt-3 border-t border-border/40 ${cancelado ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>{item.observacao}</div>
                    )}
                    {item.motivo_ajuste && (
                      <div className="mt-2 text-xs text-muted-foreground">Motivo: {item.motivo_ajuste}</div>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>

        {listaFiltrada.length > 0 && (
          <div className="flex-shrink-0 bg-card border-t border-border/40 p-4">
            <div className="flex justify-between items-center max-w-4xl mx-auto">
              <span className="text-sm font-medium text-muted-foreground">Total do Turno</span>
              <span className={`text-2xl font-bold font-glacial ${corTotal}`}>
                {sinal}{formatValor(listaFiltrada.filter(item => item.status_registro !== 'Cancelado').reduce((sum, item) => sum + (item.valor || 0), 0))}
              </span>
            </div>
          </div>
        )}
      </CaixaDialogContent>
    </Dialog>
  );
}