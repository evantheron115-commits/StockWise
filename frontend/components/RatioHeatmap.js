// Shows where `value` sits within [min, max] as a small glass track with a glowing dot.
// higherIsBetter=true  → right side is green (higher = better)
// higherIsBetter=false → left side is green (lower  = better)
export default function RatioHeatmap({ value, min, max, higherIsBetter = true }) {
  if (value == null || isNaN(value) || min == null || max == null || min >= max) return null;

  const clamped = Math.min(Math.max(value, min), max);
  const pos     = (clamped - min) / (max - min); // 0 = min, 1 = max

  // goodness: 1 = great, 0 = bad — direction flips with higherIsBetter
  const goodness = higherIsBetter ? pos : 1 - pos;
  const dotColor = goodness > 0.6
    ? '#34d399'
    : goodness > 0.35
      ? '#fbbf24'
      : '#f87171';

  const gradient = higherIsBetter
    ? 'linear-gradient(to right, rgba(248,113,113,0.22), rgba(251,191,36,0.22), rgba(52,211,153,0.22))'
    : 'linear-gradient(to right, rgba(52,211,153,0.22), rgba(251,191,36,0.22), rgba(248,113,113,0.22))';

  return (
    // Outer wrapper allows the dot to overflow the track height
    <div style={{ position: 'relative', width: 72, height: 10, flexShrink: 0 }}>
      {/* Track */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         0,
        right:        0,
        transform:    'translateY(-50%)',
        height:       4,
        borderRadius: 999,
        background:   'rgba(255,255,255,0.05)',
        border:       '1px solid rgba(255,255,255,0.08)',
        overflow:     'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: gradient }} />
      </div>

      {/* Glowing dot */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         `${pos * 100}%`,
        transform:    'translate(-50%, -50%)',
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   dotColor,
        boxShadow:    `0 0 10px 2px ${dotColor}`,
        border:       '1.5px solid rgba(13,15,24,0.85)',
        flexShrink:   0,
      }} />
    </div>
  );
}
