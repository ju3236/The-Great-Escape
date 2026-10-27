// Cloudflare Worker: 정적 파일(public/)은 Workers 정적 파일 기능이 내보내고,
// 방마다 Durable Object(GameRoom) 하나가 게임을 진행한다.
import { DurableObject } from 'cloudflare:workers';
import { Room, SCENARIO_LIST } from './room.js';

const ROOM_TTL = 6 * 60 * 60 * 1000; // 아무도 접속하지 않은 방은 6시간 뒤 정리
const MAX_MESSAGE = 600 * 1024; // 캐릭터 그림이 실려 올 수 있다
const MAX_IMAGE = 300 * 1024; // 그림 한 장(data URL 문자열) 최대 길이
const IMAGE_RE = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;
const IMG_PATH = /^\/img\/([A-HJ-NP-Z2-9]{4})\/([0-9a-f]{16})\/([ab])$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
const roomStub = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/scenarios') return json(SCENARIO_LIST);

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch { /* 기본 에피소드 */ }
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const res = await roomStub(env, code).fetch('https://room/init', {
          method: 'POST', body: JSON.stringify({ code, scenario: String(body.scenario || '') }),
        });
        if (res.ok) return json({ code });
      }
      return json({ error: '방을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, 503);
    }

    const img = url.pathname.match(IMG_PATH);
    if (img) return roomStub(env, img[1]).fetch(request);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket 전용 주소예요.', { status: 426 });
      const code = (url.searchParams.get('code') || '').toUpperCase();
      if (!CODE_RE.test(code)) return new Response('잘못된 방 코드예요.', { status: 400 });
      return roomStub(env, code).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // 소켓에는 플레이어 토큰을 붙여 둔다. Durable Object가 잠들었다 깨어나도 유지된다.
    this.io = {
      socketsOf: (token) => this.ctx.getWebSockets()
        .filter((ws) => ws.readyState === 1 && ws.deserializeAttachment()?.token === token),
    };
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec('CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
      const snap = await ctx.storage.get('room');
      if (snap) {
        const log = this.sql.exec('SELECT data FROM msgs ORDER BY id').toArray().map((r) => JSON.parse(r.data));
        this.room = Room.restore(snap, log, this.io);
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const img = url.pathname.match(IMG_PATH);
    if (img) return this.serveImage(img[2], img[3]);
    if (url.pathname === '/init') {
      if (this.room) return new Response('exists', { status: 409 });
      const { code, scenario } = await request.json();
      this.room = new Room(code, scenario, this.io);
      await this.save();
      return new Response('ok');
    }

    const [client, server] = Object.values(new WebSocketPair());
    if (!this.room) {
      // 없는 방: 이유를 알려 주고 닫는다
      server.accept();
      server.send(JSON.stringify({ t: 'error', text: '그런 방이 없어요. 코드를 다시 확인해 주세요.', fatal: true }));
      server.close(1000, 'no room');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 캐릭터 그림: 주소에 id가 들어 있고 바뀌면 id도 바뀌므로 오래 캐시해도 된다
  async serveImage(id, kind) {
    const saved = await this.ctx.storage.get(`img:${id}`);
    const dataUrl = saved?.[kind];
    if (!dataUrl) return new Response('없는 그림이에요.', { status: 404 });
    const [head, b64] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    return new Response(bytes, {
      headers: { 'Content-Type': head.slice(5, head.indexOf(';')), 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  }

  // 메시지에 실려 온 그림을 떼어 저장하고, 캐릭터에는 그림 id만 남긴다
  async takeImages(char) {
    if (!char || typeof char !== 'object') return;
    const pick = (v) => (typeof v === 'string' && v.length <= MAX_IMAGE && IMAGE_RE.test(v) ? v : null);
    const a = pick(char.avatar);
    const b = pick(char.body);
    delete char.avatar;
    delete char.body;
    delete char.img;
    if (!a && !b) return;
    const id = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
    await this.ctx.storage.put(`img:${id}`, { a, b });
    char.img = { id, a: !!a, b: !!b };
  }

  reply(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch { /* 닫힌 소켓 */ }
  }

  async webSocketMessage(ws, raw) {
    if (!this.room || typeof raw !== 'string' || raw.length > MAX_MESSAGE) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const room = this.room;
    const token = ws.deserializeAttachment()?.token;
    const player = token && room.players.get(token);
    if (msg.t === 'join' || msg.t === 'setChar') await this.takeImages(msg.char);

    if (!player) {
      if (msg.t === 'join') {
        const res = room.join(!!msg.gm, msg.char);
        if (res.error) return this.reply(ws, { t: 'error', text: res.error });
        this.attach(ws, res.player);
      } else if (msg.t === 'resume') {
        // 같은 기기는 토큰으로, 다른 기기는 6자리 복귀 번호(PIN)로 돌아온다
        const p = (msg.token && room.players.get(msg.token)) || (msg.pin && room.findByPin(msg.pin));
        if (!p) return this.reply(ws, { t: 'error', text: '이 방에서 내 자리를 찾을 수 없어요.', fatal: true });
        this.attach(ws, p);
      }
      await this.save();
      return;
    }

    if (msg.t === 'leave') {
      room.handle(player, msg);
      ws.serializeAttachment(null);
      this.reply(ws, { t: 'left' });
      ws.close(1000, 'left');
      room.flush();
    } else {
      room.handle(player, msg);
    }
    this.dropRemoved();
    await this.save();
  }

  // 방에서 내보낸 사람의 연결은 닫는다
  dropRemoved() {
    for (const ws of this.ctx.getWebSockets()) {
      const token = ws.deserializeAttachment()?.token;
      if (token && !this.room.players.has(token)) {
        ws.serializeAttachment(null);
        try { ws.close(4000, 'removed'); } catch { /* 이미 닫힘 */ }
      }
    }
  }

  attach(ws, player) {
    ws.serializeAttachment({ token: player.token });
    this.reply(ws, { t: 'joined', code: this.room.code, token: player.token });
    // 도중 합류 메시지가 겹치지 않게, 새 소식을 먼저 보내고 전체 기록으로 덮는다
    this.room.flush();
    this.room.sendLog(player);
  }

  async webSocketClose(ws, code, reason) {
    ws.serializeAttachment(null);
    try { ws.close(code, reason); } catch { /* 이미 닫힘 */ }
    if (!this.room) return;
    this.room.lastActive = Date.now();
    this.room.flush();
    await this.save();
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  // 시간 조건 이벤트, 시간 초과 판정, 오래된 방 정리
  async alarm() {
    if (!this.room) return;
    this.room.tick();
    const online = this.ctx.getWebSockets().some((ws) => ws.readyState === 1);
    if (!online && Date.now() - this.room.lastActive > ROOM_TTL) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    await this.save();
  }

  async save() {
    const room = this.room;
    for (const m of room.takeUnsaved()) {
      this.sql.exec('INSERT OR REPLACE INTO msgs (id, data) VALUES (?, ?)', m.id, JSON.stringify(m));
    }
    await this.ctx.storage.put('room', room.snapshot());
    const timeUp = room.phase === 'play' ? room.nextWake() : Infinity;
    const cleanup = Math.max(Date.now() + 60 * 1000, room.lastActive + ROOM_TTL + 1000);
    await this.ctx.storage.setAlarm(Math.min(timeUp, cleanup));
  }
}
