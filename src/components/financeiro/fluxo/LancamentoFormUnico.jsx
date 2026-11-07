import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft,
  Calendar, ChevronDown, ChevronRight, ChevronUp, Tag, Wallet,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import { createUppercaseInputChangeHandler } from '@/lib/uppercaseInputHandlers';
import { formatCurrency } from '@/lib/financialUtils';
import { handleCentavosMaskKeyDown, selectAllOnFocus } from '@/lib/inputFocusUtils';
import SeletorContaMobile from './SeletorContaMobile';
import { SeletorCategoria } from './DialogCategoria';
import TagsInput from './TagsInput';
import LancamentoMaisOpcoes from './LancamentoMaisOpcoes';
import RecorrenciaConfig from './RecorrenciaConfig';
import LancamentoValeFolha from './LancamentoValeFolha';
import LancamentoPickerDialog, { LancamentoFormSheet } from './LancamentoPickerDialog';
import { agoraParaInputDatetimeLocal } from '@/components/utils/dateUtils';
import BudgetCategoriaSelect from '@/components/budget-previsao/BudgetCategoriaSelect';
import BudgetModeloSelect from '@/components/budget-previsao/BudgetModeloSelect';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';

const TIPOS = [
  { value: 'Receita', label: 'Receita', icon: ArrowDownLeft },
  { value: 'Despesa', label: 'Despesa', icon: ArrowUpRight },
  { value: 'Transferência', label: 'Transf.', icon: ArrowRightLeft },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTextoDataHora(ymd, hora, minuto) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, mo, d] = ymd.split('-');
  return `${d}/${mo}/${y} ${pad2(hora)}:${pad2(minuto)}`;
}

/** Converte dd/MM/yyyy HH:mm → yyyy-MM-ddThh:mm (null se incompleto). */
function parseTextoDataHora(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  const hora = m[4] !== undefined ? parseInt(m[4], 10) : 0;
  const minuto = m[5] !== undefined ? parseInt(m[5], 10) : 0;
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;
  return `${y}-${pad2(mo)}-${pad2(day)}T${pad2(hora)}:${pad2(minuto)}`;
}

function partesDeDatetimeLocal(local) {
  const [ymd, rest] = String(local || '').split('T');
  const [hh = '12', mm = '00'] = (rest || '').split(':');
  return {
    ymd: ymd || '',
    hora: Math.min(23, Math.max(0, parseInt(hh, 10) || 0)),
    minuto: Math.min(59, Math.max(0, parseInt(mm, 10) || 0)),
  };
}

function ajustarHora(hora, delta) {
  return ((hora + delta) % 24 + 24) % 24;
}

function ajustarMinuto(minuto, delta) {
  return ((minuto + delta) % 60 + 60) % 60;
}

function ColunaHorario({ label, valor, onIncrement, onDecrement, ariaLabel }) {
  const colRef = useRef(null);

  const onWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) onIncrement();
    else onDecrement();
  };

  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <button
        type="button"
        aria-label={`Aumentar ${ariaLabel}`}
        onClick={onIncrement}
        className="flex h-8 w-full items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div
        ref={colRef}
        tabIndex={0}
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={valor}
        onWheel={onWheel}
        className="my-1 flex h-12 w-full max-h-[120px] touch-pan-y items-center justify-center overflow-y-auto rounded-xl bg-muted text-lg font-semibold tabular-nums text-foreground"
      >
        {pad2(valor)}
      </div>
      <button
        type="button"
        aria-label={`Diminuir ${ariaLabel}`}
        onClick={onDecrement}
        className="flex h-8 w-full items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

