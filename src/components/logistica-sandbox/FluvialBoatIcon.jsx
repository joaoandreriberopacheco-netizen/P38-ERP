import React from 'react';

/**
 * Ícone de embarcação — SVG inline (sem URL externa).
 */
export default function FluvialBoatIcon({
  size = 16,
  rotation = 0,
  stroke = '#ffffff',
  strokeWidth = 1,
  fill = 'transparent',
  className = '',
}) {
  const half = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-half} ${-half} ${size} ${size}`}
      className={className}
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d={fluvialBoatIconPath(1)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function fluvialBoatIconPath(scale = 1) {
  const s = scale;
  return [
    `M 0 ${-3.2 * s}`,
    `C ${0.9 * s} ${-1.4 * s} ${1.1 * s} ${0.8 * s} ${0.55 * s} ${2.4 * s}`,
    `L 0 ${1.9 * s}`,
    `L ${-0.55 * s} ${2.4 * s}`,
    `C ${-1.1 * s} ${0.8 * s} ${-0.9 * s} ${-1.4 * s} 0 ${-3.2 * s}`,
    'Z',
  ].join(' ');
}
