import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_Z = 1100;

function resolveTarget(selector) {
  if (!selector) return null;
  return document.querySelector(selector);
}

function computeTooltipPosition(rect, placement = 'auto') {
  const margin = 12;
  const tooltipWidth = Math.min(320, window.innerWidth - 32);
  const tooltipHeight = 180;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates = placement === 'auto'
    ? ['bottom', 'top', 'right', 'left']
    : [placement, 'bottom', 'top', 'right', 'left'];

  for (const side of candidates) {
    if (side === 'bottom' && rect.bottom + margin + tooltipHeight < vh) {
      return {
        top: rect.bottom + margin,
        left: Math.min(Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2), vw - tooltipWidth - 16),
        placement: 'bottom',
      };
    }
    if (side === 'top' && rect.top - margin - tooltipHeight > 0) {
      return {
        top: rect.top - margin - tooltipHeight,
        left: Math.min(Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2), vw - tooltipWidth - 16),
        placement: 'top',
      };
    }
    if (side === 'right' && rect.right + margin + tooltipWidth < vw) {
      return {
        top: Math.min(Math.max(16, rect.top + rect.height / 2 - tooltipHeight / 2), vh - tooltipHeight - 16),
        left: rect.right + margin,
        placement: 'right',
      };
    }
    if (side === 'left' && rect.left - margin - tooltipWidth > 0) {
      return {
        top: Math.min(Math.max(16, rect.top + rect.height / 2 - tooltipHeight / 2), vh - tooltipHeight - 16),
        left: rect.left - margin - tooltipWidth,
        placement: 'left',
      };
    }
  }

  return {
    top: Math.min(vh - tooltipHeight - 16, Math.max(16, rect.bottom + margin)),
    left: Math.min(Math.max(16, rect.left), vw - tooltipWidth - 16),
    placement: 'bottom',
  };
}

function TourOverlay({ step, stepIndex, totalSteps, onClose, onPrev, onNext, isFirst, isLast }) {
  const [layout, setLayout] = useState({ rect: null, tooltip: { top: 16, left: 16, placement: 'bottom' } });
  const tooltipRef = useRef(null);
  const maskId = React.useId().replace(/:/g, '');

  const refreshLayout = useCallback(() => {
    const el = resolveTarget(step?.target);
    if (!el) {
      setLayout({
        rect: null,
        tooltip: {
          top: Math.max(16, (window.innerHeight - 200) / 2),
          left: Math.max(16, (window.innerWidth - 320) / 2),
          placement: 'center',
        },
      });
      return;
    }

    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const rect = el.getBoundingClientRect();
    const pad = step?.padding ?? 6;
    const padded = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      right: rect.right + pad,
      bottom: rect.bottom + pad,
    };
    setLayout({
      rect: padded,
      tooltip: computeTooltipPosition(padded, step?.placement),
    });
  }, [step]);

  useLayoutEffect(() => {
    refreshLayout();
    const t = window.setTimeout(refreshLayout, 280);
    return () => window.clearTimeout(t);
  }, [refreshLayout, stepIndex]);

  useEffect(() => {
    const onResize = () => refreshLayout();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [refreshLayout]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && !isLast) onNext();
      if (e.key === 'ArrowLeft' && !isFirst) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev, isFirst, isLast]);

  const spotlightStyle = layout.rect
    ? {
        top: layout.rect.top,
        left: layout.rect.left,
        width: layout.rect.width,
        height: layout.rect.height,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[1100]" style={{ zIndex: TOUR_Z }} role="dialog" aria-modal="true" aria-label={step?.title || 'Tour de ajuda'}>
      <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask={`url(#${maskId})`} />
      </svg>

      {spotlightStyle && (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-[#e8b824] ring-offset-2 ring-offset-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0)]"
          style={spotlightStyle}
        />
      )}

      <button
        type="button"
        className="fixed inset-0 z-[1] cursor-default"
        aria-label="Fechar tour"
        onClick={onClose}
      />

      <div
        ref={tooltipRef}
        className="fixed z-[2] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/40 bg-card p-4 shadow-2xl dark:bg-[#2a2830]"
        style={{ top: layout.tooltip.top, left: layout.tooltip.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Passo {stepIndex + 1} de {totalSteps}
            </p>
            <h3 className="text-sm font-semibold leading-snug text-foreground">{step?.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{step?.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          <button
            type="button"
            onClick={isLast ? onClose : onNext}
            className="inline-flex items-center gap-1 rounded-xl bg-[#4a5240] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#636B2F] dark:text-[#1f1d22]"
          >
            {isLast ? 'Concluir' : 'Próximo'}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * FAB de ajuda + tour virtual passo a passo.
 * `steps`: [{ target, title, body, placement?, padding?, beforeStep? }]
 */
export function P38TourFab({
  steps = [],
  label = 'Abrir tour de ajuda',
  fabClassName,
  stack = 'fab2',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const stackClass = stack === 'fab1' ? 'p38-bottom-fab1' : 'p38-bottom-fab2';

  const closeTour = useCallback(() => {
    setOpen(false);
    setStepIndex(0);
  }, []);

  const goToStep = useCallback(async (nextIndex) => {
    const step = steps[nextIndex];
    if (step?.beforeStep) {
      await step.beforeStep();
    }
    setStepIndex(nextIndex);
  }, [steps]);

  const startTour = useCallback(async () => {
    if (!steps.length || disabled) return;
    setStepIndex(0);
    const first = steps[0];
    if (first?.beforeStep) await first.beforeStep();
    setOpen(true);
  }, [steps, disabled]);

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        disabled={disabled || !steps.length}
        data-pulse-sensor="p38-tour.fab-ajuda"
        className={cn(
          'fixed right-4 z-[56] flex h-12 w-12 items-center justify-center rounded-full bg-card text-[#4a5240] shadow-lg ring-1 ring-border/30 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40 dark:bg-muted dark:text-[#A8B56E] md:right-6',
          stackClass,
          fabClassName,
        )}
        title={label}
        aria-label={label}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && currentStep && (
        <TourOverlay
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          onClose={closeTour}
          onPrev={() => { if (!isFirst) goToStep(stepIndex - 1); }}
          onNext={() => { if (!isLast) goToStep(stepIndex + 1); }}
          isFirst={isFirst}
          isLast={isLast}
        />
      )}
    </>
  );
}
