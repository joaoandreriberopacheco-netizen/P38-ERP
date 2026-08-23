import * as React from 'react';
import {
  FORCE_LANDSCAPE_ATTR,
  ORIENTATION_CHANGE_EVENT,
  isForceLandscapeCssActive,
} from '@/lib/portraitOrientationLock';

/** Smartphone estreito: sempre layout mobile. */
export const PHONE_MAX = 767;
/** Largura mínima típica de tablet. */
export const TABLET_MIN = 768;
/** Desktop por largura (monitor / tablet paisagem largo). */
export const DESKTOP_MIN = 1024;

function isPortrait(width, height) {
  return height > width;
}

/**
 * Layout de conteúdo/shell:
 * - mobile: telemóvel OU tablet em retrato (vertical)
 * - desktop: largura ≥1024 OU tablet em paisagem (horizontal)
 */
export function resolveViewportLayout(width, height) {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width < TABLET_MIN) return 'mobile';
  return isPortrait(width, height) ? 'mobile' : 'desktop';
}

/** Paisagem forçada por CSS: o ecrã físico ainda é retrato — usa a dimensão longa como largura. */
export function logicalViewportSize(width, height, forceLandscape) {
  if (forceLandscape && height > width) {
    return { width: height, height: width };
  }
  return { width, height };
}

/** Notebook com rato: menu lateral no hover. Tablet/telemóvel (sem hover) usam o menu de baixo. */
export function canUseHoverSidebar() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** compact = menu de baixo; sidebar = menu lateral (só com rato). */
export function resolveShell(layout, hoverSidebar) {
  if (!hoverSidebar) return 'compact';
  return layout === 'desktop' ? 'sidebar' : 'compact';
}

/** Legado: phone | tablet | desktop por largura só. */
function resolveBreakpoint(width) {
  if (width < TABLET_MIN) return 'phone';
  if (width < DESKTOP_MIN) return 'tablet';
  return 'desktop';
}

function readViewport() {
  if (typeof window === 'undefined') {
    return {
      width: DESKTOP_MIN,
      height: DESKTOP_MIN,
      layout: 'desktop',
      breakpoint: 'desktop',
      shell: 'sidebar',
    };
  }
  const physical = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const { width, height } = logicalViewportSize(
    physical.width,
    physical.height,
    isForceLandscapeCssActive(),
  );
  const layout = resolveViewportLayout(width, height);
  const hoverSidebar = canUseHoverSidebar();
  return {
    width,
    height,
    layout,
    breakpoint: resolveBreakpoint(width),
    shell: resolveShell(layout, hoverSidebar),
  };
}

/**
 * Hook reativo — atualiza em resize e rotação.
 * `layout`: 'mobile' | 'desktop' (orientação + largura)
 * `breakpoint`: 'phone' | 'tablet' | 'desktop' (só largura)
 */
export function useViewport() {
  const [viewport, setViewport] = React.useState(readViewport);

  React.useEffect(() => {
    const onChange = () => setViewport(readViewport());

    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    window.addEventListener(ORIENTATION_CHANGE_EVENT, onChange);
    const portraitMq = window.matchMedia('(orientation: portrait)');
    const landscapeMq = window.matchMedia('(orientation: landscape)');
    const hoverMq = window.matchMedia('(hover: hover)');
    const fineMq = window.matchMedia('(pointer: fine)');
    portraitMq.addEventListener('change', onChange);
    landscapeMq.addEventListener('change', onChange);
    hoverMq.addEventListener('change', onChange);
    fineMq.addEventListener('change', onChange);
    const rootObserver = new MutationObserver(onChange);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [FORCE_LANDSCAPE_ATTR],
    });

    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.removeEventListener(ORIENTATION_CHANGE_EVENT, onChange);
      portraitMq.removeEventListener('change', onChange);
      landscapeMq.removeEventListener('change', onChange);
      hoverMq.removeEventListener('change', onChange);
      fineMq.removeEventListener('change', onChange);
      rootObserver.disconnect();
    };
  }, []);

  return viewport;
}

/** @deprecated Preferir useViewport().layout */
export function useBreakpoint() {
  return useViewport().breakpoint;
}

/** Shell com menu de baixo: telemóvel e tablet (sem rato), em retrato ou paisagem. */
export function useCompactShell() {
  return useViewport().shell === 'compact';
}

/** Conteúdo denso: tabelas, TreeGrid — desktop + tablet paisagem. */
export function useDesktopContent() {
  return useViewport().layout === 'desktop';
}

/** Alias: mesmo critério do menu de baixo (telemóvel + tablet). */
export function useMobileLayout() {
  return useCompactShell();
}

/** true em smartphone estreito (<768px). */
export function useIsPhone() {
  return useViewport().breakpoint === 'phone';
}

/** true em tablet por largura (768–1023), qualquer orientação. */
export function useIsTablet() {
  return useViewport().breakpoint === 'tablet';
}

/** true quando largura ≥1024 (independente de orientação). */
export function useIsDesktop() {
  return useViewport().breakpoint === 'desktop';
}
