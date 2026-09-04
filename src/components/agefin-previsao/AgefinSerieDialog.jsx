import { useEffect, useMemo, useState } from 'react';
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
  formatCompetenciaLabel,
  formatCurrency,
  FREQUENCIA_SERIE,
  FREQUENCIAS_SERIE_OPCOES,
  MESES_VENCIMENTO_LABELS,
  MODO_CADASTRO_SERIE,
  serieEhParcelada,
} from '@/lib/agefinPrevisaoCalculos';
import { gerarParcelasProposta } from '@/lib/agefinParcelamentoCalculos';
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
  competenciaMes = '',
}) {
  const [form, setForm] = useState({
    modo_cadastro: MODO_CADASTRO_SERIE.RECORRENTE,
    nome: '',
    terceiro_nome: '',
    categoria_id: '',
    categoria_nome: '',
    centro_custo: '',
    centro_custo_id: '',
    valor_previsto: 0,
    dia_vencimento: 10,
    frequencia: FREQUENCIA_SERIE.MENSAL,
    mes_vencimento: new Date().getMonth() + 1,
    competencia_inicio_parcelas: '',
    total_parcelas: 2,
    observacoes: '',
  });

  const editando = Boolean(serie?.id);
  const modoParcelada = form.modo_cadastro === MODO_CADASTRO_SERIE.PARCELADA;

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

    const parcelada = serieEhParcelada(serie);
    const competenciaPadrao =
      String(serie?.competencia_inicio_parcelas || competenciaMes || '').slice(0, 7) ||
      new Date().toISOString().slice(0, 7);

    setForm({
      modo_cadastro: parcelada ? MODO_CADASTRO_SERIE.PARCELADA : MODO_CADASTRO_SERIE.RECORRENTE,
      nome: serie?.nome || '',
      terceiro_nome: serie?.terceiro_nome || '',
      categoria_id: categoriaId,
      categoria_nome: categoriaNome,
      centro_custo: serie?.centro_custo || '',
      centro_custo_id: serie?.centro_custo_id || '',
      valor_previsto: Number(serie?.valor_previsto) || 0,
      dia_vencimento: Number(serie?.dia_vencimento) || 10,
      frequencia: serie?.frequencia || FREQUENCIA_SERIE.MENSAL,
      mes_vencimento: Number(serie?.mes_vencimento) || new Date().getMonth() + 1,
      competencia_inicio_parcelas: competenciaPadrao,
      total_parcelas: Math.max(2, Number(serie?.total_parcelas) || 2),
      observacoes: serie?.observacoes || '',
    });
  }, [open, serie, categorias, competenciaMes]);

  const precisaMesReferencia = !modoParcelada && form.frequencia !== FREQUENCIA_SERIE.MENSAL;

  const previewParcelas = useMemo(() => {
    if (!modoParcelada) return [];
    const valor = parseFloat(form.valor_previsto) || 0;
    if (valor <= 0) return [];
    return gerarParcelasProposta({
      competenciaOrigem: form.competencia_inicio_parcelas,
      valorOriginal: valor,
      totalParcelas: parseInt(form.total_parcelas, 10) || 2,
      diaVencimento: parseInt(form.dia_vencimento, 10) || 10,
    });
  }, [
    modoParcelada,
    form.valor_previsto,
    form.competencia_inicio_parcelas,
    form.total_parcelas,
    form.dia_vencimento,
  ]);

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
    const valorTotal = parseFloat(form.valor_previsto) || 0;
    const dia = parseInt(form.dia_vencimento, 10) || 10;
    const competenciaInicio = String(form.competencia_inicio_parcelas || '').slice(0, 7);
    const totalParcelas = Math.max(2, parseInt(form.total_parcelas, 10) || 2);

    onSave?.({
      ...serie,
      ...form,
      modo_cadastro: modoParcelada ? MODO_CADASTRO_SERIE.PARCELADA : MODO_CADASTRO_SERIE.RECORRENTE,
      valor_previsto: valorTotal,
      dia_vencimento: dia,
      mes_vencimento: parseInt(form.mes_vencimento, 10) || 1,
      competencia_inicio_parcelas: modoParcelada ? competenciaInicio : null,
      total_parcelas: modoParcelada ? totalParcelas : null,
      _criarParcelamento: modoParcelada && !editando,
    });
  };

  const titulo = editando
    ? modoParcelada
      ? 'Editar conta parcelada'
      : 'Editar conta fixa'
    : modoParcelada
      ? 'Nova conta parcelada'
      : 'Nova conta fixa';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          {!editando && (
            <div className="space-y-2">
              <Label>Tipo de conta</Label>
              <div className="grid grid-cols-2 gap-2">
                <OpcaoChip
                  active={!modoParcelada}
                  onClick={() =>
                    setForm((f) => ({ ...f, modo_cadastro: MODO_CADASTRO_SERIE.RECORRENTE }))
                  }
                >
                  Recorrente
                </OpcaoChip>
                <OpcaoChip
                  active={modoParcelada}
                  onClick={() =>
                    setForm((f) => ({ ...f, modo_cadastro: MODO_CADASTRO_SERIE.PARCELADA }))
                  }
                >
                  Parcelada
                </OpcaoChip>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {modoParcelada
                  ? DESCRICAO_FREQUENCIA_SERIE[FREQUENCIA_SERIE.PARCELADA]
                  : 'Valor fixo que se repete (mensal, anual, etc.).'}
              </p>
            </div>
          )}

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

          {!modoParcelada && (
            <>
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
            </>
          )}

          {modoParcelada && (
            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="serie-competencia-inicio">Primeira parcela em</Label>
                <Input
                  id="serie-competencia-inicio"
                  type="month"
                  value={form.competencia_inicio_parcelas}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, competencia_inicio_parcelas: e.target.value }))
                  }
                  className="h-11"
                  disabled={editando}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serie-total-parcelas">Número de parcelas</Label>
                <Input
                  id="serie-total-parcelas"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={60}
                  value={form.total_parcelas}
                  onChange={(e) => setForm((f) => ({ ...f, total_parcelas: e.target.value }))}
                  className="h-11"
                  disabled={editando}
                  required
                />
              </div>
              {previewParcelas.length >= 2 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização</p>
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {previewParcelas.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-sm rounded-lg bg-muted/40 px-2.5 py-1.5"
                      >
                        <span>
                          {p.numero}/{previewParcelas.length} · {formatCompetenciaLabel(p.competencia)}
                        </span>
                        <span className="font-medium tabular-nums">{formatCurrency(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {editando && (
                <p className="text-[11px] text-muted-foreground">
                  Para alterar parcelas, remova o parcelamento na previsão do mês e crie de novo.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Centro de custo</Label>
            <FolhaCentroCustoSelect
              centros={centrosCustoRegistros}
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
              placeholder="Escolher centro de custo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="serie-valor">
                {modoParcelada ? 'Valor total (R$)' : 'Valor previsto (R$)'}
              </Label>
              <Input
                id="serie-valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.valor_previsto}
                onChange={(e) => setForm((f) => ({ ...f, valor_previsto: e.target.value }))}
                className="h-11"
                required
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
              disabled={
                saving ||
                !form.nome.trim() ||
                !form.categoria_id ||
                (modoParcelada && !editando && previewParcelas.length < 2)
              }
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
