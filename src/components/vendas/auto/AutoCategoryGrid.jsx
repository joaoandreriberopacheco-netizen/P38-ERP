import { ChevronRight, LayoutGrid } from 'lucide-react';
import { AUTO_CARD_CLASS } from './autoAtendimentoUi';

export default function AutoCategoryGrid({ categories, onSelect }) {
  if (!categories?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhuma categoria disponível.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onSelect(cat.name)}
          className={`${AUTO_CARD_CLASS} p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.98]`}
        >
          <div className="flex items-start justify-between gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <p className="font-semibold text-foreground mt-3 leading-snug">{cat.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{cat.count} produtos</p>
        </button>
      ))}
    </div>
  );
}