function LancamentoDataHoraSheet({
  open,
  onOpenChange,
  dataCustomizada,
  dataHoraCustomizada,
  onConfirm,
  stackElevated = false,
}) {
  const [textoManual, setTextoManual] = useState('');
  const [ymd, setYmd] = useState('');
  const [hora, setHora] = useState(12);
  const [minuto, setMinuto] = useState(0);

  const aplicarPartes = (novaYmd, novaHora, novoMinuto) => {
    setYmd(novaYmd);
    setHora(novaHora);
    setMinuto(novoMinuto);
    setTextoManual(formatTextoDataHora(novaYmd, novaHora, novoMinuto));
  };

  useEffect(() => {
    if (!open) return;
    const base =
      dataHoraCustomizada
      || (dataCustomizada ? `${dataCustomizada}T12:00` : null)
      || agoraParaInputDatetimeLocal();
    const partes = partesDeDatetimeLocal(base);
    aplicarPartes(partes.ymd, partes.hora, partes.minuto);
  }, [open, dataCustomizada, dataHoraCustomizada]);

  const confirmar = () => {
    const parsed = parseTextoDataHora(textoManual);
    let local = parsed;
    if (!local && ymd) {
      local = `${ymd}T${pad2(hora)}:${pad2(minuto)}`;
    }
    if (!local) {
      onOpenChange(false);
      return;
    }
    const partes = partesDeDatetimeLocal(local);
    onConfirm(partes.ymd, local);
    onOpenChange(false);
  };

  const cancelar = () => onOpenChange(false);

  return (
    <LancamentoFormSheet open={open} onOpenChange={onOpenChange} title="Data e hora" elevated={stackElevated}>
      <input
        autoComplete="off"
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa hh:mm"
        value={textoManual}
        onChange={(e) => setTextoManual(e.target.value)}
        className="h-12 w-full rounded-xl border-0 bg-muted px-3 text-sm outline-none text-foreground"
      />
      <input
        autoComplete="off"
        type="date"
        value={ymd}
        onChange={(e) => {
          const novaData = e.target.value;
          aplicarPartes(novaData, hora, minuto);
        }}
        className="mt-3 h-12 w-full rounded-xl border-0 bg-muted px-3 text-sm outline-none"
      />
      <div className="mt-3 flex gap-3 rounded-xl bg-card px-2 py-2 shadow-sm">
        <ColunaHorario
          label="Hora"
          valor={hora}
          ariaLabel="Hora"
          onIncrement={() => aplicarPartes(ymd, ajustarHora(hora, 1), minuto)}
          onDecrement={() => aplicarPartes(ymd, ajustarHora(hora, -1), minuto)}
        />
        <ColunaHorario
          label="Min"
          valor={minuto}
          ariaLabel="Minutos"
          onIncrement={() => aplicarPartes(ymd, hora, ajustarMinuto(minuto, 1))}
          onDecrement={() => aplicarPartes(ymd, hora, ajustarMinuto(minuto, -1))}
        />
      </div>
      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={cancelar}
          className="h-11 flex-1 rounded-xl bg-muted text-sm font-medium text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          className="h-11 flex-1 rounded-xl bg-[#4a5240] text-sm font-semibold text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]"
        >
          Confirmar
        </button>
      </div>
    </LancamentoFormSheet>
  );
}

function CampoLinha({ label, value, placeholder, onClick, icon: Icon, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl bg-card shadow-sm px-4 py-3.5 flex items-center gap-3 text-left min-h-[56px] active:scale-[0.99] transition-transform',
        className,
      )}
    >
      {Icon && (
        <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-medium truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
          {value || placeholder}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

/**
 * Formulário único — receita, despesa e transferência num só ecrã.
 */
export default function LancamentoFormUnico({
  tipo,
  onTipoChange,
  valorNumerico,
  onValorChange,
  descricao,
  onDescricaoChange,
  realizado,
  onRealizadoChange,
  dataExibicao,
  dataCustomizada,
  dataHoraCustomizada,
  onDataVencimentoConfirm,
  contaId,
  contaDestinoId,
  contas,
  onContaChange,
  onContaDestinoChange,
  categoria,
  categoriaId,
  onCategoriaChange,
  categorias,
  onCategoriaCriada,
  tags,
  onTagsChange,
  isRecorrente,
  onRecorrenteToggle,
  frequencia,
  onFrequencia,
  parcelas,
  onParcelas,
  dataFim,
  onDataFim,
  isCustoMercadoria,
  onCustoMercadoriaChange,
  isValeFolha,
  onValeFolhaToggle,
  valeFolhaModeloId,
  onValeFolhaPessoaChange,
  pessoasFolha,
  loadingPessoasFolha,
  bloquearValeFolha,
  pedidoCompraId,
  onPedidoCompraIdChange,
  pedidosCompra,
  dataLancamento,
  onDataLancamentoChange,
  previewOrdemLancamento,
  saving,
  onSalvar,
  onCancelar,
  rodapeExtra = null,
  bloquearTipo = false,
  bloquearRecorrencia = false,
  salvarLabel = 'Salvar',
  modoPlanejamento = false,
  centroCusto = '',
  centroCustoId = '',
  onCentroCustoChange,
  centrosCustoRegistros = [],
  onCentrosCustoChange,
  categoriasDespesa = [],
  onCategoriasDespesaChange,
  modelosBudget = [],
  budgetModeloId = '',
  onBudgetModeloChange,
  onModelosBudgetChange,
  stackElevated = false,
}) {
  const [campoAtivo, setCampoAtivo] = useState('valor');
  const [picker, setPicker] = useState(null); // 'conta' | 'contaDestino' | 'categoria' | 'tags'
  const [showDataSheet, setShowDataSheet] = useState(false);
  const scrollRef = useRef(null);

  const focarCampo = (campo, el) => {
    setCampoAtivo(campo);
    requestAnimationFrame(() => {
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const contaNome = contas.find((c) => c.id === contaId)?.nome;
  const contaDestinoNome = contas.find((c) => c.id === contaDestinoId)?.nome;
  const isTransfer = tipo === 'Transferência';
  const toggleLabel = isTransfer ? 'Já foi realizada?' : 'Já foi pago?';

  const tagsResumo = useMemo(() => {
    if (!tags?.length) return null;
    return tags.slice(0, 3).join(', ') + (tags.length > 3 ? '…' : '');
  }, [tags]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-2">
        {!bloquearTipo ? (
        <div className="flex gap-1 bg-muted dark:bg-muted rounded-2xl p-1">
          {TIPOS.map((t) => {
            const Icon = t.icon;
            const isActive = tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onTipoChange(t.value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-medium transition-all',
                  isActive ? 'bg-background dark:bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        ) : (
          <div className="rounded-2xl bg-muted px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</p>
            <p className="text-sm font-semibold text-foreground">{tipo}</p>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="h-0 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 space-y-3 scroll-pb-24 touch-pan-y [-webkit-overflow-scrolling:touch]"
      >
        <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-foreground">{toggleLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              {realizado
                ? isTransfer ? 'Movimenta as duas contas agora' : 'Entra no fluxo realizado'
                : isTransfer ? 'Fica programada até marcar como feita' : 'Conta a pagar ou receber'}
            </p>
          </div>
          <Switch checked={realizado} onCheckedChange={onRealizadoChange} />
        </div>

        <div
          className={cn(
            'rounded-2xl bg-card shadow-sm transition-all duration-200',
            campoAtivo === 'valor' ? 'px-4 py-6' : 'px-4 py-3',
          )}
        >
          <p className={cn('text-muted-foreground mb-1', campoAtivo === 'valor' ? 'text-xs text-center' : 'text-[10px] uppercase tracking-wider')}>
            Valor
          </p>
          <div className={cn('flex items-baseline gap-1', campoAtivo === 'valor' ? 'justify-center' : '')}>
            <span className={cn('font-semibold text-muted-foreground shrink-0', campoAtivo === 'valor' ? 'text-2xl' : 'text-lg')}>
              R$
            </span>
            <input
              autoComplete="off"
              type="text"
              inputMode="numeric"
              value={formatCurrency(valorNumerico)}
              onFocus={(e) => {
                focarCampo('valor', e.currentTarget);
                selectAllOnFocus(e);
              }}
              onKeyDown={(e) => handleCentavosMaskKeyDown(e, {
                setInput: () => {},
                setValor: onValorChange,
                formatDisplay: formatCurrency,
              })}
              onChange={(e) => {
                const nums = e.target.value.replace(/\D/g, '') || '0';
                onValorChange(parseInt(nums, 10) / 100);
              }}
              placeholder="0,00"
              className={cn(
                'min-w-0 flex-1 bg-transparent outline-none border-0 font-semibold text-foreground tracking-tight font-glacial placeholder:text-muted-foreground',
                campoAtivo === 'valor' ? 'text-center text-5xl max-w-[min(100%,16rem)]' : 'text-2xl',
              )}
            />
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl bg-card shadow-sm transition-all duration-200',
            campoAtivo === 'descricao' ? 'px-4 py-5' : 'px-4 py-3',
          )}
        >
          <p className={cn('text-muted-foreground mb-1', campoAtivo === 'descricao' ? 'text-xs' : 'text-[10px] uppercase tracking-wider')}>
            {isTransfer ? 'Observações (opcional)' : 'Descrição'}
          </p>
          <input
            autoComplete="off"
            value={descricao}
            onFocus={(e) => focarCampo('descricao', e.currentTarget)}
            onChange={createUppercaseInputChangeHandler((e) => onDescricaoChange(e.target.value))}
            placeholder={isTransfer ? 'Ex.: repasse mensal' : 'Do que se trata?'}
            className={cn(
              'w-full bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground p38-data-uppercase',
              campoAtivo === 'descricao' ? 'text-xl font-medium' : 'text-sm',
            )}
          />
        </div>

        <CampoLinha
          label="Data"
          value={dataExibicao}
          placeholder="Agora (ao salvar)"
          icon={Calendar}
          onClick={() => setShowDataSheet(true)}
        />

        {isTransfer ? (
          <>
            <CampoLinha
              label="Conta origem"
              value={contaNome}
              placeholder="Selecionar origem"
              icon={Wallet}
              onClick={() => setPicker('conta')}
            />
            <CampoLinha
              label="Conta destino"
              value={contaDestinoNome}
              placeholder="Selecionar destino"
              icon={Wallet}
              onClick={() => setPicker('contaDestino')}
            />
          </>
        ) : (
          <CampoLinha
            label="Conta"
            value={contaNome}
            placeholder="Selecionar conta"
            icon={Wallet}
            onClick={() => setPicker('conta')}
          />
        )}

        {!isTransfer && modoPlanejamento ? (
          <div className="rounded-2xl bg-card shadow-sm px-4 py-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Categoria</p>
              <BudgetCategoriaSelect
                categorias={categoriasDespesa}
                value={categoriaId}
                onValueChange={(cat) => onCategoriaChange(cat?.nome || '', cat?.id || '')}
                onCategoriasChange={onCategoriasDespesaChange}
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Centro de custo</p>
              <FolhaCentroCustoSelect
                centros={centrosCustoRegistros}
                value={centroCusto}
                valueId={centroCustoId}
                onValueChange={onCentroCustoChange}
                onCentrosChange={onCentrosCustoChange}
                stackElevated={stackElevated}
              />
            </div>
          </div>
        ) : !isTransfer ? (
          <>
            {tipo === 'Despesa' && (
              <div className="rounded-2xl bg-card shadow-sm px-4 py-3 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Budget (opcional)</p>
                  <BudgetModeloSelect
                    modelos={modelosBudget}
                    value={budgetModeloId}
                    displayName={budgetModeloId ? categoria : ''}
                    onValueChange={onBudgetModeloChange}
                    onModelosChange={onModelosBudgetChange}
                    categorias={categoriasDespesa}
                    centrosCustoRegistros={centrosCustoRegistros}
                    onCategoriasChange={onCategoriasDespesaChange}
                    onCentrosChange={onCentrosCustoChange}
                    placeholder="Escolher budget — + para criar"
                    stackElevated={stackElevated}
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Centro de custo</p>
                  <FolhaCentroCustoSelect
                    centros={centrosCustoRegistros}
                    value={centroCusto}
                    valueId={centroCustoId}
                    onValueChange={onCentroCustoChange}
                    onCentrosChange={onCentrosCustoChange}
                    emptyLabel="Nenhum"
                    placeholder={budgetModeloId ? 'Preenchido pelo budget — + para alterar' : 'Opcional — + para criar'}
                    stackElevated={stackElevated}
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <CampoLinha
                label="Categoria"
                value={categoria}
                placeholder="Opcional"
                onClick={() => setPicker('categoria')}
                className="sm:col-span-1"
              />
              <CampoLinha
                label="Tags"
                value={tagsResumo}
                placeholder="Opcional"
                icon={Tag}
                onClick={() => setPicker('tags')}
                className="sm:col-span-1"
              />
            </div>
          </>
        ) : null}

        {!isTransfer && modoPlanejamento && !bloquearRecorrencia && (
          <RecorrenciaConfig
            isRecorrente={isRecorrente}
            onToggle={onRecorrenteToggle}
            frequencia={frequencia}
            onFrequencia={onFrequencia}
            parcelas={parcelas}
            onParcelas={onParcelas}
            dataFim={dataFim}
            onDataFim={onDataFim}
          />
        )}

        {!isTransfer && (
          <>
            <LancamentoValeFolha
              ativo={isValeFolha}
              onAtivoChange={onValeFolhaToggle}
              pessoaId={valeFolhaModeloId}
              onPessoaChange={onValeFolhaPessoaChange}
              pessoas={pessoasFolha}
              carregando={loadingPessoasFolha}
              desabilitado={bloquearValeFolha}
            />
            <LancamentoMaisOpcoes
            tipo={tipo}
            tags={[]}
            onTagsChange={() => {}}
            isCustoMercadoria={isCustoMercadoria}
            onCustoMercadoriaChange={onCustoMercadoriaChange}
            pedidoCompraId={pedidoCompraId}
            onPedidoCompraIdChange={onPedidoCompraIdChange}
            pedidosCompra={pedidosCompra}
            isRecorrente={isRecorrente}
            onRecorrenteToggle={onRecorrenteToggle}
            bloquearRecorrencia={bloquearRecorrencia}
            hideRecorrencia={modoPlanejamento}
            frequencia={frequencia}
            onFrequencia={onFrequencia}
            parcelas={parcelas}
            onParcelas={onParcelas}
            dataFim={dataFim}
            onDataFim={onDataFim}
            dataLancamento={dataLancamento}
            onDataLancamentoChange={onDataLancamentoChange}
            previewOrdemLancamento={previewOrdemLancamento}
            hideTags
          />
          </>
        )}
      </div>

      {rodapeExtra}

      <div className="shrink-0 flex gap-2 px-4 pt-2 pb-4 border-t border-border/30">
        <button
          type="button"
          onClick={onCancelar}
          data-pulse-sensor="fluxo-caixa.novo-cancelar"
          className="flex-1 h-12 rounded-2xl bg-muted text-sm font-medium text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={saving}
          className="flex-[2] h-12 rounded-2xl bg-[#4a5240] text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#a4ce33] dark:text-[#1f1d22]"
        >
          {saving ? 'Salvando…' : salvarLabel}
        </button>
      </div>

      <LancamentoPickerDialog
        open={picker === 'conta'}
        onOpenChange={(o) => !o && setPicker(null)}
        title={isTransfer ? 'Conta origem' : 'Qual conta?'}
      >
        <SeletorContaMobile
          contas={contas}
          value={contaId}
          onChange={(id) => { onContaChange(id); setPicker(null); }}
          label="Conta"
          pickerMode
        />
      </LancamentoPickerDialog>

      <LancamentoPickerDialog
        open={picker === 'contaDestino'}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Conta destino"
      >
        <SeletorContaMobile
          contas={contas}
          value={contaDestinoId}
          onChange={(id) => { onContaDestinoChange(id); setPicker(null); }}
          excludeIds={contaId ? [contaId] : []}
          label="Destino"
          pickerMode
        />
      </LancamentoPickerDialog>

      <LancamentoPickerDialog
        open={picker === 'categoria'}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Categoria"
        bodyClassName="px-4"
      >
        <SeletorCategoria
          tipo={tipo}
          value={categoria}
          onChange={(nome, id) => { onCategoriaChange(nome, id); setPicker(null); }}
          categorias={categorias}
          onCriada={onCategoriaCriada}
          pickerMode
        />
      </LancamentoPickerDialog>

      <LancamentoPickerDialog
        open={picker === 'tags'}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Tags"
        bodyClassName="px-4"
      >
        <TagsInput tags={tags} onChange={onTagsChange} pickerMode />
      </LancamentoPickerDialog>

      <LancamentoDataHoraSheet
        open={showDataSheet}
        onOpenChange={setShowDataSheet}
        dataCustomizada={dataCustomizada}
        dataHoraCustomizada={dataHoraCustomizada}
        stackElevated={stackElevated}
        onConfirm={(ymd, dataHoraLocal) => {
          if (dataHoraLocal?.includes('T')) {
            onDataVencimentoConfirm?.(ymd, dataHoraLocal);
          } else {
            onDataVencimentoConfirm?.(ymd, null);
          }
        }}
      />
    </div>
  );
}

/** Rótulo amigável para data no formulário. */
export function formatarDataFormulario(dataCustomizada, dataHoraCustomizada) {
  if (dataHoraCustomizada) {
    try {
      const d = new Date(dataHoraCustomizada);
      if (!Number.isNaN(d.getTime())) {
        return format(d, "dd/MM/yyyy 'às' HH:mm");
      }
    } catch { /* ignore */ }
  }
  if (dataCustomizada) return formatarSoData(dataCustomizada);
  return `Hoje (${formatarSoData(dataHoje())})`;
}
