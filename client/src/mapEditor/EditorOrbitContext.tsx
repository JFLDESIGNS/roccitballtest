import { createContext, useContext, type RefObject } from 'react';
import type { OrbitControls } from '@react-three/drei';

export const EditorOrbitContext = createContext<RefObject<
  React.ComponentRef<typeof OrbitControls> | null
> | null>(null);

export function useEditorOrbit() {
  return useContext(EditorOrbitContext);
}
