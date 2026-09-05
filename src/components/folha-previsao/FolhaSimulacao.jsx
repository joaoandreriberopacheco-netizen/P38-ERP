import React, { useMemo, useState } from 'react';
import { FileDown, Loader2, RotateCcw, Scissors, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import { FinanceiroKpiItem, FinanceiroKpiStrip } from '@/components/financeiro/fluxo/FinanceiroKpiInline';
import { P38_KPI_SHELL } from '@/components/financeiro/fluxo/financeiroP38';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import {
  calcularProjecaoPessoaFolha,
  getCompetenciaAtual,
  ordenarPessoasFolhaPorCentroENome,
} from '@/lib/folhaPrevisaoCalculos';
import {
  atualizarAjusteSimulacao,
  calcularComparativoSimulacaoFolha,
  montarModelosSimulacao,
} from '@/lib/folhaSimulacaoCalculos';
import { generateFolhaPessoasPorCentroPdf } from '@/lib/folhaPessoasPorCentroPdf';
import { shareOrDownloadBlob } from '@/lib/mobilePrintAndShare';
import SimulacaoPessoaRow from '@/components/folha-previsao/FolhaSimulacaoPessoaRow';

export default function FolhaSimulacao({
  modelos = [],
  centrosRegistrados = [],
  colaboradoresMap = {},
  loading = false,
}) {
  const { toast } = useToast();
  const [ajustes, setAjustes] = useState({});
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const pessoasBase = useMemo(
    () =>
      ordenarPessoasFolhaPorCentroENome(
        (modelos || []).filter((m) => m.colaborador_id && m.ativo !== false),
        colaboradoresMap,
      ),
    [modelos, colaboradoresMap],
  );

  const centrosRegistradosSet = useMemo(
    () => new Set(centrosRegistrados.map((c) => c.toLocaleLowerCase('pt-BR'))),
    [centrosRegistrados],
  );

  const pessoasPorCentro = useMemo(() => {
    const mapa = {};
    for (const pessoa of pessoasBase) {
      const centro = String(pessoa.centro_custo || '').trim();
      const chave =
        centro && centrosRegistradosSet.has(centro.toLocaleLowerCase('pt-BR')) ? centro : '__sem__';
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(pessoa);
    }
    return mapa;
  }, [pessoasBase, centrosRegistradosSet]);

  const comparativo = useMemo(
    () =>
      calcularComparativoSimulacaoFolha({
        modelos: pessoasBase,
        centrosRegistrados,
        colaboradoresMap,
        ajustesPorId: ajustes,
        competenciaInicio: getCompetenciaAtual(),
      }),
    [pessoasBase, centrosRegistrados, colaboradoresMap, ajustes],
  );

  const mediasPorId = useMemo(() => {
    const inicio = getCompetenciaAtual();
    const mapa = {};
    for (const pessoa of pessoasBase) {
      mapa[pessoa.id] = calcularProjecaoPessoaFolha(pessoa, 12, inicio).mediaMensal;
    }
    const simulados = montarModelosSimulacao(pessoasBase, ajustes);
    for (const pessoa of simulados) {
      const origem = pessoasBase.find((p) => p.id === pessoa.id);
      if (!origem) continue;
      mapa[`${origem.id}__depois`] = calcularProjecaoPessoaFolha(pessoa, 12, inicio).mediaMensal;
    }
    return mapa;
  }, [pessoasBase, ajustes]);

  const temAjustes = Object.keys(ajustes).length > 0;

  const handleLimpar = () => {
    setAjustes({});
    toast({ title: 'Simulação limpa', description: 'Voltou ao cenário real da folha.' });
  };

  const handleGerarPdf = async () => {
    if (!comparativo.depois.secoes.length) {
      toast({
        title: 'Ninguém restou',
        description: 'Mantenha ao menos uma pessoa na simulação para gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    setGerandoPdf(true);
    try {
      const blob = await generateFolhaPessoasPorCentroPdf({
        relatorio: comparativo.depois,
        titulo: 'Folha — Simulação de cortes',
        avisoSimulacao: true,
        comparativo: {
          totalAntes: comparativo.antes.resumo.totalMediaMensal,
          economiaMensal: comparativo.economiaMensal,
          pessoasCortadas: comparativo.pessoasCortadas,
          pessoasAntes: comparativo.antes.resumo.totalPessoas,
          pessoasDepois: comparativo.depois.resumo.totalPessoas,
        },
      });
      const data = new Date().toISOString().slice(0, 10);
      const result = await shareOrDownloadBlob(
        blob,
        `folha_simulacao_${data}.pdf`,
        'application/pdf',
        'Folha — Simulação de cortes',
      );
      if (result !== 'aborted') {
        toast({
          title: result === 'shared' ? 'PDF compartilhado' : 'PDF gerado',
          description: `${comparativo.depois.resumo.totalPessoas} pessoa(s) no cenário simulado.`,
        });
      }
    } catch (e) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm',
          P38_FIELD_SURFACE,
        )}
      >
        <p className="font-medium text-foreground">Modo simulação</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          Edite salários e retiradas, teste cortes e veja o impacto — sem alterar o cadastro real. Ao sair desta aba, tudo é descartado.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleLimpar}
            disabled={!temAjustes}
          >
            <RotateCcw className="h-4 w-4" />
            Limpar simulação
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleGerarPdf}
            disabled={gerandoPdf || loading || pessoasBase.length === 0}
          >
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {gerandoPdf ? 'Gerando…' : 'PDF resultado'}
          </Button>
        </div>
        <P38HelpPopover label="Ajuda: simulação de cortes" side="bottom" align="end">
          <p className="font-medium text-foreground">Como simular</p>
          <p className="text-muted-foreground">
            Edite o <strong className="text-foreground">salário base</strong> ou a <strong className="text-foreground">retirada</strong> como na previsão do mês. Use <strong className="text-foreground">Cortar</strong> para remover alguém do cenário.
          </p>
          <p className="text-muted-foreground">
            O PDF lista apenas quem ficou, com média mensal em 12 meses e totais por centro de custo.
          </p>
        </P38HelpPopover>
      </div>

      <div className={cn(P38_KPI_SHELL, 'space-y-2')}>
        <FinanceiroKpiStrip>
          <FinanceiroKpiItem label="Média mensal antes" value={formatFinanceiroValor(comparativo.antes.resumo.totalMediaMensal)} />
          <FinanceiroKpiItem
            label="Média mensal depois"
            value={formatFinanceiroValor(comparativo.depois.resumo.totalMediaMensal)}
            tone={comparativo.temAlteracao ? 'warning' : 'default'}
          />
          <FinanceiroKpiItem
            label="Economia mensal"
            value={formatFinanceiroValor(comparativo.economiaMensal)}
            tone={comparativo.economiaMensal > 0 ? 'success' : 'default'}
          />
          <FinanceiroKpiItem
            label="Pessoas"
            value={`${comparativo.antes.resumo.totalPessoas} → ${comparativo.depois.resumo.totalPessoas}`}
          />
        </FinanceiroKpiStrip>
        <FinanceiroListaMeta>
          {comparativo.pessoasCortadas > 0 && (
            <FinanceiroSummaryChip className="text-red-800 dark:text-red-300">
              <UserMinus className="w-3 h-3 mr-1 inline" />
              {comparativo.pessoasCortadas} cortada(s)
            </FinanceiroSummaryChip>
          )}
          {comparativo.depois.resumo.totalDecimo > 0 && (
            <FinanceiroSummaryChip>13º {formatFinanceiroValor(comparativo.depois.resumo.totalDecimo)}</FinanceiroSummaryChip>
          )}
          {comparativo.depois.resumo.totalFerias > 0 && (
            <FinanceiroSummaryChip>Férias {formatFinanceiroValor(comparativo.depois.resumo.totalFerias)}</FinanceiroSummaryChip>
          )}
          {!comparativo.temAlteracao && (
            <FinanceiroSummaryChip className="text-muted-foreground">Nenhum ajuste aplicado</FinanceiroSummaryChip>
          )}
        </FinanceiroListaMeta>
      </div>

      <FinanceiroListaEstado
        loading={loading}
        loadingMessage="Carregando simulação da folha…"
        vazio={!loading && pessoasBase.length === 0}
        vazioMensagem="Cadastre pessoas na aba Pessoas para simular cortes."
        vazioIcon={Scissors}
      >
        <div className="space-y-3">
          {[...centrosRegistrados, '__sem__'].map((centro) => {
            const chave = centro || '__sem__';
            const pessoas = pessoasPorCentro[chave] || [];
            if (!pessoas.length) return null;
            const centroLabel = chave === '__sem__' ? 'Sem centro de custo' : centro;
            return (
              <div key={chave} className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{centroLabel}</p>
                  <span className="text-xs text-muted-foreground">
                    {pessoas.filter((p) => !ajustes[p.id]?.removido).length}/{pessoas.length} ativas
                  </span>
                </div>
                <P38MobileLineList className="block md:!block rounded-none">
                  {pessoas.map((pessoa, idx) => (
                    <SimulacaoPessoaRow
                      key={pessoa.id}
                      modelo={pessoa}
                      colaborador={colaboradoresMap[pessoa.colaborador_id]}
                      ajuste={ajustes[pessoa.id]}
                      mediaAntes={mediasPorId[pessoa.id] || 0}
                      mediaDepois={mediasPorId[`${pessoa.id}__depois`] ?? mediasPorId[pessoa.id] ?? 0}
                      onToggleCorte={(checked) => {
                        setAjustes((prev) =>
                          atualizarAjusteSimulacao(
                            prev,
                            pessoa.id,
                            { removido: checked },
                            pessoa,
                          ),
                        );
                      }}
                      onSalarioChange={(valor) => {
                        setAjustes((prev) =>
                          atualizarAjusteSimulacao(
                            prev,
                            pessoa.id,
                            { salarioBase: parseFloat(valor) || 0, removido: false },
                            pessoa,
                          ),
                        );
                      }}
                      onRetiradaChange={(valor) => {
                        setAjustes((prev) =>
                          atualizarAjusteSimulacao(
                            prev,
                            pessoa.id,
                            { retiradaValor: parseFloat(valor) || 0, removido: false },
                            pessoa,
                          ),
                        );
                      }}
                      striped={idx % 2 === 1}
                    />
                  ))}
                </P38MobileLineList>
              </div>
            );
          })}
        </div>
      </FinanceiroListaEstado>
    </div>
  );
}
