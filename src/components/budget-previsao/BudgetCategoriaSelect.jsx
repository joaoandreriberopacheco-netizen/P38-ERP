import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, Search } from 'lucide-react';
import { Command as CommandPrimitive } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import BudgetCategoriaDialog from '@/components/budget-previsao/BudgetCategoriaDialog';
import { salvarCategoriaDespesa } from '@/lib/budgetService';
import { useToast } from '@/components/ui/use-toast';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { lancamentoStackClasses } from '@/components/financeiro/fluxo/LancamentoPickerDialog';

export default function BudgetCategoriaSelect({
  categorias = [],
  value,
  displayName = '',
  onValueChange,
  onCategoriasChange,
  disabled,
  placeholder = 'Escolher categoria',
  stackElevated = false,
  stackLevel = 1,
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaForm, setCategoriaForm] = useState(null);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const { toast } = useToast();
  const compact = useCompactShell();
  const stack = lancamentoStackClasses(stackElevated ? stackLevel : 0);
  const dialogStackLevel = stackElevated ? stackLevel + 1 : 0;

  const selecionada = useMemo(
    () => categorias.find((c) => c.id === value) || null,
    [categorias, value],
  );

  const labelExibida = selecionada?.nome || displayName || '';

  const filtradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return categorias;
    return categorias.filter((c) => String(c.nome || '').toLocaleLowerCase('pt-BR').includes(q));
  }, [categorias, busca]);

  const handleSelect = (cat) => {
    onValueChange?.(cat);
    setOpen(false);
    setBusca('');
  };

  const handleSalvarCategoria = async (payload) => {
    setSalvandoCategoria(true);
    try {
      const saved = await salvarCategoriaDespesa(payload);
      await onCategoriasChange?.();
      onValueChange?.({ id: saved.id, nome: saved.nome });
      setCategoriaForm(null);
      setOpen(false);
      setBusca('');
      toast({ title: payload.id ? 'Categoria atualizada' : 'Categoria criada' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoCategoria(false);
    }
  };

  const abrirFormCategoria = (cat) => {
    setOpen(false);
    setCategoriaForm(cat || {});
  };

  const triggerClass = cn(
    'w-full justify-between font-normal h-11 px-3 rounded-xl',
    !labelExibida && 'text-muted-foreground',
  );

  const listaItens = (
    <>
      {filtradas.map((cat) => {
        const selected = value === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleSelect(cat)}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
              selected
                ? 'bg-primary/15 text-foreground'
                : 'text-foreground/90 hover:bg-muted',
            )}
          >
            <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
            <span className="flex-1 truncate">{cat.nome}</span>
            <span
              role="button"
              tabIndex={0}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Editar ${cat.nome}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                abrirFormCategoria(cat);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirFormCategoria(cat);
                }
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </button>
        );
      })}
      {filtradas.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhuma categoria encontrada.
        </p>
      )}
    </>
  );

  return (
    <>
      {compact ? (
        <>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={triggerClass}
            onClick={() => setOpen(true)}
          >
            <span className="truncate">{labelExibida || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>

          <Drawer
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setBusca('');
            }}
            repositionInputs={false}
            shouldScaleBackground={false}
          >
            <DrawerContent
              overlayClassName={stack.overlay}
              className={cn(
                'rounded-t-[28px] border-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
                stack.content,
              )}
            >
              <DrawerHeader className="px-0 pb-2 text-left">
                <DrawerTitle>Categoria</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar categoria…"
                      className="h-12 rounded-xl border-0 bg-muted pl-9"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    aria-label="Nova categoria"
                    onClick={() => abrirFormCategoria({})}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="max-h-[48vh] space-y-1 overflow-y-auto rounded-2xl bg-muted/40 p-2">
                  {listaItens}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setBusca('');
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={triggerClass}
            >
              <span className="truncate">{labelExibida || placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-[var(--radix-popover-trigger-width)] p-0', stack.content)}
            align="start"
          >
            <Command shouldFilter={false}>
              <div className="flex items-center gap-1 border-b px-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
                  <Search className="h-4 w-4 shrink-0 opacity-50" />
                  <CommandPrimitive.Input
                    value={busca}
                    onValueChange={setBusca}
                    placeholder="Buscar categoria…"
                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Nova categoria"
                  onClick={() => abrirFormCategoria({})}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CommandList>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                <CommandGroup>
                  {filtradas.map((cat) => (
                    <CommandItem
                      key={cat.id}
                      value={cat.id}
                      onSelect={() => handleSelect(cat)}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          value === cat.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{cat.nome}</span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Editar ${cat.nome}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          abrirFormCategoria(cat);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <BudgetCategoriaDialog
        open={Boolean(categoriaForm)}
        onClose={() => setCategoriaForm(null)}
        categoria={categoriaForm}
        onSave={handleSalvarCategoria}
        saving={salvandoCategoria}
        stackElevated={stackElevated}
        stackLevel={dialogStackLevel}
      />
    </>
  );
}
