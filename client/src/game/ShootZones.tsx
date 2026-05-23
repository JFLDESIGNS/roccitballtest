import * as THREE from 'three';
import { ARENA, BOT } from '../shared/Constants';
import { getShootZoneCenter } from './botShootZone';
import type { Team } from '../shared/Types';

const shellMatRed = new THREE.MeshBasicMaterial({
  color: '#ff5533',
  transparent: true,
  opacity: BOT.shootZoneVisualOpacity,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const shellMatBlue = new THREE.MeshBasicMaterial({
  color: '#3388ff',
  transparent: true,
  opacity: BOT.shootZoneVisualOpacity,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const capMatRed = new THREE.MeshBasicMaterial({
  color: '#ff5533',
  transparent: true,
  opacity: BOT.shootZoneCapOpacity,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const capMatBlue = new THREE.MeshBasicMaterial({
  color: '#3388ff',
  transparent: true,
  opacity: BOT.shootZoneCapOpacity,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const edgeMatRed = new THREE.LineBasicMaterial({
  color: '#ffaa88',
  transparent: true,
  opacity: BOT.shootZoneEdgeOpacity,
  depthWrite: false,
  depthTest: true,
  toneMapped: false,
});

const edgeMatBlue = new THREE.LineBasicMaterial({
  color: '#88ccff',
  transparent: true,
  opacity: BOT.shootZoneEdgeOpacity,
  depthWrite: false,
  depthTest: true,
  toneMapped: false,
});

function ShootZoneCylinder({ team }: { team: Team }) {
  const center = getShootZoneCenter(team);
  const radius = BOT.shootZoneRadiusM;
  const height = BOT.shootZoneHeightM;
  const yBase = ARENA.floorY;
  const shellMat = team === 'red' ? shellMatRed : shellMatBlue;
  const capMat = team === 'red' ? capMatRed : capMatBlue;
  const edgeMat = team === 'red' ? edgeMatRed : edgeMatBlue;

  return (
    <group position={[center.x, yBase, center.z]}>
      <mesh
        position={[0, height * 0.5, 0]}
        material={shellMat}
        renderOrder={12}
        frustumCulled={false}
      >
        <cylinderGeometry args={[radius, radius, height, 64, 1, true]} />
      </mesh>

      <mesh
        position={[0, height, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={capMat}
        renderOrder={13}
        frustumCulled={false}
      >
        <circleGeometry args={[radius, 64]} />
      </mesh>
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={capMat}
        renderOrder={13}
        frustumCulled={false}
      >
        <circleGeometry args={[radius, 64]} />
      </mesh>

      <lineSegments
        position={[0, height * 0.5, 0]}
        renderOrder={14}
        frustumCulled={false}
      >
        <edgesGeometry
          args={[new THREE.CylinderGeometry(radius, radius, height, 48, 1, true), 12]}
        />
        <primitive object={edgeMat} attach="material" />
      </lineSegments>
    </group>
  );
}

/** Transparent offensive zones at each net — always visible during play. */
export function ShootZones() {
  return (
    <>
      <ShootZoneCylinder team="red" />
      <ShootZoneCylinder team="blue" />
    </>
  );
}
