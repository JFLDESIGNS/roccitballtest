import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { RigidBody, type RigidBodyProps } from '@react-three/rapier';
import { useArenaVisualOnly } from './arenaVisualOnly';

function isColliderElement(el: ReactElement): boolean {
  const t = el.type as { displayName?: string; name?: string };
  const label = t?.displayName ?? t?.name ?? '';
  return label.includes('Collider');
}

function visualsOnly(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (isColliderElement(child)) return null;
    const props = child.props as { children?: ReactNode };
    if (props.children != null) {
      return cloneElement(child, {}, visualsOnly(props.children));
    }
    return child;
  });
}

/** RigidBody in play mode; plain group + meshes in map editor (no Rapier). */
export function MaybeRigidBody({ children, ...props }: RigidBodyProps) {
  const visualOnly = useArenaVisualOnly();
  if (visualOnly) return <group>{visualsOnly(children)}</group>;
  return <RigidBody {...props}>{children}</RigidBody>;
}
