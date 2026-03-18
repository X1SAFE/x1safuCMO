/**
 * TokenLogo — SVG logos for USDC.X, XNT, XEN, X1SAFE
 * Usage: <TokenLogo token="USDCX" size={28} />
 */

interface Props {
  token: 'USDCX' | 'XNT' | 'XEN' | 'X1SAFE'
  size?: number
  style?: React.CSSProperties
}

export function TokenLogo({ token, size = 28, style }: Props) {
  const s = size
  const r = Math.round(s * 0.28)   // corner radius

  switch (token) {

    /* ── USDC.X — blue circle, $ center ── */
    case 'USDCX':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={style}>
          <circle cx="16" cy="16" r="16" fill="#2775CA"/>
          <circle cx="16" cy="16" r="12.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
          {/* X1 badge top-right */}
          <circle cx="24" cy="8" r="5" fill="#0f1923"/>
          <text x="24" y="11.2" textAnchor="middle" fill="#2775CA"
            fontFamily="'Geist', sans-serif" fontWeight="800" fontSize="5.5">X1</text>
          {/* $ sign */}
          <text x="15.5" y="21.5" textAnchor="middle" fill="white"
            fontFamily="'Geist', sans-serif" fontWeight="700" fontSize="14">$</text>
          {/* USDC label */}
          <text x="16" y="28.5" textAnchor="middle" fill="rgba(255,255,255,0.55)"
            fontFamily="'Geist', sans-serif" fontWeight="600" fontSize="4.2" letterSpacing="0.3">USDC</text>
        </svg>
      )

    /* ── XNT — deep purple, X1 native token ── */
    case 'XNT':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={style}>
          <defs>
            <linearGradient id="xnt-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c3aed"/>
              <stop offset="100%" stopColor="#4f46e5"/>
            </linearGradient>
            <linearGradient id="xnt-glow" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx={r} fill="url(#xnt-grad)"/>
          <rect width="32" height="32" rx={r} fill="url(#xnt-glow)"/>
          {/* Hexagon shape */}
          <path d="M16 6 L24.66 11 L24.66 21 L16 26 L7.34 21 L7.34 11 Z"
            fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          {/* XNT letters */}
          <text x="16" y="20.5" textAnchor="middle" fill="white"
            fontFamily="'Geist', sans-serif" fontWeight="800" fontSize="10" letterSpacing="-0.5">XNT</text>
        </svg>
      )

    /* ── XEN — amber/orange, energy feel ── */
    case 'XEN':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={style}>
          <defs>
            <linearGradient id="xen-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f59e0b"/>
              <stop offset="100%" stopColor="#d97706"/>
            </linearGradient>
            <radialGradient id="xen-core" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
          </defs>
          <rect width="32" height="32" rx={r} fill="url(#xen-grad)"/>
          <rect width="32" height="32" rx={r} fill="url(#xen-core)"/>
          {/* X cross / lightning */}
          <path d="M10 10 L22 22 M22 10 L10 22" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M10 10 L22 22 M22 10 L10 22" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          {/* Dot center */}
          <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.9"/>
        </svg>
      )

    /* ── X1SAFE — shield, green ── */
    case 'X1SAFE':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={style}>
          <defs>
            <linearGradient id="safe-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#16a34a"/>
              <stop offset="100%" stopColor="#15803d"/>
            </linearGradient>
            <radialGradient id="safe-glow" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#86efac" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
          </defs>
          <rect width="32" height="32" rx={r} fill="url(#safe-grad)"/>
          <rect width="32" height="32" rx={r} fill="url(#safe-glow)"/>
          {/* Shield */}
          <path d="M16 6 L8 9.5 L8 16.5 C8 21 11.5 24.8 16 26 C20.5 24.8 24 21 24 16.5 L24 9.5 Z"
            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
          {/* Checkmark */}
          <path d="M12 16.5 L14.5 19 L20 13.5"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={style}>
          <rect width="32" height="32" rx={r} fill="#1a1a1a"/>
          <text x="16" y="21" textAnchor="middle" fill="#666"
            fontFamily="sans-serif" fontWeight="700" fontSize="12">?</text>
        </svg>
      )
  }
}

/* Helper: map asset key → TokenLogo token prop */
export function AssetLogo({ assetKey, size = 28, style }: {
  assetKey: string; size?: number; style?: React.CSSProperties
}) {
  const map: Record<string, 'USDCX' | 'XNT' | 'XEN' | 'X1SAFE'> = {
    USDCX: 'USDCX', XNT: 'XNT', XEN: 'XEN', X1SAFE: 'X1SAFE',
  }
  const token = map[assetKey]
  if (!token) return <span style={{ fontSize: size * 0.6, ...style }}>◈</span>
  return <TokenLogo token={token} size={size} style={style} />
}
