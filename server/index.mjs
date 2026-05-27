import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'client', 'dist');
const port = Number(process.env.PORT || 3000);
const snapshotHz = Number(process.env.SNAPSHOT_HZ || 30);
const BALL_RADIUS = 1.6;
const BALL_SPAWN = { x: 0, y: 2.05, z: 0 };
const ARENA_HEX_RADIUS = 64;
const ARENA_WALL_HEIGHT = 43.7;
const ARENA_FLOOR_Y = 0;
const GRAVITY_Y = -11;
const BALL_LINEAR_DAMPING = 0.014;
const BALL_RESTITUTION = 0.58;
const BALL_FRICTION = 0.26;
const BALL_ANGULAR_DAMPING = 0.06;
const BALL_MAX_SPEED = 85;
const BEAM_RANGE = 42 * 0.6;
const BEAM_PULL_ACCEL = 39;
const SERVER_STEP_MAX = 1 / 30;
const SERVER_PHYSICS_STEP = 1 / 60;
const POST_RELEASE_HOLD_BLOCK_MS = 700;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.flac', 'audio/flac'],
  ['.fbx', 'application/octet-stream'],
]);

const rooms = new Map();
const clients = new Map();

function createServerBall() {
  return {
    position: { ...BALL_SPAWN },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    updatedAt: Date.now(),
  };
}

function createRoomPhysics() {
  const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
  world.integrationParameters.dt = SERVER_PHYSICS_STEP;

  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setLinearDamping(BALL_LINEAR_DAMPING)
      .setAngularDamping(BALL_ANGULAR_DAMPING)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setDensity(3.5)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
    ballBody,
  );

  const floorThickness = 0.25;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      ARENA_HEX_RADIUS + 8,
      floorThickness,
      ARENA_HEX_RADIUS + 8,
    )
      .setTranslation(0, ARENA_FLOOR_Y - floorThickness, 0)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      ARENA_HEX_RADIUS + 8,
      floorThickness,
      ARENA_HEX_RADIUS + 8,
    )
      .setTranslation(0, ARENA_WALL_HEIGHT + floorThickness, 0)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
  );

  const apothem = ARENA_HEX_RADIUS * Math.cos(Math.PI / 6);
  const halfSide = ARENA_HEX_RADIUS * 0.5;
  const halfHeight = ARENA_WALL_HEIGHT * 0.5;
  const halfThickness = 0.75;
  for (let i = 0; i < 6; i += 1) {
    const normalAngle = i * (Math.PI / 3);
    const yaw = normalAngle;
    const halfYaw = yaw * 0.5;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfSide, halfHeight, halfThickness)
        .setTranslation(
          Math.cos(normalAngle) * apothem,
          ARENA_WALL_HEIGHT * 0.5,
          Math.sin(normalAngle) * apothem,
        )
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
        .setRestitution(BALL_RESTITUTION)
        .setFriction(BALL_FRICTION),
    );
  }

  return { world, ballBody, accumulator: 0 };
}

function getRoom(roomId) {
  const id = typeof roomId === 'string' && roomId.trim() ? roomId.trim() : 'main';
  let room = rooms.get(id);
  if (!room) {
    room = {
      id,
      players: new Map(),
      hostId: null,
      ball: createServerBall(),
      match: null,
      physics: createRoomPhysics(),
    };
    rooms.set(id, room);
  }
  return room;
}

function sendFrame(socket, data) {
  const payload = Buffer.from(data);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch {
    removeClient(socket);
  }
}

