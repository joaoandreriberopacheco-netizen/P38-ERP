import { useMemo } from 'react';
import { Repeat2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import AgefinPrevisaoCabecalho from '@/components/agefin-previsao/AgefinPrevisaoCabecalho';
import AgefinPrevisaoFiltros from '@/components/agefin-previsao/AgefinPrevisaoFiltros';
import AgefinPrevisaoLista from '@/components/agefin-previsao/AgefinPrevisaoLista';
import AgefinConsultaOrganizer from '@/components/agefin/AgefinConsultaOrganizer';
import {
  calcularTotaisGrupo,
  formatCompetenciaLabel,
  mapaModelosPorId,
  filtrarCompetenciasPrevisao,
  agruparCompetenciasPrevisao,
  isCompetenciaFutura,
  isCompetenciaPlanejamento,
} from '@/lib/agefinPrevisaoCalculos';
import { montarCompetenciasVisaoComParcelas } from '@/lib/agefinParcelamentoCalculos';

export default function PrevisaoMesTab({
  competenciaMes,
  onMesAnterior,
  onMesProximo,
  onAbrirMes,
  onDesfazerAbrirMes,
  saving,
  loading,
  modelos,
  lancamentosMes,
  parcelamentos,
  lancamentosRecorrentes = [],
  filtroBusca,
  onBuscaChange,
  filtroCentro,
  onCentroChange,
  centrosRegistrados,
  groupBy,
  sortOrder,
  onGroupByChange,
  onSortOrderToggle,
  onOpenCompetencia,
  onNovoLancamento,
}) {
  const modelosMap = useMemo(() => mapaModelosPorId(modelos), [modelos]);

  const competenciasVisao = useMemo(
    () =>
      montarCompetenciasVisaoComParcelas(
        competenciaMes,
        modelos,
        lancamentosMes,
        parcelamentos,
        lancamentosRecorrentes,
      ),
    [competenciaMes, modelos, lancamentosMes, parcelamentos, lancamentosRecorrentes],
  );

  const competenciasExibidas = useMemo(
    () => filtrarCompetenciasPrevisao(competenciasVisao, { busca: filtroBusca, centro: filtroCentro }),
    [competenciasVisao, filtroBusca, filtroCentro],
  );

  const gruposExibicao = useMemo(
    () => agruparCompetenciasPrevisao(competenciasExibidas, groupBy, sortOrder, modelosMap),
    [competenciasExibidas, groupBy, sortOrder, modelosMap],
  );

  const qtdPlanejamento = useMemo(
    () => competenciasExibidas.filter((c) => isCompetenciaPlanejamento(c)).length,
    [competenciasExibidas],
  );

  const totaisGrupo = useMemo(
    () => calcularTotaisGrupo(competenciasExibidas, modelosMap),
    [competenciasExibidas, modelosMap],
  );

  const hasLancamentosMes = lancamentosMes.length > 0;
  const mesFuturo = isCompetenciaFutura(competenciaMes);
  const semFiltros = !filtroBusca && filtroCentro === '__todos__';

  return (
    <div className="space-y-3 min-w-0">
      <AgefinPrevisaoCabecalho
        competenciaMes={competenciaMes}
        onMesAnterior={onMesAnterior}
        onMesProximo={onMesProximo}
        onAbrirMes={onAbrirMes}
        onDesfazerAbrirMes={onDesfazerAbrirMes}
        saving={saving}
        hasLancamentosMes={hasLancamentosMes}
        mesFuturo={mesFuturo}
        totais={totaisGrupo}
        count={totaisGrupo.count}
        countPlanejamento={qtdPlanejamento}
      />

      <AgefinPrevisaoFiltros
        busca={filtroBusca}
        onBuscaChange={onBuscaChange}
        centro={filtroCentro}
        onCentroChange={onCentroChange}
        centrosRegistrados={centrosRegistrados}
        organizer={
          <AgefinConsultaOrganizer
            variant="previsao"
            groupBy={groupBy}
            sortOrder={sortOrder}
            onGroupByChange={onGroupByChange}
            onSortOrderToggle={onSortOrderToggle}
          />
        }
      />

      <FinanceiroListaEstado
        loading={loading}
        vazio={!loading && competenciasExibidas.length === 0}
        vazioMensagem={
          !semFiltros
            ? 'Nenhuma conta encontrada com estes filtros.'
            : `Nenhuma despesa recorrente para ${formatCompetenciaLabel(competenciaMes)}. Cadastre pelo botão +.`
        }
        vazioIcon={Repeat2}
      >
        <div className="p38-single-sheet">
          <AgefinPrevisaoLista
            grupos={gruposExibicao}
            competencias={competenciasExibidas}
            modelosMap={modelosMap}
            onOpen={onOpenCompetencia}
          />
        </div>
      </FinanceiroListaEstado>

      {!loading && competenciasExibidas.length === 0 && semFiltros && (
        <div className="flex justify-center -mt-6 pb-4 gap-2 px-1">
          <Button variant="outline" className="w-full max-w-xs" onClick={onNovoLancamento}>
            Nova conta fixa
          </Button>
        </div>
      )}
    </div>
  );
}
