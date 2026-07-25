import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';

export default function TagSearchPopup({
  allTags,
  selectedTags,
  setSelectedTags,
  onClose,
  variant = 'popup',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return allTags;
    return allTags.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, allTags]);
  
  const unselected = filtered.filter(tag => !selectedTags.includes(tag));
  const isInline = variant === 'inline';

  return (
    <div
      className={
        isInline
          ? 'relative w-full rounded-xl border border-border/40 bg-muted/50/80 p-3 max-h-56 overflow-hidden flex flex-col'
          : 'absolute top-full left-0 mt-2 bg-card rounded-lg shadow-lg p-3 z-50 border border-border/40 w-64 max-h-72 overflow-hidden flex flex-col'
      }
    >
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input autoComplete="off"
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus={!isInline}
          className="w-full pl-7 pr-2 py-1.5 text-sm bg-muted/40 dark:bg-muted rounded border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      
      {selectedTags.length > 0 && (
        <div className="mb-2 pb-2 border-b border-border/40">
          <p className="text-xs text-muted-foreground font-medium mb-1">Selecionadas</p>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                className="inline-flex items-center gap-1 px-2 py-1 bg-card text-card-foreground rounded text-xs font-medium hover:opacity-80 transition"
              >
                {tag}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto space-y-1">
        {unselected.length > 0 ? (
          unselected.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev => [...prev, tag])}
              className="w-full text-left px-2 py-1.5 text-sm text-foreground bg-muted/40 dark:bg-muted rounded hover:bg-muted dark:hover:bg-muted transition"
            >
              {tag}
            </button>
          ))
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            {searchTerm ? 'Nenhuma tag encontrada' : 'Todas selecionadas'}
          </div>
        )}
      </div>
      
      {!isInline && (
        <button
          onClick={onClose}
          className="w-full mt-2 py-1.5 bg-card text-card-foreground text-xs font-medium rounded hover:opacity-90 transition"
        >
          Fechar
        </button>
      )}
    </div>
  );
}