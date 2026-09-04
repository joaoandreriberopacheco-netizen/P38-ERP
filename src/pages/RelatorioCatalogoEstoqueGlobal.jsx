import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Abre o catálogo e gera o resumo global de estoque (físico + trânsito). */
export default function RelatorioCatalogoEstoqueGlobal() {
  return <Navigate to={`${createPageUrl('Produtos')}?relatorioEstoqueGlobal=1`} replace />;
}
