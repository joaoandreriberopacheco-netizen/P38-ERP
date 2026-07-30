import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: ferramenta interna de auditoria de código — removida da UI. */
export default function AuditoriaCodigoProjetoPage() {
  return <Navigate to={createPageUrl('Configuracoes')} replace />;
}
