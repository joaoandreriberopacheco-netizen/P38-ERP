/**
 * Tour de onboarding (product tour) — catálogos B2B Formigres / Arielle.
 * Spotlight + passos; primeira visita automática; botão Ajuda repete.
 */

export function buildCatalogTourSteps({ skin = 'formigres', qtyLabelPl = 'paletes' } = {}) {
  const isArielle = skin === 'arielle';
  const marca = isArielle ? 'Arielle · Carmelo Fior' : 'Formigres';
  const linhas = isArielle ? 'Bold e Retificada' : 'Bold, Retificada e Polida';
  const regimeOrigem = isArielle
    ? 'Produtos Arielle (Polo SE): o incentivo considera origem Sergipe.'
    : 'Produtos Formigres (SP): o incentivo considera origem São Paulo.';

  return [
    {
      id: 'welcome',
      title: isArielle ? 'Bem-vindo ao catálogo Arielle' : 'Bem-vindo ao catálogo Formigres',
      text: `Tour rápido (~1 min) do catálogo ${marca}: busca, ${qtyLabelPl}, regime Suframa e revisão do pedido. Pode pular a qualquer momento.`,
      center: true,
    },
    {
      id: 'desconto',
      selector: '#desconto-pct',
      title: 'Desconto comercial',
      text: 'Opcional: percentual negociado com o cliente. Combina com o incentivo Suframa quando o regime especial estiver ativo.',
      placement: 'bottom',
    },
    {
      id: 'regime',
      selector: '#regime-panel',
      title: 'Regime especial Suframa',
      text: `Ative para compras para AM, RR, AP ou AC. Informe UF, destino (ZFM/ALC) e regime tributário — o desconto entra nos preços. ${regimeOrigem}`,
      placement: 'bottom',
    },
    {
      id: 'search',
      selector: '#search',
      title: 'Busca',
      text: 'Procure por código, nome do modelo ou formato (ex.: 84x84, 60x120).',
      placement: 'bottom',
    },
    {
      id: 'group',
      selectorDesktop: '#group-by-desktop',
      selectorMobile: '#group-by',
      title: 'Agrupar catálogo',
      text: isArielle
        ? 'Escolha ver por formato › acabamento ou acabamento › formato — Bold/Retificada e Mate/Brilhante/Polida ficam organizados.'
        : 'Escolha ver por formato › acabamento ou acabamento › formato — Bold, Retificada e Polida no mesmo nível, com acabamentos dentro de cada linha.',
      placement: 'bottom',
    },
    {
      id: 'catalogo',
      selector: '#catalogo',
      title: 'Montar o pedido',
      text: `Abra ${linhas}, escolha formato e acabamento e preencha a coluna de ${qtyLabelPl} em cada linha.`,
      placement: 'top',
    },
    {
      id: 'cart',
      selector: '#cart-fab',
      title: 'Minha seleção',
      text: 'Revise itens, m², peso e total. Daqui exporta PDF ou partilha o pedido com a equipe.',
      placement: 'left',
    },
  ];
}

export function buildCatalogTourCss() {
  return `
    .catalog-tour-overlay {
      position: fixed;
      inset: 0;
      z-index: 120;
      pointer-events: auto;
    }
    .catalog-tour-overlay[hidden] { display: none !important; }
    .catalog-tour-spotlight {
      position: fixed;
      border-radius: var(--radius, 8px);
      box-shadow: 0 0 0 9999px rgba(8, 7, 10, .78);
      z-index: 121;
      pointer-events: none;
      transition: top .2s ease, left .2s ease, width .2s ease, height .2s ease;
    }
    .catalog-tour-spotlight.is-center { display: none; }
    .catalog-tour-card {
      position: fixed;
      z-index: 122;
      width: min(340px, calc(100vw - 24px));
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 3px solid var(--accent);
      border-radius: var(--radius);
      padding: 14px 14px 12px;
      box-shadow: var(--shadow);
    }
    .catalog-tour-step {
      margin: 0 0 6px;
      font-size: .68rem;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
    }
    .catalog-tour-title {
      margin: 0 0 8px;
      font-size: .95rem;
      font-weight: 700;
      color: var(--text-strong);
      line-height: 1.25;
    }
    .catalog-tour-text {
      margin: 0 0 12px;
      font-size: .82rem;
      line-height: 1.45;
      color: var(--text);
    }
    .catalog-tour-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .catalog-tour-actions .btn { flex: 1 1 auto; min-width: 0; padding: 9px 10px; font-size: .78rem; }
    .catalog-tour-skip {
      background: transparent;
      border: 0;
      color: var(--muted);
      font-size: .74rem;
      cursor: pointer;
      padding: 4px 2px;
      margin-right: auto;
    }
    .catalog-tour-skip:hover { color: var(--accent); }
    .help-fab {
      font-size: 1.05rem;
      font-weight: 700;
      font-family: inherit;
    }
    body.catalog-tour-active { overflow: hidden; }
    @media (max-width: 720px) {
      .catalog-tour-card { width: min(320px, calc(100vw - 20px)); }
    }
  `.trim();
}

