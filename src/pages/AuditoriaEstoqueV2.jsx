import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: conferência duplicada → AuditoriaEstoque (PDV). */
export default function AuditoriaEstoqueV2Page() {
  return <Navigate to={createPageUrl('AuditoriaEstoque')} replace />;
}
