/**
 * Perfis de viewport para Pulso (Playwright).
 * Tablet usa emulação touch para activar shell compact (menu de baixo).
 */
import { devices } from 'playwright';

const IPAD = devices['iPad Pro 11'];
const IPAD_LANDSCAPE = devices['iPad Pro 11 landscape'];

export const PULSE_VIEWPORT_PROFILES = {
  desktop: {
    id: 'desktop',
    label: 'Desktop 1440×900',
    contextOptions: {
      viewport: { width: 1440, height: 900 },
    },
  },
  'tablet-portrait': {
    id: 'tablet-portrait',
    label: 'Tablet retrato (iPad Pro 11)',
    contextOptions: {
      ...IPAD,
      viewport: IPAD.viewport,
    },
  },
  'tablet-landscape': {
    id: 'tablet-landscape',
    label: 'Tablet paisagem (iPad Pro 11)',
    contextOptions: {
      ...IPAD_LANDSCAPE,
      viewport: IPAD_LANDSCAPE.viewport,
    },
  },
};

/**
 * @param {{ tablet?: boolean, orientation?: string, profile?: string }} args
 */
export function resolveViewportProfile(args = {}) {
  if (args.profile) {
    const key = args.profile === 'tablet' ? 'tablet-portrait' : args.profile;
    const found = PULSE_VIEWPORT_PROFILES[key];
    if (!found) {
      throw new Error(
        `Perfil inválido: ${args.profile}. Use desktop, tablet-portrait ou tablet-landscape.`
      );
    }
    return found;
  }

  if (args.tablet) {
    return args.orientation === 'landscape'
      ? PULSE_VIEWPORT_PROFILES['tablet-landscape']
      : PULSE_VIEWPORT_PROFILES['tablet-portrait'];
  }

  return PULSE_VIEWPORT_PROFILES.desktop;
}

/**
 * Cria contexto Playwright com perfil e opcional rotação livre (localStorage auto).
 */
export async function createPulseBrowserContext(browser, { profile, modoPaisagem = false } = {}) {
  const resolved = profile?.contextOptions
    ? { id: profile.id || 'custom', label: profile.label || 'custom', contextOptions: profile.contextOptions }
    : resolveViewportProfile(profile?.args || {});

  const context = await browser.newContext(resolved.contextOptions);

  if (modoPaisagem) {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('p38_orientation_mode', 'auto');
      } catch {
        /* ignore */
      }
    });
  }

  return { context, profileMeta: { id: resolved.id, label: resolved.label } };
}
