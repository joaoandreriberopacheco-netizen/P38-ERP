/** Ordenação e filtro partilhados — selects de fornecedor em compras / OCR. */

export function sortFornecedoresByNome(fornecedores = []) {
  return [...fornecedores].sort((a, b) =>
    (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '', 'pt-BR', {
      sensitivity: 'base',
    }),
  );
}

export function fornecedorSearchBlob(f) {
  return [f.nome, f.razao_social, f.codigo_interno, f.cpf_cnpj]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR');
}

export function filterFornecedoresByQuery(fornecedores = [], query = '') {
  const sorted = sortFornecedoresByNome(fornecedores);
  const q = String(query).trim().toLocaleLowerCase('pt-BR');
  if (!q) return sorted;
  return sorted.filter((f) => fornecedorSearchBlob(f).includes(q));
}

export function labelFornecedor(f) {
  return f?.nome || f?.razao_social || 'Sem nome';
}
