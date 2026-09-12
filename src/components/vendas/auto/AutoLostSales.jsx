import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  AUTO_PRIMARY_BTN,
  AUTO_FIELD_CLASS,
  AUTO_SUBHEADING,
  AUTO_LABEL,
  AUTO_SURFACE_CLASS,
} from './autoAtendimentoUi';

export default function AutoLostSales({ open, onClose }) {
  const [msg, setMsg] = useState('');
  const [qtd, setQtd] = useState(1);
  const [sugestoes, setSugestoes] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    base44.entities.VendaPerdida.list()
      .then((items) => {
        const nomes = [...new Set(items.map((i) => i.produto_nome || i.nome_produto_nao_mix).filter(Boolean))];
        setSugestoes(nomes);
      })
      .catch(console.error);
  }, [open]);

  const filteredSugestoes =
    msg.length >= 2
      ? sugestoes.filter((s) => s.toLowerCase().includes(msg.toLowerCase())).slice(0, 3)
      : [];

  const handleSubmit = async () => {
    try {
      const user = await base44.auth.me();
      await base44.entities.VendaPerdida.create({
        produto_nome: msg,
        quantidade_desejada: parseInt(qtd, 10) || 1,
        motivo: 'Não Trabalhamos',
        vendedor_id: user.id,
        data_registro: new Date().toISOString(),
        origem: 'Auto-Atendimento',
      });
      toast({
        title: 'Sugestão recebida!',
        description: 'Obrigado por nos ajudar a melhorar.',
      });
      setMsg('');
      setQtd(1);
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto font-din-1451 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-tight text-[#242424]">Não encontrou?</DialogTitle>
          <p className={AUTO_SUBHEADING}>Conte o que você estava procurando.</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="relative">
            <label className={`block mb-2 ${AUTO_LABEL}`}>Produto</label>
            <Input
              placeholder="Nome do produto..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className={`h-12 text-base rounded-xl ${AUTO_FIELD_CLASS}`}
              autoFocus
            />
            {filteredSugestoes.length > 0 && (
              <div className={`absolute z-10 w-full mt-1 ${AUTO_SURFACE_CLASS} rounded-xl shadow-lg overflow-hidden`}>
                {filteredSugestoes.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left p-3 hover:bg-[#f5f5f5] text-sm text-[#404040]"
                    onClick={() => setMsg(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Input
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className={`h-12 w-24 text-center rounded-xl ${AUTO_FIELD_CLASS}`}
              aria-label="Quantidade"
            />
            <Button
              onClick={handleSubmit}
              disabled={!msg.trim()}
              className={`flex-1 h-12 ${AUTO_PRIMARY_BTN}`}
            >
              Enviar
            </Button>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-full text-[#6b6b6b]">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
