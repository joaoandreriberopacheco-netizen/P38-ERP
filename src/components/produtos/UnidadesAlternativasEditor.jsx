import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Boxes } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Editor de embalagens alternativas (Base44).
 * Textos alinhados ao cadastro de produto e ao catálogo (vitrine, embalagens, precificação).
 */
export default function UnidadesAlternativasEditor({
  unidades = [],
  unidadePrincipal = 'UN',
  onChange,
  commercialUnitId = '',
  onPickCatalogPrincipal,
  onPickCatalogRow,
  catalogControlsDisabled = false,
}) {
  const MAX_UNIDADES = 5;
  const handleItemChange = (index, field, value) => {
    if (field === 'fator_conversao') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (Number.isFinite(num) && num === 1) {
        toast.error('Embalagem alternativa não pode ter fator 1. A unidade base já é fator 1.');
        return;
      }
    }
    const next = [...unidades];
    const prevRow = next[index] || {};
    const stableId =
      String(prevRow.id || '').trim() ||
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${index}`);
    next[index] = { ...prevRow, id: stableId, [field]: value };
    onChange(next);
  };

  const handleAdd = () => {
    if ((unidades || []).length >= MAX_UNIDADES) {
      toast.error(`Limite atingido: no máximo ${MAX_UNIDADES} embalagens alternativas.`);
      return;
    }
    onChange([
      ...unidades,
      {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}`),
        nome: '', unidade: '', fator_conversao: 2, fator_preco: 1, preco_venda: 0, rotulo: '', ajuste_percentual: 0, ativo: true,
      },
    ]);
  };

  const handleRemove = (index) => {
    onChange(unidades.filter((_, currentIndex) => currentIndex !== index));
  };

  const principal = unidadePrincipal || 'UN';
  const showCatalogControls =
    typeof onPickCatalogPrincipal === 'function' && typeof onPickCatalogRow === 'function';
  const cid = String(commercialUnitId || '').trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <Label className="text-sm text-foreground/90">Outras embalagens</Label>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Fator: quantos <strong>{principal}</strong> equivalem a <strong>1</strong> desta sigla (ex.: 1 CX = 2,5 {principal} → fator 2,5).
            Diferença % (vs principal): negativo vende mais barato, positivo mais caro. Preço fixo (opcional) ignora o proporcional.
            {showCatalogControls ? (
              <>
                {' '}
                Use «Vitrine» numa linha para essa sigla aparecer em listagens; só uma de cada vez (a da unidade base está acima).
              </>
            ) : (
              <>
                {' '}
                A unidade de vitrine é escolhida no bloco seguinte do formulário.
              </>
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="border-0 shadow-sm shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar embalagem
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {(unidades || []).length}/{MAX_UNIDADES} embalagens além da principal.
      </p>

      {unidades.length === 0 ? (
        <div className="rounded-2xl bg-muted/50/60 p-4 text-sm text-muted-foreground flex items-center gap-3">
          <Boxes className="w-4 h-4 shrink-0" />
          Nenhuma embalagem alternativa cadastrada. Use «Adicionar embalagem» para caixas, pacotes, fardos, etc.
        </div>
      ) : (
        <div className="space-y-3">
          {unidades.map((item, index) => {
            const rowId = String(item?.id || '').trim();
            const isRowCatalog =
              showCatalogControls &&
              rowId &&
              cid === rowId &&
              cid !== 'primary' &&
              cid !== 'principal';
            return (
            <div
              key={String(item?.id || '').trim() || `nova-${index}`}
              className="rounded-2xl bg-muted/50/60 dark:border-border/40 p-4 shadow-sm space-y-3 border border-transparent"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge className="bg-card text-foreground/90 dark:bg-background dark:text-foreground border-0 shadow-sm">
                  {item.unidade || `Embalagem ${index + 1}`}
                </Badge>
                <div className="flex items-center gap-2 ml-auto">
                  {showCatalogControls && (
                    <div className="flex items-center gap-1.5 rounded-full bg-card/80 dark:bg-background/80 px-2 py-1 border border-border/40/80 dark:border-border/80">
                      <Switch
                        id={`catalogo-alt-${rowId || index}`}
                        className="scale-90"
                        checked={isRowCatalog}
                        disabled={catalogControlsDisabled || !String(item.unidade || '').trim()}
                        title="Listagens e vendas usam esta sigla na vitrine quando ativo"
                        onCheckedChange={(checked) => {
                          if (checked) onPickCatalogRow(index);
                          else onPickCatalogPrincipal();
                        }}
                      />
                      <Label
                        htmlFor={`catalogo-alt-${rowId || index}`}
                        className="text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap select-none"
                      >
                        Vitrine
                      </Label>
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(index)} className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0" title="Remover embalagem">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground mb-2 block">Nome</Label>
                  <Input
                    value={item.nome || ''}
                    onChange={(e) => handleItemChange(index, 'nome', e.target.value)}
                    placeholder="Ex.: Caixa master"
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Sigla</Label>
                  <Input
                    value={item.unidade || ''}
                    onChange={(e) => handleItemChange(index, 'unidade', e.target.value.toUpperCase())}
                    placeholder="CX, PAC, PCT"
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Rótulo (opcional)</Label>
                  <Input
                    value={item.rotulo || ''}
                    onChange={(e) => handleItemChange(index, 'rotulo', e.target.value)}
                    placeholder="Ex.: Caixa fechada"
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Equivale a quantos {principal}</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={item.fator_conversao ?? 1}
                    onChange={(e) => handleItemChange(index, 'fator_conversao', parseFloat(e.target.value) || 0)}
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Diferença % (sinal)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.ajuste_percentual ?? 0}
                    onChange={(e) => handleItemChange(index, 'ajuste_percentual', parseFloat(e.target.value) || 0)}
                    placeholder="-10 ou +10"
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">% preço vs base (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      Object.prototype.hasOwnProperty.call(item, 'percentual_preco_vs_principal') &&
                      item.percentual_preco_vs_principal !== '' &&
                      item.percentual_preco_vs_principal != null
                        ? item.percentual_preco_vs_principal
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || raw === null) {
                        const next = { ...item };
                        delete next.percentual_preco_vs_principal;
                        const arr = [...unidades];
                        arr[index] = next;
                        onChange(arr);
                        return;
                      }
                      handleItemChange(index, 'percentual_preco_vs_principal', parseFloat(raw) || 0);
                    }}
                    placeholder="Vazio = usa % + fator preço"
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Fator de preço</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={item.fator_preco ?? 1}
                    onChange={(e) => handleItemChange(index, 'fator_preco', parseFloat(e.target.value) || 1)}
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Preço venda fixo (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.preco_venda ?? 0}
                    onChange={(e) => handleItemChange(index, 'preco_venda', parseFloat(e.target.value) || 0)}
                    className="bg-card border-0 shadow-sm rounded-lg h-10 text-sm"
                  />
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
