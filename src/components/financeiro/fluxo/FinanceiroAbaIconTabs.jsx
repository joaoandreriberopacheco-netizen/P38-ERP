import React from 'react';
import { ArrowLeftRight, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FINANCEIRO_ABA_TAB_ACTIVE,
  FINANCEIRO_ABA_TAB_BTN,
  FINANCEIRO_ABA_TAB_GROUP,
  FINANCEIRO_ABA_TAB_IDLE,
} from './financeiroP38';

const TAB_ICONS = {
  caixas: Wallet,
  fluxo: ArrowLeftRight,
};

/** Abas Contas / Fluxo — ícones compactos ao lado do título (mobile). */
export default function FinanceiroAbaIconTabs({ items, value, onChange, className }) {
  return (
    <div className={cn(FINANCEIRO_ABA_TAB_GROUP, className)} role="tablist" aria-label="Módulo financeiro">
      {items.map((item) => {
        const Icon = TAB_ICONS[item.value] ?? Wallet;
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => onChange(item.value)}
            className={cn(
              FINANCEIRO_ABA_TAB_BTN,
              active ? FINANCEIRO_ABA_TAB_ACTIVE : FINANCEIRO_ABA_TAB_IDLE,
            )}
          >
            <Icon className="h-[22px] w-[22px]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
