import { useEffect, useState } from 'react';
import { useP38DashboardLightShell } from '@/paiol/components/dashboard/P38DashboardLightContext';

const LIGHT = {
  tick: { fontSize: 11, fill: '#434a40', fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#9aa094', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#a8afa4', fontWeight: 400 },
  grid: 'rgba(74, 82, 64, 0.07)',
  cursor: 'rgba(74, 82, 64, 0.06)',
  pieStroke: '#ffffff',
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid rgba(74, 82, 64, 0.18)',
      borderRadius: 10,
      color: '#2a2f28',
      boxShadow: '0 8px 20px rgba(74, 82, 64, 0.12)',
    },
    labelStyle: { color: '#2a2f28', fontWeight: 700 },
    itemStyle: { color: '#5c6358' },
  },
  linePrimary: '#6b7a52',
  lineBreakEven: '#dc2626',
  lineMeta: '#5c7e44',
};

/** Gráficos na folha branca (modo claro mobile — shell Labotrat). */
const LIGHT_SHEET = {
  tick: { fontSize: 11, fill: '#111827', fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#9ca3af', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#9ca3af', fontWeight: 400 },
  grid: 'rgba(0, 0, 0, 0.06)',
  cursor: 'rgba(0, 0, 0, 0.04)',
  pieStroke: '#ffffff',
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
      borderRadius: 12,
      color: '#111827',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
    labelStyle: { color: '#111827', fontWeight: 700 },
    itemStyle: { color: '#6b7280' },
  },
  linePrimary: '#84cc16',
  lineBreakEven: '#dc2626',
  lineMeta: '#65a30d',
};

const DARK = {
  tick: { fontSize: 11, fill: '#d7deea', fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#64748b', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#6b7a90', fontWeight: 400 },
  grid: 'rgba(148, 163, 184, 0.08)',
  cursor: 'rgba(148, 163, 184, 0.1)',
  pieStroke: '#2b3342',
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(3, 7, 18, 0.95)',
      border: '1px solid rgba(148, 163, 184, 0.35)',
      borderRadius: 10,
      color: '#edf2f7',
      boxShadow: '0 12px 26px rgba(0, 0, 0, 0.45)',
    },
    labelStyle: { color: '#e2e8f0', fontWeight: 700 },
    itemStyle: { color: '#cbd5e1' },
  },
  linePrimary: '#abc85a',
  lineBreakEven: '#ef4444',
  lineMeta: '#22c55e',
};

function readIsDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** Tema Recharts para dashboard — reage a html.dark e shell modo claro mobile. */
export function useDashboardChartTheme() {
  const isLightShell = useP38DashboardLightShell();
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (isLightShell) return LIGHT_SHEET;
  return isDark ? DARK : LIGHT;
}
