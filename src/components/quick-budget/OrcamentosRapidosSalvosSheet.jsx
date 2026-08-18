import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Search, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { listarOrcamentosRapidos } from '@/lib/orcamentoRapidoSql';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrcamentosRapidosSalvosSheet({ isOpen, onClose, onCarregar }) {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listarOrcamentosRapidos({ dias: 14, busca: '', limite: 80 });
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

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[2] flex flex-col bg-muted/40 dark:bg-background">
      <div className="flex items-center gap-3 px-4 py-4 bg-card border-b border-border/40 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground font-glacial">Orçamentos salvos</h2>
          <p className="text-xs text-muted-foreground">Últimos 14 dias · SQL</p>
        </div>
      </div>

      <div className="px-4 py-3 bg-card border-b border-border/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, número ou observação..."
            className="pl-10 h-11 border-0 bg-muted rounded-2xl"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-10 h-10 opacity-40 mb-3" />
            <p className="text-sm">Nenhum orçamento salvo encontrado</p>
          </div>
        ) : (
          filtrados.map((orc) => {
            const dataCriacao = new Date(orc.created_at || orc.created_date);
            return (
              <button
                key={orc.id}
                type="button"
                onClick={() => onCarregar(orc)}
                className="w-full bg-card rounded-2xl px-4 py-4 text-left shadow-sm active:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-muted rounded-2xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {orc.cliente_nome || 'Sem cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {orc.numero ? `${orc.numero} · ` : ''}
                      {(orc.itens || []).length} item(s) · {format(dataCriacao, "dd/MM · HH'h'mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-bold text-foreground tabular-nums">
                      R$ {fmtR(orc.valor_total)}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                      <ShoppingCart className="w-3 h-3" /> Abrir
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
