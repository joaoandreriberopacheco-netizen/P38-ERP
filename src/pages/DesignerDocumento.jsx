import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: designer visual de documentos removido → Configurações. */
export default function DesignerDocumentoPage() {
  return <Navigate to={createPageUrl('Configuracoes')} replace />;
}
