import type { MatchScore, Team, Vec3 } from '../shared/Types';
import type { ActorProfile } from '../game/playerRoster';
import { gameStore, type GamePhase } from '../game/gameStore';

export type MultiplayerStatus = 'offline' | 'connecting' | 'online' | 'error';

export type RemoteMultiplayerPlayer = {
  id: string;
  name: string;
  jerseyNumber: number;
  team: Team;
  position: Vec3;
  velocity: Vec3;
  rotation: { yaw: number; pitch: number };
  energy: number;
  isBeaming: boolean;
  isHoldingBall: boolean;
  holdPosition: Vec3 | null;
  loadReady?: boolean;
  updatedAt: number;
};

export type NetworkBallState = {
  position: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
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

export type NetworkBallAction = {
  id: string;
  ownerId: string;
  kind: 'release';
  position: Vec3;
  velocity: Vec3;
  ballState: 'loose' | 'launched';
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
  team: Team | null;
  error: string | null;
  ball: NetworkBallState | null;
  match: NetworkMatchState | null;
  remoteRockets: NetworkRocketState[];
  remoteBallActions: NetworkBallAction[];
  remotePlayers: RemoteMultiplayerPlayer[];
};

type ServerMessage =
  | { type: 'welcome'; id: string; roomId: string; team: Team; hostId?: string }
  | {
      type: 'snapshot';
      serverTime: number;
      hostId: string | null;
      ball: NetworkBallState | null;
      match: NetworkMatchState | null;
      players: RemoteMultiplayerPlayer[];
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
    };

type LocalPlayerUpdate = {
  position: Vec3;
  velocity: Vec3;
  rotation: { yaw: number; pitch: number };
  energy: number;
  isBeaming: boolean;
  isHoldingBall: boolean;
  holdPosition: Vec3 | null;
};

const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let lastSendAt = 0;
let profile: ActorProfile | null = null;

const LOCAL_PLAYER_SEND_INTERVAL_MS = 33;

let state: MultiplayerState = {
  enabled: false,
  status: 'offline',
  selfId: null,
  hostId: null,
  roomId: 'main',
  team: null,
  error: null,
  ball: null,
  match: null,
  remoteRockets: [],
  remoteBallActions: [],
  remotePlayers: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<MultiplayerState>) {
  state = { ...state, ...next };
  emit();
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
      team: msg.team,
      error: null,
    });
    return;
  }

  if (msg.type === 'snapshot') {
    const selfId = state.selfId;
    if (msg.match && selfId !== msg.hostId) {
      gameStore.syncNetworkMatch(msg.match);
    }
    patch({
      hostId: msg.hostId,
      ball: msg.ball,
      match: msg.match,
      remotePlayers: msg.players.filter((player) => player.id !== selfId),
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
      team: null,
      error: null,
      ball: null,
      match: null,
      remoteRockets: [],
      remoteBallActions: [],
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
      if (state.enabled) {
        patch({
          status: 'offline',
          selfId: null,
          hostId: null,
          team: null,
          ball: null,
          match: null,
          remoteRockets: [],
          remoteBallActions: [],
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
      team: null,
      error: null,
      ball: null,
      match: null,
      remoteRockets: [],
      remoteBallActions: [],
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
};
