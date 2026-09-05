import React from 'react';
import P38RoscaGauge from '@/components/ui/P38RoscaGauge';

export function CircularProgress({ value, max, currentBatch, totalBatches, processedItems, totalItems }) {
  const safeValue = Math.min(value || 0, max || 1);
  const safeMax = max || 1;
  const percentage = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <P38RoscaGauge
        size="md"
        percent={percentage}
        showCenterPlate
        percentDigits={0}
        className="h-32 w-32"
      />

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground/90">
          Lote {currentBatch} de {totalBatches}
        </p>
        <p className="text-xs text-muted-foreground">
          {processedItems} de {totalItems} produtos
        </p>
      </div>
    </div>
  );
}
