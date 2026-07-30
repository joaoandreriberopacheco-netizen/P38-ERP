import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import AgefinPrevisaoProjecao from '@/components/agefin-previsao/AgefinPrevisaoProjecao';

export default function ProjecaoTab({
  loading,
  modelos,
  competenciaMes,
  lancamentosRecorrentes,
  onNovoLancamento,
}) {
  const semModelos = !loading && modelos.filter((m) => m.ativo !== false).length === 0;

  return (
    <div className="space-y-3 min-w-0">
      <FinanceiroListaEstado
        loading={loading}
        vazio={semModelos}
        vazioMensagem="Cadastre contas fixas pelo botão + para ver a projeção de 12 meses."
        vazioIcon={TrendingUp}
      >
        <div className="p38-single-sheet">
          <div className="p38-sheet-block">
            <AgefinPrevisaoProjecao
              modelos={modelos}
              competenciaInicio={competenciaMes}
              lancamentos={lancamentosRecorrentes}
            />
          </div>
        </div>
      </FinanceiroListaEstado>

      {semModelos && (
        <div className="flex justify-center -mt-6 pb-4 px-1">
          <Button variant="outline" className="w-full max-w-xs" onClick={onNovoLancamento}>
            Nova conta fixa
          </Button>
        </div>
      )}
    </div>
  );
}
