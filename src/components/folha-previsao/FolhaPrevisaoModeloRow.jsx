import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  P38MobileLine,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import {
  CLASSIFICACAO_DESPESA_FOLHA,
  CLASSIFICACAO_DESPESA_FOLHA_LABELS,
  formatCurrency,
  extrairSalarioBase,
  formatDataBr,
  parseDataIso,
} from '@/lib/folhaPrevisaoCalculos';

export default function FolhaPrevisaoModeloRow({
  modelo,
  colaborador,
  onEdit,
  onDelete,
  striped = false,
  showTitle = true,
  showCentroCusto = true,
}) {
  const tipo = modelo.tipo_vinculo || 'funcionario';
  const salarioBase = extrairSalarioBase(modelo);
  const retiradaFixa = Number(modelo.retirada_valor_fixo) || 0;
  const nome = colaborador?.nome || modelo.colaborador_nome || modelo.nome || 'Pessoa';
  const custoDireto =
    typeof modelo.custo_direto === 'boolean'
      ? modelo.custo_direto
      : modelo.classificacao_despesa !== CLASSIFICACAO_DESPESA_FOLHA.INDIRETA;
  const classificacaoDespesa = custoDireto
    ? CLASSIFICACAO_DESPESA_FOLHA.DIRETA
    : CLASSIFICACAO_DESPESA_FOLHA.INDIRETA;
  const centroCusto = String(modelo.centro_custo || '').trim();
  const dataEntrada = parseDataIso(modelo.data_entrada);

  const resumoPrincipal =
    tipo === 'socio'
      ? `Retirada fixa ${formatCurrency(retiradaFixa)}/mês`
      : `Salário ${formatCurrency(salarioBase)}/mês`;
  const extras = [
    modelo.decimo_terceiro_ativo ? '13º' : null,
    (modelo.ferias_programadas || []).length > 0 ? 'Férias' : null,
  ].filter(Boolean);

  const meta = (
    <>
      <span>{tipo === 'socio' ? 'Sócio' : 'Funcionário'}</span>
      {dataEntrada && (
        <span className="text-foreground/80 print:text-black/80">
          Entrada {formatDataBr(dataEntrada)}
        </span>
      )}
      <P38StatusLabel tone={classificacaoDespesa === CLASSIFICACAO_DESPESA_FOLHA.DIRETA ? 'success' : 'warning'}>
        {classificacaoDespesa === CLASSIFICACAO_DESPESA_FOLHA.DIRETA ? 'Direta' : 'Indireta'}
      </P38StatusLabel>
      {showCentroCusto && <span>CC {centroCusto || 'não informado'}</span>}
      {!modelo.ativo && <P38StatusLabel tone="muted">Inativo</P38StatusLabel>}
    </>
  );

  return (
    <P38MobileLine
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(classificacaoDespesa === CLASSIFICACAO_DESPESA_FOLHA.DIRETA ? 'danger' : 'muted')}
      className={cn(
        '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base',
        'max-md:!py-3 max-md:min-h-[56px] [&>div:last-child]:max-w-[44%] sm:[&>div:last-child]:max-w-[42%]',
      )}
      title={showTitle ? <span className="truncate text-foreground print:text-black">{nome}</span> : null}
      subtitle={`${resumoPrincipal}${extras.length ? ` · ${extras.join(' · ')}` : ''}`}
      meta={showTitle ? meta : (
        <>
          <span className="text-foreground print:text-black">{resumoPrincipal}</span>
          {extras.length > 0 && <span className="text-foreground/80 print:text-black/80">{extras.join(' · ')}</span>}
        </>
      )}
      value={<span className="hidden sm:inline">{formatCurrency(tipo === 'socio' ? retiradaFixa : salarioBase)}</span>}
      valueSub={
        <span className="text-muted-foreground hidden sm:inline">
          {CLASSIFICACAO_DESPESA_FOLHA_LABELS[classificacaoDespesa]}
        </span>
      }
      trailing={
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => onEdit?.(modelo)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
            onClick={() => onDelete?.(modelo)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      }
    />
  );
}
