import React from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  RefreshCw,
  MapPin,
  UserRound,
  Package,
  MoreVertical,
  Pencil,
  Paperclip,
  Trash2,
  Eye,
  Plus,
  Tags,
  ImageIcon,
  BarChart3,
} from 'lucide-react';
import { P38MobileLine, P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import { brandSurface } from '@/lib/brandSurfaces';
import { p38Mobile } from '@/lib/p38MobileSurfaces';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function PeriodFilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-sm' : p38Mobile.filterChip
      )}
    >
      {children}
    </button>
  );
}

function ConsumoAcoesMenu({ item, onView, onEdit, onViewAttachments, onAttach, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10"
          aria-label="Mais opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onView(item)} className="cursor-pointer gap-2">
          <Eye className="h-4 w-4" /> Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer gap-2">
          <Pencil className="h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewAttachments(item)} className="cursor-pointer gap-2">
          <ImageIcon className="h-4 w-4" /> Ver anexos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAttach(item)} className="cursor-pointer gap-2">
          <Paperclip className="h-4 w-4" /> Anexar doc / foto
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(item)} className="cursor-pointer gap-2 text-destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile — linha compacta P38 com barra oliva. */
function ConsumoHistoricoLinha({ item, index, onView, onEdit, onViewAttachments, onAttach, onDelete }) {
  const subtitulo = [item.destinacao, item.responsavel_recebimento].filter(Boolean).join(' · ');
  return (
    <P38MobileLine
      thinAccent
      striped={index % 2 === 1}
      accent="success"
      onClick={() => onView(item)}
      title={item.numero}
      subtitle={subtitulo || 'Sem destinação'}
      meta={
        <>
          <span>{item.quantidade_total_itens ?? (item.itens?.length || 0)} item(ns)</span>
          {!!item.assinatura_recolhedor_url && <span>Assinatura</span>}
          {!!item.tags?.length && <span>{item.tags.join(', ')}</span>}
        </>
      }
      value={<span className={p38Accent.success.text}>{formatCurrency(item.valor_total)}</span>}
      trailing={<ConsumoAcoesMenu item={item} onView={onView} onEdit={onEdit} onViewAttachments={onViewAttachments} onAttach={onAttach} onDelete={onDelete} />}
    />
  );
}

