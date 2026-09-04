import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: auditoria de PINs removida → Configurações. */
export default function AuditoriaPinsPage() {
  return <Navigate to={createPageUrl('Configuracoes')} replace />;
}
