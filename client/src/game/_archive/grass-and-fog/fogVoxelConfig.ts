/**
 * Master switch for interactable fog voxel grid (billboards + wireframe cube array).
 * Keep off for performance — gameplay fog carving can be re-enabled later.
 */
export const FOG_VOXEL_ENABLED = false;

export function isFogVoxelEnabled(): boolean {
  return FOG_VOXEL_ENABLED;
}
