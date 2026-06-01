import type { MatchScore, Team, Vec3 } from '../shared/Types';
import type { ActorProfile } from '../game/playerRoster';
import { gameStore, type GamePhase } from '../game/gameStore';
import { applyNetworkGoalScore } from '../game/goalScoreHandler';

export type MultiplayerStatus = 'offline' | 'connecting' | 'online' | 'error';
export type RoomMode = '1v1' | '2v2' | 'coop-adventure' | 'training';

export type RoomSummary = {
  id: string;
  name: string;
  mode: RoomMode;
  maxPlayers: number;
  playerCount: number;
  readyCount: number;
  inMatch: boolean;
};

export type RoomInfo = RoomSummary;

export type RemoteMultiplayerPlayer = {
  id: string;
  name: string;
  jerseyNumber: number;
  team: Team;
  teamSlot: number;
  position: Vec3;
  velocity: Vec3;
  rotation: { yaw: number; pitch: number };
  visualTilt?: { x: number; y: number; z: number };
  flipActive?: boolean;
  danceActive?: boolean;
  energy: number;
  isSprinting?: boolean;
  isBeaming: boolean;
  isHoldingBall: boolean;
  holdPosition: Vec3 | null;
  coopRagdoll?: boolean;
  playReady?: boolean;
  loadReady?: boolean;
  updatedAt: number;
};

export type NetworkBallState = {
  position: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
  visible?: boolean;
  updatedAt: number;
};

export type NetworkRocketState = {
  id: string;
  ownerId: string;
  position: Vec3;
  velocity: Vec3;
  spawnPos: Vec3;
  segmentStart: Vec3;
  spawnTime: number;
  bouncesLeft: number;
  explosive: boolean;
};

export type NetworkRocketImpact = {
  position: Vec3;
  radius: number;
  rocketVelocity?: Vec3;
  ballImpactNormal?: Vec3;
};

export type NetworkBallAction = {
  id: string;
  ownerId: string;
  kind: 'release';
  position: Vec3;
  velocity: Vec3;
  angularVelocity?: Vec3;
  ballState: 'loose' | 'launched';
};

export type NetworkCoopAction = {
  id: string;
  ownerId: string;
  kind: 'playerPull' | 'playerThrow' | 'playerSetDown' | 'railSpawn' | 'levelAdvance' | 'loveMessage' | 'dance';
  targetId?: string;
  position: Vec3;
  velocity: Vec3;
  holdPosition?: Vec3;
  railKey?: string;
  levelId?: number;
  platformId?: string;
  message?: 'love' | 'more';
};

export type NetworkTrainingObjectAction = {
  id: string;
  ownerId: string;
  kind: 'hold' | 'release';
  objectId: string;
  objectKind: 'ball' | 'cube';
  position: Vec3;
  velocity: Vec3;
  angularVelocity?: Vec3 | null;
};

type NetworkMatchState = {
  phase: GamePhase;
  score: MatchScore;
  timeLeft: number;
  countdown: number;
  arenaSettleCountdown: number;
  loadCountdown: number;
  ballFrozen: boolean;
};

type MultiplayerState = {
  enabled: boolean;
  status: MultiplayerStatus;
  selfId: string | null;
  hostId: string | null;
  roomId: string;
  roomInfo: RoomInfo | null;
  team: Team | null;
  teamSlot: number;
  error: string | null;
  ball: NetworkBallState | null;
  match: NetworkMatchState | null;
  playReady: boolean;
  remoteRockets: NetworkRocketState[];
  remoteBallActions: NetworkBallAction[];
  remoteCoopActions: NetworkCoopAction[];
  remoteCoopRailActions: NetworkCoopAction[];
  remoteCoopEventActions: NetworkCoopAction[];
  remoteTrainingObjectActions: NetworkTrainingObjectAction[];
  coopRails: NetworkCoopAction[];
  remotePlayers: RemoteMultiplayerPlayer[];
};

type ServerMessage =
  | {
      type: 'welcome';
      id: string;
      roomId: string;
      team: Team;
      teamSlot: number;
      hostId?: string;
      room: RoomInfo;
    }
  | { type: 'joinError'; message: string }
  | {
      type: 'snapshot';
      serverTime: number;
      hostId: string | null;
      ball: NetworkBallState | null;
      match: NetworkMatchState | null;
      room: RoomInfo;
      players: RemoteMultiplayerPlayer[];
      coopRails?: NetworkCoopAction[];
    }
  | {
      type: 'rocketFire';
      serverTime: number;
      rocket: NetworkRocketState;
    }
  | {
      type: 'ballAction';
      serverTime: number;
      action: NetworkBallAction;
    }
  | {
      type: 'coopAction';
      serverTime: number;
      action: NetworkCoopAction;
    }
  | {
      type: 'trainingObjectAction';
      serverTime: number;
      action: NetworkTrainingObjectAction;
    }
  | {
      type: 'ballImpulse';
      serverTime: number;
      ball: NetworkBallState | null;
    }
  | {
      type: 'goalScored';
      serverTime: number;
      goal: {
        id: string;
        points: number;
        scoringTeam: Team;
        goalTeam: Team;
        goalId: string;
        goalPos: Vec3;
        score: MatchScore;
        scorerId: string | null;
        scorerName: string | null;
        shotDistanceM: number | null;
      };
    };

