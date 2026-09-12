import { ChevronRight, LayoutGrid } from 'lucide-react';
import {
  AUTO_VITRINE_CARD,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_HEADING,
  AUTO_LABEL,
  AUTO_BODY,
} from './autoAtendimentoUi';

export default function AutoCategoryGrid({ categories, onSelect }) {
  if (!categories?.length) {
    return (
      <div className={`text-center py-16 ${AUTO_BODY}`}>
        Nenhuma categoria disponível.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {categories.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onSelect(cat.name)}
          className={`${AUTO_VITRINE_CARD} p-4 sm:p-5 text-left`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className={`w-10 h-10 rounded-xl ${AUTO_ACCENT_BG} flex items-center justify-center shrink-0 bg-[#fafafa]`}>
              <LayoutGrid className={`w-4 h-4 ${AUTO_ACCENT_TEXT}`} />
            </div>
            <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0 mt-0.5" />
          </div>
          <p className={`${AUTO_HEADING} text-base sm:text-lg mt-4 leading-snug`}>{cat.name}</p>
          <p className={`${AUTO_LABEL} mt-2 normal-case`}>{cat.count} produtos</p>
        </button>
      ))}
    </div>
  );
}
