import { useRef, useEffect } from 'react';
import { spatialTick } from './haptics';

// Attaches an IntersectionObserver to the returned ref.
// Fires spatialTick() each time the element enters the viewport — gives
// financial data sections a physical "dial notch" sensation as the user scrolls.
//
// Usage:
//   const sectionRef = useSpatialHaptic();
//   <div ref={sectionRef}>...</div>

export function useSpatialHaptic(threshold = 0.15) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let fired = false; // only tick on first entry, not on every scroll-back
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !fired) {
            fired = true;
            spatialTick();
          }
          if (!e.isIntersecting) {
            fired = false; // reset so it fires again on next entry
          }
        });
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
