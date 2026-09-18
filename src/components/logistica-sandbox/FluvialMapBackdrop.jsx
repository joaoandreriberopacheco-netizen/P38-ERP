/**
 * Fundo estilizado — corredor Amazônia oeste→leste (não é mapa GPS).
 * Terra sólida nas bordas, rio no centro, grade fina tipo tracking dashboard.
 */
export default function FluvialMapBackdrop({ uid }) {
  return (
    <g className="fluvial-map-backdrop" aria-hidden="true">
      <defs>
        <pattern id={`${uid}-grid`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="0.15" />
        </pattern>
        <linearGradient id={`${uid}-river-channel`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="18%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.07)" />
          <stop offset="82%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <radialGradient id={`${uid}-land-fade`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="160" height="100" fill="#060606" />
      <rect x="0" y="0" width="160" height="100" fill={`url(#${uid}-grid)`} />

      {/* Massa de terra oeste */}
      <path
        d="M 0 0 L 52 0 L 48 18 C 44 28 40 42 38 58 C 36 72 34 86 32 100 L 0 100 Z"
        fill="#101010"
      />
      {/* Massa de terra leste */}
      <path
        d="M 160 0 L 108 0 L 112 18 C 116 28 120 42 122 58 C 124 72 126 86 128 100 L 160 100 Z"
        fill="#101010"
      />

      {/* Corredor fluvial */}
      <path
        d="M 38 58 C 46 52 54 48 62 46 C 78 42 88 42 98 46 C 106 48 114 52 122 58
           C 114 64 106 68 98 70 C 88 74 78 74 68 70 C 58 68 50 64 42 58 Z"
        fill={`url(#${uid}-river-channel)`}
      />
      <path
        d="M 42 58 C 54 50 72 46 80 46 C 92 46 108 52 118 58
           C 108 64 92 70 80 70 C 68 70 52 66 42 58 Z"
        fill="rgba(255,255,255,0.015)"
      />

      {/* Afluentes decorativos */}
      <path d="M 48 24 C 58 30 66 38 72 48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.35" />
      <path d="M 112 24 C 102 30 94 38 88 48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.35" />

      <rect x="0" y="0" width="160" height="100" fill={`url(#${uid}-land-fade)`} />
    </g>
  );
}
