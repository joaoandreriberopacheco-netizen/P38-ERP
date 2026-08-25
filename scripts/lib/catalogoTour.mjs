/**
 * Tour de onboarding (product tour) — catálogos B2B Formigres / Arielle / portfolio.
 */
const HELP_FAB_TOKENS = {
  formigres: {
    bg: '#d6f2f4',
    bgHover: '#c4ebef',
    border: '#8ecfd8',
    fg: '#156b73',
    glow: 'rgba(21, 107, 115, 0.18)',
  },
  arielle: {
    bg: '#fae4e8',
    bgHover: '#f5d4db',
    border: '#e8a8b8',
    fg: '#8b3a4a',
    glow: 'rgba(139, 58, 74, 0.16)',
  },
  ecuaceramica: {
    bg: '#efe4d8',
    bgHover: '#e6d9c9',
    border: '#c9b59a',
    fg: '#6b5344',
    glow: 'rgba(107, 83, 68, 0.16)',
  },
  tintao: {
    bg: '#ececf0',
    bgHover: '#e0e0e6',
    border: '#b8b8c0',
    fg: '#3a3a42',
    glow: 'rgba(58, 58, 66, 0.14)',
  },
};

export function buildCatalogTourSteps({ skin = 'formigres', qtyLabelPl = 'paletes' } = {}) {
  const isArielle = skin === 'arielle';
  const isPortfolio = skin === 'ecuaceramica';
  const isTintao = skin === 'tintao' || skin === 'default';
  const marca = isPortfolio
    ? 'Ecuaceramica (exemplo portfolio P38)'
    : (isTintao ? 'Formigres (Tintão)' : (isArielle ? 'Arielle · Carmelo Fior' : 'Formigres'));
  const linhas = isArielle ? 'Bold e Retificada' : 'Bold, Retificada e Polida';
  const regimeOrigem = isArielle
    ? 'Origem Sergipe (Polo SE).'
    : 'Origem São Paulo (SP).';

  const steps = [
    {
      id: 'welcome',
      title: isPortfolio
        ? 'Exemplo de catálogo B2B white-label'
        : (isTintao
          ? 'Bem-vindo ao pedido Formigres'
          : (isArielle ? 'Bem-vindo ao catálogo Arielle' : 'Bem-vindo ao catálogo Formigres')),
      text: isPortfolio
        ? `Tour rápido (~2 min) do ${marca}: busca, ${qtyLabelPl}, carrinho e PDF. Dados ilustrativos — sem vínculo com concorrentes do seu mercado.`
        : (isTintao
          ? `Tour rápido (~2 min): busca por código ou modelo, marque ${qtyLabelPl} na tabela, revise no carrinho e gere o PDF para enviar ao representante. Pode pular a qualquer momento.`
          : `Tour rápido (~2 min) do catálogo ${marca}: busca, ${qtyLabelPl}, regime Suframa, carrinho e PDF para o representante. Pode pular a qualquer momento.`),
      center: true,
      prepare: 'closePanels',
    },
    {
      id: 'desconto',
      selector: '#desconto-pct',
      title: 'Desconto comercial',
      text: isTintao
        ? 'Opcional: percentual negociado com o representante. Entra no total do pedido.'
        : (isPortfolio
          ? 'Opcional: percentual negociado com o cliente. Combina com o regime Suframa quando activo.'
          : 'Opcional: percentual negociado com o cliente. Combina com o incentivo Suframa quando o regime especial estiver ativo.'),
      placement: 'bottom',
      prepare: 'closePanels',
    },
  ];

  if (!isTintao) {
    steps.push(
      {
        id: 'regime',
        selector: '#regime-panel',
        title: 'Regime especial Suframa',
        text: isPortfolio
          ? 'Demonstração: ative para compras destinadas a AM, RR, AP ou AC. Origem demo SP (importação). O incentivo entra nos preços.'
          : `Ative o interruptor para compras destinadas a AM, RR, AP ou AC. ${regimeOrigem} O incentivo entra automaticamente nos preços.`,
        placement: 'bottom',
        prepare: 'closePanels',
      },
      {
        id: 'regime-edit',
        selector: '#regime-dialog',
        title: 'Parâmetros do regime',
        text: isPortfolio
          ? 'UF do comprador, destino Suframa (ZFM, ALC ou Amazônia Ocidental) e regime tributário — igual ao catálogo real P38.'
          : 'Ajuste UF do comprador, destino Suframa (ZFM, ALC ou Amazônia Ocidental) e regime tributário. Toque em Aplicar para recalcular os preços. O ícone de lápis no painel reabre este formulário.',
        placement: 'bottom',
        prepare: 'regimeDialog',
      },
    );
  }

  steps.push(
    {
      id: 'search',
      selector: '#search',
      title: 'Busca',
      text: 'Procure por código, nome do modelo ou formato (ex.: 84x84, 60x120).',
      placement: 'bottom',
      prepare: 'closePanels',
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
      prepare: 'closePanels',
    },
    {
      id: 'catalogo',
      selector: '#catalogo',
      title: 'Montar o pedido',
      text: isTintao
        ? `Navegue por linha (Bold, Retificada, Polida), formato e acabamento. Preencha a coluna de ${qtyLabelPl} em cada modelo.`
        : `Abra ${linhas}, escolha formato e acabamento e preencha a coluna de ${qtyLabelPl} em cada linha.`,
      placement: 'top',
      prepare: 'closePanels',
    },
    {
      id: 'cart',
      selector: '#cart-fab',
      title: 'Carrinho — Minha seleção',
      text: `Toque no carrinho para abrir a seleção: revise ${qtyLabelPl}, m², peso e subtotais antes de exportar.`,
      placement: 'left',
      prepare: 'closePanels',
    },
    {
      id: 'pedido',
      selector: '#pedido-actions',
      selectorMobile: '#pedido-panel',
      title: 'Revisar antes do PDF',
      text: 'Confira cada linha do pedido. Pode limpar a seleção ou ajustar quantidades voltando ao catálogo.',
      placement: 'top',
      prepare: 'pedidoOpen',
    },
    {
      id: 'pdf',
      selector: '#pdf-pedido-panel',
      title: 'Gerar PDF do pedido',
      text: 'Com itens na seleção, toque em PDF do pedido. O ficheiro baixa no telemóvel ou computador — ideal para arquivar ou enviar.',
      placement: 'top',
      prepare: 'pedidoOpen',
    },
    {
      id: 'enviar',
      title: 'Envie ao representante',
      text: isTintao
        ? 'Depois de gerar o PDF, envie ao representante Formigres (WhatsApp, e-mail ou canal habitual) para formalizar cotação ou pedido.'
        : (isPortfolio
          ? 'Depois de gerar o PDF, imagine enviar ao representante da sua fábrica — é o fluxo que o P38 entrega no white-label.'
          : 'Depois de gerar o PDF, reenvie-o ao seu representante comercial (WhatsApp, e-mail ou canal habitual) para formalizar cotação ou pedido.'),
      center: true,
      prepare: 'closePanels',
    },
  );

  return steps;
}

