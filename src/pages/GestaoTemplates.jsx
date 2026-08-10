import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: editor de templates de comprovante removido → Relatórios. */
export default function GestaoTemplatesPage() {
  return <Navigate to={createPageUrl('Relatorios')} replace />;
}
