import { cn } from '@/lib/utils';

/** Modo claro — paleta cítrica P38 (amarelo suco); escuro mantém cores semânticas. */
const LIGHT_CITRUS_CHIP =
  'bg-[#e8b824]/14 text-[#a8942e] border-[#e8b824]/32';
const LIGHT_CITRUS_CHIP_MUTED =
  'bg-[#e8b824]/8 text-[#8a7824] border-[#e8b824]/22';

const FORMA_STYLES = {
  dinheiro: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/50',
  ),
  pix: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700/50',
  ),
  debito: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50',
  ),
  credito: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700/50',
  ),
  fiado: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/50',
  ),
  vale: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50',
  ),
  outro: cn(
    LIGHT_CITRUS_CHIP_MUTED,
    'dark:bg-muted dark:text-muted-foreground dark:border-border/50',
  ),
};

const FORMA_STYLES_CAIXA = {
  dinheiro: cn(
    LIGHT_CITRUS_CHIP,
    'dark:bg-[rgba(99,107,47,0.22)] dark:text-[#A8B56E] dark:border-[rgba(99,107,47,0.4)]',
  ),
  pix: FORMA_STYLES.pix,
  debito: FORMA_STYLES.debito,
  credito: FORMA_STYLES.credito,
  fiado: FORMA_STYLES.fiado,
  vale: FORMA_STYLES.vale,
  outro: FORMA_STYLES.outro,
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
  const styles = palette === 'caixa' ? FORMA_STYLES_CAIXA : FORMA_STYLES;

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
