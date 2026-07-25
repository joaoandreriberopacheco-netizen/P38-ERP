/**
 * P38 — superfícies e ritmo visual (modo claro / escuro).
 *
 * Padrão de layout:
 * - Mobile: coluna única, cartões empilhados (vertical).
 * - md+ / telas grandes: grelhas horizontais onde o ecrã usa `md:grid` / `md:flex-row`.
 * - Ícones em contentores com raio fixo (`rounded-2xl` ou `rounded-[15px]`), já usado na Home.
 *
 * Modo escuro alinhado à Home: `bg-background`, cartões `bg-card` + `border-border` para contraste estável.
 */

/** Três assets oficiais em public/brand/ (modo claro: raster; escuro: composição em P38Logo). */
export const BRAND_ASSETS = {
  icon: '/brand/p38-app-icon.png',
  horizontal: '/brand/p38-logo-full.png',
  vertical: '/brand/p38-logo-mobile.png',
};

/**
 * Variante P38Logo por superfície da app.
 * Escuro: ícone PWA + tipografia (sem invert em JPEG/PNG com fundo branco).
 * Claro: PNG/JPEG oficial quando existir.
 */
export const BRAND_LOGO_SURFACES = {
  'sidebar.collapsed': { variant: 'icon-only', size: 'sm' },
  'sidebar.expanded': { variant: 'horizontal', size: 'md' },
  'sidebar.expandedMobile': { variant: 'mobile', size: 'md' },
  'home.headerDesktop': { variant: 'vertical', size: 'sm' },
  'home.headerMobile': { variant: 'vertical', size: 'xs' },
  'dashboard.header': { variant: 'vertical', size: 'sm' },
  'splash': { variant: 'vertical', size: 'xxl' },
  'auth.desktop': { variant: 'horizontal', size: 'xxl' },
  'auth.mobile': { variant: 'vertical', size: 'xl' },
  'navigation.transition': { variant: 'horizontal', size: 'lg' },
  'mobile.functionSelector': { variant: 'mobile', size: 'sm' },
};

/** @param {keyof typeof BRAND_LOGO_SURFACES} surface */
export function brandLogoProps(surface) {
  return BRAND_LOGO_SURFACES[surface] ?? { variant: 'horizontal', size: 'md' };
}

export const brandSurface = {
  page: 'bg-background',
  pageScreen: 'min-h-screen bg-background',
  card: 'bg-card text-card-foreground border border-border shadow-sm',
  cardInset: 'bg-muted/50',
  iconCapsule: 'rounded-2xl bg-muted flex items-center justify-center shadow-sm',
  textMuted: 'text-muted-foreground',
  textLabel: 'text-muted-foreground',
  accent: 'text-[#4a5240] dark:text-[#a4ce33]',
  accentBg: 'bg-primary/10 text-primary',
  /** Contentor de tabela — ver p38TableSurfaces.js */
  tableShell: 'rounded-xl border border-border bg-background shadow-sm overflow-auto',
};