export function buildCatalogTourCss(skin = 'formigres') {
  const help = HELP_FAB_TOKENS[skin] || HELP_FAB_TOKENS.formigres;
  return `
    .help-fab-anchor {
      position: fixed;
      left: 14px;
      bottom: calc(14px + env(safe-area-inset-bottom));
      z-index: 40;
    }
    .help-fab {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      background: ${help.bg};
      border: 1px solid ${help.border};
      color: ${help.fg};
      box-shadow: 0 4px 16px ${help.glow};
      font-size: 1.12rem;
      font-weight: 700;
      font-family: inherit;
    }
    .help-fab:hover {
      transform: scale(1.04);
      background: ${help.bgHover};
      border-color: ${help.border};
      color: ${help.fg};
      box-shadow: 0 8px 22px ${help.glow};
    }
    .catalog-tour-overlay {
      position: fixed;
      inset: 0;
      z-index: 120;
      pointer-events: auto;
    }
    .catalog-tour-overlay[hidden] { display: none !important; }
    .catalog-tour-dim {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(8, 7, 10, 0.48);
      pointer-events: none;
      opacity: 0;
      transition: opacity .22s ease;
    }
    .catalog-tour-overlay:not([hidden]) .catalog-tour-dim {
      opacity: 1;
    }
    .catalog-tour-spotlight {
      position: fixed;
      border-radius: var(--radius, 8px);
      box-shadow: 0 0 0 9999px rgba(8, 7, 10, 0.38);
      outline: 2px solid rgba(255, 255, 255, 0.22);
      outline-offset: 1px;
      z-index: 121;
      pointer-events: none;
      transition: top .2s ease, left .2s ease, width .2s ease, height .2s ease, opacity .2s ease;
    }
    .catalog-tour-spotlight.is-center {
      opacity: 0;
      width: 0;
      height: 0;
      box-shadow: none;
      outline: none;
    }
    .catalog-tour-card {
      position: fixed;
      z-index: 122;
      width: min(340px, calc(100vw - 24px));
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 3px solid var(--accent);
      border-radius: var(--radius);
      padding: 14px 14px 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
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
    body.catalog-tour-active { overflow: hidden; }
    @media (max-width: 720px) {
      .catalog-tour-card { width: min(320px, calc(100vw - 20px)); }
      .help-fab-anchor { left: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); }
    }
  `.trim();
}

