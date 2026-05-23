/** Called when bottom flaps finish opening — releases the kickoff ball */
let releaseHandler: (() => void) | null = null;

export function setKickoffBallReleaseHandler(fn: (() => void) | null) {
  releaseHandler = fn;
}

export function triggerKickoffBallRelease() {
  releaseHandler?.();
}
