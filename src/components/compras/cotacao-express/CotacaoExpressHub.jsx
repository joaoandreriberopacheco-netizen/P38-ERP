import { format } from 'date-fns';
import { Camera, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
  p38StatusTone,
} from '@/components/ui/p38-mobile-line';
import { cotacaoAccent, isCotacaoAberta, isCotacaoConcluida } from '@/lib/cotacaoExpressUtils';

function HubTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:py-2.5 sm:text-sm ${
        active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function CotacaoExpressHub({
  cotacoes = [],
  loading = false,
  hubView,
  onHubViewChange,
  onNovaCotacao,
  onImportarFoto,
  onAbrirCotacao,
  onExcluirCotacao,
  criando = false,
}) {
  const abertas = cotacoes.filter((c) => isCotacaoAberta(c.status));
  const concluidas = cotacoes.filter((c) => isCotacaoConcluida(c.status));
  const lista = hubView === 'abertas' ? abertas : concluidas;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold font-glacial text-foreground">
            Cotações
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onImportarFoto}
            className="h-9 shrink-0 rounded-xl px-3"
          >
            <Camera className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">OCR</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onNovaCotacao}
            disabled={criando}
            className="h-9 shrink-0 rounded-xl px-3 p38-btn-primary"
          >
            {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />Nova</>}
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-border/40 px-3 py-2">
        <div className="flex min-w-0 gap-1 rounded-2xl bg-muted/50 p-1">
          <HubTab active={hubView === 'abertas'} onClick={() => onHubViewChange('abertas')}>
            Abertas ({abertas.length})
          </HubTab>
          <HubTab active={hubView === 'concluidas'} onClick={() => onHubViewChange('concluidas')}>
            Concluídas ({concluidas.length})
          </HubTab>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {hubView === 'abertas'
                ? 'Nenhuma cotação aberta. Toque em Nova para começar.'
                : 'Nenhuma cotação concluída neste período.'}
            </p>
          </div>
        ) : (
          <P38MobileLineList>
            {lista.map((cotacao, index) => (
              <P38MobileLine
                key={cotacao.id}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(cotacaoAccent(cotacao.status))}
                onClick={() => onAbrirCotacao(cotacao)}
                title={cotacao.titulo}
                subtitle={cotacao.numero}
                meta={
                  <>
                    <P38StatusLabel tone={p38StatusTone(cotacao.status)}>{cotacao.status}</P38StatusLabel>
                    <span>{cotacao.fornecedores?.length || 0} forn.</span>
                  </>
                }
                value={`${cotacao.itens?.length || 0} prod.`}
                valueSub={
                  cotacao.data_abertura
                    ? format(new Date(cotacao.data_abertura), 'dd/MM/yyyy')
                    : '—'
                }
                trailing={
                  hubView === 'abertas' ? (
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExcluirCotacao(cotacao);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null
                }
              />
            ))}
          </P38MobileLineList>
        )}
      </div>
    </div>
  );
}
