import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BudgetCategoriaSelect from '@/components/budget-previsao/BudgetCategoriaSelect';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';
import {
  DESCRICAO_FREQUENCIA_SERIE,
  FREQUENCIA_SERIE,
  FREQUENCIAS_SERIE_OPCOES,
  MESES_VENCIMENTO_LABELS,
} from '@/lib/agefinPrevisaoCalculos';
import { cn } from '@/lib/utils';

const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function OpcaoChip({ active, children, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
        'border border-border/50',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-muted/60 text-foreground hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function AgefinSerieDialog({
  open,
  onClose,
  serie,
  categorias = [],
  centrosCustoRegistros = [],
  onCategoriasChange,
  onCentrosChange,
  onSave,
  saving,
}) {
  const [form, setForm] = useState({
    nome: '',
    terceiro_nome: '',
    categoria_id: '',
    categoria_nome: '',
    centro_custo: '',
    valor_previsto: 0,
    dia_vencimento: 10,
    frequencia: FREQUENCIA_SERIE.MENSAL,
    mes_vencimento: new Date().getMonth() + 1,
    observacoes: '',
  });

  useEffect(() => {
    if (!open) return;

    let categoriaId = serie?.categoria_id || '';
    let categoriaNome = serie?.categoria_nome || '';
    if (!categoriaId && categoriaNome) {
      const match = categorias.find(
        (c) => String(c.nome || '').toLocaleLowerCase('pt-BR') === categoriaNome.toLocaleLowerCase('pt-BR'),
      );
      if (match) categoriaId = match.id;
    }

    setForm({
      nome: serie?.nome || '',
      terceiro_nome: serie?.terceiro_nome || '',
      categoria_id: categoriaId,
      categoria_nome: categoriaNome,
      centro_custo: serie?.centro_custo || '',
      valor_previsto: Number(serie?.valor_previsto) || 0,
      dia_vencimento: Number(serie?.dia_vencimento) || 10,
      frequencia: serie?.frequencia || FREQUENCIA_SERIE.MENSAL,
      mes_vencimento: Number(serie?.mes_vencimento) || new Date().getMonth() + 1,
      observacoes: serie?.observacoes || '',
    });
  }, [open, serie, categorias]);

  const precisaMesReferencia = form.frequencia !== FREQUENCIA_SERIE.MENSAL;

  const handleCategoria = (cat) => {
    if (!cat?.id) return;
    setForm((f) => ({
      ...f,
      categoria_id: cat.id,
      categoria_nome: cat.nome || '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.({
      ...serie,
      ...form,
      valor_previsto: parseFloat(form.valor_previsto) || 0,
      dia_vencimento: parseInt(form.dia_vencimento, 10) || 10,
      mes_vencimento: parseInt(form.mes_vencimento, 10) || 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{serie?.id ? 'Editar conta fixa' : 'Nova conta fixa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div className="space-y-1.5">
            <Label htmlFor="serie-nome">Nome da conta</Label>
            <Input
              id="serie-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Energia Loja Centro"
              className="h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="serie-fornecedor">Fornecedor</Label>
            <Input
              id="serie-fornecedor"
              value={form.terceiro_nome}
              onChange={(e) => setForm((f) => ({ ...f, terceiro_nome: e.target.value }))}
              placeholder="Concessionária, operadora…"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <BudgetCategoriaSelect
              categorias={categorias}
              value={form.categoria_id || ''}
              displayName={form.categoria_nome || ''}
              onValueChange={handleCategoria}
              onCategoriasChange={onCategoriasChange}
              placeholder="Escolher categoria"
            />
          </div>

          <div className="space-y-2">
            <Label>Periodicidade</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FREQUENCIAS_SERIE_OPCOES.map((freq) => (
                <OpcaoChip
                  key={freq}
                  active={form.frequencia === freq}
                  onClick={() => setForm((f) => ({ ...f, frequencia: freq }))}
                  className="col-span-1"
                >
                  {freq}
                </OpcaoChip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {DESCRICAO_FREQUENCIA_SERIE[form.frequencia] ||
                DESCRICAO_FREQUENCIA_SERIE[FREQUENCIA_SERIE.MENSAL]}
            </p>
          </div>

          {precisaMesReferencia && (
            <div className="space-y-2">
              <Label>
                {form.frequencia === FREQUENCIA_SERIE.ANUAL
                  ? 'Mês do vencimento'
                  : 'Mês de referência'}
              </Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {MESES_VENCIMENTO_LABELS.map((nome, idx) => {
                  const mes = idx + 1;
                  return (
                    <OpcaoChip
                      key={nome}
                      active={form.mes_vencimento === mes}
                      onClick={() => setForm((f) => ({ ...f, mes_vencimento: mes }))}
                      className="min-h-10 px-1 text-xs sm:text-sm"
                      title={nome}
                    >
                      {MESES_CURTOS[idx]}
                    </OpcaoChip>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selecionado: {MESES_VENCIMENTO_LABELS[form.mes_vencimento - 1]}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Centro de custo</Label>
            <FolhaCentroCustoSelect
              centros={centrosCustoRegistros}
              value={form.centro_custo || ''}
              onValueChange={(nome) => setForm((f) => ({ ...f, centro_custo: nome }))}
              onCentrosChange={onCentrosChange}
              placeholder="Escolher centro de custo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="serie-valor">Valor previsto (R$)</Label>
              <Input
                id="serie-valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.valor_previsto}
                onChange={(e) => setForm((f) => ({ ...f, valor_previsto: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="serie-dia">Dia vencimento</Label>
              <Input
                id="serie-dia"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={form.dia_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))}
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto h-11"
              disabled={saving || !form.nome.trim() || !form.categoria_id}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