type LocalPlayerUpdate = {
  position: Vec3;
  velocity: Vec3;
  rotation: { yaw: number; pitch: number };
  visualTilt?: { x: number; y: number; z: number };
  flipActive?: boolean;
  danceActive?: boolean;
  energy: number;
  isSprinting?: boolean;
  isBeaming: boolean;
  isHoldingBall: boolean;
  holdPosition: Vec3 | null;
  coopRagdoll?: boolean;
};

const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let lastSendAt = 0;
let profile: ActorProfile | null = null;
let latestBallServerTime = 0;

const LOCAL_PLAYER_SEND_INTERVAL_MS = 12;

let state: MultiplayerState = {
  enabled: false,
  status: 'offline',
  selfId: null,
  hostId: null,
  roomId: 'main',
  roomInfo: null,
  team: null,
  teamSlot: 0,
  error: null,
  ball: null,
  match: null,
  playReady: false,
  remoteRockets: [],
  remoteBallActions: [],
  remoteCoopActions: [],
  remoteCoopRailActions: [],
  remoteCoopEventActions: [],
  remoteTrainingObjectActions: [],
  coopRails: [],
  remotePlayers: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<MultiplayerState>) {
  state = { ...state, ...next };
  (
    window as unknown as {
      __roccitballMultiplayerOnline?: boolean;
    }
  ).__roccitballMultiplayerOnline =
    state.enabled && state.status === 'online';
  emit();
}

function upsertCoopRail(
  rails: NetworkCoopAction[],
  action: NetworkCoopAction,
): NetworkCoopAction[] {
  if (action.kind !== 'railSpawn' || !action.railKey) return rails;
  return [
    ...rails.filter((rail) => rail.railKey !== action.railKey),
    action,
  ].slice(-80);
}

