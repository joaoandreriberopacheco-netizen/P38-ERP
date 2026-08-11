import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { searchProdutosProducao } from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { espelharProdutoProducao } from '@/lib/modeloCatalogo/espelharProduto';
import { toast } from 'sonner';

export default function EspelharProdutoDialog({ open, onClose, onEspelhar, linhas = [], produtosCompra = [] }) {
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const rows = await searchProdutosProducao(term);
      setResults(rows);
    } catch (e) {
      toast.error(e.message || 'Erro na busca');
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (produto) => {
    const { draft, hints } = espelharProdutoProducao(produto, { linhas, produtosCompra });
    if (!hints.linha_existente) {
      toast.message(`LINHA sugerida: ${hints.linha_nome_sugerido} — crie-a se ainda não existir`);
    }
    onEspelhar?.({ draft, hints, produto });
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Espelhar SKU de produção</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Lê o catálogo real (read-only) e cria rascunho no laboratório. Não altera produção.
        </p>
        <div className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome ou código…" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <Button onClick={handleSearch} disabled={loading} size="icon">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <ul className="max-h-64 overflow-y-auto space-y-1">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full text-left px-2 py-2 rounded hover:bg-muted text-sm" onClick={() => handlePick(p)}>
                <span className="font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{p.codigo_interno} · est. {p.estoque_atual}</span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
