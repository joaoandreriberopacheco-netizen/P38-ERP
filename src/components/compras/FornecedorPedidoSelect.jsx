import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
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
import { useCompactShell } from '@/hooks/use-breakpoint';
import {
  filterFornecedoresByQuery,
  labelFornecedor,
} from '@/lib/fornecedorSelectUtils';

/**
 * Fornecedor com busca incremental e lista A–Z (formulário de pedido, OCR / Torre).
 */
export default function FornecedorPedidoSelect({
  value,
  onValueChange,
  fornecedores = [],
  disabled = false,
  placeholder = 'Selecione o fornecedor...',
  displayName = '',
  triggerClassName,
  showCreateNew = false,
  createNewValue = 'new',
  createNewLabel = 'Criar novo fornecedor',
  onCreateNew,
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const compact = useCompactShell();

  const selecionado = useMemo(
    () => fornecedores.find((f) => f.id === value) || null,
    [fornecedores, value],
  );

  const isCreateSelected = showCreateNew && value === createNewValue;

  const labelExibida = isCreateSelected
    ? createNewLabel
    : selecionado
      ? labelFornecedor(selecionado)
      : displayName || '';

  const filtrados = useMemo(
    () => filterFornecedoresByQuery(fornecedores, busca),
    [fornecedores, busca],
  );

  const closeAndClear = () => {
    setOpen(false);
    setBusca('');
  };

  const pickFornecedor = (id) => {
    onValueChange?.(id);
    closeAndClear();
  };

  const pickCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      onValueChange?.(createNewValue);
    }
    closeAndClear();
  };

  const triggerClass = cn(
    'w-full justify-between font-normal',
    triggerClassName,
  );

  const listaMobile = (
    <>
      {showCreateNew && (
        <button
          type="button"
          onClick={pickCreateNew}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
            isCreateSelected
              ? 'bg-muted text-foreground'
              : 'text-foreground/90 hover:bg-muted/80',
          )}
        >
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{createNewLabel}</span>
          {isCreateSelected && <Check className="h-4 w-4 shrink-0" />}
        </button>
      )}
      {filtrados.map((f) => {
        const selected = f.id === value;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => pickFornecedor(f.id)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
              selected ? 'bg-muted text-foreground' : 'text-foreground/90 hover:bg-muted/80',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{labelFornecedor(f)}</span>
            {selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
      {filtrados.length === 0 && !showCreateNew && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>
      )}
    </>
  );

  const listaDesktop = (
    <CommandList className="max-h-[min(320px,50vh)]">
      <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
      <CommandGroup>
        {showCreateNew && (
          <CommandItem
            value="__create_new__"
            onSelect={pickCreateNew}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{createNewLabel}</span>
            <Check className={cn('h-4 w-4 shrink-0', isCreateSelected ? 'opacity-100' : 'opacity-0')} />
          </CommandItem>
        )}
        {filtrados.map((f) => (
          <CommandItem
            key={f.id}
            value={f.id}
            onSelect={() => pickFornecedor(f.id)}
            className="flex items-center gap-2"
          >
            <Check
              className={cn('h-4 w-4 shrink-0', value === f.id ? 'opacity-100' : 'opacity-0')}
            />
            <span className="min-w-0 flex-1 truncate">{labelFornecedor(f)}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  );

  const buscaInputMobile = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar fornecedor..."
        className="h-12 rounded-xl border-0 bg-muted pl-9"
        autoFocus
      />
    </div>
  );

  if (compact) {
    return (
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
          repositionInputs={false}
          shouldScaleBackground={false}
        >
          <DrawerContent className="rounded-t-[28px] border-0 bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 pb-2 text-left">
              <DrawerTitle>Fornecedor</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-3">
              {buscaInputMobile}
              <div className="max-h-[48vh] space-y-1 overflow-y-auto rounded-2xl bg-muted/40 p-2">
                {listaMobile}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
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
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[10000]"
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
              value={busca}
              onValueChange={setBusca}
              placeholder="Buscar fornecedor..."
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {listaDesktop}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
