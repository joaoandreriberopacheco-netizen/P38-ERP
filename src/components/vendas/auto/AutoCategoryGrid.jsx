import { ChevronRight, LayoutGrid } from 'lucide-react';
import {
  AUTO_VITRINE_CARD,
  AUTO_ACCENT_TEXT,
  AUTO_IMAGE_STAGE,
  AUTO_HEADING,
  AUTO_LABEL,
  AUTO_BODY,
  AUTO_EYEBROW,
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
          className={`${AUTO_VITRINE_CARD} p-4 sm:p-5 text-left group`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className={`w-11 h-11 rounded-xl ${AUTO_IMAGE_STAGE} flex items-center justify-center shrink-0`}>
              <LayoutGrid className={`w-4 h-4 ${AUTO_ACCENT_TEXT}`} />
            </div>
            <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className={AUTO_EYEBROW}>Departamento</p>
          <p className={`${AUTO_HEADING} text-base sm:text-lg mt-1 leading-snug`}>{cat.name}</p>
          <p className={`${AUTO_LABEL} mt-2 normal-case`}>{cat.count} produtos</p>
        </button>
      ))}
    </div>
  );
}
