export function isMobileControlsLikely(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { maxTouchPoints?: number };
  return (
    (nav.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.innerWidth <= 900
  );
}
