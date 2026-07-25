import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BuscarPedidoCompraParaAnexo({ onSelecionar, onVoltar, uploadando }) {
  const [query, setQuery] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [selecionado, setSelecionado] = useState(null);

  const buscar = async (q = '') => {
    setCarregando(true);
    setErro(null);
    try {
      const todos = await base44.entities.PedidoCompra.list('-created_date', 80);
      const lista = todos || [];
      if (q) {
        const lower = q.toLowerCase();
        setPedidos(
          lista.filter(
            (p) =>
              String(p.numero || '')
                .toLowerCase()
                .includes(lower) ||
              String(p.fornecedor_nome || '')
                .toLowerCase()
                .includes(lower) ||
              String(p.status || '')
                .toLowerCase()
                .includes(lower)
          )
        );
      } else {
        setPedidos(lista);
      }
    } catch (e) {
      console.error(e);
      setErro(e?.message || 'Não foi possível carregar os pedidos.');
      setPedidos([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscar();
  }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    buscar(val);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 px-5 pb-6 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="w-9 h-9 rounded-full bg-muted dark:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium text-foreground/90">Pedido de compra</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input autoComplete="off"
          value={query}
          onChange={handleSearch}
          placeholder="Número, fornecedor ou status..."
          className="w-full bg-card rounded-2xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {erro && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}
        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : pedidos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">Nenhum pedido encontrado</p>
        ) : (
          pedidos.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setSelecionado(p)}
              className={`w-full text-left rounded-2xl px-4 py-3 text-sm shadow-sm transition-colors ${
                selecionado?.id === p.id
                  ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground'
                  : 'bg-card text-foreground'
              }`}
            >
              <p className="font-semibold">{p.numero || p.id}</p>
              <p className="text-xs opacity-80 mt-0.5">{p.fornecedor_nome || '—'}</p>
            </button>
          ))
        )}
      </div>

      {selecionado && (
        <button
          type="button"
          onClick={() => onSelecionar(selecionado)}
          disabled={uploadando}
          className="w-full h-14 rounded-2xl bg-card text-card-foreground text-sm font-semibold flex items-center justify-center gap-2 mt-auto"
        >
          {uploadando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Anexar ao pedido
            </>
          )}
        </button>
      )}
    </div>
  );
}
