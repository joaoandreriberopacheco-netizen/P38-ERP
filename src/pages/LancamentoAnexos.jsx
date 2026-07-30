import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import AnexosPanelIntegrado from '@/components/anexos/AnexosPanelIntegrado';
import { brandSurface } from '@/lib/brandSurfaces';

/**
 * Abre diretamente o painel de anexos de um LancamentoFinanceiro (ex.: após partilha → vincular).
 */
export default function LancamentoAnexos() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) {
      setCarregando(false);
      setErro('Lançamento não informado.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const lista = await base44.entities.LancamentoFinanceiro.filter({ id });
        const l = lista?.[0];
        if (!cancelled) {
          if (l) setTitulo(l.descricao || l.id);
          else setErro('Lançamento não encontrado.');
        }
      } catch (e) {
        if (!cancelled) setErro(e?.message || 'Não foi possível carregar o lançamento.');
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const voltar = () => {
    window.location.href = createPageUrl('FluxoCaixa');
  };

  if (!id) {
    return (
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 ${brandSurface.pageScreen}`}>
        <p className={`text-sm ${brandSurface.textMuted}`}>Parâmetro id ausente.</p>
        <button
          type="button"
          onClick={voltar}
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Ir para Fluxo de Caixa
        </button>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-[100dvh] flex-col ${brandSurface.pageScreen}`}>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-5 md:px-5">
        <button
          type="button"
          onClick={voltar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground dark:text-foreground">Anexos do lançamento</h1>
          {carregando ? (
            <p className={`mt-0.5 flex items-center gap-2 text-xs ${brandSurface.textLabel}`}>
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </p>
          ) : (
            <p className={`mt-0.5 truncate text-xs uppercase tracking-wide ${brandSurface.textLabel}`}>{titulo || id}</p>
          )}
        </div>
      </div>

      {erro && (
        <div className="mx-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 md:mx-5">
          {erro}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <AnexosPanelIntegrado
          referencias={[
            {
              referencia_tipo: 'LancamentoFinanceiro',
              referencia_id: id,
              label: 'Protocolo',
            },
          ]}
          referenciaNomero={titulo}
          initialModalOpen
          onModalClose={voltar}
        />
      </div>
    </div>
  );
}
