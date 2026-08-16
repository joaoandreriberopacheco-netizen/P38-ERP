import { ChevronRight, LayoutGrid } from 'lucide-react';
import {
  AUTO_SURFACE_CLASS,
  AUTO_CARD_HOVER,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
} from './autoAtendimentoUi';

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
          className={`${AUTO_SURFACE_CLASS} ${AUTO_CARD_HOVER} p-4 text-left`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className={`w-8 h-8 rounded-lg ${AUTO_ACCENT_BG} flex items-center justify-center shrink-0`}>
              <LayoutGrid className={`w-4 h-4 ${AUTO_ACCENT_TEXT}`} />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <p className="font-semibold text-foreground mt-3 leading-snug">{cat.name}</p>
          <p className={`text-xs mt-1 ${AUTO_ACCENT_TEXT} opacity-80`}>{cat.count} produtos</p>
        </button>
      ))}
    </div>
  );
}
