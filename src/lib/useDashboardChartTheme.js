import { useEffect, useState } from 'react';

const LIGHT = {
  tick: { fontSize: 11, fill: '#434a40', fontWeight: 600 },
  grid: 'rgba(74, 82, 64, 0.12)',
  cursor: 'rgba(74, 82, 64, 0.08)',
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
  lineMeta: '#4a5240',
};

const DARK = {
  tick: { fontSize: 11, fill: '#d7deea', fontWeight: 600 },
  grid: 'rgba(148, 163, 184, 0.14)',
  cursor: 'rgba(148, 163, 184, 0.16)',
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

/** Tema Recharts para dashboard — reage a html.dark. */
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
