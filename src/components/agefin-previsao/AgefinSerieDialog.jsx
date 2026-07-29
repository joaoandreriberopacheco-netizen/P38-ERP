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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BudgetCategoriaSelect from '@/components/budget-previsao/BudgetCategoriaSelect';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';
import {
  FREQUENCIA_SERIE,
  FREQUENCIAS_SERIE_OPCOES,
  MESES_VENCIMENTO_LABELS,
} from '@/lib/agefinPrevisaoCalculos';

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
        <form onSubmit={handleSubmit} className="space-y-3 min-w-0">
          <div>
            <Label>Nome da conta</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Energia Loja Centro"
              required
            />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input
              value={form.terceiro_nome}
              onChange={(e) => setForm((f) => ({ ...f, terceiro_nome: e.target.value }))}
              placeholder="Concessionária, operadora…"
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <BudgetCategoriaSelect
              categorias={categorias}
              value={form.categoria_id || ''}
              onValueChange={handleCategoria}
              onCategoriasChange={onCategoriasChange}
            />
          </div>
          <div>
            <Label>Periodicidade</Label>
            <Select
              value={form.frequencia}
              onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIAS_SERIE_OPCOES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.frequencia === FREQUENCIA_SERIE.ANUAL
                ? 'Conta anual — aparece só no mês de vencimento escolhido.'
                : form.frequencia === FREQUENCIA_SERIE.MENSAL
                  ? 'Conta mensal — aparece em todos os meses.'
                  : `Conta ${form.frequencia.toLowerCase()} — a partir do mês de referência.`}
            </p>
          </div>
          {precisaMesReferencia && (
            <div>
              <Label>
                {form.frequencia === FREQUENCIA_SERIE.ANUAL ? 'Mês do vencimento' : 'Mês de referência'}
              </Label>
              <Select
                value={String(form.mes_vencimento)}
                onValueChange={(v) => setForm((f) => ({ ...f, mes_vencimento: parseInt(v, 10) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_VENCIMENTO_LABELS.map((nome, idx) => (
                    <SelectItem key={nome} value={String(idx + 1)}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Centro de custo</Label>
            <FolhaCentroCustoSelect
              centros={centrosCustoRegistros}
              value={form.centro_custo || ''}
              onValueChange={(nome) => setForm((f) => ({ ...f, centro_custo: nome }))}
              onCentrosChange={onCentrosChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label>Valor previsto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_previsto}
                onChange={(e) => setForm((f) => ({ ...f, valor_previsto: e.target.value }))}
              />
            </div>
            <div className="min-w-0">
              <Label>Dia vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.dia_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
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