/** HTML overlay + help FAB snippet (B2B only). */
export function buildCatalogTourHtml() {
  return `
  <div class="catalog-tour-overlay" id="catalog-tour-overlay" hidden aria-hidden="true">
    <div class="catalog-tour-spotlight is-center" id="catalog-tour-spotlight" aria-hidden="true"></div>
    <div class="catalog-tour-card" id="catalog-tour-card" role="dialog" aria-modal="true" aria-labelledby="catalog-tour-title">
      <p class="catalog-tour-step" id="catalog-tour-step"></p>
      <h2 class="catalog-tour-title" id="catalog-tour-title"></h2>
      <p class="catalog-tour-text" id="catalog-tour-text"></p>
      <div class="catalog-tour-actions">
        <button type="button" class="catalog-tour-skip" id="catalog-tour-skip">Pular tour</button>
        <button type="button" class="btn" id="catalog-tour-prev" hidden>Anterior</button>
        <button type="button" class="btn btn-primary" id="catalog-tour-next">Próximo</button>
      </div>
    </div>
  </div>`;
}

export function buildCatalogTourFabHtml() {
  return `<button type="button" class="fab help-fab" id="help-tour-fab" aria-label="Ajuda — tour do catálogo" title="Ajuda">?</button>`;
}

export function buildCatalogTourClientJs({ tourKey, skin = 'formigres', qtyLabelPl = 'paletes' }) {
  const stepsJson = JSON.stringify(buildCatalogTourSteps({ skin, qtyLabelPl }));
  const key = JSON.stringify(tourKey || 'catalog-tour-v1');
  return `
    const TOUR_KEY = ${key};
    const TOUR_STEPS = ${stepsJson};
    let tourIndex = 0;
    let tourOpen = false;

    function tourResolveSelector(step) {
      if (step.center) return null;
      const mobile = window.matchMedia('(max-width: 720px)').matches;
      const sel = mobile ? (step.selectorMobile || step.selector) : (step.selectorDesktop || step.selector);
      if (!sel) return null;
      const el = document.querySelector(sel);
      return el && el.offsetParent !== null ? el : document.querySelector(step.selector || sel);
    }

    function tourPlaceCard(target, placement, center) {
      const card = document.getElementById('catalog-tour-card');
      const spot = document.getElementById('catalog-tour-spotlight');
      if (!card || !spot) return;
      const pad = 8;
      const gap = 12;
      if (center || !target) {
        spot.classList.add('is-center');
        card.style.top = '50%';
        card.style.left = '50%';
        card.style.transform = 'translate(-50%, -50%)';
        return;
      }
      spot.classList.remove('is-center');
      const r = target.getBoundingClientRect();
      spot.style.top = Math.max(4, r.top - pad) + 'px';
      spot.style.left = Math.max(4, r.left - pad) + 'px';
      spot.style.width = Math.max(24, r.width + pad * 2) + 'px';
      spot.style.height = Math.max(24, r.height + pad * 2) + 'px';
      const cardRect = card.getBoundingClientRect();
      let top = r.bottom + gap;
      let left = r.left;
      const place = placement || 'bottom';
      if (place === 'top') top = r.top - cardRect.height - gap;
      if (place === 'left') {
        top = r.top + (r.height - cardRect.height) / 2;
        left = r.left - cardRect.width - gap;
      }
      if (place === 'right') {
        top = r.top + (r.height - cardRect.height) / 2;
        left = r.right + gap;
      }
      if (top + cardRect.height > window.innerHeight - 8) top = window.innerHeight - cardRect.height - 8;
      if (top < 8) top = 8;
      if (left + cardRect.width > window.innerWidth - 8) left = window.innerWidth - cardRect.width - 8;
      if (left < 8) left = 8;
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.transform = 'none';
    }

    function tourRenderStep() {
      const step = TOUR_STEPS[tourIndex];
      if (!step) return endTour(true);
      const titleEl = document.getElementById('catalog-tour-title');
      const textEl = document.getElementById('catalog-tour-text');
      const stepEl = document.getElementById('catalog-tour-step');
      const prevBtn = document.getElementById('catalog-tour-prev');
      const nextBtn = document.getElementById('catalog-tour-next');
      if (titleEl) titleEl.textContent = step.title || '';
      if (textEl) textEl.textContent = step.text || '';
      if (stepEl) stepEl.textContent = 'Passo ' + (tourIndex + 1) + ' de ' + TOUR_STEPS.length;
      if (prevBtn) prevBtn.hidden = tourIndex <= 0;
      if (nextBtn) nextBtn.textContent = tourIndex >= TOUR_STEPS.length - 1 ? 'Concluir' : 'Próximo';
      const target = tourResolveSelector(step);
      if (target && !step.center) {
        try { target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ }
      }
      requestAnimationFrame(function () {
        tourPlaceCard(target, step.placement, step.center);
        requestAnimationFrame(function () {
          tourPlaceCard(target, step.placement, step.center);
        });
      });
    }

    function endTour(markDone) {
      tourOpen = false;
      document.body.classList.remove('catalog-tour-active');
      const overlay = document.getElementById('catalog-tour-overlay');
      if (overlay) {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
      }
      if (markDone) {
        try { localStorage.setItem(TOUR_KEY, 'done'); } catch { /* ignore */ }
      }
    }

    function startTour(fromStart) {
      if (!IS_B2B_CATALOG || !TOUR_STEPS.length) return;
      tourIndex = fromStart ? 0 : tourIndex;
      tourOpen = true;
      document.body.classList.add('catalog-tour-active');
      const overlay = document.getElementById('catalog-tour-overlay');
      if (overlay) {
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
      }
      tourRenderStep();
    }

    function tourNext() {
      if (tourIndex >= TOUR_STEPS.length - 1) endTour(true);
      else { tourIndex += 1; tourRenderStep(); }
    }
    function tourPrev() {
      if (tourIndex > 0) { tourIndex -= 1; tourRenderStep(); }
    }

    function initCatalogTour() {
      if (!IS_B2B_CATALOG) return;
      bindClick('catalog-tour-next', tourNext);
      bindClick('catalog-tour-prev', tourPrev);
      bindClick('catalog-tour-skip', function () { endTour(true); });
      bindClick('help-tour-fab', function () { tourIndex = 0; startTour(true); });
      document.getElementById('catalog-tour-overlay')?.addEventListener('click', function (e) {
        if (e.target.id === 'catalog-tour-overlay') endTour(true);
      });
      window.addEventListener('resize', function () {
        if (tourOpen) tourRenderStep();
      });
      document.addEventListener('keydown', function (e) {
        if (tourOpen && e.key === 'Escape') endTour(true);
      });
      let seen = false;
      try { seen = localStorage.getItem(TOUR_KEY) === 'done'; } catch { /* ignore */ }
      if (!seen) {
        window.__tintaoAfterReveal = (window.__tintaoAfterReveal || []).concat([function () {
          setTimeout(function () { startTour(true); }, 500);
        }]);
      }
    }
    initCatalogTour();
  `.trim();
}
