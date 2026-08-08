import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import AtualizarPrecosDialog from '@/components/compras/AtualizarPrecosDialog';
import {
  collectItensAtualizarPrecosFiltrados,
  coletarProdutoIdsDosItens,
  deduplicarItensAtualizarPrecosPorProduto,
} from '@/lib/collectItensAtualizarPrecosFiltrados';
import { agruparItensAtualizarPrecos } from '@/lib/agruparItensAtualizarPrecos';
import { formatarSoData } from '@/components/utils/dateUtils';

const AGRUPAMENTO_OPCOES = [
  { value: 'alfabetica', label: 'Alfabética' },
  { value: 'pedido', label: 'Por pedido' },
  { value: 'fornecedor', label: 'Por fornecedor' },
  { value: 'eta', label: 'Por ETA' },
];

async function carregarProdutosMap(ids = []) {
  const produtosMap = {};
  if (!ids.length) return produtosMap;

  try {
    const rows = await base44.entities.Produto.filter({ id: ids });
    (rows || []).forEach((p) => {
      if (p?.id) produtosMap[p.id] = p;
    });
  } catch {
    const chunkSize = 25;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      const batch = await Promise.all(slice.map((id) => base44.entities.Produto.get(id).catch(() => null)));
      batch.filter(Boolean).forEach((p) => {
        produtosMap[p.id] = p;
      });
    }
  }

  return produtosMap;
}

function buildSubtituloItem(item, agrupamento) {
  const partes = [];
  if (agrupamento !== 'pedido' && item._pedido_numero) partes.push(item._pedido_numero);
  if (agrupamento !== 'fornecedor' && item._fornecedor_nome) partes.push(item._fornecedor_nome);
  if (agrupamento !== 'eta' && item._eta) partes.push(`ETA ${formatarSoData(item._eta)}`);
  return partes.join(' · ');
}

export default function AtualizarPrecosFiltradosDialog({
  isOpen,
  onClose,
  pedidosFiltrados = [],
}) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [itensBrutos, setItensBrutos] = useState([]);
  const [agrupamento, setAgrupamento] = useState('alfabetica');

  useEffect(() => {
    if (!isOpen) {
      setProdutos([]);
      setItensBrutos([]);
      setAgrupamento('alfabetica');
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const brutos = await collectItensAtualizarPrecosFiltrados(base44, pedidosFiltrados);
        if (cancelled) return;

        if (!brutos.length) {
          toast({
            title: 'Nenhum item nos pedidos filtrados',
            description: 'Ajuste os filtros ou confirme se os pedidos têm itens migrados em SQL.',
          });
          onClose?.(false);
          return;
        }

        setItensBrutos(brutos);
        const dedup = deduplicarItensAtualizarPrecosPorProduto(brutos);
        const ids = coletarProdutoIdsDosItens(dedup);
        const map = await carregarProdutosMap(ids);
        if (!cancelled) {
          setProdutos(Object.values(map));
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Erro ao carregar itens',
            description: error?.message || 'Tente novamente',
            variant: 'destructive',
          });
          onClose?.(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, pedidosFiltrados, onClose]);

  const itensDedup = useMemo(
    () => deduplicarItensAtualizarPrecosPorProduto(itensBrutos),
    [itensBrutos],
  );

  const itensOrdenados = useMemo(() => {
    const grupos = agruparItensAtualizarPrecos(
      itensDedup.map((item) => ({ ...item, produto_nome: item.produto_nome || 'Produto' })),
      agrupamento,
    );
    return grupos.flatMap((g) => g.items);
  }, [itensDedup, agrupamento]);

  const gruposResumo = useMemo(() => {
    return agruparItensAtualizarPrecos(
      itensDedup.map((item) => ({ ...item, produto_nome: item.produto_nome || 'Produto' })),
      agrupamento,
    );
  }, [itensDedup, agrupamento]);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
        <div className="flex items-center gap-3 rounded-xl bg-card px-6 py-4 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-foreground">Carregando itens SQL dos pedidos filtrados…</span>
        </div>
      </div>
    );
  }

  if (!itensDedup.length) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[61] flex justify-center pointer-events-none px-4 pt-20">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-card border border-border/50 shadow-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">Agrupar visualização</p>
          <div className="flex flex-wrap gap-2">
            {AGRUPAMENTO_OPCOES.map((op) => (
              <Button
                key={op.value}
                type="button"
                size="sm"
                variant={agrupamento === op.value ? 'default' : 'outline'}
                className="h-8 text-xs rounded-xl"
                onClick={() => setAgrupamento(op.value)}
              >
                {op.label}
              </Button>
            ))}
          </div>
          {agrupamento !== 'alfabetica' && gruposResumo.length > 0 && (
            <p className="text-[11px] text-muted-foreground px-1">
              {gruposResumo.length} grupo{gruposResumo.length === 1 ? '' : 's'}
              {' · '}
              {itensDedup.length} produto{itensDedup.length === 1 ? '' : 's'} únicos
              {itensBrutos.length > itensDedup.length
                ? ` (${itensBrutos.length} linhas nos pedidos)`
                : ''}
            </p>
          )}
        </div>
      </div>

      <AtualizarPrecosDialog
        isOpen={isOpen}
        onClose={onClose}
        itens={itensOrdenados}
        produtos={produtos}
        titulo="Atualizar preços — pedidos filtrados"
        subtitulo={`${pedidosFiltrados.length} pedido(s) · ${itensDedup.length} produto(s) · fonte SQL`}
        getItemSubtitulo={(item) => buildSubtituloItem(item, agrupamento)}
        secoesAgrupamento={agrupamento !== 'alfabetica' ? gruposResumo : null}
      />
    </>
  );
}
