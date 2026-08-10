import React from 'react';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Button } from '@/components/ui/button';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';
import { Input } from '@/components/ui/input';
import { Plus, Minus } from 'lucide-react';

export default function CalculadoraCedulasDialog({ open, onOpenChange, cedulas, setCedulas, formatValor, onConfirmar }) {
  const calcularTotal = () => (
    cedulas.nota200 * 200 + cedulas.nota100 * 100 + cedulas.nota50 * 50 +
    cedulas.nota20 * 20 + cedulas.nota10 * 10 + cedulas.nota5 * 5 +
    cedulas.nota2 * 2 + cedulas.moeda1 * 1 + cedulas.moeda050 * 0.50 +
    cedulas.moeda025 * 0.25 + cedulas.moeda010 * 0.10 + cedulas.moeda005 * 0.05
  );

  const renderItem = (key, label, valor) => (
    <div key={key} className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground/90 w-24">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm"
          onClick={() => setCedulas(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
          className="h-8 w-8 p-0"><Minus className="w-4 h-4" /></Button>
        <Input type="number" value={cedulas[key]}
          onChange={(e) => setCedulas(prev => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
          onFocus={selectAllOnFocus}
          className="h-8 w-16 text-center dark:bg-muted" />
        <Button variant="outline" size="sm"
          onClick={() => setCedulas(prev => ({ ...prev, [key]: prev[key] + 1 }))}
          className="h-8 w-8 p-0"><Plus className="w-4 h-4" /></Button>
        <span className="text-sm font-semibold text-foreground/90 w-24 text-right">
          {formatValor(cedulas[key] * valor)}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CaixaDialogContent className="max-w-md dark:bg-background dark:text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Calculadora de Cédulas e Moedas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/90">Notas</h4>
            {[
              { key: 'nota200', label: 'R$ 200,00', valor: 200 },
              { key: 'nota100', label: 'R$ 100,00', valor: 100 },
              { key: 'nota50', label: 'R$ 50,00', valor: 50 },
              { key: 'nota20', label: 'R$ 20,00', valor: 20 },
              { key: 'nota10', label: 'R$ 10,00', valor: 10 },
              { key: 'nota5', label: 'R$ 5,00', valor: 5 },
              { key: 'nota2', label: 'R$ 2,00', valor: 2 },
            ].map(({ key, label, valor }) => renderItem(key, label, valor))}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/90">Moedas</h4>
            {[
              { key: 'moeda1', label: 'R$ 1,00', valor: 1 },
              { key: 'moeda050', label: 'R$ 0,50', valor: 0.50 },
              { key: 'moeda025', label: 'R$ 0,25', valor: 0.25 },
              { key: 'moeda010', label: 'R$ 0,10', valor: 0.10 },
              { key: 'moeda005', label: 'R$ 0,05', valor: 0.05 },
            ].map(({ key, label, valor }) => renderItem(key, label, valor))}
          </div>
          <div className="pt-3 border-t border-border/40">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Total Calculado:</span>
              <span className={`text-xl font-bold ${caixaClasses('success').text}`}>{formatValor(calcularTotal())}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button onClick={() => onConfirmar(calcularTotal())} className={`flex-1 ${caixaClasses('success').btn}`}>Confirmar</Button>
          </div>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}