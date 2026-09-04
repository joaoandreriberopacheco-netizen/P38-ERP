import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { formatCountQuantity } from '@/lib/inventoryCountUnits';
import { agregarContagensPorProduto, extrairReferenciaSessao, resumoSessaoConcluida } from '@/lib/contagemExpressSessao';
import { reimprimirRelatorioSessaoContagemExpress } from '@/lib/contagemExpressReport';

function ProdutoRow({ nome, quantidade, unidade, meta, striped }) {
  return (
    <div
      className={cn(
        p38Table.mobileLineThin,
        'flex min-w-0 border-l-primary/55',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <div className="relative w-[3.25rem] flex-shrink-0 border-r border-border/40 pr-1.5 py-2.5 text-right">
        <p className="text-base font-din-1451 tabular-nums text-foreground leading-none">
          {formatCountQuantity(quantidade)}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5 leading-none truncate">
          {(unidade || 'UN').toUpperCase()}
        </p>
      </div>
      <div className="flex-1 min-w-0 py-2 pr-3 pl-2">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug')}>{nome}</p>
        {meta && <p className="text-xs text-muted-foreground mt-1">{meta}</p>}
      </div>
    </div>
  );
}

export default function ContagemExpressConsultaTotal({ sessoes = [], produtos = [] }) {
  const [modo, setModo] = useState('comprovante');
  const [imprimindoId, setImprimindoId] = useState(null);

  const handleImprimirSessao = async (sessao) => {
    if (imprimindoId) return;
    setImprimindoId(sessao.id);
    try {
      await reimprimirRelatorioSessaoContagemExpress({ base44, sessao, produtos });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível reimprimir o relatório.');
    }
    setImprimindoId(null);
  };

  const produtosAgregados = useMemo(
    () => agregarContagensPorProduto(sessoes, produtos),
    [sessoes, produtos],
  );

  const sessoesOrdenadas = useMemo(
    () => [...sessoes].sort((a, b) => {
      const da = a.data_fim || a.created_date || '';
      const db = b.data_fim || b.created_date || '';
      return db.localeCompare(da);
    }),
    [sessoes],
  );

  if (sessoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma contagem concluída no período</p>
      </div>
    );
  }

  const totalProdutos = produtosAgregados.length;
  const totalSessoes = sessoes.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Totais do período</p>
          <p className="text-lg font-semibold font-din-1451 text-foreground">
            {totalSessoes} contagem{totalSessoes === 1 ? '' : 'ens'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalProdutos} produto{totalProdutos === 1 ? '' : 's'} distintos
          </p>
        </div>
        <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => setModo('produto')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por produto
          </button>
          <button
            type="button"
            onClick={() => setModo('comprovante')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${modo === 'comprovante' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por comprovante
          </button>
        </div>
      </div>

      {modo === 'produto' ? (
        <P38MobileLineList allViewports className="rounded-lg">
          {produtosAgregados.map((p, index) => (
            <ProdutoRow
              key={p.key}
              nome={p.nome}
              quantidade={p.quantidade}
              unidade={p.unidade}
              meta={`${p.entradas} entrada${p.entradas === 1 ? '' : 's'}`}
              striped={index % 2 === 1}
            />
          ))}
        </P38MobileLineList>
      ) : (
        <div className="space-y-3">
          {sessoesOrdenadas.map((sessao) => {
            const { produtos: qtdProd, itens, linhas } = resumoSessaoConcluida(sessao, produtos);
            const data = sessao.data_fim || sessao.created_date;
            const dataFmt = data
              ? format(new Date(data), "dd/MM/yy HH:mm", { locale: ptBR })
              : '';
            const numeroMovimento = extrairReferenciaSessao(sessao);

            const imprimindo = imprimindoId === sessao.id;

            return (
              <div key={sessao.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleImprimirSessao(sessao)}
                  disabled={imprimindo}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`${p38Table.mobileLineTitle} truncate`}>
                      {numeroMovimento || 'Contagem Express'}
                    </p>
                    <p className={`${p38Table.mobileLineSubtitle} mt-1 truncate`}>
                      {sessao.responsavel_nome || 'Operador'}
                      {dataFmt ? ` · ${dataFmt}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {qtdProd} prod. · {itens} ent.
                    </p>
                  </div>
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                    {imprimindo
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Printer className="h-4 w-4" />}
                  </span>
                </button>
                <P38MobileLineList allViewports className="rounded-none border-0">
                  {linhas.map((linha, idx) => (
                    <ProdutoRow
                      key={`${sessao.id}-${linha.produto_id}`}
                      nome={linha.produto_nome}
                      quantidade={linha.quantidade}
                      unidade={linha.unidade}
                      striped={idx % 2 === 1}
                    />
                  ))}
                </P38MobileLineList>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
