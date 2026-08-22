import { useEffect, useState } from 'react';
import { P38_LIGHT_HEX } from '@/lib/p38LightTheme';

const LIGHT = {
  tick: { fontSize: 11, fill: P38_LIGHT_HEX.textSub, fontWeight: 600 },
  axisTickY: { fontSize: 9, fill: '#9ca3af', fontWeight: 400 },
  axisTickX: { fontSize: 9, fill: '#b0b0b0', fontWeight: 400 },
  grid: 'rgba(0, 0, 0, 0.06)',
  cursor: 'rgba(0, 0, 0, 0.04)',
  pieStroke: P38_LIGHT_HEX.bg,
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      border: `1px solid ${P38_LIGHT_HEX.border}`,
      borderRadius: 10,
      color: P38_LIGHT_HEX.text,
      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
    },
    labelStyle: { color: P38_LIGHT_HEX.text, fontWeight: 700 },
    itemStyle: { color: P38_LIGHT_HEX.textMuted },
  },
  linePrimary: P38_LIGHT_HEX.citrus,
  lineBreakEven: '#dc2626',
  lineMeta: P38_LIGHT_HEX.olive,
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
