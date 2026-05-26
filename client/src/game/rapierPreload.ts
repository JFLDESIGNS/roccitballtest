let preloadPromise: Promise<void> | null = null;

/** Load Rapier WASM once so map-editor / game Physics does not suspend forever. */
export function preloadRapier(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = import('@dimforge/rapier3d-compat')
      .then(async (R) => {
        await R.init();
      })
      .catch((err) => {
        preloadPromise = null;
        throw err;
      });
  }
  return preloadPromise;
}
