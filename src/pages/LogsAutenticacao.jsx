import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: logs de autenticação removidos → Configurações. */
export default function LogsAutenticacaoPage() {
  return <Navigate to={createPageUrl('Configuracoes')} replace />;
}
