import React from 'react';
import { fluvialBoatIconPath } from '@/components/logistica-sandbox/FluvialBoatIcon';

/**
 * Avatar da embarcação — SVG inline (sem dependência de URL externa).
 */
export default function FluvialVesselAvatar({
  size = 40,
  initials = '—',
  active = false,
  className = '',
}) {
  const iconSize = Math.round(size * 0.52);

  return (
    <div
      className={`fluvial-vessel-avatar ${active ? 'fluvial-vessel-avatar--active' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox={`${-iconSize / 2} ${-iconSize / 2} ${iconSize} ${iconSize}`}
        className="fluvial-vessel-avatar__boat"
      >
        <path
          d={fluvialBoatIconPath(1)}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={0.35}
          strokeLinejoin="round"
        />
      </svg>
      <span className="fluvial-vessel-avatar__initials">{initials}</span>
    </div>
  );
}
