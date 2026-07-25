import React from 'react';
import { Check, FileStack, FileText, Repeat } from 'lucide-react';

const options = [
  {
    id: 'Parcelado',
    label: 'Parcelado',
    description: 'Múltiplas parcelas',
    icon: FileStack,
  },
  {
    id: 'Único',
    label: 'Único',
    description: 'Pagamento único',
    icon: FileText,
  },
  {
    id: 'Recorrente',
    label: 'Recorrente',
    description: 'Despesa fixa',
    icon: Repeat,
  },
];

export default function AgefinNaturezaSelector({ value = 'Único', onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative rounded-2xl px-3 py-4 text-center transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm dark:bg-card dark:text-foreground'
                : 'bg-muted text-muted-foreground shadow-sm hover:bg-muted dark:bg-background dark:text-muted-foreground dark:hover:bg-background'
            }`}
          >
            <div className="mb-2 flex justify-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? 'bg-card/10 dark:bg-muted' : 'bg-card'}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs font-semibold leading-tight">{option.label}</p>
            {isActive && (
              <div className="absolute right-2 top-2 rounded-full bg-card/15 p-1 dark:bg-muted">
                <Check className="h-3 w-3" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}