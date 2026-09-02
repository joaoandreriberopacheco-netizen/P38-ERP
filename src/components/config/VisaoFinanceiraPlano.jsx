import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, LayoutList, Loader2, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import {
  FinanceiroGrupo,
  FinanceiroListaEstado,
  formatFinanceiroValor,
} from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { P38MobileLine, P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { cn } from '@/lib/utils';
import { P38_CHIP_INACTIVE, P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { formatCompetenciaLabel, getCompetenciaAtual, shiftCompetencia } from '@/lib/budgetCalculos';
import {
  listarModelos as listarModelosBudget,
  listarCompetencias as listarCompetenciasBudget,
  listarLancamentosMes,
  listarLancamentosVencimentoMes,
} from '@/lib/budgetService';
import { useLucroBrutoCompetencia } from '@/hooks/useLucroBrutoCompetencia';
import { listarModelos as listarModelosFolha, listarCompetencias as listarCompetenciasFolha } from '@/lib/folhaPrevisaoService';
import { listarModelos as listarModelosAgefin, listarLancamentosCompetencia, listarLancamentosRecorrentes } from '@/lib/agefinPrevisaoService';
import { listarParcelamentos } from '@/lib/agefinParcelamentoService';
import { montarPlanoFinanceiroConsolidado } from '@/lib/planoFinanceiroConsolidado';
import { gerarRelatorioVisaoFinanceira } from '@/functions/gerarRelatorioVisaoFinanceira';
import { dataHoje } from '@/components/utils/dateUtils';

function CelulaValor({ valor, positivo, className, prefix = '' }) {
  const n = Number(valor) || 0;
  const cls =
    positivo === true
      ? 'text-emerald-700 dark:text-emerald-400'
      : positivo === false
        ? 'text-red-700 dark:text-red-400'
        : '';
  return (
    <span className={cn('tabular-nums font-medium', cls, className)}>
      {prefix}
      {formatFinanceiroValor(n)}
    </span>
  );
}

function LinhaResumo({ label, valor, tipo = 'normal', sublabel, destaque = false }) {
  const prefix = tipo === 'soma' ? '+' : tipo === 'subtrai' ? '−' : '';
  const positivo =
    tipo === 'soma' ? Number(valor) >= 0 : tipo === 'resultado' ? Number(valor) >= 0 : undefined;

  return (
    <tr
      className={cn(
        'border-b border-border/40',
        destaque && 'bg-muted/20 font-semibold',
      )}
    >
      <td className="py-3 pl-3 pr-3 text-sm">
        <span className={destaque ? 'font-semibold' : 'font-medium'}>{label}</span>
        {sublabel ? (
          <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{sublabel}</span>
        ) : null}
      </td>
      <td className="py-3 pl-3 pr-3 text-right text-sm whitespace-nowrap">
        <CelulaValor valor={valor} positivo={positivo} prefix={prefix} />
      </td>
    </tr>
  );
}

function buildSubtitleExplodido(item, modo, baseSubtitle = '') {
  const parts = [];
  if (baseSubtitle) parts.push(baseSubtitle);
  if (item.tipoPauta === 'frete') parts.push('Frete');
  if (item.tipoPauta === 'compra_mercadoria') parts.push('Compra mercadoria');
  if (item.raw?.numero_parcelas_total > 1) {
    parts.push(`Parcela ${item.raw.parcela_atual || '?'} de ${item.raw.numero_parcelas_total}`);
  }
  if (item.coberturaBudget) parts.push('Coberto por budget');
  if (item.entraNoTotal === false && !item.coberturaBudget) parts.push('Informativo — não soma novamente');
  if (item.destaque) parts.push('Compromisso do mês');
  if (modo === 'provisao' && item.frequencia) parts.push(item.frequencia);
  return parts.join(' · ');
}

function ItemPlanoLine({
  item,
  striped,
  modo = 'padrao',
  mostrarCentro = false,
  explodido = false,
  omitirDataVencimento = false,
}) {
  const accent = item.destaque
    ? 'warning'
    : item.coberturaBudget
      ? 'info'
      : item.entraNoTotal === false
        ? 'muted'
        : 'default';

  const meta = (
    <>
      {item.tipoPauta === 'frete' ? <P38StatusLabel tone="warning">Frete</P38StatusLabel> : null}
      {item.tipoPauta === 'compra_mercadoria' ? (
        <P38StatusLabel tone="muted">Compra mercadoria</P38StatusLabel>
      ) : null}
      {item.raw?.numero_parcelas_total > 1 ? (
        <P38StatusLabel tone="muted">
          Parcela {item.raw.parcela_atual || '?'} de {item.raw.numero_parcelas_total}
        </P38StatusLabel>
      ) : null}
      {item.coberturaBudget ? (
        <P38StatusLabel tone="info">Coberto por budget</P38StatusLabel>
      ) : null}
      {item.entraNoTotal === false && !item.coberturaBudget ? (
        <P38StatusLabel tone="muted">Não soma novamente</P38StatusLabel>
      ) : null}
      {item.destaque ? <P38StatusLabel tone="warning">Compromisso do mês</P38StatusLabel> : null}
      {mostrarCentro && item.centroCusto ? (
        <P38StatusLabel tone="muted">{item.centroCusto}</P38StatusLabel>
      ) : null}
    </>
  );

  const title =
    (modo === 'vencimento' || modo === 'pauta') && !omitirDataVencimento
      ? item.dataVencimentoLabel
        ? `${item.dataVencimentoLabel} · ${item.nome}`
        : item.nome
      : item.nome;

  const subtitle =
    modo === 'provisao'
      ? [item.frequencia, item.dataVencimentoLabel ? `ref. ${item.dataVencimentoLabel}` : '']
          .filter(Boolean)
          .join(' · ')
      : modo === 'vencimento' || modo === 'pauta'
        ? ''
        : item.detalhe ||
          (item.valorSecundario != null
            ? `${item.valorSecundarioLabel}: ${formatFinanceiroValor(item.valorSecundario)}`
            : '');

  const subtitleFinal = explodido ? buildSubtitleExplodido(item, modo, subtitle) : subtitle;

  const titleNode = explodido ? (
    <span className="text-sm md:text-[15px] font-medium uppercase tracking-wide leading-snug text-foreground">
      {title}
    </span>
  ) : (
    title
  );

  return (
    <P38MobileLine
      as={item.link ? Link : 'div'}
      to={item.link || undefined}
      thinAccent={!explodido}
      striped={striped && !explodido}
      accent={accent}
      className={cn(
        'w-full text-left',
        explodido
          ? 'border-b-0 py-3 md:py-3.5 px-3 md:px-4 min-h-0 gap-4 md:gap-6 [&>div:last-child]:max-w-[42%]'
          : 'max-md:!py-3.5 max-md:min-h-[58px]',
      )}
      title={titleNode}
      subtitle={
        subtitleFinal
          ? explodido
            ? <span className="text-xs md:text-sm text-muted-foreground leading-snug">{subtitleFinal}</span>
            : subtitleFinal
          : null
      }
      meta={
        explodido
          ? mostrarCentro && item.centroCusto
            ? <P38StatusLabel tone="muted">{item.centroCusto}</P38StatusLabel>
            : null
          : meta
      }
      value={
        explodido ? (
          <span className="text-sm md:text-base font-semibold tabular-nums text-foreground whitespace-nowrap">
            <span className="text-foreground/70">−</span>
            {formatFinanceiroValor(item.valor)}
          </span>
        ) : (
          <>
            <span className="text-foreground/85">−</span>
            {formatFinanceiroValor(item.valor)}
          </>
        )
      }
      valueSub={
        (modo === 'provisao' || (modo !== 'vencimento' && modo !== 'pauta')) && item.valorSecundario != null
          ? `${item.valorSecundarioLabel}: ${formatFinanceiroValor(item.valorSecundario)}`
          : null
      }
      trailing={item.link ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
    />
  );
}

function ListaItensPlano({
  items,
  modo = 'padrao',
  mostrarCentro = false,
  explodido = false,
  omitirDataVencimento = false,
}) {
  const lines = items.map((item, index) => (
    <ItemPlanoLine
      key={item.id}
      item={item}
      striped={index % 2 === 1}
      modo={modo}
      mostrarCentro={mostrarCentro}
      explodido={explodido}
      omitirDataVencimento={omitirDataVencimento}
    />
  ));

  if (!explodido) return lines;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/40 overflow-hidden bg-background',
        items.length > 4
          ? 'md:grid md:grid-cols-2 md:gap-px md:bg-border/40'
          : 'divide-y divide-border/40',
      )}
    >
      {lines.map((line, index) => (
        <div key={items[index]?.id || index} className="bg-background">
          {line}
        </div>
      ))}
    </div>
  );
}

