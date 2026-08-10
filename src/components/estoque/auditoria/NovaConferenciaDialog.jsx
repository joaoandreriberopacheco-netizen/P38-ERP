import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function NovaConferenciaDialog({ open, onClose, onCriada }) {
  const [form, setForm] = useState({ nome_conferencia: "", tipo_conferencia: "Cíclico" });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const handleCriar = async () => {
    if (!form.nome_conferencia.trim()) return;
    setLoading(true);
    const nova = await base44.entities.ConferenciaEstoque.create({
      ...form,
      responsavel_id: user?.email || "",
      responsavel_nome: user?.full_name || "",
      status: "Em Andamento",
      data_inicio: new Date().toISOString(),
      itens_conferidos: [],
    });
    setLoading(false);
    setForm({ nome_conferencia: "", tipo_conferencia: "Cíclico" });
    onCriada(nova);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl border-0 shadow-xl dark:bg-background p-6">
        <DialogHeader>
          <DialogTitle className="font-glacial text-foreground text-base">Nova Conferência</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome / Identificação</label>
            <Input
              placeholder="Ex: Inventário Corredor A"
              value={form.nome_conferencia}
              onChange={e => setForm(f => ({ ...f, nome_conferencia: e.target.value }))}
              className="rounded-xl border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-border/40 dark:focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <Select value={form.tipo_conferencia} onValueChange={v => setForm(f => ({ ...f, tipo_conferencia: v }))}>
              <SelectTrigger className="rounded-xl border-0 bg-muted/50 focus:ring-1 focus:ring-border/40 dark:focus:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inventário Geral">Inventário Geral</SelectItem>
                <SelectItem value="Cíclico">Cíclico</SelectItem>
                <SelectItem value="Específico">Específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={loading || !form.nome_conferencia.trim()}
              className="flex-1 rounded-xl bg-card text-card-foreground shadow-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Iniciar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}