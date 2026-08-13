import { useEffect, useMemo, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { salvarCentroCustoRegistro } from '@/lib/folhaPrevisaoService';
import { useToast } from '@/components/ui/use-toast';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { lancamentoStackClasses } from '@/components/financeiro/fluxo/LancamentoPickerDialog';

function FolhaCentroCustoFormDialog({
  open,
  onClose,
  centro,
  onSave,
  saving,
  stackElevated = false,
  stackLevel = 2,
}) {
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const stack = lancamentoStackClasses(stackElevated ? stackLevel : 0);

  useEffect(() => {
    if (!open) return;
    setNome(centro?.nome || '');
    setAtivo(centro?.ativo !== false);
  }, [open, centro]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.({
      ...centro,
      nome: nome.trim(),
      ativo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent
        overlayClassName={stack.overlay}
        className={cn('w-[calc(100vw-1.25rem)] max-w-sm rounded-2xl', stack.content)}
      >
        <DialogHeader>
          <DialogTitle>{centro?.id ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Loja, Casa, Fábrica"
              required
              autoFocus
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(Boolean(v))} />
            <span className="text-sm">Ativo</span>
          </label>
          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving || !nome.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FolhaCentroCustoSelect({
  centros = [],
  value = '',
  valueId = '',
  onValueChange,
  onCentrosChange,
  disabled,
  allowEmpty = true,
  emptyLabel = 'Sem centro',
  placeholder = 'Escolher centro de custo',
  stackElevated = false,
  stackLevel = 1,
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [centroForm, setCentroForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();
  const compact = useCompactShell();
  const stack = lancamentoStackClasses(stackElevated ? stackLevel : 0);
  const dialogStackLevel = stackElevated ? stackLevel + 1 : 0;

  const ativos = useMemo(
    () => (centros || []).filter((c) => c?.ativo !== false && String(c?.nome || '').trim()),
    [centros],
  );

  const selecionado = useMemo(() => {
    const id = String(valueId || '').trim();
    if (id) {
      const byId = ativos.find((c) => String(c.id) === id);
      if (byId) return byId;
    }
    const nome = String(value || '').trim();
    if (!nome) return null;
    return (
      ativos.find(
        (c) => String(c.nome).toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'),
      ) || { id: '', nome }
    );
  }, [ativos, value, valueId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return ativos;
    return ativos.filter((c) => String(c.nome || '').toLocaleLowerCase('pt-BR').includes(q));
  }, [ativos, busca]);

  const emitChange = (centro) => {
    if (!centro?.nome) {
      onValueChange?.({ id: '', nome: '' });
      return;
    }
    onValueChange?.({ id: centro.id || '', nome: centro.nome });
  };

  const handleSelect = (centro) => {
    emitChange(centro?.nome ? centro : null);
    setOpen(false);
    setBusca('');
  };

  const handleSalvarCentro = async (payload) => {
    setSalvando(true);
    try {
      const lista = await salvarCentroCustoRegistro({
        id: payload.id || null,
        nome: payload.nome,
        ativo: payload.ativo !== false,
        ordem: payload.ordem,
      });
      await onCentrosChange?.(lista);
      const nomeLimpo = String(payload.nome || '').trim();
      const criado =
        (lista || []).find(
          (c) =>
            String(c.nome || '').toLocaleLowerCase('pt-BR') === nomeLimpo.toLocaleLowerCase('pt-BR'),
        ) || { id: payload.id || '', nome: nomeLimpo };
      emitChange(criado);
      setCentroForm(null);
      setOpen(false);
      setBusca('');
      toast({ title: payload.id ? 'Centro atualizado' : 'Centro criado' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const abrirFormCentro = (centro) => {
    setOpen(false);
    setCentroForm(centro || {});
  };

  const isSelectedCentro = (centro) => {
    if (!selecionado?.nome && !selecionado?.id) return false;
    if (selecionado.id && centro?.id && String(selecionado.id) === String(centro.id)) return true;
    return (
      String(selecionado.nome || '').toLocaleLowerCase('pt-BR') ===
      String(centro?.nome || '').toLocaleLowerCase('pt-BR')
    );
  };

  const semCentro = !selecionado?.nome && !selecionado?.id;

  const triggerClass = cn(
    'w-full justify-between font-normal h-11 px-3 rounded-xl',
    !selecionado && 'text-muted-foreground',
  );

  const listaMobile = (
    <>
      {allowEmpty && (
        <button
          type="button"
          onClick={() => handleSelect({ nome: '' })}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
            semCentro ? 'bg-primary/15 text-foreground' : 'text-foreground/90 hover:bg-muted',
          )}
        >
          <Check className={cn('h-4 w-4 shrink-0', semCentro ? 'opacity-100' : 'opacity-0')} />
          <span className="text-muted-foreground">{emptyLabel}</span>
        </button>
      )}
      {filtrados.map((centro) => {
        const selected = isSelectedCentro(centro);
        return (
          <button
            key={centro.id || centro.nome}
            type="button"
            onClick={() => handleSelect(centro)}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors',
              selected
                ? 'bg-primary/15 text-foreground'
                : 'text-foreground/90 hover:bg-muted',
            )}
          >
            <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
            <span className="flex-1 truncate">{centro.nome}</span>
            {centro.id && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Editar ${centro.nome}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirFormCentro(centro);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    abrirFormCentro(centro);
                  }
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
      {filtrados.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhum centro encontrado.
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
            <span className="truncate">{selecionado?.nome || placeholder}</span>
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
                <DrawerTitle>Centro de custo</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar centro…"
                      className="h-12 rounded-xl border-0 bg-muted pl-9"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    aria-label="Novo centro de custo"
                    onClick={() => abrirFormCentro({})}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="max-h-[48vh] space-y-1 overflow-y-auto rounded-2xl bg-muted/40 p-2">
                  {listaMobile}
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
              <span className="truncate">{selecionado?.nome || placeholder}</span>
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
                    placeholder="Buscar centro…"
                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Novo centro de custo"
                  onClick={() => abrirFormCentro({})}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CommandList>
                <CommandEmpty>Nenhum centro encontrado.</CommandEmpty>
                <CommandGroup>
                  {allowEmpty && (
                    <CommandItem value="__none__" onSelect={() => handleSelect({ nome: '' })}>
                      <Check
                        className={cn('h-4 w-4 shrink-0', semCentro ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="text-muted-foreground">{emptyLabel}</span>
                    </CommandItem>
                  )}
                  {filtrados.map((centro) => (
                    <CommandItem
                      key={centro.id || centro.nome}
                      value={centro.nome}
                      onSelect={() => handleSelect(centro)}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isSelectedCentro(centro) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{centro.nome}</span>
                      {centro.id && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Editar ${centro.nome}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            abrirFormCentro(centro);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <FolhaCentroCustoFormDialog
        open={Boolean(centroForm)}
        onClose={() => setCentroForm(null)}
        centro={centroForm}
        onSave={handleSalvarCentro}
        saving={salvando}
        stackElevated={stackElevated}
        stackLevel={dialogStackLevel}
      />
    </>
  );
}
