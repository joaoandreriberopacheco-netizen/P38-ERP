import { ShoppingBag, Touchpad } from 'lucide-react';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_SHELL_BG,
  AUTO_VITRINE_CARD,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_CITRUS_TEXT,
  AUTO_DISPLAY,
  AUTO_SUBHEADING,
  AUTO_EYEBROW,
  AUTO_STORE_MAX,
} from './autoAtendimentoUi';

export default function AutoHome({ onStart }) {
  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 ${AUTO_SHELL_BG}`}>
      <AutoShellHeader>
        <div className="flex items-center gap-2">
          <ShoppingBag className={`w-6 h-6 ${AUTO_ACCENT_TEXT}`} />
          <div>
            <p className="text-sm font-medium tracking-tight text-[#242424]">Auto-atendimento</p>
            <p className={AUTO_EYEBROW}>Vitrine P38</p>
          </div>
        </div>
      </AutoShellHeader>

      <div className={`flex-1 flex flex-col ${AUTO_STORE_MAX} px-4 py-6`}>
        <button
          type="button"
          data-pulse-sensor="auto-atendimento.iniciar"
          onClick={onStart}
          className={`flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b824]/40 ${AUTO_VITRINE_CARD}`}
        >
          <div className={`w-24 h-24 rounded-3xl ${AUTO_ACCENT_BG} flex items-center justify-center mb-8 bg-[#fafafa]`}>
            <ShoppingBag className={`w-12 h-12 ${AUTO_ACCENT_TEXT}`} />
          </div>
          <p className={AUTO_EYEBROW}>Bem-vindo</p>
          <h1 className={`${AUTO_DISPLAY} mt-2 mb-4`}>Comece sua compra</h1>
          <p className={`${AUTO_SUBHEADING} max-w-md mb-10`}>
            Escolha seus produtos e finalize no totem — rápido, claro e sem fila.
          </p>
          <div className={`inline-flex items-center gap-2 text-sm font-medium ${AUTO_CITRUS_TEXT}`}>
            <Touchpad className="w-5 h-5" />
            Toque para iniciar
          </div>
        </button>
      </div>
    </div>
  );
}
