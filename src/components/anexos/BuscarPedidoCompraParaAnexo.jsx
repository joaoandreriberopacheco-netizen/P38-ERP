import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function pedidoKey(pedido) {
  return String(pedido?.id || pedido?.numero || '');
}

function PedidoCompraPickerItem({ pedido, selecionado, onSelect }) {
  const touchStartRef = useRef(null);
  const lastSelectAtRef = useRef(0);

  const fireSelect = useCallback(() => {
    const now = Date.now();
    if (now - lastSelectAtRef.current < 300) return;
    lastSelectAtRef.current = now;
    onSelect(pedido);
  }, [onSelect, pedido]);

  return (
    <button
      type="button"
      onTouchStart={(e) => {
        const t = e.changedTouches?.[0] || e.touches?.[0];
        if (!t) return;
        touchStartRef.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start) return;
        const t = e.changedTouches?.[0];
        if (!t) return;
        const dx = Math.abs(t.clientX - start.x);
        const dy = Math.abs(t.clientY - start.y);
        if (dx <= 12 && dy <= 12) {
          e.preventDefault();
          fireSelect();
        }
      }}
      onClick={fireSelect}
      className={`w-full touch-manipulation select-none rounded-2xl px-4 py-3.5 text-left text-sm shadow-sm transition-all active:scale-[0.98] ${
        selecionado
          ? 'bg-primary/15 ring-2 ring-primary/45 dark:bg-muted dark:ring-primary/50'
          : 'bg-card text-foreground dark:border dark:border-border dark:bg-card'
      }`}
    >
      <p className={`font-semibold ${selecionado ? 'text-foreground' : 'text-foreground'}`}>
        {pedido.numero || pedido.id}
      </p>
      <p className={`mt-0.5 text-xs ${selecionado ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
        {pedido.fornecedor_nome || '—'}
        {pedido.status ? ` · ${pedido.status}` : ''}
      </p>
    </button>
  );
}

export default function BuscarPedidoCompraParaAnexo({ onSelecionar, onVoltar, uploadando }) {
  const [query, setQuery] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const inputBuscaRef = useRef(null);
  const buscaTimerRef = useRef(null);

  const buscar = useCallback(async (q = '') => {
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
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputBuscaRef.current?.focus({ preventScroll: false });
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (buscaTimerRef.current) window.clearTimeout(buscaTimerRef.current);
    buscaTimerRef.current = window.setTimeout(() => {
      buscar(val);
    }, 280);
  };

  const handleSelect = (pedido) => {
    setSelecionado((prev) => {
      const key = pedidoKey(pedido);
      if (prev && pedidoKey(prev) === key) {
        if (!uploadando) onSelecionar(pedido);
        return prev;
      }
      return pedido;
    });
  };

  const handleConfirmar = () => {
    if (selecionado) onSelecionar(selecionado);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-foreground/90">Pedido de compra</p>
      </div>

      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputBuscaRef}
          autoComplete="off"
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={handleSearch}
          placeholder="Número, fornecedor ou status..."
          className="w-full touch-manipulation rounded-2xl border border-transparent bg-card py-3 pl-10 pr-4 text-base text-foreground shadow-sm outline-none ring-2 ring-border/80 placeholder:text-muted-foreground focus:ring-primary/35 dark:bg-background dark:ring-border/40"
        />
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {erro && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}
        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pedidos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado</p>
        ) : (
          pedidos.map((p) => (
            <PedidoCompraPickerItem
              key={pedidoKey(p)}
              pedido={p}
              selecionado={selecionado && pedidoKey(selecionado) === pedidoKey(p)}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      <div className="shrink-0 pt-1">
        {selecionado ? (
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={uploadando}
            className="flex h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {uploadando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Anexar ao pedido {selecionado.numero ? `· ${selecionado.numero}` : ''}
              </>
            )}
          </button>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Toque num pedido para selecionar · toque de novo para anexar
          </p>
        )}
      </div>
    </div>
  );
}
