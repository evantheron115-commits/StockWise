'use strict';

// Normalise a raw ticker string and return an ordered list of variants to try.
// ORCL → ['ORCL']
// BRK.B → ['BRK.B', 'BRK-B', 'BRKB']
// BRK-B → ['BRK-B', 'BRK.B', 'BRKB']
function tickerVariants(raw) {
  if (!raw) return [];
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!t) return [];
  const seen = new Set([t]);
  if (t.includes('.')) {
    const dash = t.replace(/\./g, '-');
    const bare = t.replace(/\./g, '');
    if (!seen.has(dash)) seen.add(dash);
    if (!seen.has(bare)) seen.add(bare);
  } else if (t.includes('-')) {
    const dot  = t.replace(/-/g, '.');
    const bare = t.replace(/-/g, '');
    if (!seen.has(dot))  seen.add(dot);
    if (!seen.has(bare)) seen.add(bare);
  }
  return [...seen];
}

module.exports = { tickerVariants };
