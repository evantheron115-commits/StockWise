// Zero-dash UI primitive.
// Renders a formatted metric value, or context-aware fallback:
//   loading + no value → "Estimating…" (pulsing, faded)
//   no value, not loading → "N/A" (faded)
//   value present → formatted output
//
// Props:
//   value    — the raw number/string to display
//   format   — optional function(value) → string  e.g. (v) => `$${v.toFixed(2)}`
//   loading  — bool: true while a background fetch is in flight
//   className — extra classes applied to the outer <span>
//   naText   — override the "N/A" string (e.g. "—" for legacy compat, "Pending")

export default function MetricDisplay({
  value,
  format,
  loading   = false,
  className = '',
  naText    = 'N/A',
}) {
  const isValid = value != null && value !== '' && value !== false &&
                  !(typeof value === 'number' && !isFinite(value));

  if (isValid) {
    return (
      <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format ? format(value) : value}
      </span>
    );
  }

  if (loading) {
    return (
      <span
        className={`animate-pulse ${className}`}
        style={{ color: 'rgba(156,163,175,0.45)' }}
      >
        Estimating…
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ color: 'rgba(156,163,175,0.35)' }}
    >
      {naText}
    </span>
  );
}
