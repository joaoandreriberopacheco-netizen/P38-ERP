import { ArrowRight, ShoppingBag } from 'lucide-react';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_PAGE_CANVAS,
  AUTO_EDITORIAL_PANEL,
  AUTO_ACCENT_TEXT,
  AUTO_IMAGE_STAGE,
  AUTO_DISPLAY,
  AUTO_SUBHEADING,
  AUTO_EYEBROW,
  AUTO_STORE_MAX,
  AUTO_PRIMARY_BTN,
} from './autoAtendimentoUi';

export default function AutoHome({ onStart }) {
  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 ${AUTO_PAGE_CANVAS}`}>
      <AutoShellHeader>
        <div className="flex items-center gap-2.5">
          <ShoppingBag className={`w-5 h-5 ${AUTO_ACCENT_TEXT}`} />
          <div>
            <p className="text-sm font-medium tracking-tight text-[#242424]">Auto-atendimento</p>
            <p className={AUTO_EYEBROW}>Vitrine P38</p>
          </div>
        </div>
      </AutoShellHeader>

      <div className={`flex-1 flex flex-col ${AUTO_STORE_MAX} px-4 py-8 sm:py-12`}>
        <button
          type="button"
          data-pulse-sensor="auto-atendimento.iniciar"
          onClick={onStart}
          className={`flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5240]/25 ${AUTO_EDITORIAL_PANEL}`}
        >
          <div className={`w-28 h-28 rounded-3xl ${AUTO_IMAGE_STAGE} flex items-center justify-center mb-10 shadow-inner`}>
            <ShoppingBag className={`w-14 h-14 ${AUTO_ACCENT_TEXT}`} />
          </div>
          <p className={AUTO_EYEBROW}>Bem-vindo</p>
          <h1 className={`${AUTO_DISPLAY} mt-2 mb-4 max-w-lg`}>Comece sua compra</h1>
          <p className={`${AUTO_SUBHEADING} max-w-md mb-10`}>
            Escolha seus produtos e finalize no totem — rápido, claro e sem fila.
          </p>
          <span className={`inline-flex items-center justify-center gap-2 px-8 ${AUTO_PRIMARY_BTN} max-w-xs`}>
            Iniciar
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
