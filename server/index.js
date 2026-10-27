// 정적 파일 서버 + 실시간 게임 서버 (WebSocket, 경로 /ws)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Room, SCENARIO_LIST } = require('./room');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const ROOM_TTL = 3 * 60 * 60 * 1000; // 아무도 접속하지 않은 방은 3시간 뒤 정리
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('없는 페이지예요.');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do {
    code = Array.from(crypto.randomBytes(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  } while (rooms.has(code));
  return code;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

wss.on('connection', (ws) => {
  let room = null;
  let player = null;
  const reply = (obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));
  reply({ t: 'hello', scenarios: SCENARIO_LIST });

  const attach = (r, p) => {
    room = r;
    player = p;
    p.sockets.add(ws);
    reply({ t: 'joined', code: r.code, token: p.token });
    r.sendLog(p);
    r.flush();
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'create' || msg.t === 'join' || msg.t === 'resume') {
      if (player) return;
      let target;
      if (msg.t === 'create') {
        target = new Room(newCode(), msg.scenario);
        rooms.set(target.code, target);
      } else {
        target = rooms.get(String(msg.code || '').trim().toUpperCase());
        if (!target) return reply({ t: 'error', text: '그런 방이 없어요. 코드를 다시 확인해 주세요.', fatal: msg.t === 'resume' });
      }
      if (msg.t === 'resume') {
        const p = target.players.get(msg.token);
        if (!p) return reply({ t: 'error', text: '이 방에서 내 자리를 찾을 수 없어요.', fatal: true });
        return attach(target, p);
      }
      const res = target.join(!!msg.gm, msg.char);
      if (res.error) {
        if (msg.t === 'create') rooms.delete(target.code);
        return reply({ t: 'error', text: res.error });
      }
      return attach(target, res.player);
    }

    if (!room || !player) return;
    if (msg.t === 'leave') {
      room.handle(player, msg);
      player.sockets.delete(ws);
      reply({ t: 'left' });
      room = null;
      player = null;
      return;
    }
    room.handle(player, msg);
  });

  ws.on('close', () => {
    if (!player) return;
    player.sockets.delete(ws);
    room.lastActive = Date.now();
    room.flush();
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.tick();
    const online = [...room.players.values()].some((p) => p.sockets.size);
    if (!room.players.size || (!online && now - room.lastActive > ROOM_TTL)) rooms.delete(code);
  }
}, 1000);

server.listen(PORT, () => console.log(`대탈출 서버 실행 중: http://localhost:${PORT}`));
