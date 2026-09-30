import { cn } from '@/lib/utils';
import { CAIXA_FORMA_PAGAMENTO_BADGE } from '@/lib/caixaP38Theme';

/** Modo claro — paleta cítrica P38 com matiz por forma; escuro com tons cítricos distintos. */
const FORMA_STYLES = {
  dinheiro: CAIXA_FORMA_PAGAMENTO_BADGE.dinheiro,
  pix: CAIXA_FORMA_PAGAMENTO_BADGE.pix,
  debito: CAIXA_FORMA_PAGAMENTO_BADGE.debito,
  credito: CAIXA_FORMA_PAGAMENTO_BADGE.credito,
  fiado: CAIXA_FORMA_PAGAMENTO_BADGE.fiado,
  vale: CAIXA_FORMA_PAGAMENTO_BADGE.vale,
  outro: CAIXA_FORMA_PAGAMENTO_BADGE.outro,
};

function resolveFormaKey(forma) {
  const f = (forma || '').toLowerCase();
  if (f.includes('dinheiro')) return 'dinheiro';
  if (f === 'pix') return 'pix';
  if (f.includes('débito') || f.includes('debito')) return 'debito';
  if (f.includes('crédito') || f.includes('credito')) return 'credito';
  if (f.includes('conta a pagar') || f.includes('fiado')) return 'fiado';
  if (f.includes('vale')) return 'vale';
  return 'outro';
}

/** Rótulo curto para badge (ex.: Débito, Crédito 3x, Fiado). */
export function labelFormaPagamento(pag) {
  const forma = pag?.forma_pagamento || '';
  const parcelas = pag?.parcelas || 1;
  if (forma.includes('Crédito') && parcelas > 1) return `Crédito ${parcelas}x`;
  if (forma.includes('Cartão de Débito')) return 'Débito';
  if (forma.includes('Cartão de Crédito')) return 'Crédito';
  if (forma === 'Conta a Pagar') return 'Fiado';
  if (forma.includes('Vale')) return 'Vale';
  return forma || '?';
}

/**
 * Badges compactos das formas de pagamento de uma venda.
 * @param {{ pagamentos?: Array, className?: string, size?: 'xs'|'sm', palette?: 'default'|'caixa' }} props
 */
export default function FormaPagamentoBadges({
  pagamentos = [],
  className,
  size = 'sm',
  palette = 'default',
}) {
  const pags = Array.isArray(pagamentos) ? pagamentos.filter((p) => p?.forma_pagamento) : [];
  if (pags.length === 0) return null;

  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5';
  const styles = palette === 'caixa' ? CAIXA_FORMA_PAGAMENTO_BADGE : FORMA_STYLES;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {pags.map((pag, idx) => {
        const key = resolveFormaKey(pag.forma_pagamento);
        return (
          <span
            key={`${pag.forma_pagamento}-${idx}`}
            className={cn(
              'inline-flex items-center rounded-full border font-medium leading-tight whitespace-nowrap',
              sizeClass,
              styles[key],
            )}
            title={pag.forma_pagamento}
          >
            {labelFormaPagamento(pag)}
          </span>
        );
      })}
    </div>
  );
}
