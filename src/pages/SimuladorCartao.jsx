import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: simulador em página removido — usar sheet no PDV/Orçamento. */
export default function SimuladorCartaoPage() {
  return <Navigate to={createPageUrl('PDV')} replace />;
}
