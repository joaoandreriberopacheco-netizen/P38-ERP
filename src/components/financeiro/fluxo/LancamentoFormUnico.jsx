import React, { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft,
  Calendar, ChevronRight, Tag, Wallet,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import { createUppercaseInputChangeHandler } from '@/lib/uppercaseInputHandlers';
import SeletorContaMobile from './SeletorContaMobile';
import { SeletorCategoria } from './DialogCategoria';
import TagsInput from './TagsInput';
import LancamentoMaisOpcoes from './LancamentoMaisOpcoes';
import RecorrenciaConfig from './RecorrenciaConfig';
import LancamentoValeFolha from './LancamentoValeFolha';
import LancamentoPickerDialog from './LancamentoPickerDialog';
import BudgetCategoriaSelect from '@/components/budget-previsao/BudgetCategoriaSelect';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';

const TIPOS = [
  { value: 'Receita', label: 'Receita', icon: ArrowDownLeft },
  { value: 'Despesa', label: 'Despesa', icon: ArrowUpRight },
  { value: 'Transferência', label: 'Transf.', icon: ArrowRightLeft },
];

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
  onEditarData,
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
  bloquearTipo = false,
  bloquearRecorrencia = false,
  salvarLabel = 'Salvar',
  modoPlanejamento = false,
  centroCusto = '',
  onCentroCustoChange,
  centrosCustoRegistros = [],
  onCentrosCustoChange,
  categoriasDespesa = [],
  onCategoriasDespesaChange,
}) {
  const [campoAtivo, setCampoAtivo] = useState('valor');
  const [picker, setPicker] = useState(null); // 'conta' | 'contaDestino' | 'categoria' | 'tags'
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 space-y-3 scroll-pb-24"
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
          <input
            autoComplete="off"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={valorNumerico === 0 ? '' : valorNumerico}
            onFocus={(e) => focarCampo('valor', e.currentTarget)}
            onChange={(e) => onValorChange(e.target.value)}
            placeholder="0,00"
            className={cn(
              'w-full bg-transparent outline-none border-0 font-semibold text-foreground tracking-tight font-glacial placeholder:text-muted-foreground',
              campoAtivo === 'valor' ? 'text-center text-5xl' : 'text-2xl',
            )}
          />
          {campoAtivo === 'valor' && (
            <p className="text-xs text-muted-foreground text-center mt-1">R$</p>
          )}
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
          onClick={onEditarData}
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
                onValueChange={onCentroCustoChange}
                onCentrosChange={onCentrosCustoChange}
              />
            </div>
          </div>
        ) : !isTransfer ? (
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

      <div className="shrink-0 flex gap-2 px-4 pt-2 pb-4 border-t border-border/30">
        <button
          type="button"
          onClick={onCancelar}
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