/** Desktop — card P38 com barra oliva. */
function ConsumoHistoricoCard({ item, onView, onEdit, onViewAttachments, onAttach, onDelete }) {
  return (
    <div className={cn('relative rounded-[24px] px-4 py-3.5', brandSurface.card)}>
      <div className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-sm', p38Table.panelAccentBar)} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-3">
        <button type="button" onClick={() => onView(item)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground">{item.numero}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {item.destinacao || '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3 shrink-0" />
              {item.responsavel_recebimento || '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3 shrink-0" />
              {item.quantidade_total_itens ?? (item.itens?.length || 0)} item(ns)
            </span>
            {!!item.assinatura_recolhedor_url && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3 shrink-0" />
                assinatura
              </span>
            )}
            {!!item.tags?.length && (
              <span className="inline-flex items-center gap-1">
                <Tags className="h-3 w-3 shrink-0" />
                {item.tags.join(', ')}
              </span>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <p className={cn('text-base font-semibold tabular-nums', p38Accent.success.text)}>
            {formatCurrency(item.valor_total)}
          </p>
          <button
            type="button"
            onClick={() => onView(item)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10"
            aria-label="Visualizar consumo"
          >
            <Eye className="h-4 w-4" />
          </button>
          <ConsumoAcoesMenu
            item={item}
            onView={onView}
            onEdit={onEdit}
            onViewAttachments={onViewAttachments}
            onAttach={onAttach}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

export default function ConsumoInternoPainelInicial({
  filtroTemporal,
  setFiltroTemporal,
  labelFiltro,
  consumosFiltrados,
  search,
  setSearch,
  consumosAgrupadosPorDia,
  onRefresh,
  onView,
  onViewAttachments,
  onEdit,
  onAttach,
  onDelete,
  onNovoFormulario,
}) {
  const acoesProps = { onView, onEdit, onViewAttachments, onAttach, onDelete };
  const totalPeriodo = consumosFiltrados.reduce((sum, item) => sum + (item.valor_total || 0), 0);

  return (
    <div className={cn('min-h-screen -m-4 p-3 font-din-1451 md:-m-6 md:p-6', brandSurface.pageScreen)}>
      <div className="mx-auto max-w-6xl space-y-4 pb-24 md:space-y-5">
        <div className={cn('rounded-[24px] p-4 md:rounded-[28px] md:p-5', brandSurface.card)}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Operação · estoque</p>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Consumo Interno</h1>
              <p className="mt-1 text-sm text-muted-foreground">Movimentações internas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/AnexoCompartilhado"
                className={cn(
                  'flex items-center gap-2 rounded-2xl border border-border/40 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/10',
                  brandSurface.card
                )}
                title="Página antiga de anexos"
              >
                <Paperclip className={cn('h-5 w-5', brandSurface.accent)} />
                <span className="hidden sm:inline">Página antiga</span>
              </Link>
              <Link
                to="/RelatorioConsumoInterno"
                className={cn(
                  'flex items-center gap-2 rounded-2xl border border-border/40 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/10',
                  brandSurface.card
                )}
                title="Relatório de consumo interno"
              >
                <BarChart3 className={cn('h-5 w-5', brandSurface.accent)} />
                <span className="hidden sm:inline">Relatório</span>
              </Link>
              <button
                onClick={onRefresh}
                type="button"
                className={cn(
                  'rounded-2xl border border-border/40 p-3 transition-colors hover:bg-primary/10',
                  brandSurface.card
                )}
                style={{ minWidth: 48, minHeight: 48 }}
                aria-label="Atualizar"
              >
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className={cn('min-w-[120px] rounded-2xl border border-border/40 px-4 py-2.5', brandSurface.card)}>
                <p className={p38Mobile.kpiLabel}>Total — {labelFiltro[filtroTemporal]}</p>
                <p className={cn(p38Mobile.kpiValueAccent, 'text-lg md:text-xl')}>{formatCurrency(totalPeriodo)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(labelFiltro).map(([key, label]) => (
              <PeriodFilterChip key={key} active={filtroTemporal === key} onClick={() => setFiltroTemporal(key)}>
                {label}
              </PeriodFilterChip>
            ))}
          </div>
        </div>

        <div className={cn('md:rounded-[28px] md:p-5', brandSurface.card, 'md:border md:shadow-sm')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-base font-semibold uppercase tracking-wide text-foreground">Histórico</p>
            <div className="relative w-full max-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar"
                className={cn(p38Mobile.searchInput, 'h-11 rounded-lg pl-9')}
              />
            </div>
          </div>

          <div className="space-y-5 md:space-y-4">
            {consumosAgrupadosPorDia.length === 0 && (
              <div className={cn('rounded-lg px-4 py-10 text-center text-sm text-muted-foreground', p38Mobile.detailPanel)}>
                Nenhuma movimentação encontrada.
              </div>
            )}

            {consumosAgrupadosPorDia.map(([dia, itens]) => (
              <section key={dia} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 border-b border-border/40 px-0.5 pb-2 dark:border-white/10">
                  <p className="p38-meta-label font-medium">
                    {format(new Date(dia + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <span className={cn('text-xs font-semibold tabular-nums', p38Accent.success.text)}>
                    {formatCurrency(itens.reduce((s, i) => s + (i.valor_total || 0), 0))}
                  </span>
                </div>

                <P38MobileLineList className="block rounded-lg border border-border/40 dark:border-white/10 desktop-layout:hidden">
                  {itens.map((item, index) => (
                    <ConsumoHistoricoLinha key={item.id} item={item} index={index} {...acoesProps} />
                  ))}
                </P38MobileLineList>

                <div className="hidden space-y-2 md:block">
                  {itens.map((item) => (
                    <ConsumoHistoricoCard key={item.id} item={item} {...acoesProps} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed right-4 z-[55] flex flex-col items-end gap-3 p38-bottom-fab1 lg:bottom-10 lg:right-6">
        <button
          type="button"
          onClick={onNovoFormulario}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform hover:scale-105 hover:bg-primary/90"
          aria-label="Novo consumo interno"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
