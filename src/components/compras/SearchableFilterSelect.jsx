import React, { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchTextIncludes } from '@/lib/normalizeSearchText';

export default function SearchableFilterSelect({
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  options,
  className
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label || placeholder;
  }, [options, value, placeholder]);

  const filteredOptions = useMemo(() => {
    return options.filter((option) => searchTextIncludes(option.label, query));
  }, [options, query]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full min-w-0 max-w-full justify-between bg-muted dark:bg-muted text-foreground/90 dark:text-foreground hover:bg-muted dark:hover:bg-muted border-0 shadow-none',
          className
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="border-0 rounded-t-[28px] bg-card dark:bg-card px-4 pb-6">
          <DrawerHeader className="px-0 pb-3 text-left">
            <DrawerTitle className="font-glacial text-foreground">{placeholder}</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-12 rounded-xl border-0 bg-muted dark:bg-muted text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
            />

            <div className="max-h-[48vh] overflow-y-auto space-y-1 rounded-2xl bg-muted/40 dark:bg-muted/40 p-2">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-muted dark:bg-muted text-foreground'
                        : 'text-foreground/90 hover:bg-muted dark:hover:bg-muted/80'
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}

              {filteredOptions.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhum resultado encontrado.
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}