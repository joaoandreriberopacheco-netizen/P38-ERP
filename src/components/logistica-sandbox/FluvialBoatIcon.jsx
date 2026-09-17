import React from 'react';

/**
 * Silhueta de barco vista de cima — estilo do rascunho (trapézio fino).
 * rotation em graus; aponta na direção do fluxo no mapa.
 */
export default function FluvialBoatIcon({
  size = 16,
  rotation = 0,
  stroke = '#ffffff',
  strokeWidth = 1,
  fill = '#000000',
  className = '',
}) {
  const half = size / 2;
  const bow = half * 0.55;

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
        d={`M 0 ${-bow} L ${half * 0.72} ${bow * 0.55} L ${half * 0.38} ${bow} L ${-half * 0.38} ${bow} L ${-half * 0.72} ${bow * 0.55} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Versão SVG pura para uso dentro de <svg> do mapa (sem wrapper). */
export function fluvialBoatIconPath(scale = 1) {
  const s = scale;
  return `M 0 ${-2.8 * s} L ${2 * s} ${1.5 * s} L ${1 * s} ${2.8 * s} L ${-1 * s} ${2.8 * s} L ${-2 * s} ${1.5 * s} Z`;
}