const GRUPO_EXPLODIDO_LABEL =
  '!text-xs md:!text-sm !font-bold !uppercase !tracking-wide !text-foreground !max-w-none';

function GrupoDataVencimentoPlano({ bloco, modo = 'vencimento', explodido = false }) {
  return (
    <FinanceiroGrupo
      card={explodido}
      label={bloco.label}
      labelClassName={explodido ? GRUPO_EXPLODIDO_LABEL : undefined}
      ocultarTotais
      defaultOpen
    >
      <ListaItensPlano
        items={bloco.items}
        modo={modo}
        explodido={explodido}
        omitirDataVencimento
      />
    </FinanceiroGrupo>
  );
}

function GrupoCentroPlano({ centro, modo, mostrarCentro = true, explodido = false }) {
  return (
    <FinanceiroGrupo
      card={explodido}
      label={centro.label}
      labelClassName={explodido ? GRUPO_EXPLODIDO_LABEL : undefined}
      despesas={centro.subtotal}
      liquido={-centro.subtotal}
      defaultOpen
    >
      <ListaItensPlano items={centro.items} modo={modo} mostrarCentro={mostrarCentro} explodido={explodido} />
    </FinanceiroGrupo>
  );
}

function GrupoCategoriaPlano({ categoria, explodido = false }) {
  return (
    <FinanceiroGrupo
      card={explodido}
      label={categoria.label}
      labelClassName={explodido ? GRUPO_EXPLODIDO_LABEL : undefined}
      despesas={categoria.subtotal}
      liquido={-categoria.subtotal}
      defaultOpen
    >
      {categoria.items.map((item, index) => (
        <ItemPlanoLine key={item.id} item={item} striped={index % 2 === 1} explodido={explodido} />
      ))}
    </FinanceiroGrupo>
  );
}