/** HTML overlay + help FAB snippet (B2B only). */
export function buildCatalogTourHtml() {
  return `
  <div class="catalog-tour-overlay" id="catalog-tour-overlay" hidden aria-hidden="true">
    <div class="catalog-tour-dim" id="catalog-tour-dim" aria-hidden="true"></div>
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
  return `<div class="help-fab-anchor"><button type="button" class="fab help-fab" id="help-tour-fab" aria-label="Ajuda — tour do catálogo" title="Ajuda — tour do catálogo">?</button></div>`;
}

export function buildCatalogTourClientJs({ tourKey, skin = 'formigres', qtyLabelPl = 'paletes' }) {
  const stepsJson = JSON.stringify(buildCatalogTourSteps({ skin, qtyLabelPl }));
  const key = JSON.stringify(tourKey || 'catalog-tour-v1');
  return `
    const HAS_CATALOG_TOUR = true;
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

    function tourResetPrepare() {
      if (typeof closeRegimeDialog === 'function') closeRegimeDialog();
      if (typeof closePedidoPdfSheet === 'function') closePedidoPdfSheet();
      if (typeof closePedidoPanel === 'function') closePedidoPanel();
    }

    function tourApplyPrepare(step) {
      tourResetPrepare();
      if (!step || !step.prepare) return;
      if (step.prepare === 'regimeDialog') {
        if (typeof populateRegimeDialogForm === 'function') populateRegimeDialogForm();
        if (typeof openRegimeDialog === 'function') openRegimeDialog('edit');
        return;
      }
      if (step.prepare === 'pedidoOpen') {
        if (typeof openPedidoPanel === 'function') openPedidoPanel();
        return;
      }
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
      tourApplyPrepare(step);
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
      tourResetPrepare();
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
      if (!HAS_CATALOG_TOUR || !TOUR_STEPS.length) return;
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
      if (!HAS_CATALOG_TOUR) return;
      bindClick('catalog-tour-next', tourNext);
      bindClick('catalog-tour-prev', tourPrev);
      bindClick('catalog-tour-skip', function () { endTour(true); });
      bindClick('help-tour-fab', function () { tourIndex = 0; startTour(true); });
      document.getElementById('catalog-tour-overlay')?.addEventListener('click', function (e) {
        if (e.target.id === 'catalog-tour-overlay' || e.target.id === 'catalog-tour-dim') endTour(true);
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
