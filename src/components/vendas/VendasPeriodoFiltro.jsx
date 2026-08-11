import React from 'react';
import MobileDateRangePicker from '@/components/vendas/MobileDateRangePicker';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE } from '@/components/financeiro/fluxo/financeiroP38';
import { isValidGestaoDateKey } from '@/lib/fetchPedidosVendaGestao';
import {
  PERIODOS_VENDAS,
  getPeriodoMesCorrente,
  getVendasPeriodoRange,
} from '@/lib/vendasPeriodoFiltro';

export default function VendasPeriodoFiltro({
  periodoPreset,
  onPeriodoPresetChange,
  dataInicio,
  dataFim,
  onDateRangeChange,
}) {
  const handlePresetClick = (preset) => {
    onPeriodoPresetChange(preset);
    if (preset === 'personalizado') return;
    const range = getVendasPeriodoRange(preset);
    if (range) onDateRangeChange(range.start, range.end);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PERIODOS_VENDAS.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => handlePresetClick(p.v)}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
              periodoPreset === p.v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE
            }`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {periodoPreset === 'personalizado' && (
        <MobileDateRangePicker
          nested
          startDate={dataInicio}
          endDate={dataFim}
          onApply={(inicio, fim) => {
            if (!isValidGestaoDateKey(inicio) || !isValidGestaoDateKey(fim)) return;
            onDateRangeChange(inicio, fim);
          }}
          onClear={() => {
            const { start, end } = getPeriodoMesCorrente();
            onPeriodoPresetChange('mes_atual');
            onDateRangeChange(start, end);
          }}
        />
      )}
    </div>
  );
}
