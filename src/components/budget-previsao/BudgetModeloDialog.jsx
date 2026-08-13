import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import BudgetCategoriaSelect from '@/components/budget-previsao/BudgetCategoriaSelect';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { cn } from '@/lib/utils';
import { lancamentoStackClasses } from '@/components/financeiro/fluxo/LancamentoPickerDialog';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import {
  calcularOrcadoMensal,
  formatCompetenciaLabel,
  formatCurrency,
  getCompetenciaAtual,
  mediaOrcadoAnual,
  MODO_ESTIMATIVA,
  MODO_ESTIMATIVA_OPCOES,
  shiftCompetencia,
  diasCalendarioMes,
  diasUteisMes,
  gerarIdInterno,
} from '@/lib/budgetCalculos';

export default function BudgetModeloDialog({
  open,
  onClose,
  modelo,
  categorias = [],
  centrosCustoRegistros = [],
  centrosRegistrados = [],
  onSave,
  saving,
  onCategoriasChange,
  onCentrosChange,
  stackElevated = false,
  stackLevel = 2,
}) {
  const stack = lancamentoStackClasses(stackElevated ? stackLevel : 0);
  const nestedStackLevel = stackElevated ? stackLevel + 1 : 0;
  const draftIdRef = useRef(null);

  useEffect(() => {
    if (!open) {
      draftIdRef.current = null;
      return;
    }
    if (!modelo?.id) {
      draftIdRef.current = draftIdRef.current || gerarIdInterno('bdg-mod');
    }
  }, [open, modelo?.id]);

  const [form, setForm] = useState({
    nome: '',
    categoria_id: '',
    categoria_nome: '',
    centro_custo: '',
    centro_custo_id: '',
    modo_estimativa: MODO_ESTIMATIVA.POR_MES,
    valor_entrada: '',
    ciclo_dias: '',
    usa_dias_uteis: false,
    ativo: true,
    observacoes: '',
  });

  const centrosParaSelect = useMemo(() => {
    if (centrosCustoRegistros?.length) return centrosCustoRegistros;
    return (centrosRegistrados || []).map((nome, idx) =>
      typeof nome === 'string' ? { id: '', nome, ativo: true, ordem: idx } : nome,
    );
  }, [centrosCustoRegistros, centrosRegistrados]);

  useEffect(() => {
    if (!open) return;
    setForm({
      nome: modelo?.nome || '',
      categoria_id: modelo?.categoria_id || '',
      categoria_nome: modelo?.categoria_nome || '',
      centro_custo: modelo?.centro_custo || '',
      centro_custo_id: modelo?.centro_custo_id || '',
      modo_estimativa: modelo?.modo_estimativa || MODO_ESTIMATIVA.POR_MES,
      valor_entrada: modelo?.valor_entrada != null ? String(modelo.valor_entrada) : '',
      ciclo_dias: modelo?.ciclo_dias ? String(modelo.ciclo_dias) : '',
      usa_dias_uteis: modelo?.usa_dias_uteis === true,
      ativo: modelo?.ativo !== false,
      observacoes: modelo?.observacoes || '',
    });
  }, [open, modelo]);

  const competenciaAtual = getCompetenciaAtual();
  const competenciaProx = shiftCompetencia(competenciaAtual, 1);

  const previewModelo = useMemo(
    () => ({
      ...modelo,
      ...form,
      valor_entrada: parseFloat(form.valor_entrada) || 0,
      ciclo_dias: parseInt(form.ciclo_dias, 10) || 0,
    }),
    [modelo, form],
  );

  const orcadoMesAtual = calcularOrcadoMensal(previewModelo, competenciaAtual);
  const orcadoMesProx = calcularOrcadoMensal(previewModelo, competenciaProx);
  const mediaAnual = mediaOrcadoAnual(previewModelo);

  const valorLabel = useMemo(() => {
    switch (form.modo_estimativa) {
      case MODO_ESTIMATIVA.POR_DIA:
        return 'por dia';
      case MODO_ESTIMATIVA.POR_SEMANA:
        return 'a cada 7 dias';
      case MODO_ESTIMATIVA.POR_CICLO:
        return 'por ciclo';
      default:
        return 'por mês';
    }
  }, [form.modo_estimativa]);

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
    if (saving) return;
    const id = modelo?.id || draftIdRef.current;
    if (!id) return;
    onSave?.({
      ...modelo,
      ...form,
      id,
      valor_entrada: parseFloat(form.valor_entrada) || 0,
      ciclo_dias: parseInt(form.ciclo_dias, 10) || 0,
    });
  };

  const diasCal = diasCalendarioMes(competenciaAtual);
  const diasUteis = diasUteisMes(competenciaAtual);

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose?.()}>
      <DialogContent
        overlayClassName={stack.overlay}
        className={cn(
          'max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto',
          stack.content,
        )}
      >
        <DialogHeader>
          <DialogTitle>{modelo?.id ? 'Editar budget' : 'Novo budget'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Alimentação equipe"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Categoria *</Label>
              <BudgetCategoriaSelect
                categorias={categorias}
                value={form.categoria_id || ''}
                onValueChange={handleCategoria}
                onCategoriasChange={onCategoriasChange}
                stackElevated={stackElevated}
                stackLevel={nestedStackLevel}
              />
            </div>
            <div>
              <Label>Centro de custo</Label>
              <FolhaCentroCustoSelect
                centros={centrosParaSelect}
                value={form.centro_custo || ''}
                valueId={form.centro_custo_id || ''}
                onValueChange={(centro) =>
                  setForm((f) => ({
                    ...f,
                    centro_custo: centro?.nome || '',
                    centro_custo_id: centro?.id || '',
                  }))
                }
                onCentrosChange={onCentrosChange}
                emptyLabel="Nenhum"
                placeholder="Nenhum — tocar + para criar"
                stackElevated={stackElevated}
                stackLevel={nestedStackLevel}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Como você estima este gasto?</Label>
              <P38HelpPopover label="Ajuda: modos de estimativa" size="sm">
                <p className="text-muted-foreground">
                  Informe na unidade que faz sentido. O sistema sempre mostra o <strong className="text-foreground">orçamento mensal</strong>.
                </p>
                <p className="text-muted-foreground">
                  Dias úteis = segunda a sábado (domingo não conta).
                </p>
              </P38HelpPopover>
            </div>
            <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl p-2', P38_FIELD_SURFACE)}>
              {MODO_ESTIMATIVA_OPCOES.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer text-sm',
                    form.modo_estimativa === opt.value ? 'bg-card shadow-sm' : '',
                  )}
                >
                  <input
                    type="radio"
                    name="modo_estimativa"
                    checked={form.modo_estimativa === opt.value}
                    onChange={() => setForm((f) => ({ ...f, modo_estimativa: opt.value }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Valor * ({valorLabel})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_entrada}
                onChange={(e) => setForm((f) => ({ ...f, valor_entrada: e.target.value }))}
                required
              />
            </div>
            {form.modo_estimativa === MODO_ESTIMATIVA.POR_CICLO && (
              <div>
                <Label>Ciclo dura (dias) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.ciclo_dias}
                  onChange={(e) => setForm((f) => ({ ...f, ciclo_dias: e.target.value }))}
                  placeholder="Ex: 20"
                  required
                />
              </div>
            )}
          </div>

          {form.modo_estimativa !== MODO_ESTIMATIVA.POR_MES && (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Usar dias úteis</p>
                <p className="text-[11px] text-muted-foreground">
                  Padrão: mês completo ({diasCal} dias). Com toggle: {diasUteis} dias (sem domingo).
                </p>
              </div>
              <Switch
                checked={form.usa_dias_uteis}
                onCheckedChange={(v) => setForm((f) => ({ ...f, usa_dias_uteis: v }))}
              />
            </label>
          )}

          <div className={cn('rounded-xl p-3 space-y-1.5 text-sm', P38_FIELD_SURFACE)}>
            <p className="font-medium text-foreground">Orçamento mensal (calculado)</p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {formatCompetenciaLabel(competenciaAtual)} ({form.usa_dias_uteis ? diasUteis : diasCal} dias)
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(orcadoMesAtual)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">{formatCompetenciaLabel(competenciaProx)}</span>
              <span className="tabular-nums">{formatCurrency(orcadoMesProx)}</span>
            </p>
            <p className="flex justify-between gap-2 border-t border-border/40 pt-1.5">
              <span className="text-muted-foreground">Média anual</span>
              <span className="tabular-nums">{formatCurrency(mediaAnual)}/mês</span>
            </p>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={2}
              placeholder="Opcional"
            />
          </div>

          <label className="flex items-center justify-between gap-2">
            <span className="text-sm">Budget ativo</span>
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
          </label>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.nome.trim() || !form.categoria_id}>
              {saving ? 'Processando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
