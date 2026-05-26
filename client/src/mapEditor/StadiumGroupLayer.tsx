import { Suspense, useMemo } from 'react';
import { Arena } from '../game/Arena';
import { ArenaLighting } from '../game/ArenaLighting';
import { ARENA } from '../shared/Constants';
import { ARENA_GOALS } from '../game/goals';
import { getArenaCornerPillarLayouts } from '../game/arenaPillars';
import { OctagonPlatform } from '../game/OctagonPlatform';
import { RocccitLogoStamp } from '../game/RocccitLogoStamp';
import type { MapGroup } from './mapEditorTypes';
import { parseStadiumKey } from './stadiumLayout';
import { StadiumGoalVisual, StadiumPillarVisual } from './StadiumPieceVisuals';

function StadiumGroupVisual({ stadiumKey }: { stadiumKey: string }) {
  const parsed = parseStadiumKey(stadiumKey);
  const content = useMemo(() => {
    if (!parsed) return null;
    if (parsed.kind === 'goal') {
      const goal = ARENA_GOALS.find((g) => g.id === parsed.goalId);
      if (!goal) return null;
      return <StadiumGoalVisual goal={goal} />;
    }
    if (parsed.kind === 'platform') {
      return (
        <>
          <OctagonPlatform x={0} z={0} sizeScale={1} />
          {parsed.index === 0 && (
            <group
              position={[0, ARENA.platformTopHeight + 0.04, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <RocccitLogoStamp size={16} maxWidth={18} maxHeight={9} />
            </group>
          )}
        </>
      );
    }
    const layout = getArenaCornerPillarLayouts()[parsed.index];
    if (!layout) return null;
    return <StadiumPillarVisual pillarX={layout.x} pillarZ={layout.z} />;
  }, [parsed, stadiumKey]);

  return content;
}

function stadiumPickSize(stadiumKey: string): number {
  const parsed = parseStadiumKey(stadiumKey);
  if (parsed?.kind === 'goal') {
    return ARENA_GOALS.find((g) => g.id === parsed.goalId)?.ringRadius ?? 4;
  }
  if (parsed?.kind === 'platform') {
    return ARENA.octagonSlopeRadius * 1.05;
  }
  return 6;
}

type StadiumPickProps = {
  stadiumKey: string;
  selected: boolean;
  onSelect?: (id: string) => void;
  groupId: string;
};

export function StadiumGroupPickMesh({
  stadiumKey,
  selected,
  onSelect,
  groupId,
}: StadiumPickProps) {
  const parsed = parseStadiumKey(stadiumKey);
  const pickSize = stadiumPickSize(stadiumKey);

  const handlePick = onSelect
    ? (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onSelect(groupId);
      }
    : undefined;

  if (!handlePick) return null;

  return (
    <>
      <mesh onPointerDown={handlePick} onClick={handlePick}>
        {parsed?.kind === 'goal' ? (
          <sphereGeometry args={[pickSize * 1.35, 10, 10]} />
        ) : parsed?.kind === 'platform' ? (
          <cylinderGeometry args={[pickSize, pickSize, 3, 8]} />
        ) : (
          <cylinderGeometry args={[4.5, 4.5, 14, 8]} />
        )}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh>
          {parsed?.kind === 'goal' ? (
            <sphereGeometry args={[pickSize * 1.4, 12, 12]} />
          ) : parsed?.kind === 'platform' ? (
            <cylinderGeometry args={[pickSize * 1.04, pickSize * 1.04, 3.2, 8]} />
          ) : (
            <cylinderGeometry args={[4.8, 4.8, 14.5, 8]} />
          )}
          <meshBasicMaterial
            color="#44ddff"
            wireframe
            transparent
            opacity={0.45}
            depthTest={false}
          />
        </mesh>
      )}
    </>
  );
}

export { StadiumGroupVisual };

type StadiumGroupLayerProps = {
  groups: MapGroup[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

/** Renders movable stadium pieces at saved group transforms (play mode / static). */
export function StadiumGroupLayer({
  groups,
  selectedId = null,
  onSelect,
}: StadiumGroupLayerProps) {
  const stadiumGroups = groups.filter((g) => g.stadiumKey);

  return (
    <>
      {stadiumGroups.map((group) => (
        <group
          key={group.id}
          position={group.position}
          rotation={group.rotation}
          scale={group.scale}
        >
          {group.stadiumKey && <StadiumGroupVisual stadiumKey={group.stadiumKey} />}
          {group.stadiumKey && onSelect && (
            <StadiumGroupPickMesh
              stadiumKey={group.stadiumKey}
              selected={selectedId === group.id}
              onSelect={onSelect}
              groupId={group.id}
            />
          )}
        </group>
      ))}
    </>
  );
}

export function EditorBaseArena({
  hiddenGoalIds,
  hiddenPillarIndices,
  hiddenPlatformIndices,
}: {
  hiddenGoalIds: string[];
  hiddenPillarIndices: number[];
  hiddenPlatformIndices: number[];
}) {
  return (
    <>
      <ArenaLighting />
      <Suspense fallback={null}>
        <Arena
          hiddenGoalIds={hiddenGoalIds}
          hiddenPillarIndices={hiddenPillarIndices}
          hiddenPlatformIndices={hiddenPlatformIndices}
        />
      </Suspense>
    </>
  );
}
