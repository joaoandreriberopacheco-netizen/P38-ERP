import React from 'react';

export default function ConsumoStepTabs({ mobileStep, setMobileStep }) {
  const steps = [
    { key: 'destinacao', label: 'Destinação' },
    { key: 'itens', label: 'Itens' },
    { key: 'minuta', label: 'Minuta' },
  ];

  return (
    <div className="mb-4 grid grid-cols-3 gap-2 md:hidden">
      {steps.map((step) => (
        <button
          key={step.key}
          onClick={() => setMobileStep(step.key)}
          className={`rounded-2xl px-2 py-2 text-[11px] font-semibold shadow-sm ${mobileStep === step.key ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground' : 'bg-card text-muted-foreground dark:bg-muted dark:text-muted-foreground'}`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}