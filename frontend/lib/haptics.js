import { IS_NATIVE } from './mobileAuth';

// Lazy-load the Capacitor Haptics plugin once and reuse it.
// Returns null on web or if the plugin is unavailable (older iOS, simulator).
let _mod = null;
async function plugin() {
  if (!IS_NATIVE) return null;
  if (_mod) return _mod;
  try {
    _mod = await import('@capacitor/haptics');
    return _mod;
  } catch {
    return null;
  }
}

// Used on each discrete slider step — mimics iOS picker wheel ticks.
// Call onPointerDown → selectionStart, onChange → selectionChanged, onPointerUp → selectionEnd.
export async function hapticSelectionStart() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.selectionStart(); } catch {}
}

export async function hapticSelectionChanged() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.selectionChanged(); } catch {}
}

export async function hapticSelectionEnd() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.selectionEnd(); } catch {}
}

// Single light tap — chart crosshair ticks, minor UI interactions.
export async function hapticLight() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.impact({ style: h.ImpactStyle.Light }); } catch {}
}

// Satisfying confirmation — watchlist add, DCF result returned.
export async function hapticSuccess() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.notification({ type: h.NotificationType.Success }); } catch {}
}

// Warning — DCF invalid input state entered.
export async function hapticWarning() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.notification({ type: h.NotificationType.Warning }); } catch {}
}

// Spatial tick — fired as content rows enter the viewport while scrolling.
// The lightest possible sensation: mimics a physical index dial turning one notch.
export async function spatialTick() {
  const h = await plugin();
  if (!h) return;
  try { await h.Haptics.impact({ style: h.ImpactStyle.Light }); } catch {}
}

// Market-magnitude haptic — call on each live price update.
// Maps the day's changePercent to physical sensation intensity.
// Sub-0.5% noise is silenced entirely to prevent haptic fatigue.
export async function triggerMarketHaptic(changePercent) {
  const abs = Math.abs(changePercent ?? 0);
  if (abs < 0.5) return;
  const h = await plugin();
  if (!h) return;
  try {
    if (abs > 2.0) {
      // Big move — the "feels like a market event" pulse
      await h.Haptics.notification({ type: h.NotificationType.Success });
    } else {
      // Moderate move — directional confirmation
      await h.Haptics.impact({ style: h.ImpactStyle.Medium });
    }
  } catch {}
}

// Value gravity — fires when the DCF intrinsic value crosses into a proximity zone
// relative to the current market price. Intensity escalates as IV approaches price,
// giving the sliders a physical "gravitational pull" sensation near fair value.
// Call only on zone ENTRY (not continuously) to avoid haptic fatigue.
//
// zone: 'light'  → IV within 25% of price (approaching)
//       'medium' → IV within 10% of price (near)
//       'heavy'  → IV within 3%  of price (at fair value)
export async function hapticValueGravity(zone) {
  const h = await plugin();
  if (!h) return;
  const style = zone === 'heavy'  ? h.ImpactStyle.Heavy
              : zone === 'medium' ? h.ImpactStyle.Medium
              :                     h.ImpactStyle.Light;
  try { await h.Haptics.impact({ style }); } catch {}
}

