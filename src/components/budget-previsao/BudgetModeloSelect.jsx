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
import BudgetModeloDialog from '@/components/budget-previsao/BudgetModeloDialog';
import { salvarModelo } from '@/lib/budgetService';
import { useToast } from '@/components/ui/use-toast';
import { useCompactShell } from '@/hooks/use-breakpoint';

function labelModelo(modelo) {
  if (!modelo) return '';
  const partes = [modelo.categoria_nome, modelo.centro_custo].filter(Boolean);
  return partes.length ? `${modelo.nome} · ${partes.join(' · ')}` : modelo.nome;
}

export default function BudgetModeloSelect({
  modelos = [],
  value,
  displayName = '',
  onValueChange,
  onModelosChange,
  categorias = [],
  centrosCustoRegistros = [],
  onCategoriasChange,
  onCentrosChange,
  disabled,
  placeholder = 'Vincular a um budget',
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [modeloForm, setModeloForm] = useState(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const { toast } = useToast();
  const compact = useCompactShell();

  const ativos = useMemo(
    () => (modelos || []).filter((m) => m.ativo !== false),
    [modelos],
  );

  const selecionado = useMemo(
    () => modelos.find((m) => m.id === value) || null,
    [modelos, value],
  );

  const labelExibida = selecionado ? labelModelo(selecionado) : displayName || '';

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return ativos;
    return ativos.filter((m) => {
      const blob = [
        m.nome,
        m.categoria_nome,
        m.centro_custo,
      ].join(' ').toLocaleLowerCase('pt-BR');
      return blob.includes(q);
    });
  }, [ativos, busca]);

  const handleSelect = (modelo) => {
    onValueChange?.(modelo);
    setOpen(false);
    setBusca('');
  };

  const handleSalvarModelo = async (payload) => {
    setSalvandoModelo(true);
    try {
      const saved = await salvarModelo(payload);
      await onModelosChange?.();
      onValueChange?.(saved);
      setModeloForm(null);
      setOpen(false);
      setBusca('');
      toast({ title: payload?.nome ? 'Budget salvo' : 'Budget criado' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoModelo(false);
    }
  };

  const abrirFormModelo = (mod) => {
    setOpen(false);
    setModeloForm(mod ?? {});
  };

  const triggerClass = cn(
    'w-full justify-between font-normal h-11 px-3 rounded-xl',
    !labelExibida && 'text-muted-foreground',
  );

  const listaItens = (
    <>
      {filtrados.map((mod) => {
        const selected = value === mod.id;
        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => handleSelect(mod)}
            className={cn(
              'flex w-full items-start gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
              selected
                ? 'bg-primary/15 text-foreground'
                : 'text-foreground/90 hover:bg-muted',
            )}
          >
            <Check className={cn('h-4 w-4 shrink-0 mt-0.5', selected ? 'opacity-100' : 'opacity-0')} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium truncate">{mod.nome}</span>
              {(mod.categoria_nome || mod.centro_custo) && (
                <span className="block text-xs text-muted-foreground truncate">
                  {[mod.categoria_nome, mod.centro_custo].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
              aria-label={`Editar ${mod.nome}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                abrirFormModelo(mod);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirFormModelo(mod);
                }
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </button>
        );
      })}
      {filtrados.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhum budget encontrado.
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
            <span className="truncate text-left">{labelExibida || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>

          <Drawer
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setBusca('');
            }}
          >
            <DrawerContent className="rounded-t-[28px] border-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <DrawerHeader className="px-0 pb-2 text-left">
                <DrawerTitle>Budget</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar budget…"
                      className="h-12 rounded-xl border-0 bg-muted pl-9"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    aria-label="Novo budget"
                    onClick={() => abrirFormModelo({})}
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
              <span className="truncate text-left">{labelExibida || placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <div className="flex items-center gap-1 border-b px-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
                  <Search className="h-4 w-4 shrink-0 opacity-50" />
                  <CommandPrimitive.Input
                    value={busca}
                    onValueChange={setBusca}
                    placeholder="Buscar budget…"
                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Novo budget"
                  onClick={() => abrirFormModelo({})}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CommandList>
                <CommandEmpty>Nenhum budget encontrado.</CommandEmpty>
                <CommandGroup>
                  {filtrados.map((mod) => (
                    <CommandItem
                      key={mod.id}
                      value={mod.id}
                      onSelect={() => handleSelect(mod)}
                      className="flex items-start gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0 mt-0.5',
                          value === mod.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{mod.nome}</span>
                        {(mod.categoria_nome || mod.centro_custo) && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {[mod.categoria_nome, mod.centro_custo].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                        aria-label={`Editar ${mod.nome}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          abrirFormModelo(mod);
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

      <BudgetModeloDialog
        open={Boolean(modeloForm)}
        onClose={() => setModeloForm(null)}
        modelo={modeloForm}
        categorias={categorias}
        centrosCustoRegistros={centrosCustoRegistros}
        onSave={handleSalvarModelo}
        saving={salvandoModelo}
        onCategoriasChange={onCategoriasChange}
        onCentrosChange={onCentrosChange}
      />
    </>
  );
}
