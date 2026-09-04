import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { BUDGET_MODULO_LABEL, formatCompetenciaLabel } from '@/lib/budgetCalculos';

function CelulaValor({ valor, positivo, className }) {
  const n = Number(valor) || 0;
  const cls =
    positivo === true
      ? 'text-emerald-700 dark:text-emerald-400'
      : positivo === false
        ? 'text-red-700 dark:text-red-400'
        : '';
  return (
    <span className={cn('tabular-nums font-medium', cls, className)}>
      {formatFinanceiroValor(n)}
    </span>
  );
}

function MetricaMobile({ label, valor, positivo }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <CelulaValor valor={valor} positivo={positivo} className="text-sm" />
    </div>
  );
}

function CardPlanoMobile({ label, planejado, realizado, linkTo, destaque = false, somenteRealizado = false }) {
  const diff = (Number(planejado) || 0) - (Number(realizado) || 0);
  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 p-3 space-y-2',
        destaque ? 'bg-muted/25 border-border/60' : 'bg-card/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-sm font-medium leading-snug', destaque && 'font-semibold')}>{label}</p>
        {linkTo ? (
          <Link to={linkTo} className="shrink-0 text-xs text-primary hover:underline">
            Abrir
          </Link>
        ) : null}
      </div>
      {somenteRealizado ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Realizado</p>
          <CelulaValor
            valor={realizado}
            positivo={label === 'Resultado' || label === 'Lucro bruto' ? Number(realizado) >= 0 : undefined}
            className="text-sm"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <MetricaMobile label="Planejado" valor={planejado} />
          <MetricaMobile label="Realizado" valor={realizado} />
          <MetricaMobile label="Diferença" valor={diff} positivo={diff >= 0} />
        </div>
      )}
    </div>
  );
}

