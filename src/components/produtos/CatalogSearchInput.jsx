import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/** Atraso antes de filtrar o catálogo (ms). O campo mostra o texto na hora. */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Busca do catálogo: estado local para resposta imediata ao digitar;
 * propaga `onChange` com debounce para não re-renderizar TreeGrid a cada tecla.
 */
export default function CatalogSearchInput({ value = '', onChange, className, placeholder, ...rest }) {
  const [draft, setDraft] = useState(() => String(value || ''));
  const debounceRef = useRef(null);
  const lastCommittedRef = useRef(String(value || ''));

  useEffect(() => {
    const external = String(value || '');
    if (external !== lastCommittedRef.current) {
      lastCommittedRef.current = external;
      setDraft(external);
    }
  }, [value]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const commit = (next) => {
    const normalized = String(next ?? '');
    if (normalized === lastCommittedRef.current) return;
    lastCommittedRef.current = normalized;
    onChange?.(normalized);
  };

  const handleChange = (e) => {
    const next = e.target.value;
    setDraft(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS);
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit(draft);
  };

  return (
    <Input
      value={draft}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      {...rest}
    />
  );
}
