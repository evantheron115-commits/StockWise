'use strict';

// Thundering-herd protection: when N concurrent requests arrive for the same
// key, only the first fires the upstream fetcher. The rest subscribe to its
// Promise and receive the same resolved value when it completes.
//
// This is the single source of truth for in-flight deduplication.
// cache.js imports `coalesce` from here instead of duplicating the logic.

const pending = new Map();

async function coalesce(key, fetcher) {
  if (pending.has(key)) return pending.get(key);
  const p = fetcher().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

function inFlightCount() {
  return pending.size;
}

function inFlightKeys() {
  return [...pending.keys()];
}

module.exports = { coalesce, inFlightCount, inFlightKeys };