function LinhaPlano({ label, planejado, realizado, linkTo }) {
  const diff = (Number(planejado) || 0) - (Number(realizado) || 0);
  return (
    <tr className="border-b border-border/40">
      <td className="py-3.5 pl-3 pr-3 text-sm font-medium">{label}</td>
      <td className="py-3.5 px-3 text-right text-sm">
        <CelulaValor valor={planejado} />
      </td>
      <td className="py-3.5 px-3 text-right text-sm">
        <CelulaValor valor={realizado} />
      </td>
      <td className="py-3.5 pl-3 pr-3 text-right text-sm">
        <CelulaValor valor={diff} positivo={diff >= 0} />
      </td>
      <td className="py-3.5 pl-2 pr-3 text-right">
        {linkTo ? (
          <Link to={linkTo} className="text-xs text-primary hover:underline">
            Abrir →
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

export default function BudgetPlanoCompleto({
  competencia,
  totaisFixas,
  totaisFolha,
  totaisBudgets,
  realizadoFixas,
  realizadoFolha,
  lucroBruto = 0,
  margemDetalhe,
}) {
  const planejadoDespesas =
    (totaisFixas?.total || 0) + (totaisFolha?.custoTotalEmpresa || 0) + (totaisBudgets?.orcado || 0);
  const realizadoDespesas =
    (realizadoFixas || 0) + (realizadoFolha || 0) + (totaisBudgets?.realizado || 0);
  const diffDespesas = planejadoDespesas - realizadoDespesas;
  const lucro = Number(lucroBruto) || 0;
  const resultado = lucro - realizadoDespesas;

  const compLabel = formatCompetenciaLabel(competencia);

  const rows = useMemo(
    () => [
      {
        key: 'fixas',
        label: 'Contas fixas',
        planejado: totaisFixas?.total || 0,
        realizado: realizadoFixas || 0,
        link: `/PlanejamentoFinanceiro?competencia=${competencia}`,
      },
      {
        key: 'folha',
        label: 'Folha',
        planejado: totaisFolha?.custoTotalEmpresa || 0,
        realizado: realizadoFolha || 0,
        link: `/FolhaPrevisao?competencia=${competencia}`,
      },
      {
        key: 'budgets',
        label: BUDGET_MODULO_LABEL,
        planejado: totaisBudgets?.orcado || 0,
        realizado: totaisBudgets?.realizado || 0,
        link: `/Budgets?aba=acompanhamento&competencia=${competencia}`,
      },
    ],
    [competencia, totaisFixas, totaisFolha, totaisBudgets, realizadoFixas, realizadoFolha],
  );

  return (
    <div className="space-y-4 pb-3">
      <div className="flex items-center gap-1.5 px-1 pr-14 md:pr-1">
        <h2 className="text-sm font-semibold leading-snug">Plano financeiro — {compLabel}</h2>
        <P38HelpPopover label="Ajuda: plano completo" size="sm">
          <p className="text-muted-foreground">
            Junta contas fixas, folha e budgets. O realizado usa despesas pagas no Fluxo (e lançamentos de folha/fixas quando identificáveis).
          </p>
          <p className="text-muted-foreground mt-2">
            O <strong className="text-foreground">lucro bruto</strong> segue o mesmo cálculo do relatório de margem: vendas PDV do mês menos o custo da mercadoria (custo atual do cadastro).
          </p>
          <p className="text-muted-foreground mt-2">
            <strong className="text-foreground">Resultado</strong> = lucro bruto − despesas operacionais pagas.
          </p>
        </P38HelpPopover>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <CardPlanoMobile
            key={r.key}
            label={r.label}
            planejado={r.planejado}
            realizado={r.realizado}
            linkTo={r.link}
          />
        ))}
        <CardPlanoMobile
          label="Total despesas"
          planejado={planejadoDespesas}
          realizado={realizadoDespesas}
          destaque
        />
        <CardPlanoMobile
          label="Lucro bruto"
          realizado={lucro}
          somenteRealizado
        />
        {margemDetalhe?.receita_liquida > 0 && (
          <p className="text-[11px] text-muted-foreground px-1 -mt-1">
            Receita líq. {formatFinanceiroValor(margemDetalhe.receita_liquida)} · CMV{' '}
            {formatFinanceiroValor(margemDetalhe.custo_total)}
          </p>
        )}
        <CardPlanoMobile
          label="Resultado"
          realizado={resultado}
          destaque
          somenteRealizado
        />
      </div>

      <div className={cn('hidden md:block overflow-x-auto rounded-2xl p-2 lg:p-3', P38_FIELD_SURFACE)}>
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-3 pl-3 pr-3 font-medium">Camada</th>
              <th className="py-3 px-3 text-right font-medium">Planejado</th>
              <th className="py-3 px-3 text-right font-medium">Realizado</th>
              <th className="py-3 pl-3 pr-3 text-right font-medium">Diferença</th>
              <th className="py-3 pl-2 pr-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <LinhaPlano
                key={r.key}
                label={r.label}
                planejado={r.planejado}
                realizado={r.realizado}
                linkTo={r.link}
              />
            ))}
            <tr className="border-t-2 border-border/60 bg-muted/20 font-semibold">
              <td className="py-3.5 pl-3 pr-3 text-sm">Total despesas</td>
              <td className="py-3.5 px-3 text-right text-sm">
                <CelulaValor valor={planejadoDespesas} />
              </td>
              <td className="py-3.5 px-3 text-right text-sm">
                <CelulaValor valor={realizadoDespesas} />
              </td>
              <td className="py-3.5 pl-3 pr-3 text-right text-sm">
                <CelulaValor valor={diffDespesas} positivo={diffDespesas >= 0} />
              </td>
              <td />
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-3.5 pl-3 pr-3 text-sm">Lucro bruto</td>
              <td className="py-3.5 px-3 text-right text-sm text-muted-foreground">—</td>
              <td className="py-3.5 px-3 text-right text-sm">
                <CelulaValor valor={lucro} positivo={lucro >= 0} />
              </td>
              <td className="py-3.5 pl-3 pr-3" colSpan={2} />
            </tr>
            {margemDetalhe?.receita_liquida > 0 && (
              <tr className="border-b border-border/20 text-[11px] text-muted-foreground">
                <td className="py-1 pr-2 pl-4" colSpan={5}>
                  Receita líq. {formatFinanceiroValor(margemDetalhe.receita_liquida)} · CMV{' '}
                  {formatFinanceiroValor(margemDetalhe.custo_total)} (relatório de margem)
                </td>
              </tr>
            )}
            <tr>
              <td className="py-3.5 pl-3 pr-3 text-sm font-semibold">Resultado</td>
              <td className="py-3.5 px-3 text-right text-sm text-muted-foreground">—</td>
              <td className="py-3.5 px-3 text-right text-sm font-semibold">
                <CelulaValor valor={resultado} positivo={resultado >= 0} />
              </td>
              <td className="py-3.5 pl-3 pr-3" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