function sendJson(socket, msg) {
  if (socket.destroyed) return;
  sendFrame(socket, JSON.stringify(msg));
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

function decodeFrames(socket, chunk) {
  socket.wsBuffer = Buffer.concat([socket.wsBuffer ?? Buffer.alloc(0), chunk]);
  const messages = [];
  let buffer = socket.wsBuffer;

  while (buffer.length >= 2) {
    let offset = 0;
    const b0 = buffer[offset++];
    const b1 = buffer[offset++];
    const opcode = b0 & 0x0f;
    const masked = Boolean(b1 & 0x80);
    let length = b1 & 0x7f;

    if (length === 126) {
      if (buffer.length < offset + 2) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buffer.length < offset + 8) break;
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask;
    if (masked) {
      if (buffer.length < offset + 4) break;
      mask = buffer.subarray(offset, offset + 4);
      offset += 4;
    }
    if (buffer.length < offset + length) break;

    let payload = buffer.subarray(offset, offset + length);
    buffer = buffer.subarray(offset + length);
    if (masked && mask) {
      payload = Buffer.from(payload.map((value, i) => value ^ mask[i % 4]));
    }

    if (opcode === 0x8) {
      socket.end(encodeCloseFrame());
      continue;
    }
    if (opcode === 0x9) {
      socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode === 0x1) {
      messages.push(payload.toString('utf8'));
    }
  }

  socket.wsBuffer = buffer;
  return messages;
}

function removeClient(socket) {
  const client = clients.get(socket);
  if (!client) return;
  clients.delete(socket);
  const room = rooms.get(client.roomId);
  room?.players.delete(client.id);
  if (room?.hostId === client.id) {
    room.hostId = [...room.players.keys()][0] ?? null;
    room.match = null;
  }
  if (room && room.players.size === 0) rooms.delete(room.id);
}

function sanitizeProfile(profile = {}) {
  const name =
    typeof profile.name === 'string' && profile.name.trim()
      ? profile.name.trim().slice(0, 18)
      : 'Player';
  const jerseyNumber = Number.isFinite(profile.jerseyNumber)
    ? Math.max(0, Math.min(99, Math.floor(profile.jerseyNumber)))
    : 0;
  return { name, jerseyNumber };
}

function sanitizeTeam(team, room) {
  if (team === 'red' || team === 'blue') return team;
  let red = 0;
  let blue = 0;
  for (const player of room.players.values()) {
    if (player.team === 'red') red += 1;
    if (player.team === 'blue') blue += 1;
  }
  return red <= blue ? 'red' : 'blue';
}

function sanitizeVec3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z,
  };
}

function sanitizeMatchState(match = {}) {
  return {
    phase:
      ['intro', 'loading', 'playing', 'paused', 'countdown'].includes(match.phase)
        ? match.phase
        : 'playing',
    score: {
      red: Number.isFinite(match.score?.red)
        ? Math.max(0, Math.floor(match.score.red))
        : 0,
      blue: Number.isFinite(match.score?.blue)
        ? Math.max(0, Math.floor(match.score.blue))
        : 0,
    },
    timeLeft: Number.isFinite(match.timeLeft)
      ? Math.max(0, Math.ceil(match.timeLeft))
      : 0,
    countdown: Number.isFinite(match.countdown)
      ? Math.max(0, Math.ceil(match.countdown))
      : 0,
    arenaSettleCountdown: Number.isFinite(match.arenaSettleCountdown)
      ? Math.max(0, Math.ceil(match.arenaSettleCountdown))
      : 0,
    loadCountdown: Number.isFinite(match.loadCountdown)
      ? Math.max(0, Math.ceil(match.loadCountdown))
      : 0,
    ballFrozen: Boolean(match.ballFrozen),
  };
}

function clampBallSpeed(ball) {
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z);
  if (speed <= BALL_MAX_SPEED || speed <= 0.0001) return;
  const scale = BALL_MAX_SPEED / speed;
  ball.velocity.x *= scale;
  ball.velocity.y *= scale;
  ball.velocity.z *= scale;
}

function setPhysicsBall(room, position, velocity, angularVelocity = null) {
  if (!room.physics) room.physics = createRoomPhysics();
  const body = room.physics.ballBody;
  body.setTranslation(position, true);
  body.setLinvel(velocity, true);
  body.setAngvel(
    angularVelocity ?? {
      x: velocity.z / BALL_RADIUS,
      y: 0,
      z: -velocity.x / BALL_RADIUS,
    },
    true,
  );
}

function syncBallFromPhysics(room, now) {
  if (!room.physics) room.physics = createRoomPhysics();
  const body = room.physics.ballBody;
  const t = body.translation();
  const v = body.linvel();
  const av = body.angvel();
  room.ball = {
    position: { x: t.x, y: t.y, z: t.z },
    velocity: { x: v.x, y: v.y, z: v.z },
    angularVelocity: { x: av.x, y: av.y, z: av.z },
    updatedAt: now,
  };
}

function clampPhysicsBallSpeed(room) {
  const body = room.physics.ballBody;
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed <= BALL_MAX_SPEED || speed <= 0.0001) return;
  const scale = BALL_MAX_SPEED / speed;
  body.setLinvel({ x: v.x * scale, y: v.y * scale, z: v.z * scale }, true);
}

