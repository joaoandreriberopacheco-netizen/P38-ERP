import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Save } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const CheckRow = ({ label, desc, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl bg-muted/50/60">
    <div>
      <p className="text-xs font-medium text-foreground/90">{label}</p>
      {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
    </div>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 accent-primary flex-shrink-0" />
  </div>
);

export default function ConfigEstoqueManager() {
  const [config, setConfig] = useState({
    alerta_estoque_minimo: true, alerta_validade_proxima: true,
    permitir_venda_estoque_negativo: false, contagem_cega_recepcao: true,
    dias_alerta_validade: 30, dias_reposicao_automatica: 7
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.ConfiguracoesEstoque.list().then(data => {
      if (data?.length > 0) setConfig(data[0]);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const all = await base44.entities.ConfiguracoesEstoque.list();
    if (all?.length > 0) {
      await base44.entities.ConfiguracoesEstoque.update(all[0].id, config);
    } else {
      await base44.entities.ConfiguracoesEstoque.create(config);
    }
    toast({ title: "✓ Configurações salvas!", className: "bg-card" });
    setIsSaving(false);
  };

  const set = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="pb-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" /> Configurações de Estoque
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Alertas, controles e reposição</p>
      </div>

      {/* Alertas */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Alertas</p>
        <CheckRow label="Alerta de estoque mínimo" desc="Notificar quando produtos atingirem estoque mínimo"
          checked={config.alerta_estoque_minimo} onChange={v => set('alerta_estoque_minimo', v)} />
        <CheckRow label="Alerta de validade próxima" desc="Notificar quando produtos estiverem perto do vencimento"
          checked={config.alerta_validade_proxima} onChange={v => set('alerta_validade_proxima', v)} />
      </div>

      {/* Controles */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Controles</p>
        <CheckRow label="Permitir venda com estoque negativo" desc="Sistema permitirá vendas mesmo sem estoque disponível"
          checked={config.permitir_venda_estoque_negativo} onChange={v => set('permitir_venda_estoque_negativo', v)} />
        <CheckRow label="Contagem cega na recepção" desc="Não mostra quantidade esperada durante conferência"
          checked={config.contagem_cega_recepcao} onChange={v => set('contagem_cega_recepcao', v)} />
      </div>

      {/* Dias */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Antecedência para Alertas</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Alerta de validade (dias)</Label>
            <Input type="number" value={config.dias_alerta_validade}
              onChange={e => set('dias_alerta_validade', parseInt(e.target.value) || 30)}
              className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Reposição automática (dias)</Label>
            <Input type="number" value={config.dias_reposicao_automatica}
              onChange={e => set('dias_reposicao_automatica', parseInt(e.target.value) || 7)}
              className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-2 h-9 text-sm">
          <Save className="w-4 h-4" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}