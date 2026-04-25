// Fixed background layer that sits behind all glass cards.
// sentiment: 'bullish' | 'bearish' | 'neutral'
// On native the GPU composites this at 60fps — backdrop-filter on
// glass cards will pick up these colors subtly.

const PALETTES = {
  bullish: {
    a: 'rgba(16, 185, 129, 0.22)', // emerald-500
    b: 'rgba(6,  182, 212, 0.14)', // cyan-500
  },
  bearish: {
    a: 'rgba(239, 68,  68,  0.18)', // red-500
    b: 'rgba(109, 40,  217, 0.14)', // violet-700
  },
  neutral: {
    a: 'rgba(99,  102, 241, 0.16)', // indigo-500
    b: 'rgba(30,  58,  138, 0.12)', // indigo-900
  },
};

export default function AuroraBackground({ sentiment = 'neutral' }) {
  const { a, b } = PALETTES[sentiment] ?? PALETTES.neutral;

  return (
    <div
      aria-hidden="true"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         0,
        pointerEvents:  'none',
        overflow:       'hidden',
      }}
    >
      {/* Orb A — top-left quadrant */}
      <div style={{
        position:     'absolute',
        top:          '-10%',
        left:         '-5%',
        width:        '55vw',
        height:       '55vw',
        maxWidth:     520,
        maxHeight:    520,
        borderRadius: '50%',
        background:   a,
        filter:       'blur(90px)',
        animation:    'aurora-a 28s ease-in-out infinite',
        willChange:   'transform',
      }} />

      {/* Orb B — bottom-right quadrant */}
      <div style={{
        position:     'absolute',
        bottom:       '-8%',
        right:        '-8%',
        width:        '48vw',
        height:       '48vw',
        maxWidth:     460,
        maxHeight:    460,
        borderRadius: '50%',
        background:   b,
        filter:       'blur(80px)',
        animation:    'aurora-b 22s ease-in-out infinite',
        willChange:   'transform',
      }} />
    </div>
  );
}
