import { useMemo } from 'react';

const SYMBOLS = ['$', '%', 'Σ', 'Δ', '±', '→', '▲', '◆', 'π', '∫', '∞', '∂'];
const COUNT   = 18;

export default function DataStreamOverlay() {
  const streams = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      id:       i,
      left:     `${(i / COUNT) * 100 + (Math.sin(i * 1.7) * 2)}%`,
      delay:    `${((i * 0.31) % 4).toFixed(2)}s`,
      duration: `${(3.5 + (i % 5) * 0.6).toFixed(2)}s`,
      chars:    Array.from({ length: 9 }, (__, j) =>
        SYMBOLS[(i * 3 + j * 7) % SYMBOLS.length]
      ),
    })), []
  );

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset:         0,
        zIndex:        0,
        pointerEvents: 'none',
        overflow:      'hidden',
      }}
    >
      {streams.map((s) => (
        <div
          key={s.id}
          style={{
            position:      'absolute',
            left:          s.left,
            top:           0,
            display:       'flex',
            flexDirection: 'column',
            gap:           '7px',
            animation:     `data-stream ${s.duration} ${s.delay} linear infinite`,
            willChange:    'transform',
            color:         'rgba(99,102,241,0.16)',
            fontSize:      '10px',
            fontFamily:    'JetBrains Mono, monospace',
            fontWeight:    500,
            userSelect:    'none',
          }}
        >
          {s.chars.map((c, i) => <span key={i}>{c}</span>)}
        </div>
      ))}
    </div>
  );
}
