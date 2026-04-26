// Returns true when a formatted value string contains real data (not a dash/empty).
// Use this to filter rows before rendering — never show a row the user can't act on.
export function isPresent(formattedValue) {
  return formattedValue != null && formattedValue !== '—' && formattedValue !== '';
}

// Filters a KeyRatios-style rows array, removing entries with no displayable data.
export function filterRows(rows) {
  return rows.filter(row => isPresent(row.value));
}
