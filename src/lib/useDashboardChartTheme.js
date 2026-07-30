import { useEffect, useState } from 'react';

const LIGHT = {
  tick: { fontSize: 11, fill: '#111827', fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#9CA3AF', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#9CA3AF', fontWeight: 400 },
  grid: 'rgba(0, 0, 0, 0.05)',
  cursor: 'rgba(0, 0, 0, 0.04)',
  pieStroke: '#ffffff',
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
      borderRadius: 12,
      color: '#111827',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    },
    labelStyle: { color: '#111827', fontWeight: 700 },
    itemStyle: { color: '#6B7280' },
  },
  linePrimary: '#84CC16',
  lineBreakEven: '#DC2626',
  lineMeta: '#65A30D',
  barPrimary: '#84CC16',
  barMuted: '#E5E7EB',
  ringPrimary: '#84CC16',
  ringTrack: '#374151',
};

const DARK = {
  tick: { fontSize: 11, fill: '#F9FAFB', fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#A1A1AA', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#A1A1AA', fontWeight: 400 },
  grid: 'rgba(255, 255, 255, 0.06)',
  cursor: 'rgba(255, 255, 255, 0.05)',
  pieStroke: '#1C1C1E',
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(9, 9, 11, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      color: '#F9FAFB',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
    },
    labelStyle: { color: '#F9FAFB', fontWeight: 700 },
    itemStyle: { color: '#A1A1AA' },
  },
  linePrimary: '#C3FB12',
  lineBreakEven: '#EF4444',
  lineMeta: '#A3E635',
  barPrimary: '#C3FB12',
  barMuted: '#3F3F46',
  ringPrimary: '#C3FB12',
  ringTrack: '#3F3F46',
};

function readIsDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** Tema Recharts para dashboard — premium claro/escuro. */
export function useDashboardChartTheme() {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark ? DARK : LIGHT;
}
