import { p38Dashboard, p38DashboardLight } from '@/lib/p38DashboardSurfaces';
import { useP38DashboardLightShell } from '@/paiol/components/dashboard/P38DashboardLightContext';

/** Devolve superfícies do dashboard conforme shell modo claro mobile. */
export function useP38DashboardSurfaces() {
  const isLightShell = useP38DashboardLightShell();
  return isLightShell ? p38DashboardLight : p38Dashboard;
}
