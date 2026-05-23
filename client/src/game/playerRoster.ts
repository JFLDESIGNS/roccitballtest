import type { BotId } from './gameStore';

export type ActorId = 'local' | BotId;

export type ActorProfile = {
  displayName: string;
  jerseyNumber: number;
};

const BOT_NAME_POOL = [
  'Blaze',
  'Nova',
  'Viper',
  'Echo',
  'Jinx',
  'Rook',
  'Zed',
  'Kite',
  'Flux',
  'Rex',
  'Onyx',
  'Pixel',
  'Dash',
  'Bolt',
  'Hex',
];

export const DEFAULT_LOCAL_NAME = 'BlazingRokkit23';
export const DEFAULT_LOCAL_JERSEY = 23;

let localProfile: ActorProfile = {
  displayName: DEFAULT_LOCAL_NAME,
  jerseyNumber: DEFAULT_LOCAL_JERSEY,
};
const botProfiles = new Map<BotId, ActorProfile>();

function randomJersey(): number {
  return Math.floor(Math.random() * 100);
}

function pickBotName(used: Set<string>): string {
  const shuffled = [...BOT_NAME_POOL].sort(() => Math.random() - 0.5);
  for (const n of shuffled) {
    if (!used.has(n)) return n;
  }
  return `Bot${Math.floor(Math.random() * 90) + 10}`;
}

export function formatJersey(n: number): string {
  const v = Math.max(0, Math.min(99, Math.floor(n)));
  return v.toString().padStart(2, '0');
}

export function clampJersey(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.floor(n)));
}

export function setLocalProfile(name: string, jerseyNumber: number): void {
  const trimmed = name.trim().slice(0, 18);
  localProfile = {
    displayName: trimmed.length > 0 ? trimmed : DEFAULT_LOCAL_NAME,
    jerseyNumber: clampJersey(jerseyNumber),
  };
}

export function getLocalProfile(): ActorProfile {
  return localProfile;
}

export function assignBotProfiles(ids: BotId[]): void {
  botProfiles.clear();
  const usedNames = new Set<string>();
  const usedNumbers = new Set<number>([localProfile.jerseyNumber]);
  for (const id of ids) {
    let num = randomJersey();
    for (let i = 0; i < 40 && usedNumbers.has(num); i++) {
      num = randomJersey();
    }
    usedNumbers.add(num);
    const displayName = pickBotName(usedNames);
    usedNames.add(displayName);
    botProfiles.set(id, { displayName, jerseyNumber: num });
  }
}

export function getActorProfile(id: ActorId): ActorProfile {
  if (id === 'local') return localProfile;
  return (
    botProfiles.get(id) ?? {
      displayName: id,
      jerseyNumber: 0,
    }
  );
}

export function getDisplayName(id: ActorId): string {
  return getActorProfile(id).displayName;
}

export function getJerseyNumber(id: ActorId): number {
  return getActorProfile(id).jerseyNumber;
}
