import React, { useCallback, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  P38TableShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { CERAM_META_VAGAS } from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import {
  comparePortalSkuEixos,
  montarEixosPortalSku,
  montarSubtituloPortalSku,
} from '@/lib/hierarquiaPortal/montarNomePortalSku';
import {
  contagemReservaLine,
  enviarSkusParaReserva,
  isProdutoReservaPortal,
  reativarSkusDaReserva,
  sugerirSkusExcedente,
} from '@/lib/hierarquiaPortal/portalReservaCeramica';
import { toast } from 'sonner';

function PosBadge({ activos, meta }) {
  const over = activos > meta;
  return (
    <span
      className={cn(
        'tabular-nums text-xs font-medium px-1.5 py-0.5 rounded',
        over
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {activos}/{meta}
    </span>
  );
}

export default function PortalReservaPanel({
  supplyLines,
  reservadosEnriched = [],
  onRefresh,
}) {
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showReservados, setShowReservados] = useState(false);

  const linesComContagem = useMemo(
    () =>
      (supplyLines || [])
        .map((line) => ({ line, contagem: contagemReservaLine(line) }))
        .sort((a, b) => {
          if (b.contagem.excedente !== a.contagem.excedente) {
            return b.contagem.excedente - a.contagem.excedente;
          }
          return (a.line.produto_compra_nome || '').localeCompare(
            b.line.produto_compra_nome || '',
            'pt-BR',
          );
        }),
    [supplyLines],
  );

  const excedentes = useMemo(
    () => linesComContagem.filter(({ contagem }) => contagem.excedente > 0),
    [linesComContagem],
  );

  const reservadosPorEsquadra = useMemo(() => {
    const map = new Map();
    for (const row of reservadosEnriched) {
      const key = `${row.linha_codigo}::${row.produto_compra_codigo || 'solo'}`;
      if (!map.has(key)) {
        map.set(key, {
          linha_nome: row.linha_nome,
          produto_compra_nome: row.produto_compra_nome || '(solo)',
          skus: [],
        });
      }
      map.get(key).skus.push(row);
    }
    return [...map.values()].map((g) => ({
      ...g,
      skus: [...g.skus].sort(comparePortalSkuEixos),
    }));
  }, [reservadosEnriched]);

  const sortSkusActivos = useCallback(
    (skus) => [...(skus || [])].filter((s) => s.produto?.ativo !== false).sort(comparePortalSkuEixos),
    [],
  );

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectIds = useCallback((ids) => {
    setSelected(new Set(ids.filter(Boolean)));
  }, []);

  const handleSugerirExcedente = useCallback(
    (line) => {
      const ids = sugerirSkusExcedente(line);
      if (!ids.length) {
        toast.message('Esta esquadra já está dentro da meta de posições.');
        return;
      }
      selectIds(ids);
      toast.message(`${ids.length} SKU(s) sugerido(s) — menor estoque primeiro.`);
    },
    [selectIds],
  );

  const handleSugerirTodas = useCallback(() => {
    const ids = [];
    for (const { line, contagem } of excedentes) {
      if (contagem.excedente <= 0) continue;
      ids.push(...sugerirSkusExcedente(line));
    }
    if (!ids.length) {
      toast.message('Nenhuma esquadra acima da meta.');
      return;
    }
    selectIds(ids);
    toast.message(`${ids.length} SKU(s) sugeridos em ${excedentes.length} esquadra(s).`);
  }, [excedentes, selectIds]);

  const produtosSeleccionados = useMemo(() => {
    const all = [];
    for (const { line } of linesComContagem) {
      for (const sku of line.skus || []) {
        if (selected.has(sku.produto?.id)) all.push(sku.produto);
      }
    }
    for (const row of reservadosEnriched) {
      if (selected.has(row.produto?.id)) all.push(row.produto);
    }
    const byId = new Map();
    for (const p of all) {
      if (p?.id) byId.set(p.id, p);
    }
    return [...byId.values()];
  }, [linesComContagem, reservadosEnriched, selected]);

  const runReserva = async () => {
    const alvo = produtosSeleccionados.filter((p) => p.ativo !== false);
    if (!alvo.length) {
      toast.error('Seleccione SKUs activos para enviar à reserva.');
      return;
    }
    setProcessing(true);
    setProgress(0);
    try {
      const n = await enviarSkusParaReserva(base44, alvo, {
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      });
      toast.success(`${n} SKU(s) enviado(s) para reserva (inactivos, não apagados).`);
      setSelected(new Set());
      await onRefresh?.();
    } catch (e) {
      console.error('[PortalReserva]', e);
      toast.error('Erro ao enviar para reserva.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const runReativar = async () => {
    const alvo = produtosSeleccionados.filter((p) => isProdutoReservaPortal(p));
    if (!alvo.length) {
      toast.error('Seleccione SKUs na reserva para reactivar.');
      return;
    }
    setProcessing(true);
    setProgress(0);
    try {
      const n = await reativarSkusDaReserva(base44, alvo, {
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      });
      toast.success(`${n} SKU(s) reactivado(s) da reserva.`);
      setSelected(new Set());
      await onRefresh?.();
    } catch (e) {
      console.error('[PortalReserva]', e);
      toast.error('Erro ao reactivar da reserva.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const toggleExpand = (key) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/40 bg-muted/20 dark:bg-[#2f343c] px-4 py-3 space-y-2">
        <p className="text-sm text-foreground">
          <strong>Reserva cerâmica</strong> — inactiva SKUs em massa sem apagar do cadastro.
          Meta: <strong>{CERAM_META_VAGAS} posições</strong> por esquadra (produto compra).
        </p>
        <p className="text-xs text-muted-foreground">
          SKUs na reserva ficam com tag <code className="text-[10px]">reserva-ceramica</code> e{' '}
          <code className="text-[10px]">ativo=false</code>. Não aparecem no catálogo activo nem no piloto,
          mas podem ser reactivados a qualquer momento.
        </p>
        {excedentes.length > 0 && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {excedentes.length} esquadra(s) acima da meta · {excedentes.reduce((s, x) => s + x.contagem.excedente, 0)} posição(ões) a limpar
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={processing || !excedentes.length}
          onClick={handleSugerirTodas}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sugerir excedente (todas)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={processing || !produtosSeleccionados.some((p) => p.ativo !== false)}
          onClick={runReserva}
          className="gap-1.5"
        >
          {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          Enviar para reserva ({produtosSeleccionados.filter((p) => p.ativo !== false).length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={processing || !produtosSeleccionados.some((p) => isProdutoReservaPortal(p))}
          onClick={runReativar}
          className="gap-1.5"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          Reactivar da reserva
        </Button>
        <Button
          variant={showReservados ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowReservados((v) => !v)}
        >
          {showReservados ? 'Ocultar reservados' : `Ver reservados (${reservadosEnriched.length})`}
        </Button>
      </div>

      {processing && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground text-center">A actualizar produtos… {progress}%</p>
        </div>
      )}

      <P38TableShell className="border-border/40 dark:border-white/10 w-full bg-background dark:bg-[#2a2e35]">
        <Table className="table-auto min-w-[640px]">
          <TableHeader className={cn(p38Table.headerSolid, 'bg-muted dark:bg-[#383e47]')}>
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className={cn(p38Table.head, 'w-8')} />
              <TableHead className={cn(p38Table.head, 'min-w-[200px]')}>Esquadra</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[100px]')}>LINHA</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>Pos.</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>Reserva</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[120px]')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linesComContagem.map(({ line, contagem }) => {
              const key = line.key;
              const isOpen = expanded === key;
              const skusActivos = sortSkusActivos(line.skus);
              return (
                <React.Fragment key={key}>
                  <TableRow
                    className={cn(
                      p38Table.row,
                      contagem.excedente > 0 && 'bg-amber-50/50 dark:bg-amber-950/20',
                    )}
                  >
                    <TableCell className={cn(p38Table.cell, 'py-1.5')}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(key)}
                        className="p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={isOpen ? 'Recolher' : 'Expandir'}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell className={cn(p38Table.cell, 'py-1.5')}>
                      <p className="text-sm font-medium truncate">{line.produto_compra_nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{line.categoria}</p>
                    </TableCell>
                    <TableCell className={cn(p38Table.cell, 'py-1.5 text-xs')}>{line.linha_nome}</TableCell>
                    <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1.5')}>
                      <PosBadge activos={contagem.activos} meta={contagem.meta_vagas} />
                    </TableCell>
                    <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1.5 tabular-nums text-xs')}>
                      {contagem.reservados || '—'}
                    </TableCell>
                    <TableCell className={cn(p38Table.cell, 'py-1.5')}>
                      {contagem.excedente > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={processing}
                          onClick={() => handleSugerirExcedente(line)}
                        >
                          Sugerir {contagem.excedente}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen &&
                    skusActivos.map((sku) => {
                      const id = sku.produto?.id;
                      const cx = portalEstoqueCx(sku);
                      const isSelected = selected.has(id);
                      const eixosLabel = montarEixosPortalSku(sku);
                      const codigo = montarSubtituloPortalSku(sku);
                      return (
                        <TableRow
                          key={id}
                          className={cn(
                            p38Table.row,
                            'bg-muted/10 cursor-pointer select-none',
                            isSelected && 'bg-primary/10 dark:bg-primary/15',
                          )}
                          onClick={() => toggleSelect(id)}
                        >
                          <TableCell
                            className={cn(p38Table.cell, 'py-1')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(id)}
                              aria-label={`Seleccionar ${eixosLabel}`}
                            />
                          </TableCell>
                          <TableCell colSpan={2} className={cn(p38Table.cell, 'py-1 pl-6')}>
                            <p className="text-sm font-medium truncate">{eixosLabel}</p>
                            {codigo && (
                              <p className="text-[10px] text-muted-foreground truncate font-mono">{codigo}</p>
                            )}
                          </TableCell>
                          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1 tabular-nums text-xs')}>
                            {cx} CX
                          </TableCell>
                          <TableCell colSpan={2} className={cn(p38Table.cell, 'py-1 text-[10px] text-muted-foreground')}>
                            {sku.estoque_label}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </P38TableShell>

      {showReservados && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            SKUs na reserva ({reservadosEnriched.length})
          </h3>
          {reservadosEnriched.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
              Nenhum SKU na reserva neste piloto.
            </p>
          ) : (
            <P38TableShell className="border-border/40 w-full">
              <Table>
                <TableBody>
                  {reservadosPorEsquadra.map((grupo) => (
                    <React.Fragment key={`${grupo.linha_nome}-${grupo.produto_compra_nome}`}>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="py-1.5 text-xs font-medium">
                          {grupo.linha_nome} · {grupo.produto_compra_nome} ({grupo.skus.length})
                        </TableCell>
                      </TableRow>
                      {grupo.skus.map((sku) => {
                        const id = sku.produto?.id;
                        const isSelected = selected.has(id);
                        const eixosLabel = montarEixosPortalSku(sku);
                        return (
                          <TableRow
                            key={id}
                            className={cn(
                              'cursor-pointer select-none',
                              isSelected && 'bg-primary/10 dark:bg-primary/15',
                            )}
                            onClick={() => toggleSelect(id)}
                          >
                            <TableCell className="w-8 py-1" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(id)}
                                aria-label={`Seleccionar ${eixosLabel}`}
                              />
                            </TableCell>
                            <TableCell className="py-1 text-sm font-medium">{eixosLabel}</TableCell>
                            <TableCell className="py-1 text-[10px] text-muted-foreground">
                              {sku.estoque_label}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </P38TableShell>
          )}
        </div>
      )}
    </div>
  );
}