function tickRoomBall(room, dt, now) {
  if (!room.ball) room.ball = createServerBall();
  if (!room.physics) room.physics = createRoomPhysics();
  const match = room.match;

  if (match?.ballFrozen) {
    const frozenPosition = { ...room.ball.position };
    if (match.countdown > 0 || match.arenaSettleCountdown > 0 || match.loadCountdown > 0) {
      frozenPosition.x = BALL_SPAWN.x;
      frozenPosition.y = BALL_SPAWN.y;
      frozenPosition.z = BALL_SPAWN.z;
    }
    setPhysicsBall(
      room,
      frozenPosition,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );
    syncBallFromPhysics(room, now);
    return;
  }

  const holder = [...room.players.values()].find(
    (player) =>
      player.isHoldingBall &&
      player.holdPosition &&
      (!player.releasedBallUntil || now >= player.releasedBallUntil),
  );
  if (holder) {
    setPhysicsBall(
      room,
      sanitizeVec3(holder.holdPosition, room.ball.position),
      sanitizeVec3(holder.velocity, room.ball.velocity),
      { x: 0, y: 0, z: 0 },
    );
    syncBallFromPhysics(room, now);
    return;
  }

  for (const player of room.players.values()) {
    if (!player.isBeaming) continue;
    const body = room.physics.ballBody;
    const ballPosition = body.translation();
    const ballVelocity = body.linvel();
    const chest = {
      x: player.position.x,
      y: player.position.y + 1.2,
      z: player.position.z,
    };
    const dx = chest.x - ballPosition.x;
    const dy = chest.y - ballPosition.y;
    const dz = chest.z - ballPosition.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= 0.001 || dist > BEAM_RANGE) continue;
    const closeBoost = 1 + Math.max(0, 1 - dist / BEAM_RANGE) * 0.9;
    const accel = BEAM_PULL_ACCEL * closeBoost;
    body.setLinvel(
      {
        x: ballVelocity.x + (dx / dist) * accel * dt,
        y: ballVelocity.y + (dy / dist) * accel * dt,
        z: ballVelocity.z + (dz / dist) * accel * dt,
      },
      true,
    );
  }

  room.physics.accumulator = Math.min(0.1, room.physics.accumulator + dt);
  while (room.physics.accumulator >= SERVER_PHYSICS_STEP) {
    room.physics.world.step();
    room.physics.accumulator -= SERVER_PHYSICS_STEP;
  }
  clampPhysicsBallSpeed(room);
  syncBallFromPhysics(room, now);
}

