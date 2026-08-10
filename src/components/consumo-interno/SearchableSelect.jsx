import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';

export default function SearchableSelect({
  items = [],
  value = '',
  onChange = () => {},
  placeholder = 'Buscar...',
  onAddNew = () => {},
  displayField = 'nome',
  idField = 'id',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Atualiza label quando value muda
  useEffect(() => {
    if (value) {
      const item = items.find(i => String(i[idField]) === String(value) || i[displayField] === value);
      setSelectedLabel(item ? item[displayField] : value);
    } else {
      setSelectedLabel('');
    }
  }, [value, items, idField, displayField]);

  // Filtra itens por busca
  const filtered = items.filter((item) => {
    const label = String(item?.[displayField] ?? '').trim();
    if (!label) return false;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (item) => {
    onChange(item[displayField]);
    setSelectedLabel(item[displayField]);
    setSearch('');
    setIsOpen(false);
  };

  const handleAddNew = () => {
    const nextValue = search.trim();
    if (nextValue) {
      onAddNew(nextValue);
      setSelectedLabel(nextValue);
      onChange(nextValue);
      setSearch('');
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setSelectedLabel('');
    setSearch('');
  };

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    // Use "click" to avoid swallowing the first interaction in nearby inputs.
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 w-full">
      {/* Trigger */}
      <div className="flex h-12 w-full items-center gap-2 rounded-2xl border-0 bg-muted px-3 shadow-sm dark:bg-background overflow-hidden">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input autoComplete="off"
          ref={inputRef}
          type="text"
          placeholder={selectedLabel || placeholder}
          value={isOpen ? search : ''}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none dark:text-white dark:placeholder:text-muted-foreground"
        />
        {selectedLabel && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted dark:hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[60] mt-1 max-h-60 overflow-y-auto rounded-2xl border-0 bg-card shadow-lg dark:bg-muted">
          {filtered.length > 0 ? (
            <>
              {filtered.map((item) => (
                <button
                  key={item[idField]}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-muted/40 dark:text-white dark:hover:bg-primary/90 border-b border-border/40 last:border-b-0"
                >
                  {item[displayField]}
                </button>
              ))}
              {search && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddNew}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-border/40"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar: "{search}"
                </button>
              )}
            </>
          ) : search ? (
            <button
              type="button"
              onClick={handleAddNew}
              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Plus className="h-4 w-4" />
              Adicionar: "{search}"
            </button>
          ) : (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground">
              Nenhum resultado
            </div>
          )}
        </div>
      )}
    </div>
  );
}