function GrupoCentroCategoriaPlano({ centro, explodido = false }) {
  return (
    <FinanceiroGrupo
      card={explodido}
      label={centro.label}
      labelClassName={explodido ? GRUPO_EXPLODIDO_LABEL : undefined}
      despesas={centro.subtotal}
      liquido={-centro.subtotal}
      defaultOpen
    >
      <div className="space-y-1 pl-0.5 sm:pl-1">
        {centro.categorias.map((categoria) => (
          <GrupoCategoriaPlano key={categoria.id} categoria={categoria} explodido={explodido} />
        ))}
      </div>
    </FinanceiroGrupo>
  );
}

function ItemProvisaoColapsavel({ item, explodido = false }) {
  return (
    <FinanceiroGrupo
      card={explodido}
      label={item.nome}
      labelClassName={explodido ? GRUPO_EXPLODIDO_LABEL : undefined}
      despesas={item.valor}
      liquido={-item.valor}
      defaultOpen={false}
    >
      {item.filhos?.map((filho, index) => (
        <ItemPlanoLine
          key={filho.id}
          item={filho}
          striped={index % 2 === 1}
          mostrarCentro
          explodido={explodido}
        />
      ))}
    </FinanceiroGrupo>
  );
}

function ToggleAgrupamentoFixas({ valor, onChange }) {
  return (
    <div className={cn('inline-flex rounded-lg p-0.5', P38_FIELD_SURFACE)}>
      <button
        type="button"
        onClick={() => onChange('vencimento')}
        className={cn(
          'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
          valor === 'vencimento' ? 'bg-background shadow-sm text-foreground' : P38_CHIP_INACTIVE,
        )}
      >
        Por vencimento
      </button>
      <button
        type="button"
        onClick={() => onChange('centro_custo')}
        className={cn(
          'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
          valor === 'centro_custo' ? 'bg-background shadow-sm text-foreground' : P38_CHIP_INACTIVE,
        )}
      >
        Por centro de custo
      </button>
    </div>
  );
}

