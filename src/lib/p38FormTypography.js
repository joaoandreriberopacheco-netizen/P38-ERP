/**
 * Hierarquia tipográfica P38 — modo claro (e escuro).
 * Separa título de página, secção, label de campo e conteúdo.
 * Usar com .p38-app (que aplica uppercase global) — classes com normal-case onde indicado.
 */
import { cn } from '@/components/utils';

/** Escopo em formulários: labels leves; inputs/conteúdo com mais peso. */
export const P38_FORM_TYPO_SCOPE = cn(
  '[&_label]:font-light [&_label]:text-muted-foreground [&_label]:tracking-wider',
  '[&_input:not([type=checkbox]):not([type=radio])]:font-medium [&_input]:text-foreground',
  '[&_textarea]:font-medium [&_textarea]:text-foreground',
);

/** Título principal da página ou formulário (ex.: nome do produto). */
export const P38_PAGE_TITLE = cn(
  'p38-page-title',
  'text-xl md:text-2xl font-semibold tracking-tight text-foreground normal-case leading-tight',
);

/** Contexto acima do título (ex.: «Editar produto», breadcrumb curto). */
export const P38_PAGE_KICKER = cn(
  'p38-page-kicker',
  'text-xs font-light uppercase tracking-wider text-muted-foreground',
);

/** Subtítulo ou meta abaixo do título. */
export const P38_PAGE_SUBTITLE = cn(
  'p38-page-subtitle',
  'text-sm font-normal text-muted-foreground normal-case tracking-normal',
);

/** Títulos de secção dentro do formulário. */
export const P38_SECTION_TITLE = cn(
  'p38-section-title',
  'text-sm font-semibold text-foreground normal-case tracking-normal',
);

/** Label de campo — sempre mais leve que o valor. */
export const P38_FIELD_LABEL = cn(
  'p38-field-label',
  'text-xs font-light uppercase tracking-wider text-muted-foreground',
);

/** Texto de ajuda abaixo do campo. */
export const P38_FIELD_HINT = cn(
  'p38-field-hint',
  'text-xs font-normal text-muted-foreground/75 normal-case tracking-normal leading-relaxed',
);

/** Valor legível / preview (não editável). */
export const P38_FIELD_VALUE = cn(
  'p38-field-value',
  'text-sm font-medium text-foreground normal-case',
);

/** Cabeçalho de listagem (Catálogo, Dashboard…). */
export const P38_SHELL_TITLE = cn(
  'p38-page-title',
  'text-lg md:text-xl font-semibold tracking-tight text-foreground font-glacial normal-case',
);

export const P38_SHELL_DESC = P38_PAGE_SUBTITLE;
