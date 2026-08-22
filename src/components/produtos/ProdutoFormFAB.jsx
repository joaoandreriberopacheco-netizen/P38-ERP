import React, { useState } from 'react';
import { Save, X, Compass } from 'lucide-react';
import { PRODUTOS_FAB, PRODUTOS_ICON_BTN } from '@/lib/produtosP38Theme';

/**
 * FAB do formulário de produto (mobile) — mesmo padrão do pedido de compra:
 * bússola abre menu com Salvar e Fechar.
 */
export default function ProdutoFormFAB({ onSave, onClose, isSaving }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const runAction = (action) => {
    if (action.disabled) return;
    action.onClick();
    setIsExpanded(false);
  };

  const actions = [
    {
      icon: <X className="w-5 h-5" />,
      label: 'Fechar',
      onClick: () => onClose?.(),
      color: PRODUTOS_ICON_BTN,
    },
    {
      icon: <Save className="w-5 h-5" />,
      label: 'Salvar',
      onClick: () => onSave?.(),
      disabled: isSaving,
      color: PRODUTOS_FAB,
    },
  ];

  return (
    <>
      {isExpanded && (
        <button
          type="button"
          aria-label="Fechar ações"
          className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-[2px] desktop-layout:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        data-produto-form-fab
        className="fixed right-4 z-[999] flex flex-col-reverse items-end gap-2 p38-bottom-fab1 desktop-layout:hidden md:bottom-6 md:right-6"
      >
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-xl transition-all duration-200 ${
            isExpanded
              ? 'rotate-45 bg-card text-foreground shadow-md dark:bg-muted/400 dark:text-foreground'
              : PRODUTOS_FAB
          }`}
          title="Ações do produto"
          aria-expanded={isExpanded}
        >
          {isExpanded ? <X className="h-6 w-6" /> : <Compass className="h-6 w-6" />}
        </button>

        {isExpanded &&
          actions.map((action, idx) => (
            <button
              key={action.label}
              type="button"
              onClick={() => runAction(action)}
              disabled={action.disabled}
              title={action.label}
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${action.color}`}
              style={{
                animation: 'fadeSlideUp 0.18s ease both',
                animationDelay: `${idx * 30}ms`,
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
