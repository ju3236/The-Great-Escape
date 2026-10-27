// 방 하나의 게임 진행. 모든 판정은 서버에서 하고, 각 플레이어에게는 그 캐릭터가 보고 들을 수 있는 것만 보낸다.
// 실행 환경과는 io(소켓 찾기)로만 연결된다. 저장은 snapshot()/restore()로 한다.
import { SCENARIOS } from './scenarios.js';
import voices from '../public/js/voices.js';
import pixels from '../public/js/pixels.js';

const { PERSONALITIES, SKILLS, voiceLine } = voices;
const { SPRITES } = pixels;

const HINT_COST = 180;
const WRONG_COST = 60;
const MAX_CAST = 6;
const MAX_TEXT = 300;

// 속삭임: 같은 구역만 / 대사: 옆 구역 웅얼 / 외침: 옆 구역 또렷, 두 칸 웅얼
const RANGE = {
  whisper: { clear: 0, muffled: 0 },
  say: { clear: 0, muffled: 1 },
  shout: { clear: 1, muffled: 2 },
};

export const SCENARIO_LIST = SCENARIOS.map((s) => ({ id: s.id, title: s.title, summary: s.summary }));

function josa(word, withBatchim, without) {
  const code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  const has = code >= 0 && code <= 11171 && code % 28 !== 0;
  if (withBatchim === '으로' && code % 28 === 8) return word + without;
  return word + (has ? withBatchim : without);
}

// 웅얼거리는 소리: 메시지 id로 고정된 무작위로 글자를 지운다
function garble(text, seed) {
  let h = seed * 2654435761;
  return [...text].map((ch) => {
    if (/\s/.test(ch)) return ch;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    return h % 100 < 45 ? ch : '·';
  }).join('').replace(/·{2,}/g, '…');
}

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const str = (v, n) => String(v ?? '').trim().slice(0, n);

function cleanChar(c) {
  if (!c || typeof c !== 'object') return null;
  const name = str(c.name, 20);
  if (!name) return null;
  return {
    name,
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8e3a2e',
    image: /^https?:\/\/\S+$/i.test(c.image || '') ? str(c.image, 500) : '',
    sprite: SPRITES[c.sprite] ? c.sprite : 'short',
    personality: PERSONALITIES[c.personality] ? c.personality : 'calm',
    skill: SKILLS[c.skill] ? c.skill : 'none',
    intro: str(c.intro, 120),
  };
}

