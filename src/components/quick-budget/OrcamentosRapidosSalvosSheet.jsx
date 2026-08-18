import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Printer,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  P38_CHIP_ACTIVE,
  P38_CHIP_INACTIVE,
  P38_FIELD_SURFACE,
  P38_FILTROS_STICKY,
  P38_SEARCH,
} from '@/components/financeiro/fluxo/financeiroP38';
import { P38MobileLine, P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/lib/utils';
import { listarOrcamentosRapidos } from '@/lib/orcamentoRapidoSql';
import { orcamentoSalvoToCupomProps } from '@/lib/orcamentoRapidoCupom';
import OrcamentoRapidoCupomOverlay from './OrcamentoRapidoCupomOverlay';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrcamentosRapidosSalvosSheet({
  isOpen,
  onClose,
  onCarregar,
  tabelaNome = '',
  empresa = null,
}) {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [printState, setPrintState] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listarOrcamentosRapidos({ dias: 30, limite: 100 });
        if (!cancelled) setOrcamentos(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setOrcamentos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return orcamentos;
    return orcamentos.filter((o) =>
      [o.cliente_nome, o.numero, o.observacoes, o.vendedor_nome]
        .some((v) => String(v || '').toLowerCase().includes(termo)),
    );
  }, [orcamentos, busca]);

  const handleReimprimir = (orcamento, formato) => {
    setPrintState({
      cupomProps: orcamentoSalvoToCupomProps(orcamento),
      formato,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute inset-0 z-[2] flex flex-col font-din-1451 bg-muted/40 dark:bg-background">
        <div className="flex-shrink-0 px-3 pt-3 pb-2">
          <div className={cn('rounded-[28px] bg-card dark:bg-background shadow-sm px-4 py-3', P38_FIELD_SURFACE)}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-muted dark:bg-card shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Consulta</p>
                <h2 className="text-lg font-semibold text-foreground font-glacial leading-tight truncate">
                  Orçamentos salvos
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos 30 dias · reimprimir ou abrir</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        <div className={cn('px-3 pb-2 flex-shrink-0', P38_FILTROS_STICKY)}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, número ou observação..."
              className={cn('pl-10 h-11 rounded-2xl', P38_SEARCH)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className={cn('rounded-2xl px-4 py-10 text-center text-sm text-muted-foreground', P38_FIELD_SURFACE)}>
              Nenhum orçamento salvo encontrado
            </div>
          ) : (
            <P38MobileLineList className="rounded-2xl overflow-hidden">
              {filtrados.map((orc, idx) => {
                const dataCriacao = new Date(orc.created_at || orc.created_date);
                const qtdItens = (orc.itens || []).length;
                return (
                  <div key={orc.id} className={idx > 0 ? 'border-t border-border/30' : ''}>
                    <P38MobileLine
                      comfortable
                      striped={idx % 2 === 1}
                      accent="info"
                      title={orc.cliente_nome || 'Sem cliente'}
                      subtitle={orc.numero ? `Nº ${orc.numero}` : 'Orçamento rápido'}
                      meta={
                        <>
                          <span>{qtdItens} item(s)</span>
                          <span>·</span>
                          <span>{format(dataCriacao, "dd/MM · HH'h'mm", { locale: ptBR })}</span>
                          {orc.vendedor_nome && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{orc.vendedor_nome}</span>
                            </>
                          )}
                        </>
                      }
                      value={`R$ ${fmtR(orc.valor_total)}`}
                    />
                    <div className="px-3 pb-3 pt-0 flex flex-wrap gap-2 bg-card/40 dark:bg-background/40">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-xl text-xs"
                        onClick={() => onCarregar(orc)}
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={cn('h-9 rounded-xl text-xs', P38_CHIP_INACTIVE)}
                        onClick={() => handleReimprimir(orc, '80mm')}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Cupom 80mm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={cn('h-9 rounded-xl text-xs', P38_CHIP_INACTIVE)}
                        onClick={() => handleReimprimir(orc, 'a4')}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Folha A4
                      </Button>
                    </div>
                  </div>
                );
              })}
            </P38MobileLineList>
          )}
        </div>
      </div>

      <OrcamentoRapidoCupomOverlay
        open={Boolean(printState)}
        cupomProps={printState?.cupomProps}
        formato={printState?.formato || '80mm'}
        nomeTabela={tabelaNome}
        empresa={empresa}
        onClose={() => setPrintState(null)}
      />
    </>
  );
}
