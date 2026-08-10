import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast";
import { Store, ShoppingBag, Truck, Save, Settings2, Hash } from 'lucide-react';

const FLUXOS = [
  { value: 'completo',     icon: Truck,       label: 'Completo',      desc: 'Venda → Pagamento → Entrega/Separação em etapas distintas.' },
  { value: 'balcao',       icon: ShoppingBag, label: 'Balcão',        desc: 'Venda → Pagamento/Entrega juntos. Delivery opcional.' },
  { value: 'supermercado', icon: Store,        label: 'Supermercado',  desc: 'Venda + Pagamento + Entrega numa só tela (PDV Ágil).' },
];

const ToggleRow = ({ id, label, desc, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl bg-muted/50/60">
    <div>
      <Label htmlFor={id} className="text-xs font-medium text-foreground/90 cursor-pointer">{label}</Label>
      {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onChange} />
  </div>
);

export default function ConfiguracoesVendaManager() {
  const [config, setConfig] = useState({
    fluxo_venda_padrao: 'completo', auto_delivery_balcao: true,
    exibir_estoque_pdv: true, vender_sem_estoque: false, bloquear_venda_preco_zero: true,
    casas_decimais_quantidade: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.ConfiguracoesVenda.list().then(configs => {
      if (configs?.length > 0) setConfig(configs[0]);
    });
  }, []);

  const handleSave = async () => {
    const configs = await base44.entities.ConfiguracoesVenda.list();
    if (configs?.length > 0) {
      await base44.entities.ConfiguracoesVenda.update(configs[0].id, config);
    } else {
      await base44.entities.ConfiguracoesVenda.create(config);
    }
    toast({ title: "Configurações salvas", className: "bg-card", duration: 3000 });
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" /> Parâmetros de Venda
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fluxo e regras do processo de venda</p>
        </div>
      </div>

      {/* Seletor de fluxo */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Fluxo Padrão</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FLUXOS.map(({ value, icon: Icon, label, desc }) => {
            const ativo = config.fluxo_venda_padrao === value;
            return (
              <button key={value} onClick={() => setConfig({ ...config, fluxo_venda_padrao: value })}
                className={`text-left p-3 rounded-xl transition-all ${
                  ativo
                    ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground shadow-sm'
                    : 'bg-muted/50/60 text-muted-foreground hover:bg-muted/60'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${ativo ? 'opacity-80' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-semibold">{label}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${ativo ? 'opacity-70' : 'text-muted-foreground'}`}>{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Comportamento</p>
        <ToggleRow id="exibir_estoque" label="Exibir Estoque no PDV" desc="Mostra quantidade disponível ao vender"
          checked={config.exibir_estoque_pdv} onChange={v => setConfig({ ...config, exibir_estoque_pdv: v })} />
        <ToggleRow id="auto_delivery" label="Auto-Delivery (Balcão)" desc="Padrão 'Retirada' para vendas balcão"
          checked={config.auto_delivery_balcao} onChange={v => setConfig({ ...config, auto_delivery_balcao: v })} />
        <ToggleRow id="venda_sem_estoque" label="Vender sem Estoque" desc="Permite negativar o estoque"
          checked={config.vender_sem_estoque} onChange={v => setConfig({ ...config, vender_sem_estoque: v })} />
        <ToggleRow id="venda_zero" label="Bloquear Preço Zero" desc="Impede venda de itens sem preço"
          checked={config.bloquear_venda_preco_zero} onChange={v => setConfig({ ...config, bloquear_venda_preco_zero: v })} />
      </div>

      {/* Casas decimais de quantidade */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Produtos</p>
        <div className="px-3 py-2.5 rounded-xl bg-muted/50/60">
          <div className="flex items-center justify-between gap-4 mb-1">
            <div>
              <Label className="text-xs font-medium text-foreground/90">Casas Decimais na Quantidade</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Define o padrão global para quantidades no PDV (ex: 0 = inteiro, 2 = kg/m², 3 = litros)</p>
            </div>
            <div className="flex items-center gap-1 bg-card dark:bg-muted rounded-lg border border-border/40 overflow-hidden flex-shrink-0">
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, casas_decimais_quantidade: n })}
                  className={`w-9 h-9 text-sm font-medium transition-colors ${
                    config.casas_decimais_quantidade === n
                      ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                      : 'text-muted-foreground hover:bg-muted dark:hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            Exemplo: {config.casas_decimais_quantidade === 0 ? '1, 2, 10' : config.casas_decimais_quantidade === 1 ? '1,5 · 2,0 · 10,3' : config.casas_decimais_quantidade === 2 ? '1,50 · 2,75 · 10,00' : '1,500 · 2,750 · 10,000'}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground px-1">
          Para marcar produtos individuais como <strong>preço livre</strong> ou com casas decimais específicas, edite o produto na grade de produtos (aba Sistema) ou use a edição em massa.
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave}
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-2 h-9 text-sm">
          <Save className="w-4 h-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}