/**
 * TokenLogo — Official token logos from xDEX
 * Sources: api.xdex.xyz/api/xendex/pool/list (live token_logo fields)
 *
 * USDC.X → x1logos.s3.us-east-1.amazonaws.com/48-usdcx.png
 * XNT    → app.xdex.xyz/assets/images/tokens/x1.webp  (WXNT logo)
 * XEN    → mint.xdex.xyz/ipfs/QmQtE9X... (official XEN logo on xDEX)
 * X1SAFE → SVG shield (no official logo yet — custom branded)
 */

const XEN_LOGO = 'https://mint.xdex.xyz/ipfs/QmQtE9XqZD9vvMY5gBjYmHEdd78LE5e5gqf8f1XEDwSdjL?pinataGatewayToken=yMPvcPv-nyFCJ0GGUmoHxYkuVS6bZxS_ucWqpMpVMedA3_nOdJO5uUqA8dibii5a'

const LOGOS: Record<string, string | null> = {
  USDCX:  'https://x1logos.s3.us-east-1.amazonaws.com/48-usdcx.png',
  XNT:    'https://app.xdex.xyz/assets/images/tokens/x1.webp',
  XEN:    XEN_LOGO,
  XNM:    'https://app.xdex.xyz/assets/images/tokens/xnm.webp',
  X1SAFE: null,  // custom SVG below
}

interface Props {
  token: 'USDCX' | 'XNT' | 'XEN' | 'XNM' | 'X1SAFE'
  size?: number
  style?: React.CSSProperties
}

export function TokenLogo({ token, size = 28, style }: Props) {
  const s    = size
  const r    = Math.round(s * 0.28)
  const url  = LOGOS[token]

  /* ── Official image logo ── */
  if (url) {
    return (
      <img
        src={url}
        alt={token}
        width={s}
        height={s}
        style={{
          borderRadius: r,
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
          ...style,
        }}
        onError={e => {
          // Fallback to SVG initials on load failure
          const el = e.currentTarget
          el.style.display = 'none'
          const fb = el.nextSibling as HTMLElement | null
          if (fb) fb.style.display = 'flex'
        }}
      />
    )
  }

  /* ── X1SAFE — custom SVG shield ── */
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
      <path d="M16 6 L8 9.5 L8 16.5 C8 21 11.5 24.8 16 26 C20.5 24.8 24 21 24 16.5 L24 9.5 Z"
        fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
      <path d="M12 16.5 L14.5 19 L20 13.5"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* Helper: map asset key → TokenLogo */
export function AssetLogo({ assetKey, size = 28, style }: {
  assetKey: string; size?: number; style?: React.CSSProperties
}) {
  const map: Record<string, 'USDCX' | 'XNT' | 'XEN' | 'XNM' | 'X1SAFE'> = {
    USDCX: 'USDCX', XNT: 'XNT', XEN: 'XEN', XNM: 'XNM', X1SAFE: 'X1SAFE',
  }
  const token = map[assetKey]
  if (!token) return <span style={{ fontSize: size * 0.6, ...style }}>◈</span>
  return <TokenLogo token={token} size={size} style={style} />
}