function websocketUrl(): string {
  const envUrl = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim();
  const isLocalVite =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (isLocalVite && window.location.port === '5173') {
    return 'ws://127.0.0.1:3000/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function apiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_MULTIPLAYER_HTTP_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/+$/, '');
  const wsUrl = websocketUrl();
  return wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

async function readJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function sendJson(payload: unknown) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function handleMessage(raw: string) {
  let msg: ServerMessage;
  try {
    msg = JSON.parse(raw) as ServerMessage;
  } catch {
    return;
  }

  if (msg.type === 'welcome') {
    gameStore.setLocalTeam(msg.team);
    patch({
      status: 'online',
      selfId: msg.id,
      hostId: msg.hostId ?? msg.id,
      roomId: msg.roomId,
      roomInfo: msg.room,
      team: msg.team,
      teamSlot: msg.teamSlot,
      error: null,
    });
    return;
  }

  if (msg.type === 'joinError') {
    patch({
      status: 'error',
      error: msg.message,
      enabled: false,
      selfId: null,
      hostId: null,
      roomInfo: null,
      team: null,
      teamSlot: 0,
      ball: null,
      match: null,
      playReady: false,
      remoteRockets: [],
      remoteBallActions: [],
      remoteCoopActions: [],
      remoteCoopRailActions: [],
      remoteCoopEventActions: [],
      remoteTrainingObjectActions: [],
      coopRails: [],
      remotePlayers: [],
    });
    closeSocket();
    return;
  }

  if (msg.type === 'snapshot') {
    const receivedAt = performance.now();
    const serverTime = Number.isFinite(msg.serverTime) ? msg.serverTime : 0;
    const selfId = state.selfId;
    const selfPlayer = msg.players.find((player) => player.id === selfId) ?? null;
    if (msg.match && selfId !== msg.hostId) {
      gameStore.syncNetworkMatch(msg.match);
    }
    const acceptsBall =
      Boolean(msg.ball) &&
      (latestBallServerTime === 0 || serverTime > latestBallServerTime);
    if (acceptsBall) latestBallServerTime = serverTime;
    const ball = acceptsBall && msg.ball
      ? {
          ...msg.ball,
          updatedAt: receivedAt,
        }
      : state.ball;
    patch({
      hostId: msg.hostId,
      ball,
      match: msg.match,
      roomInfo: msg.room,
      coopRails: msg.coopRails ?? state.coopRails,
      team: selfPlayer?.team ?? state.team,
      teamSlot: selfPlayer?.teamSlot ?? state.teamSlot,
      remotePlayers: msg.players
        .filter((player) => player.id !== selfId)
        .map((player) => ({
          ...player,
          updatedAt: receivedAt,
        })),
    });
    return;
  }

  if (msg.type === 'rocketFire') {
    patch({
      remoteRockets: [...state.remoteRockets, msg.rocket].slice(-24),
    });
    return;
  }

  if (msg.type === 'ballAction') {
    patch({
      remoteBallActions: [...state.remoteBallActions, msg.action].slice(-24),
    });
    return;
  }

  if (msg.type === 'coopAction') {
    if (msg.action.kind === 'railSpawn') {
      patch({
        coopRails: upsertCoopRail(state.coopRails, msg.action),
        remoteCoopRailActions: [...state.remoteCoopRailActions, msg.action].slice(-32),
      });
      return;
    }
    if (
      msg.action.kind === 'levelAdvance' ||
      msg.action.kind === 'loveMessage' ||
      msg.action.kind === 'dance'
    ) {
      patch({
        remoteCoopEventActions: [...state.remoteCoopEventActions, msg.action].slice(-48),
      });
      return;
    }
    patch({
      remoteCoopActions: [...state.remoteCoopActions, msg.action].slice(-48),
    });
    return;
  }

  if (msg.type === 'trainingObjectAction') {
    patch({
      remoteTrainingObjectActions: [
        ...state.remoteTrainingObjectActions,
        msg.action,
      ].slice(-96),
    });
    return;
  }

  if (msg.type === 'ballImpulse') {
    const receivedAt = performance.now();
    const serverTime = Number.isFinite(msg.serverTime) ? msg.serverTime : 0;
    if (serverTime < latestBallServerTime) return;
    latestBallServerTime = serverTime;
    patch({
      ball: msg.ball
        ? {
            ...msg.ball,
            updatedAt: receivedAt,
          }
        : null,
    });
    return;
  }

  if (msg.type === 'goalScored') {
    applyNetworkGoalScore({
      points: msg.goal.points,
      scoringTeam: msg.goal.scoringTeam,
      goalPos: msg.goal.goalPos,
      score: msg.goal.score,
      scorerName: msg.goal.scorerName,
      shotDistanceM: msg.goal.shotDistanceM,
    });
  }
}

function closeSocket() {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  socket.close();
  socket = null;
  latestBallServerTime = 0;
}

export const multiplayerStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getState(): MultiplayerState {
    return state;
  },

  connect(nextProfile: ActorProfile, roomId = 'main'): void {
    profile = nextProfile;
    closeSocket();
    patch({
      enabled: true,
      status: 'connecting',
      selfId: null,
      hostId: null,
      roomId,
      roomInfo: null,
      team: null,
      teamSlot: 0,
      error: null,
      ball: null,
      match: null,
      playReady: false,
      remoteRockets: [],
      remoteBallActions: [],
      remoteCoopActions: [],
      remoteCoopRailActions: [],
      remoteCoopEventActions: [],
      remoteTrainingObjectActions: [],
      coopRails: [],
      remotePlayers: [],
    });

    try {
      socket = new WebSocket(websocketUrl());
    } catch (error) {
      patch({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed.',
      });
      return;
    }

    socket.onopen = () => {
      sendJson({
        type: 'hello',
        roomId,
        profile: {
          name: profile?.displayName,
          jerseyNumber: profile?.jerseyNumber,
        },
      });
    };
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') handleMessage(event.data);
    };
    socket.onerror = () => {
      patch({ status: 'error', error: 'Could not reach multiplayer server.' });
    };
    socket.onclose = () => {
      socket = null;
      latestBallServerTime = 0;
      if (state.enabled) {
        patch({
          status: 'offline',
          selfId: null,
          hostId: null,
          roomInfo: null,
          team: null,
          teamSlot: 0,
          ball: null,
          match: null,
          playReady: false,
          remoteRockets: [],
          remoteBallActions: [],
          remoteCoopActions: [],
          remoteCoopRailActions: [],
          remoteCoopEventActions: [],
          remoteTrainingObjectActions: [],
          coopRails: [],
          remotePlayers: [],
        });
      }
    };
  },

  disconnect(): void {
    closeSocket();
    patch({
      enabled: false,
      status: 'offline',
      selfId: null,
      hostId: null,
      roomInfo: null,
      team: null,
      teamSlot: 0,
      error: null,
      ball: null,
      match: null,
      playReady: false,
      remoteRockets: [],
      remoteBallActions: [],
      remoteCoopActions: [],
      remoteCoopRailActions: [],
      remoteCoopEventActions: [],
      remoteTrainingObjectActions: [],
      coopRails: [],
      remotePlayers: [],
    });
  },

  updateProfile(nextProfile: ActorProfile): void {
    profile = nextProfile;
  },

  sendLocalPlayer(update: LocalPlayerUpdate): void {
    if (!state.enabled || state.status !== 'online') return;
    const now = performance.now();
    if (now - lastSendAt < LOCAL_PLAYER_SEND_INTERVAL_MS) return;
    lastSendAt = now;
    sendJson({
      type: 'playerUpdate',
      ...update,
    });
  },

  sendLoadReady(ready: boolean): void {
    if (!state.enabled || state.status !== 'online') return;
    sendJson({
      type: 'loadReady',
      ready,
    });
  },

  sendPlayReady(ready: boolean): void {
    if (!state.enabled || state.status !== 'online') return;
    patch({ playReady: ready });
    sendJson({
      type: 'playReady',
      ready,
    });
    if (!ready) multiplayerStore.sendLoadReady(false);
  },

  isHost(): boolean {
    return Boolean(state.enabled && state.selfId && state.selfId === state.hostId);
  },

  sendHostState(update: {
    ball: Omit<NetworkBallState, 'updatedAt'>;
    match: NetworkMatchState;
  }): void {
    if (!state.enabled || state.status !== 'online' || !multiplayerStore.isHost()) return;
    sendJson({
      type: 'hostState',
      ...update,
    });
  },

  sendRocketFire(rocket: Omit<NetworkRocketState, 'ownerId'>): void {
    if (!state.enabled || state.status !== 'online') return;
    sendJson({
      type: 'rocketFire',
      rocket,
    });
  },

  sendRocketImpact(impact: NetworkRocketImpact): void {
    if (!state.enabled || state.status !== 'online') return;
    sendJson({
      type: 'rocketImpact',
      impact,
    });
  },

  sendBallAction(action: Omit<NetworkBallAction, 'id' | 'ownerId'>): void {
    if (!state.enabled || state.status !== 'online') return;
    sendJson({
      type: 'ballAction',
      action: {
        id: crypto.randomUUID(),
        ...action,
      },
    });
  },

  sendCoopAction(action: Omit<NetworkCoopAction, 'id' | 'ownerId'>): void {
    if (!state.enabled || state.status !== 'online') return;
    if (state.roomInfo?.mode !== 'coop-adventure') return;
    sendJson({
      type: 'coopAction',
      action: {
        id: crypto.randomUUID(),
        ...action,
      },
    });
  },

  sendTrainingObjectAction(
    action: Omit<NetworkTrainingObjectAction, 'id' | 'ownerId'>,
  ): void {
    if (!state.enabled || state.status !== 'online') return;
    if (state.roomInfo?.mode !== 'training') return;
    sendJson({
      type: 'trainingObjectAction',
      action: {
        id: crypto.randomUUID(),
        ...action,
      },
    });
  },

  drainRemoteRockets(): NetworkRocketState[] {
    const rockets = state.remoteRockets;
    if (rockets.length === 0) return [];
    state = { ...state, remoteRockets: [] };
    emit();
    return rockets;
  },

  drainRemoteBallActions(): NetworkBallAction[] {
    const actions = state.remoteBallActions;
    if (actions.length === 0) return [];
    state = { ...state, remoteBallActions: [] };
    emit();
    return actions;
  },

  drainRemoteCoopActions(): NetworkCoopAction[] {
    const actions = state.remoteCoopActions;
    if (actions.length === 0) return [];
    state = { ...state, remoteCoopActions: [] };
    emit();
    return actions;
  },

  drainRemoteCoopRailActions(): NetworkCoopAction[] {
    const actions = state.remoteCoopRailActions;
    if (actions.length === 0) return [];
    state = { ...state, remoteCoopRailActions: [] };
    emit();
    return actions;
  },

  drainRemoteCoopEventActions(): NetworkCoopAction[] {
    const actions = state.remoteCoopEventActions;
    if (actions.length === 0) return [];
    state = { ...state, remoteCoopEventActions: [] };
    emit();
    return actions;
  },

  drainRemoteTrainingObjectActions(): NetworkTrainingObjectAction[] {
    const actions = state.remoteTrainingObjectActions;
    if (actions.length === 0) return [];
    state = { ...state, remoteTrainingObjectActions: [] };
    emit();
    return actions;
  },

  async fetchRooms(): Promise<RoomSummary[]> {
    const data = await readJson<{ rooms: RoomSummary[] }>(`${apiBaseUrl()}/api/rooms`);
    return data.rooms;
  },

  async createRoom(options: { mode: RoomMode; name?: string }): Promise<RoomSummary> {
    const data = await readJson<{ room: RoomSummary }>(`${apiBaseUrl()}/api/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options),
    });
    return data.room;
  },
};