function ConteudoCamadaExplodida({ grupo, agrupamentoFixas }) {
  if (grupo.layout === 'vencimento_ou_centro') {
    const blocos =
      agrupamentoFixas === 'centro_custo' ? grupo.porCentro || [] : grupo.porVencimento || [];
    const modo = agrupamentoFixas === 'centro_custo' ? 'centro' : 'vencimento';

    if (modo === 'centro') {
      return (
        <div className="space-y-2 px-1 pb-1">
          {blocos.map((bloco) => (
            <GrupoCentroPlano
              key={bloco.id}
              centro={bloco}
              modo="vencimento"
              mostrarCentro={false}
              explodido
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2 px-1 pb-1">
        {blocos.map((bloco) => (
          <GrupoDataVencimentoPlano key={bloco.id} bloco={bloco} modo="vencimento" explodido />
        ))}
      </div>
    );
  }

  if (grupo.layout === 'provisoes_colapsaveis') {
    return (
      <div className="space-y-2 px-1 pb-1">
        {grupo.items.map((item) =>
          item.colapsavel ? (
            <ItemProvisaoColapsavel key={item.id} item={item} explodido />
          ) : (
            <ItemPlanoLine key={item.id} item={item} explodido />
          ),
        )}
      </div>
    );
  }

  if (grupo.layout === 'centro_categoria') {
    return (
      <div className="space-y-2 px-1 pb-1">
        {(grupo.porCentroCategoria || []).map((centro) => (
          <GrupoCentroCategoriaPlano key={centro.id} centro={centro} explodido />
        ))}
      </div>
    );
  }

  if (grupo.layout === 'vencimento') {
    if (grupo.vazio) {
      return (
        <p className="text-xs md:text-sm text-muted-foreground px-2 py-2">
          Nenhum boleto ou conta ocasional com vencimento neste mês.
        </p>
      );
    }

    return (
      <div className="space-y-2 px-1 pb-1">
        {(grupo.porVencimento || []).map((bloco) => (
          <GrupoDataVencimentoPlano key={bloco.id} bloco={bloco} modo="pauta" explodido />
        ))}
      </div>
    );
  }

  if (grupo.layout === 'lista') {
    if (grupo.vazio) {
      return (
        <p className="text-xs md:text-sm text-muted-foreground px-2 py-2">
          Nenhuma conta anual, bimestral, trimestral ou semestral cadastrada no Planejamento Financeiro
          (aba Contas fixas).
        </p>
      );
    }

    const itensNaoMensais = (grupo.lista || []).flatMap((bloco) => bloco.items || []);
    return (
      <div className="px-1 pb-1">
        <ListaItensPlano items={itensNaoMensais} modo="provisao" explodido />
      </div>
    );
  }

  return null;
}

function SecaoCamadaExplodida({ grupo, agrupamentoFixas, onAgrupamentoFixas }) {
  return (
    <FinanceiroGrupo
      card
      label={grupo.label}
      labelClassName={GRUPO_EXPLODIDO_LABEL}
      despesas={grupo.subtotal}
      liquido={-grupo.subtotal}
      defaultOpen
    >
      <div className="space-y-2">
        {grupo.layout === 'vencimento_ou_centro' ? (
          <div className="px-2 pt-1">
            <ToggleAgrupamentoFixas valor={agrupamentoFixas} onChange={onAgrupamentoFixas} />
          </div>
        ) : null}

        {grupo.separadoDoTotal ? (
          <p className="text-xs md:text-sm text-muted-foreground px-2">
            Provisão ou evento à parte — não entra no total operacional
          </p>
        ) : null}

        {grupo.id === 'pontuais' ? (
          <p className="text-xs md:text-sm text-muted-foreground px-2">
            Boletos e contas ocasionais com vencimento neste mês. Fretes, contas anuais e pedidos de compra
            ficam nos anexos do PDF.
          </p>
        ) : null}

        {grupo.subtotalNoTotal !== grupo.subtotal && grupo.id === 'pontuais' ? (
          <p className="text-xs md:text-sm text-muted-foreground px-2">
            {formatFinanceiroValor(grupo.subtotalNoTotal)} somam ao operacional (itens cobertos por budget e CMV
            ficam só informativos)
          </p>
        ) : null}

        <ConteudoCamadaExplodida grupo={grupo} agrupamentoFixas={agrupamentoFixas} />
      </div>
    </FinanceiroGrupo>
  );
}

function SecoesAnexosPlano({ anexos }) {
  const { contasAnuais, provisoesAnuais, fretesCapacidade } = anexos || {};
  const temAnexos =
    (contasAnuais?.itens?.length || 0) > 0 ||
    (provisoesAnuais?.itens?.length || 0) > 0 ||
    (fretesCapacidade?.itens?.length || 0) > 0 ||
    (fretesCapacidade?.capacidadeCompraBase || 0) > 0;

  if (!temAnexos) return null;

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
        Anexos (detalhe no PDF)
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 items-start">
        {(contasAnuais?.itens?.length || 0) > 0 ? (
          <FinanceiroGrupo
            card
            label="Anexo A — Contas anuais e não mensais"
            labelClassName={GRUPO_EXPLODIDO_LABEL}
            despesas={contasAnuais.totalVencimentoMes}
            liquido={-contasAnuais.totalVencimentoMes}
            defaultOpen={false}
          >
            <div className="px-1 pb-1">
              <ListaItensPlano
                items={contasAnuais.itens.map((item) => ({
                  id: item.id,
                  nome: item.nome,
                  valor: item.valorParcela,
                  detalhe: [item.frequencia, item.dataVencimentoLabel ? `Venc. ${item.dataVencimentoLabel}` : '']
                    .filter(Boolean)
                    .join(' · '),
                }))}
                explodido
              />
            </div>
          </FinanceiroGrupo>
        ) : null}

        {(provisoesAnuais?.itens?.length || 0) > 0 ? (
          <FinanceiroGrupo
            card
            label="Anexo B — Provisões anuais"
            labelClassName={GRUPO_EXPLODIDO_LABEL}
            despesas={provisoesAnuais.totalProvisaoMensal}
            liquido={-provisoesAnuais.totalProvisaoMensal}
            defaultOpen={false}
          >
            <div className="px-1 pb-1">
              <ListaItensPlano
                items={provisoesAnuais.itens.map((item) => ({
                  id: item.id,
                  nome: item.nome,
                  valor: item.provisaoMensal,
                  detalhe: [item.frequencia, `Parcela: ${formatFinanceiroValor(item.valorParcela)}`]
                    .filter(Boolean)
                    .join(' · '),
                }))}
                explodido
              />
            </div>
          </FinanceiroGrupo>
        ) : null}

        {(fretesCapacidade?.itens?.length || 0) > 0 || (fretesCapacidade?.capacidadeCompraBase || 0) > 0 ? (
          <FinanceiroGrupo
            card
            label="Anexo C — Fretes e capacidade de compra"
            labelClassName={GRUPO_EXPLODIDO_LABEL}
            despesas={fretesCapacidade.totalFretes}
            liquido={fretesCapacidade.capacidadeDisponivel}
            defaultOpen={false}
          >
            <div className="space-y-2 px-1 pb-1">
              <p className="text-xs text-muted-foreground px-2">
                Base CMV {formatFinanceiroValor(fretesCapacidade.capacidadeCompraBase)} · Fretes{' '}
                {formatFinanceiroValor(fretesCapacidade.totalFretes)} · Disponível{' '}
                {formatFinanceiroValor(fretesCapacidade.capacidadeDisponivel)}
              </p>
              {(fretesCapacidade.porVencimento || []).map((bloco) => (
                <GrupoDataVencimentoPlano key={bloco.id} bloco={bloco} modo="pauta" explodido />
              ))}
            </div>
          </FinanceiroGrupo>
        ) : null}
      </div>
    </div>
  );
}

function TabelaResumoPlano({ resumo, margemDetalhe }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl p-2 lg:p-3', P38_FIELD_SURFACE)}>
      <table className="w-full min-w-[320px] text-left">
        <thead>
          <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pl-3 pr-3 font-medium">Demonstrativo</th>
            <th className="py-3 pl-3 pr-3 text-right font-medium w-36">Valor</th>
          </tr>
        </thead>
        <tbody>
          <LinhaResumo label="Lucro bruto" valor={resumo.lucroBruto} tipo="soma" destaque />
          {margemDetalhe?.receita_liquida > 0 && (
            <tr className="border-b border-border/20 text-[11px] text-muted-foreground">
              <td className="py-1 pl-4 pr-3" colSpan={2}>
                Receita líq. {formatFinanceiroValor(margemDetalhe.receita_liquida)} · CMV{' '}
                {formatFinanceiroValor(margemDetalhe.custo_total)}
              </td>
            </tr>
          )}

          <tr className="border-b border-border/30">
            <td className="py-2 pl-3 pr-3 text-[11px] uppercase tracking-wide text-muted-foreground" colSpan={2}>
              Despesas planejadas por camada
            </td>
          </tr>
          <LinhaResumo label="Contas fixas (recorrentes)" valor={resumo.fixasRecorrentes} tipo="subtrai" />
          <LinhaResumo label="Folha de pagamento" valor={resumo.folha} tipo="subtrai" />
          <LinhaResumo label="Budgets" valor={resumo.budgets} tipo="subtrai" />
          {resumo.pontuaisExtraPlano > 0 ? (
            <LinhaResumo
              label="Pauta do mês (fora do plano fixo)"
              valor={resumo.pontuaisExtraPlano}
              tipo="subtrai"
              sublabel={`${formatFinanceiroValor(resumo.pontuais)} no total de vencimentos do mês`}
            />
          ) : null}
          <LinhaResumo label="Total operacional" valor={resumo.totalOperacional} tipo="subtrai" destaque />
          <LinhaResumo
            label="Resultado operacional"
            valor={resumo.resultadoOperacional}
            tipo="resultado"
            destaque
          />

          {resumo.provisoesFolha > 0 ? (
            <>
              <tr className="border-b border-border/30">
                <td className="py-2 pl-3 pr-3 text-[11px] uppercase tracking-wide text-muted-foreground" colSpan={2}>
                  Provisões de folha
                </td>
              </tr>
              <LinhaResumo label="Provisões de folha" valor={resumo.provisoesFolha} tipo="subtrai" />
              <LinhaResumo
                label="Total com provisões de folha"
                valor={resumo.totalComProvisoes}
                tipo="subtrai"
                destaque
              />
              <LinhaResumo
                label="Resultado com provisões de folha"
                valor={resumo.resultadoComProvisoes}
                tipo="resultado"
                destaque
              />
            </>
          ) : null}

          {resumo.pontuais > 0 ? (
            <>
              <tr className="border-b border-border/30">
                <td
                  className="py-2 pl-3 pr-3 text-[11px] uppercase tracking-wide text-muted-foreground"
                  colSpan={2}
                >
                  Desembolso conhecido no mês
                </td>
              </tr>
              <LinhaResumo label="Pauta do mês (boletos e ocasionais)" valor={resumo.pontuais} tipo="subtrai" />
              <LinhaResumo label="Total desembolso" valor={resumo.totalDesembolsoMes} tipo="subtrai" destaque />
              <LinhaResumo
                label="Saldo após compromissos conhecidos"
                valor={resumo.resultadoDesembolso}
                tipo="resultado"
                destaque
              />
            </>
          ) : null}

          <LinhaResumo
            label="Realizado no fluxo (referência)"
            valor={resumo.resultadoRealizado}
            tipo="resultado"
            sublabel="Lucro bruto menos despesas já pagas"
          />
        </tbody>
      </table>
    </div>
  );
}

export default function VisaoFinanceiraPlano() {
  const [competencia, setCompetencia] = useState(getCompetenciaAtual);
  const [modo, setModo] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches
      ? 'explodido'
      : 'resumo',
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [agrupamentoFixas, setAgrupamentoFixas] = useState('vencimento');

  const { data: modelosAgefin = [], isLoading: loadingAgefin } = useQuery({
    queryKey: ['agefin-previsao', 'modelos'],
    queryFn: listarModelosAgefin,
    staleTime: 30_000,
  });

  const { data: lancamentosRecorrentesAgefin = [], isLoading: loadingRecorrentesAgefin } = useQuery({
    queryKey: ['agefin-previsao', 'lancamentos-recorrentes'],
    queryFn: listarLancamentosRecorrentes,
    staleTime: 60_000,
  });

  const { data: parcelamentosAgefin = [], isLoading: loadingParcelamentosAgefin } = useQuery({
    queryKey: ['agefin-previsao', 'parcelamentos'],
    queryFn: listarParcelamentos,
    staleTime: 60_000,
  });

  const { data: modelosFolha = [], isLoading: loadingFolha } = useQuery({
    queryKey: ['visao-financeira', 'folha-modelos'],
    queryFn: listarModelosFolha,
    staleTime: 60_000,
  });

  const { data: modelosBudget = [], isLoading: loadingBudget } = useQuery({
    queryKey: ['visao-financeira', 'budget-modelos'],
    queryFn: listarModelosBudget,
    staleTime: 60_000,
  });

  const { data: competenciasFolha = [], isLoading: loadingCompetenciasFolha } = useQuery({
    queryKey: ['visao-financeira', 'folha-competencias', competencia],
    queryFn: () => listarCompetenciasFolha(competencia),
    staleTime: 30_000,
  });

  const { data: competenciasBudget = [], isLoading: loadingCompetenciasBudget } = useQuery({
    queryKey: ['visao-financeira', 'budget-competencias', competencia],
    queryFn: () => listarCompetenciasBudget(competencia),
    staleTime: 30_000,
  });

  const { data: lancamentosAgefin = [], isLoading: loadingLancamentosAgefin } = useQuery({
    queryKey: ['visao-financeira', 'agefin-lancamentos', competencia],
    queryFn: () => listarLancamentosCompetencia(competencia),
    staleTime: 60_000,
  });

  const { data: lancamentosMes = [], isLoading: loadingLancamentosMes } = useQuery({
    queryKey: ['visao-financeira', 'lancamentos-mes', competencia],
    queryFn: () => listarLancamentosMes(competencia),
    staleTime: 60_000,
  });

  const { data: lancamentosVencimento = [], isLoading: loadingLancamentosVencimento } = useQuery({
    queryKey: ['visao-financeira', 'lancamentos-vencimento', competencia],
    queryFn: () => listarLancamentosVencimentoMes(competencia),
    staleTime: 60_000,
  });

  const { data: lucroBrutoMes, isLoading: loadingLucroBruto } = useLucroBrutoCompetencia(competencia);

  const plano = useMemo(
    () =>
      montarPlanoFinanceiroConsolidado({
        competencia,
        modelosAgefin,
        lancamentosAgefin,
        modelosFolha,
        competenciasFolha,
        modelosBudget,
        competenciasBudget,
        lancamentosMes,
        lancamentosVencimento,
        lancamentosRecorrentesAgefin,
        parcelamentosAgefin,
        lucroBruto: lucroBrutoMes?.lucro_bruto || 0,
        margemDetalhe: lucroBrutoMes,
      }),
    [
      competencia,
      modelosAgefin,
      lancamentosAgefin,
      modelosFolha,
      competenciasFolha,
      modelosBudget,
      competenciasBudget,
      lancamentosMes,
      lancamentosVencimento,
      lancamentosRecorrentesAgefin,
      parcelamentosAgefin,
      lucroBrutoMes,
    ],
  );

  const loading =
    loadingAgefin ||
    loadingFolha ||
    loadingBudget ||
    loadingCompetenciasFolha ||
    loadingCompetenciasBudget ||
    loadingLancamentosAgefin ||
    loadingRecorrentesAgefin ||
    loadingParcelamentosAgefin ||
    loadingLancamentosMes ||
    loadingLancamentosVencimento;
  const lucroBrutoCarregando = loadingLucroBruto && !lucroBrutoMes;
  const { resumo } = plano;
  const compLabel = formatCompetenciaLabel(competencia);

  const handleGerarPdf = async () => {
    if (loading || !plano.grupos.length || gerandoPdf) return;
    setGerandoPdf(true);
    toast.loading('Gerando PDF da visão financeira...', { id: 'pdf-visao-financeira' });
    try {
      const resposta = await gerarRelatorioVisaoFinanceira({
        competencia,
        competenciaLabel: compLabel,
        resumo,
        margemDetalhe: plano.margemDetalhe,
        grupos: plano.grupos,
        anexos: plano.anexos,
        opcoesExplodido: { agrupamentoFixas },
      });
      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `RelatorioVisaoFinanceira_enxuto_${competencia}_${dataHoje()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('PDF da visão financeira gerado', { id: 'pdf-visao-financeira' });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o PDF', {
        id: 'pdf-visao-financeira',
        description: error?.message || String(error),
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">Visão ampla do negócio</h2>
            <P38HelpPopover label="Ajuda: visão ampla" size="sm">
              <p className="text-muted-foreground">
                A pauta do mês traz boletos e contas ocasionais com vencimento na competência. Fretes,
                contas anuais e capacidade de compra ficam nos anexos do PDF.
              </p>
              <p className="text-muted-foreground mt-2">
                Provisões de 13º e férias ficam resumidas — expanda para ver por colaborador.
              </p>
            </P38HelpPopover>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planejamento consolidado — {compLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl gap-1.5"
            disabled={loading || !plano.grupos.length || gerandoPdf}
            onClick={handleGerarPdf}
          >
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>PDF enxuto</span>
          </Button>

          <div className={cn('flex items-center rounded-xl p-1', P38_FIELD_SURFACE)}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCompetencia((c) => shiftCompetencia(c, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium tabular-nums min-w-[5.5rem] text-center">{compLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCompetencia((c) => shiftCompetencia(c, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className={cn('flex rounded-xl p-1', P38_FIELD_SURFACE)}>
            <button
              type="button"
              onClick={() => setModo('resumo')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                modo === 'resumo' ? 'bg-background shadow-sm text-foreground' : P38_CHIP_INACTIVE,
              )}
            >
              <PieChart className="h-3.5 w-3.5" />
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setModo('explodido')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                modo === 'explodido' ? 'bg-background shadow-sm text-foreground' : P38_CHIP_INACTIVE,
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Explodido
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <FinanceiroListaEstado loading />
      ) : plano.grupos.every((g) => !(g.items || []).length) ? (
        <FinanceiroListaEstado
          vazio
          vazioMensagem="Cadastre contas fixas, folha, budgets ou contas a pagar para ver a consolidação."
        />
      ) : modo === 'resumo' ? (
        <TabelaResumoPlano resumo={resumo} margemDetalhe={plano.margemDetalhe} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 items-start">
            {plano.grupos.map((grupo) => (
              <SecaoCamadaExplodida
                key={grupo.id}
                grupo={grupo}
                agrupamentoFixas={agrupamentoFixas}
                onAgrupamentoFixas={setAgrupamentoFixas}
              />
            ))}
          </div>
          <SecoesAnexosPlano anexos={plano.anexos} />
          <TabelaResumoPlano resumo={resumo} margemDetalhe={plano.margemDetalhe} />
        </div>
      )}
    </div>
  );
}
