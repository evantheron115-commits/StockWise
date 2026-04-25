// Shimmer skeleton that exactly mirrors the KeyRatios section layout.
// Swap in for the existing basic skeleton in KeyRatios.js loading state.

function Bar({ w = 'w-full', h = 'h-3' }) {
  return <div className={`shimmer ${h} ${w}`} />;
}

function SkeletonSection({ rows }) {
  return (
    <div className="card">
      {/* Section title */}
      <Bar w="w-28" h="h-4" />

      <div className="divide-y divide-white/[0.04] mt-4">
        {rows.map(({ label, value, badge }, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3"
          >
            {/* Left: label + optional sub-note */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <Bar w={label} h="h-3" />
              {Math.random() > 0.5 && <Bar w="w-24" h="h-2" />}
            </div>
            {/* Right: value + optional badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Bar w={value} h="h-3" />
              {badge && <Bar w="w-10" h="h-4" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mirrors the exact KeyRatios section structure:
// Valuation (5 rows), Profitability (6 rows), Financial Health (5 rows), Cash Flow (5 rows)
const SECTIONS = [
  {
    rows: [
      { label: 'w-16', value: 'w-14', badge: true },
      { label: 'w-20', value: 'w-12', badge: true },
      { label: 'w-20', value: 'w-12', badge: true },
      { label: 'w-24', value: 'w-14', badge: true },
      { label: 'w-28', value: 'w-20' },
    ],
  },
  {
    rows: [
      { label: 'w-24', value: 'w-14', badge: true },
      { label: 'w-32', value: 'w-14', badge: true },
      { label: 'w-36', value: 'w-14', badge: true },
      { label: 'w-28', value: 'w-14', badge: true },
      { label: 'w-40', value: 'w-14', badge: true },
      { label: 'w-36', value: 'w-14', badge: true },
    ],
  },
  {
    rows: [
      { label: 'w-28', value: 'w-10', badge: true },
      { label: 'w-24', value: 'w-12', badge: true },
      { label: 'w-24', value: 'w-12', badge: true },
      { label: 'w-20', value: 'w-20' },
      { label: 'w-36', value: 'w-20' },
    ],
  },
  {
    rows: [
      { label: 'w-24', value: 'w-14', badge: true },
      { label: 'w-36', value: 'w-20' },
      { label: 'w-28', value: 'w-20', badge: true },
      { label: 'w-32', value: 'w-10', badge: true },
      { label: 'w-28', value: 'w-14' },
    ],
  },
];

export default function FinancialSkeleton() {
  return (
    <div className="space-y-4 mb-6">
      {SECTIONS.map((section, i) => (
        <SkeletonSection key={i} rows={section.rows} />
      ))}
    </div>
  );
}