const randomHex = (bytes) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export class Room {
  constructor(code, scenarioId, io) {
    this.code = code;
    this.scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    this.players = new Map(); // token → player
    this.hostToken = null;
    this.phase = 'lobby';
    this.lastActive = Date.now();
    this.state = null;
    this.fresh = []; // 아직 플레이어에게 보내지 않은 메시지
    this.unsaved = []; // 아직 저장하지 않은 메시지
    this.io = io; // { socketsOf(token) → 열린 소켓 목록 }
  }

  // 메시지 기록(log)은 따로 저장하므로 빼고 담는다
  snapshot() {
    const state = this.state && { ...this.state, log: undefined };
    return {
      code: this.code,
      scenarioId: this.scenario.id,
      players: [...this.players.values()],
      hostToken: this.hostToken,
      phase: this.phase,
      lastActive: this.lastActive,
      state,
    };
  }
  static restore(snap, log, io) {
    const room = new Room(snap.code, snap.scenarioId, io);
    for (const p of snap.players) room.players.set(p.token, p);
    room.hostToken = snap.hostToken;
    room.phase = snap.phase;
    room.lastActive = snap.lastActive;
    if (snap.state) room.state = { relocked: [], fired: [], lastProgress: Date.now(), ...snap.state, log };
    return room;
  }
  takeUnsaved() {
    const list = this.unsaved;
    this.unsaved = [];
    return list;
  }
  online(player) { return this.io.socketsOf(player.token).length > 0; }

  /* ---------- 입장 ---------- */
  join(isGM, rawChar) {
    if (this.phase !== 'lobby') return { error: '이미 시작된 방이에요.' };
    const list = [...this.players.values()];
    if (isGM && list.some((p) => p.isGM)) return { error: '이 방에는 이미 진행자가 있어요.' };
    const char = isGM ? null : cleanChar(rawChar);
    if (!isGM && !char) return { error: '참가할 캐릭터를 골라 주세요.' };
    if (!isGM && list.filter((p) => !p.isGM).length >= MAX_CAST) return { error: `캐릭터는 최대 ${MAX_CAST}명까지예요.` };
    const player = { token: crypto.randomUUID(), id: randomHex(4), isGM: !!isGM, char };
    this.players.set(player.token, player);
    if (!this.hostToken) this.hostToken = player.token;
    return { player };
  }

  leave(player) {
    if (this.phase !== 'lobby') return;
    this.players.delete(player.token);
    if (this.hostToken === player.token) this.hostToken = this.players.keys().next().value || null;
  }

  /* ---------- 공용 도우미 ---------- */
  room(id) { return this.scenario.rooms[id]; }
  get cast() { return this.state.cast; }
  charOf(player) { return this.state && this.cast.find((c) => c.id === player.id); }
  linksOf(roomId) { return this.scenario.links.filter((l) => l.a === roomId || l.b === roomId); }
  other(l, roomId) { return l.a === roomId ? l.b : l.a; }
  linkOpen(l) {
    if (this.state.relocked?.includes(l.id)) return false;
    return l.kind === 'open' || (l.kind === 'door' && (!l.locked || this.state.unlocked.includes(l.id)));
  }
  isDone(id) { return this.state.solved.includes(id) || this.state.unlocked.includes(id); }
  objDone(o) {
    return this.state.solved.includes(o.id) ||
      (o.onSolve?.unlock && !o.onSolve.item && this.state.unlocked.includes(o.onSolve.unlock));
  }
  membersIn(roomId) { return this.cast.filter((c) => this.state.pos[c.id] === roomId); }
  knows(charId, roomId) { return this.state.known[charId].includes(roomId); }
  learn(charId, roomId) { if (!this.knows(charId, roomId)) this.state.known[charId].push(roomId); }

  hearing(roomId, vol) {
    const range = RANGE[vol] || RANGE.whisper;
    const dist = { [roomId]: 0 };
    const queue = [roomId];
    while (queue.length) {
      const cur = queue.shift();
      for (const l of this.linksOf(cur)) {
        const nb = this.other(l, cur);
        if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; queue.push(nb); }
      }
    }
    const hear = {};
    for (const [r, d] of Object.entries(dist)) {
      if (d <= range.clear) hear[r] = 'clear';
      else if (d <= range.muffled) hear[r] = 'muffled';
    }
    return hear;
  }

  /* ---------- 시간 ---------- */
  timeLeft() {
    const s = this.state;
    return s.paused ? s.pausedLeft : Math.max(0, s.endsAt - Date.now());
  }
  spendTime(sec) {
    const s = this.state;
    if (s.paused) s.pausedLeft = Math.max(0, s.pausedLeft - sec * 1000);
    else s.endsAt -= sec * 1000;
    if (this.timeLeft() <= 0) this.end(false);
  }
  tick() {
    if (this.phase !== 'play') return;
    this.checkTimers();
    if (this.fresh.length) this.flush();
  }

  /* ---------- 자동 이벤트 ----------
     시나리오의 events: [{ id, on, ...조건, if, repeat, do: [연출] }]
     on: start / enter / inspect / solve / item / together / time / idle */
  fire(on, ctx = {}) {
    const s = this.state;
    for (const ev of this.scenario.events || []) {
      if (s.over || ev.on !== on || (!ev.repeat && s.fired.includes(ev.id))) continue;
      if (!this.eventMatches(ev, ctx)) continue;
      if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
      this.runEvent(ev, ctx);
    }
  }
  eventMatches(ev, ctx) {
    const s = this.state;
    if (ev.room && ev.room !== ctx.room) return false;
    if (ev.obj && ev.obj !== ctx.obj) return false;
    if (ev.item && ev.item !== ctx.item) return false;
    if (ctx.only && ev.id !== ctx.only) return false;
    if (ev.on === 'together') {
      const n = this.membersIn(ctx.room).length;
      if (this.cast.length < 2 || n < (ev.count === 'all' || !ev.count ? this.cast.length : ev.count)) return false;
    }
    const cond = ev.if || {};
    if (cond.done && ![].concat(cond.done).every((id) => this.isDone(id))) return false;
    if (cond.notDone && [].concat(cond.notDone).some((id) => this.isDone(id))) return false;
    return true;
  }
  runEvent(ev, ctx) {
    const s = this.state;
    const fill = (t) => String(t)
      .replace(/\{name\}/g, ctx.char?.name || '누군가')
      .replace(/\{room\}/g, ctx.room ? this.room(ctx.room).name : '');
    for (const act of ev.do || []) {
      // to: 'here'(조건이 일어난 구역, 기본값) / 'all'(전체) / 구역 id
      const to = act.to || (ctx.room ? 'here' : 'all');
      const where = to === 'all' ? null : to === 'here' ? ctx.room : to;
      const target = where ? { room: where } : { global: true };
      if (act.narr) this.post({ type: 'narr', text: fill(act.narr), ...target });
      if (act.sys) this.post({ type: 'sys', text: fill(act.sys), icon: act.icon, ...target });
      if (act.voice) this.post({ type: 'npc', text: fill(act.voice), speaker: act.speaker || '???', ...target });
      if (act.unlock) {
        if (!s.unlocked.includes(act.unlock)) s.unlocked.push(act.unlock);
        s.relocked = s.relocked.filter((id) => id !== act.unlock);
      }
      if (act.lock && !s.relocked.includes(act.lock)) s.relocked.push(act.lock);
      if (act.release) s.relocked = s.relocked.filter((id) => id !== act.release);
      if (act.time) {
        if (act.time < 0) this.spendTime(-act.time);
        else if (s.paused) s.pausedLeft += act.time * 1000;
        else s.endsAt += act.time * 1000;
      }
      if (act.hint) {
        const h = this.scenario.hints.find((x) => !this.isDone(x.until));
        if (h) this.post({ type: 'sys', text: `${act.hint === true ? '힌트' : act.hint}: ${h.text}`, global: true, icon: 'bulb' });
      }
      if (act.effect) this.effect(act.effect, where);
    }
  }
  // 화면 효과는 기록에 남기지 않고 그 구역(또는 전체)에 있는 사람에게만 보낸다
  effect(name, roomId) {
    for (const p of this.players.values()) {
      if (roomId && !p.isGM && this.state.pos[p.id] !== roomId) continue;
      this.send(p, { t: 'effect', name });
    }
  }
  // 시간 조건(남은 시간, 진전 없음)을 확인한다
  checkTimers() {
    const s = this.state;
    if (this.phase !== 'play' || s.paused) return;
    const left = this.timeLeft();
    for (const ev of this.scenario.events || []) {
      if (ev.on !== 'time' || s.fired.includes(ev.id)) continue;
      if (left <= this.eventLeft(ev) * 1000) this.fire('time', { only: ev.id });
    }
    for (const ev of this.scenario.events || []) {
      if (ev.on === 'idle' && Date.now() - s.lastProgress >= ev.seconds * 1000) {
        s.lastProgress = Date.now();
        this.fire('idle', { only: ev.id });
      }
    }
    if (left <= 0) this.end(false);
  }
  eventLeft(ev) { return ev.left ?? this.scenario.timeLimit - (ev.elapsed || 0); }
  // 다음에 시간 조건을 확인해야 하는 시각
  nextWake() {
    const s = this.state;
    if (this.phase !== 'play' || s.paused) return Infinity;
    let next = s.endsAt;
    for (const ev of this.scenario.events || []) {
      if (ev.on === 'time' && !s.fired.includes(ev.id)) next = Math.min(next, s.endsAt - this.eventLeft(ev) * 1000);
      if (ev.on === 'idle') next = Math.min(next, s.lastProgress + ev.seconds * 1000);
    }
    return next;
  }

  /* ---------- 메시지 ---------- */
  // type: say / act / narr / sys. 말은 vol에 따라 퍼지고, 나머지는 같은 구역에만 남는다.
  post({ type, text, charId, room, vol, global, icon, speaker }) {
    if (!text) return;
    const r = room || (charId && this.state.pos[charId]);
    const m = { id: this.state.nextId++, type, text, charId, room: r, icon };
    if (speaker) m.speaker = speaker;
    if (global) m.global = true;
    else {
      const spoken = type === 'say' || type === 'npc';
      const hear = this.hearing(r, spoken ? (vol || 'say') : 'whisper');
      m.heard = {};
      for (const c of this.cast) {
        const at = this.state.pos[c.id];
        if (hear[at]) m.heard[c.id] = [hear[at], at];
      }
    }
    if (type === 'say' && vol && vol !== 'say') m.vol = vol;
    this.state.log.push(m);
    this.fresh.push(m);
    this.unsaved.push(m);
  }
  canSee(player, m) {
    return player.isGM || m.global || !!m.heard?.[player.id];
  }
  msgFor(player, m) {
    const base = { id: m.id, icon: m.icon };
    if (player.isGM) {
      return { ...base, type: m.type, text: m.text, charId: m.charId, speaker: m.speaker, vol: m.vol, global: m.global, tag: m.global ? null : this.room(m.room).name };
    }
    if (m.global) return { ...base, type: m.type, text: m.text, speaker: m.speaker, global: true };
    const [quality, at] = m.heard[player.id];
    if (quality === 'muffled') {
      return { ...base, type: 'muffled', text: garble(m.text, m.id), from: this.knows(player.id, m.room) ? this.room(m.room).name : null };
    }
    return { ...base, type: m.type, text: m.text, charId: m.charId, speaker: m.speaker, vol: m.vol, away: m.room !== at ? this.room(m.room).name : null };
  }

  /* ---------- 전송 ---------- */
  send(player, obj) {
    const data = JSON.stringify(obj);
    for (const ws of this.io.socketsOf(player.token)) {
      try { ws.send(data); } catch { /* 닫히는 중인 소켓 */ }
    }
  }
  sendLog(player) {
    if (!this.state) return this.send(player, { t: 'log', msgs: [] });
    this.send(player, { t: 'log', msgs: this.state.log.filter((m) => this.canSee(player, m)).map((m) => this.msgFor(player, m)) });
  }
  flush() {
    const fresh = this.fresh;
    this.fresh = [];
    for (const p of this.players.values()) {
      if (!this.online(p)) continue;
      this.send(p, { t: 'view', view: this.view(p) });
      const msgs = fresh.filter((m) => this.canSee(p, m)).map((m) => this.msgFor(p, m));
      if (msgs.length) this.send(p, { t: 'msgs', msgs });
    }
  }

  /* ---------- 화면 정보 ---------- */
  view(p) {
    const players = [...this.players.values()].map((x) => ({
      id: x.id, isGM: x.isGM, char: x.char, online: this.online(x), host: x.token === this.hostToken,
    }));
    const base = {
      phase: this.phase,
      code: this.code,
      me: { id: p.id, isGM: p.isGM, isHost: p.token === this.hostToken },
      scenario: { id: this.scenario.id, title: this.scenario.title, summary: this.scenario.summary, intro: this.scenario.intro, map: this.scenario.map },
      players,
    };
    if (this.phase === 'lobby') return base;

    const s = this.state;
    const myRoom = p.isGM ? null : s.pos[p.id];
    const seesChar = (c) => p.isGM || c.id === p.id || s.pos[c.id] === myRoom;
    const known = (roomId) => p.isGM || this.knows(p.id, roomId);

    const cast = this.cast.map((c) => ({
      id: c.id, name: c.name, color: c.color, image: c.image, sprite: c.sprite,
      personality: c.personality, skill: c.skill, intro: c.intro,
      room: seesChar(c) ? s.pos[c.id] : null,
      roomName: seesChar(c) ? this.room(s.pos[c.id]).name : null,
      items: seesChar(c) ? s.inv[c.id].map((id) => ({ id, ...this.scenario.items[id] })) : null,
    }));

    const vis = {};
    for (const id of Object.keys(this.scenario.rooms)) if (known(id)) vis[id] = 'known';
    for (const id of Object.keys(vis)) {
      for (const l of this.linksOf(id)) if (!vis[this.other(l, id)]) vis[this.other(l, id)] = 'unknown';
    }
    const mapRooms = Object.entries(vis).map(([id, state]) => ({
      id, state, rect: this.room(id).rect,
      name: state === 'known' ? this.room(id).name : null,
      tokens: state === 'known' && (p.isGM || id === myRoom) ? this.membersIn(id).map((c) => c.id) : [],
    }));
    const mapLinks = this.scenario.links
      .filter((l) => l.kind !== 'wall' && vis[l.a] && vis[l.b])
      .map((l) => ({ id: l.id, a: l.a, b: l.b, kind: l.kind, open: this.linkOpen(l), at: l.at }));

    const detail = (roomId) => {
      const r = this.room(roomId);
      return {
        id: roomId, name: r.name, desc: r.desc, rect: r.rect,
        objects: r.objects.map((o) => ({ id: o.id, name: o.name, icon: o.icon, done: !!this.objDone(o) })),
        exits: this.linksOf(roomId).filter((l) => l.kind !== 'wall').map((l) => {
          const to = this.other(l, roomId);
          return { to, name: known(to) ? this.room(to).name : null, open: this.linkOpen(l) };
        }),
        people: this.membersIn(roomId).map((c) => c.id),
      };
    };

    return {
      ...base,
      cast,
      time: { left: this.timeLeft(), paused: s.paused },
      over: s.over,
      result: s.result,
      map: { ...this.scenario.map, rooms: mapRooms, links: mapLinks },
      here: myRoom ? detail(myRoom) : null,
      rooms: p.isGM ? Object.fromEntries(Object.keys(this.scenario.rooms).map((id) => [id, detail(id)])) : null,
    };
  }

  /* ---------- 시작 / 종료 ---------- */
  start() {
    const cast = shuffle([...this.players.values()].filter((p) => !p.isGM && p.char).map((p) => ({ ...p.char, id: p.id })));
    if (!cast.length) return '캐릭터로 참가한 사람이 한 명 이상 있어야 해요.';
    const starts = shuffle(this.scenario.starts);
    const pos = {};
    const inv = {};
    const known = {};
    cast.forEach((c, i) => { pos[c.id] = starts[i % starts.length]; inv[c.id] = []; known[c.id] = [pos[c.id]]; });
    this.state = {
      cast, pos, inv, known,
      solved: [], unlocked: [], relocked: [], fired: [], log: [], nextId: 1, lastProgress: Date.now(),
      endsAt: Date.now() + this.scenario.timeLimit * 1000, paused: false, pausedLeft: 0,
      over: false, result: null,
    };
    this.phase = 'play';
    this.scenario.intro.forEach((t) => this.post({ type: 'narr', text: t, global: true }));
    this.post({ type: 'sys', text: `녹화 시작! 제한 시간 ${Math.floor(this.scenario.timeLimit / 60)}분.`, global: true });
    for (const c of cast) {
      this.post({ type: 'narr', text: `${josa(c.name, '이', '가')} ${this.room(pos[c.id]).name}에서 눈을 떴다.`, room: pos[c.id] });
      this.post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
    }
    this.fire('start');
    return null;
  }

  end(success) {
    const s = this.state;
    if (s.over) return;
    if (success) {
      for (const c of this.cast) this.post({ type: 'say', text: voiceLine(c.personality, 'escape'), charId: c.id });
      const used = Math.round((this.scenario.timeLimit * 1000 - this.timeLeft()) / 1000);
      this.post({ type: 'sys', text: `탈출 성공! 소요 시간 ${Math.floor(used / 60)}분 ${used % 60}초`, global: true });
    } else {
      this.post({ type: 'sys', text: this.scenario.failText || '시간 초과. 탈출에 실패했다…', global: true, icon: 'skull' });
    }
    s.pausedLeft = this.timeLeft();
    s.paused = true;
    s.over = true;
    s.result = success ? 'escape' : 'fail';
    this.phase = 'ended';
  }

  /* ---------- 행동 처리 ---------- */
  handle(player, msg) {
    this.lastActive = Date.now();
    const err = this.dispatch(player, msg);
    if (err) this.send(player, { t: 'error', text: err });
    if (this.phase === 'play') this.checkTimers();
    this.flush();
  }

  dispatch(player, msg) {
    if (this.phase === 'lobby') {
      if (msg.t === 'start') {
        if (player.token !== this.hostToken) return '방장만 시작할 수 있어요.';
        return this.start();
      }
      if (msg.t === 'setChar' && !player.isGM) {
        const char = cleanChar(msg.char);
        if (!char) return '캐릭터 정보가 올바르지 않아요.';
        player.char = char;
        return null;
      }
      if (msg.t === 'leave') return this.leave(player);
      return null;
    }
    if (this.phase !== 'play') return null;

    if (player.isGM) {
      if (msg.t === 'narr') {
        const text = str(msg.text, MAX_TEXT);
        if (!text) return null;
        if (msg.room && this.room(msg.room)) this.post({ type: 'narr', text, room: msg.room });
        else this.post({ type: 'narr', text, global: true });
      }
      if (msg.t === 'pause') {
        const s = this.state;
        if (s.paused) { s.endsAt = Date.now() + s.pausedLeft; s.paused = false; this.post({ type: 'sys', text: '진행자가 시간을 다시 흐르게 했다.', global: true }); }
        else { s.pausedLeft = this.timeLeft(); s.paused = true; this.post({ type: 'sys', text: '진행자가 시간을 멈췄다.', global: true }); }
      }
      if (msg.t === 'hint') this.hint(false);
      return null;
    }

    const c = this.charOf(player);
    if (!c) return null;
    switch (msg.t) {
      case 'say': return this.say(c, msg.mode, msg.text);
      case 'move': return this.move(c, msg.to);
      case 'interact': return this.interact(player, c, msg.obj);
      case 'guess': return this.guess(c, msg.obj, msg.value);
      case 'force': return this.force(c, msg.obj);
      case 'give': return this.give(c, msg.item, msg.to);
      case 'hint': return this.hint(true);
      default: return null;
    }
  }

  say(c, mode, raw) {
    const text = str(raw, MAX_TEXT);
    if (!text) return null;
    if (mode === 'act') this.post({ type: 'act', text, charId: c.id });
    else this.post({ type: 'say', text, charId: c.id, vol: RANGE[mode] ? mode : 'say' });
    return null;
  }

  hint(paid) {
    const h = this.scenario.hints.find((x) => !this.isDone(x.until));
    if (!h) return '더 줄 힌트가 없어요.';
    if (paid) {
      this.post({ type: 'sys', text: `힌트: ${h.text} (-${HINT_COST / 60}분)`, global: true, icon: 'bulb' });
      this.spendTime(HINT_COST);
    } else {
      this.post({ type: 'sys', text: `진행자의 힌트: ${h.text}`, global: true, icon: 'bulb' });
    }
    return null;
  }

  move(c, to) {
    const s = this.state;
    const from = s.pos[c.id];
    if (!this.room(to) || to === from) return null;
    const link = this.linksOf(from).find((l) => this.other(l, from) === to && l.kind !== 'wall');
    if (!link) return '여기서 바로 갈 수 없는 곳이에요.';
    if (!this.linkOpen(link)) {
      this.post({ type: 'act', text: '문을 밀어 보지만 꿈쩍도 하지 않는다.', charId: c.id });
      this.post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
      return null;
    }
    const first = !this.knows(c.id, to);
    this.post({ type: 'act', text: `${josa(first ? '저편' : this.room(to).name, '으로', '로')} 나간다.`, charId: c.id });
    s.pos[c.id] = to;
    this.learn(c.id, to);
    this.post({ type: 'act', text: '들어왔다.', charId: c.id });
    if (first) {
      this.post({ type: 'narr', text: this.room(to).desc, room: to });
      this.post({ type: 'say', text: voiceLine(c.personality, 'move'), charId: c.id });
    }
    const met = this.membersIn(to).filter((m) => m.id !== c.id);
    if (met.length) this.post({ type: 'sys', text: `${josa(met.map((m) => m.name).join(', '), '과', '와')} 합류했다!`, room: to });
    this.fire('enter', { char: c, room: to });
    this.fire('together', { char: c, room: to });
    return null;
  }

  findObj(c, objId) {
    return this.room(this.state.pos[c.id]).objects.find((o) => o.id === objId);
  }

  // 조사 조건을 못 갖췄으면 메시지를 남기고 true
  blocked(c, obj) {
    const s = this.state;
    const here = s.pos[c.id];
    if (obj.needItem && !s.inv[c.id].includes(obj.needItem)) {
      this.post({ type: 'narr', text: obj.lackText, room: here });
      this.post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
      return true;
    }
    if (obj.needAll) {
      const missing = this.cast.filter((m) => s.pos[m.id] !== here);
      if (missing.length) {
        this.post({ type: 'sys', text: `전원 탑승 확인 실패 — 아직 ${missing.length}명이 오지 않았다.`, room: here });
        this.post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
        return true;
      }
    }
    return false;
  }

  interact(player, c, objId) {
    const s = this.state;
    const obj = this.findObj(c, objId);
    if (!obj) return null;
    const here = s.pos[c.id];
    this.post({ type: 'act', text: `${josa(obj.name, '을', '를')} 살펴본다.`, charId: c.id });
    if (this.objDone(obj)) { this.post({ type: 'narr', text: obj.solvedDesc || '이미 해결했다.', room: here }); return null; }
    this.post({ type: 'narr', text: obj.desc, room: here });
    if (obj.bonus && c.skill === 'observe') this.post({ type: 'sys', text: `관찰력 — ${obj.bonus}`, room: here, icon: 'eye' });
    this.fire('inspect', { char: c, room: here, obj: obj.id });

    if (obj.cctv) {
      const lines = this.cast.map((m) => `${m.name}: ${this.room(s.pos[m.id]).name}`).join(' / ');
      this.post({ type: 'sys', text: lines, room: here, icon: 'monitor' });
      for (const m of this.membersIn(here)) for (const other of this.cast) this.learn(m.id, s.pos[other.id]);
      this.post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
      return null;
    }
    if (this.blocked(c, obj)) return null;
    if (obj.needItem) {
      const it = this.scenario.items[obj.needItem];
      this.post({ type: 'sys', text: `${josa(it.name, '을', '를')} 사용했다.`, room: here, icon: it.icon });
    }
    if (obj.lock) {
      this.send(player, {
        t: 'lock',
        obj: {
          id: obj.id, name: obj.name, icon: obj.icon, prompt: obj.lock.prompt,
          hint: c.skill === 'brain' ? obj.lock.hint : null,
          force: c.skill === 'strength' && !!obj.lock.forceable,
          by: c.name,
        },
      });
      return null;
    }
    if (obj.onSolve) return this.solve(c, obj);
    this.post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
    return null;
  }

  guess(c, objId, raw) {
    const obj = this.findObj(c, objId);
    if (!obj?.lock || this.objDone(obj) || this.state.over) return null;
    if ((obj.needItem && !this.state.inv[c.id].includes(obj.needItem)) || this.blocked(c, obj)) return null;
    const value = str(raw, 20);
    if (!value) return null;
    const here = this.state.pos[c.id];
    this.post({ type: 'act', text: `${obj.name}에 "${value}" 입력!`, charId: c.id });
    if (value.toUpperCase() === obj.lock.answer.toUpperCase()) return this.solve(c, obj);
    this.post({ type: 'narr', text: '삐빅— 틀렸다.', room: here });
    this.post({ type: 'say', text: voiceLine(c.personality, 'fail'), charId: c.id });
    if (c.skill === 'luck') {
      this.post({ type: 'sys', text: `${c.name}의 행운 — 시간이 줄지 않았다.`, room: here, icon: 'clover' });
    } else {
      this.post({ type: 'sys', text: `오답! -${WRONG_COST / 60}분`, global: true, icon: 'hourglass' });
      this.spendTime(WRONG_COST);
    }
    return null;
  }

  force(c, objId) {
    const obj = this.findObj(c, objId);
    if (!obj?.lock?.forceable || c.skill !== 'strength' || this.objDone(obj)) return null;
    if (this.blocked(c, obj)) return null;
    this.post({ type: 'act', text: `${josa(obj.name, '을', '를')} 힘으로 비틀어 연다!`, charId: c.id });
    this.post({ type: 'sys', text: `${c.name}의 괴력 발동!`, room: this.state.pos[c.id], icon: 'fist' });
    return this.solve(c, obj);
  }

  solve(c, obj) {
    const s = this.state;
    const r = obj.onSolve;
    const here = s.pos[c.id];
    s.solved.push(obj.id);
    s.lastProgress = Date.now();
    if (obj.needItem && !obj.keepItem) s.inv[c.id] = s.inv[c.id].filter((i) => i !== obj.needItem);
    this.post({ type: 'narr', text: r.text, room: here });
    if (r.unlock && !s.unlocked.includes(r.unlock)) s.unlocked.push(r.unlock);
    if (r.item) {
      s.inv[c.id].push(r.item);
      const it = this.scenario.items[r.item];
      this.post({ type: 'sys', text: `${c.name} — ${josa(it.name, '을', '를')} 얻었다!`, room: here, icon: it.icon });
      this.post({ type: 'say', text: voiceLine(c.personality, 'item'), charId: c.id });
    } else {
      this.post({ type: 'say', text: voiceLine(c.personality, 'success'), charId: c.id });
    }
    if (r.ending) return this.end(true);
    this.fire('solve', { char: c, room: here, obj: obj.id });
    if (r.item) this.fire('item', { char: c, room: here, item: r.item });
    return null;
  }

  give(c, item, toId) {
    const s = this.state;
    const to = this.cast.find((m) => m.id === toId);
    if (!to || to.id === c.id || !s.inv[c.id].includes(item)) return null;
    if (s.pos[to.id] !== s.pos[c.id]) return '같은 구역에 있어야 건넬 수 있어요.';
    s.inv[c.id] = s.inv[c.id].filter((i) => i !== item);
    s.inv[to.id].push(item);
    this.post({ type: 'act', text: `${to.name}에게 ${josa(this.scenario.items[item].name, '을', '를')} 건넨다.`, charId: c.id });
    return null;
  }
}

