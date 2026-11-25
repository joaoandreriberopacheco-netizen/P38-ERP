import { cn } from '@/lib/utils';
import { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { formatMargemPctGestao, margemContribuicaoPercent } from '@/lib/vendasGestaoMargemKpi';

const MARGIN_ACCENT = 'text-[#4a5240] dark:text-[#a4ce33]';

/**
 * Sufixo inline após o total de vendas: · lucro · mK · mC
 * @param {{ profit?: number, markupPercent?: number, salesNet?: number } | null} kpi
 */
export default function VendasGestaoMargemKpiSuffix({ kpi, className = '' }) {
  if (!kpi) return null;

  const profit = Number(kpi.profit) || 0;
  const markup = Number(kpi.markupPercent) || 0;
  const mc = margemContribuicaoPercent(profit, kpi.salesNet);

  return (
    <span className={cn('font-normal whitespace-normal', className)}>
      <span className="text-muted-foreground"> · </span>
      <span className={MARGIN_ACCENT}>
        {formatCaixaR(profit)} lucro
      </span>
      <span className="text-muted-foreground"> · mK </span>
      <span className={MARGIN_ACCENT}>{formatMargemPctGestao(markup)}</span>
      <span className="text-muted-foreground"> · mC </span>
      <span className={MARGIN_ACCENT}>{formatMargemPctGestao(mc)}</span>
    </span>
  );
}
