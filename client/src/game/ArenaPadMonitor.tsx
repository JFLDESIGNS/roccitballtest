import { useAfterPhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import type { RefObject } from 'react';
import { tickArenaPads } from './arenaPadPhysics';

type ArenaPadMonitorProps = {
  ballBodyRef: RefObject<RapierRigidBody | null>;
};

export function ArenaPadMonitor({ ballBodyRef }: ArenaPadMonitorProps) {
  useAfterPhysicsStep(() => {
    tickArenaPads(ballBodyRef.current);
  });
  return null;
}