function handleClientMessage(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'hello') {
    const room = getRoom(msg.roomId);
    const id = crypto.randomUUID();
    const profile = sanitizeProfile(msg.profile);
    const team = sanitizeTeam(msg.team, room);
    const player = {
      id,
      name: profile.name,
      jerseyNumber: profile.jerseyNumber,
      team,
      position: { x: 0, y: 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      energy: 100,
      isBeaming: false,
      isHoldingBall: false,
      holdPosition: null,
      loadReady: false,
      updatedAt: Date.now(),
    };
    clients.set(socket, { id, roomId: room.id });
    room.players.set(id, player);
    if (!room.hostId) room.hostId = id;
    sendJson(socket, { type: 'welcome', id, roomId: room.id, team, hostId: room.hostId });
    return;
  }

  const client = clients.get(socket);
  if (!client) return;
  const room = rooms.get(client.roomId);
  const player = room?.players.get(client.id);
  if (!player) return;

  if (msg.type === 'playerUpdate') {
    player.position = sanitizeVec3(msg.position, player.position);
    player.velocity = sanitizeVec3(msg.velocity, player.velocity);
    player.rotation = {
      yaw: Number.isFinite(msg.rotation?.yaw) ? msg.rotation.yaw : player.rotation.yaw,
      pitch: Number.isFinite(msg.rotation?.pitch) ? msg.rotation.pitch : player.rotation.pitch,
    };
    player.energy = Number.isFinite(msg.energy)
      ? Math.max(0, Math.min(100, msg.energy))
      : player.energy;
    player.isBeaming = Boolean(msg.isBeaming);
    player.isHoldingBall = Boolean(msg.isHoldingBall);
    player.holdPosition = msg.holdPosition
      ? sanitizeVec3(msg.holdPosition, player.position)
      : null;
    if (!player.isHoldingBall) player.releasedBallUntil = 0;
    player.updatedAt = Date.now();
    return;
  }

  if (msg.type === 'loadReady') {
    player.loadReady = Boolean(msg.ready);
    player.updatedAt = Date.now();
    return;
  }

  if (msg.type === 'hostState' && client.id === room.hostId) {
    if (!room.ball) room.ball = createServerBall();
    room.match = sanitizeMatchState(msg.match);
    return;
  }

  if (msg.type === 'rocketFire') {
    const rocket = {
      id: typeof msg.rocket?.id === 'string' ? msg.rocket.id.slice(0, 64) : crypto.randomUUID(),
      ownerId: client.id,
      position: sanitizeVec3(msg.rocket?.position),
      velocity: sanitizeVec3(msg.rocket?.velocity),
      spawnPos: sanitizeVec3(msg.rocket?.spawnPos),
      segmentStart: sanitizeVec3(msg.rocket?.segmentStart),
      spawnTime: Number.isFinite(msg.rocket?.spawnTime) ? msg.rocket.spawnTime : 0,
      bouncesLeft: Number.isFinite(msg.rocket?.bouncesLeft)
        ? Math.max(0, Math.floor(msg.rocket.bouncesLeft))
        : 0,
      explosive: Boolean(msg.rocket?.explosive),
    };
    const packet = {
      type: 'rocketFire',
      serverTime: Date.now(),
      rocket,
    };
    for (const [peerSocket, peerClient] of clients) {
      if (peerSocket !== socket && peerClient.roomId === room.id) {
        sendJson(peerSocket, packet);
      }
    }
    return;
  }

  if (msg.type === 'ballAction') {
    if (!room.ball) room.ball = createServerBall();
    const action = {
      id:
        typeof msg.action?.id === 'string'
          ? msg.action.id.slice(0, 64)
          : crypto.randomUUID(),
      ownerId: client.id,
      kind: 'release',
      position: sanitizeVec3(msg.action?.position),
      velocity: sanitizeVec3(msg.action?.velocity),
      ballState: msg.action?.ballState === 'loose' ? 'loose' : 'launched',
    };
    player.isHoldingBall = false;
    player.holdPosition = null;
    player.releasedBallUntil = Date.now() + POST_RELEASE_HOLD_BLOCK_MS;
    room.ball.position = action.position;
    room.ball.velocity = action.velocity;
    room.ball.angularVelocity = {
      x: action.velocity.z / BALL_RADIUS,
      y: 0,
      z: -action.velocity.x / BALL_RADIUS,
    };
    clampBallSpeed(room.ball);
    room.ball.updatedAt = Date.now();
    setPhysicsBall(room, room.ball.position, room.ball.velocity, room.ball.angularVelocity);
    const packet = {
      type: 'ballAction',
      serverTime: Date.now(),
      action,
    };
    for (const [peerSocket, peerClient] of clients) {
      if (peerSocket !== socket && peerClient.roomId === room.id) {
        sendJson(peerSocket, packet);
      }
    }
  }
}

function broadcastSnapshots() {
  const now = Date.now();
  for (const room of rooms.values()) {
    const players = [...room.players.values()];
    const packet = JSON.stringify({
      type: 'snapshot',
      serverTime: now,
      hostId: room.hostId,
      ball: room.ball,
      match: room.match,
      players,
    });
    for (const [socket, client] of clients) {
      if (client.roomId === room.id) sendFrame(socket, packet);
    }
  }
}

let lastServerStepAt = Date.now();
function tickServer() {
  const now = Date.now();
  const dt = Math.min(SERVER_STEP_MAX, Math.max(0, (now - lastServerStepAt) / 1000));
  lastServerStepAt = now;
  for (const room of rooms.values()) tickRoomBall(room, dt, now);
  broadcastSnapshots();
}

function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const relativePath =
    url.pathname === '/'
      ? 'index.html'
      : path.normalize(decodeURIComponent(url.pathname).replace(/^[/\\]+/, ''));
  const requested = path.resolve(distDir, relativePath);
  const filePath = requested.startsWith(distDir) && fs.existsSync(requested)
    ? requested
    : path.join(distDir, 'index.html');

  if (!fs.existsSync(filePath)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('RocccitBall build not found. Run npm run build first.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': mimeTypes.get(ext) ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(serveStatic);

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.on('data', (chunk) => {
    for (const message of decodeFrames(socket, chunk)) {
      handleClientMessage(socket, message);
    }
  });
  socket.on('close', () => removeClient(socket));
  socket.on('error', () => removeClient(socket));
});

setInterval(tickServer, Math.max(16, Math.round(1000 / snapshotHz)));

server.listen(port, () => {
  console.log(`RocccitBall server listening on ${port}`);
});
