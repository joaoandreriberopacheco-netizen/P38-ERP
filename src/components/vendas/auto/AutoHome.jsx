import { ShoppingBag, Touchpad } from 'lucide-react';
import { AUTO_HEADER_CLASS } from './autoAtendimentoUi';

export default function AutoHome({ onStart }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-muted/40 dark:bg-background">
      <header className={AUTO_HEADER_CLASS}>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          <div>
            <p className="font-bold leading-tight">Auto-atendimento</p>
            <p className="text-xs text-indigo-100">Toque para começar</p>
          </div>
        </div>
      </header>

      <button
        type="button"
        onClick={onStart}
        className="flex-1 flex flex-col items-center justify-center p-8 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg mx-4 my-6 bg-card border border-border/40 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="w-24 h-24 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Bem-vindo</h1>
        <p className="text-muted-foreground text-lg max-w-md mb-8">
          Escolha seus produtos e finalize no totem — rápido e simples.
        </p>
        <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
          <Touchpad className="w-5 h-5" />
          Toque em qualquer lugar para iniciar
        </div>
      </button>
    </div>
  );
}
