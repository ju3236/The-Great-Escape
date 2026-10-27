// 방 하나의 게임 진행. 모든 판정은 서버에서 하고, 각 플레이어에게는 그 사람의 캐릭터들이 보고 들을 수 있는 것만 보낸다.
// 실행 환경과는 io(소켓 찾기)로만 연결된다. 저장은 snapshot()/restore()로 한다.
import { SCENARIOS } from './scenarios.js';
import voices from '../public/js/voices.js';
import pixels from '../public/js/pixels.js';

const { PERSONALITIES, SKILLS } = voices;
const { SPRITES } = pixels;

const HINT_COST = 180; // 제한 시간이 있을 때 힌트가 깎는 시간(초)
const WRONG_COST = 60; // 제한 시간이 있을 때 오답이 깎는 시간(초)
const ATTACK_WRONG_COST = 10; // 타임어택 중 오답이 깎는 시간(초)
const MAX_CAST = 6;
const MAX_TEXT = 300;
const PIN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
    // 올린 그림은 Worker가 따로 저장하고 id만 남긴다 (a: 프사, b: 전신)
    img: c.img && /^[0-9a-f]{16}$/.test(c.img.id) ? { id: c.img.id, a: !!c.img.a, b: !!c.img.b } : undefined,
  };
}
// 캐릭터 하나(옛 방식) 또는 여러 명(배열)을 받는다
function cleanChars(raw) {
  return [].concat(raw || []).map(cleanChar).filter(Boolean).slice(0, MAX_CAST);
}

const randomHex = (bytes) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export { cleanChar };

export class Room {
  // scenario: 에피소드 id, 또는 시나리오 객체(테스트용)
  constructor(code, scenario, io) {
    this.code = code;
    this.scenario = typeof scenario === 'object' && scenario
      ? scenario
      : SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
    this.players = new Map(); // token → player
    this.hostToken = null;
    this.phase = 'lobby';
    this.lastActive = Date.now();
    this.state = null;
    this.fresh = []; // 아직 플레이어에게 보내지 않은 메시지
    this.unsaved = []; // 아직 저장하지 않은 메시지
    this.io = io; // { socketsOf(token) → 열린 소켓 목록 }
    // 방장이 바꾸는 방 설정. 제한 시간은 대기실에서만 바꿀 수 있다.
    this.options = { autoHint: false, timeLimit: false };
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
      options: this.options,
      state,
    };
  }
  static restore(snap, log, io, scenario) {
    const room = new Room(snap.code, scenario || snap.scenarioId, io);
    for (const p of snap.players) {
      if (!p.chars) p.chars = p.char ? [p.char] : []; // 예전 저장 형식
      delete p.char;
      room.players.set(p.token, p);
    }
    room.hostToken = snap.hostToken;
    room.phase = snap.phase;
    room.lastActive = snap.lastActive;
    room.options = { ...room.options, ...snap.options };
    if (snap.state) {
      room.state = {
        relocked: [], fired: [], hintVotes: [], attacks: [], lastProgress: Date.now(),
        clock: { start: Date.now(), pausedAt: null, pausedTotal: 0 }, limit: null, bonus: 0,
        ...snap.state, log,
      };
    }
    return room;
  }
  takeUnsaved() {
    const list = this.unsaved;
    this.unsaved = [];
    return list;
  }
  online(player) { return this.io.socketsOf(player.token).length > 0; }

  /* ---------- 입장 ---------- */
  // 대기실에서도, 게임 도중에도 들어올 수 있다 (도중 합류는 시작 구역 중 한 곳에서 깨어난다)
  // 한 사람이 캐릭터를 여러 명 데려올 수 있다
  join(isGM, rawChars) {
    if (this.phase === 'ended') return { error: '이미 끝난 방이에요.' };
    const list = [...this.players.values()];
    if (isGM && list.some((p) => p.isGM)) return { error: '이 방에는 이미 진행자가 있어요.' };
    const chars = isGM ? [] : cleanChars(rawChars);
    if (!isGM && !chars.length) return { error: '참가할 캐릭터를 골라 주세요.' };
    if (!isGM && this.castCount() + chars.length > MAX_CAST) return { error: `방 전체 캐릭터는 최대 ${MAX_CAST}명이에요. 지금 ${MAX_CAST - this.castCount()}명 더 들어올 수 있어요.` };
    const player = { token: crypto.randomUUID(), id: randomHex(4), pin: this.newPin(), isGM: !!isGM, chars };
    this.players.set(player.token, player);
    if (!this.hostToken) this.hostToken = player.token;
    if (this.phase === 'play' && !isGM) this.addToCast(player);
    return { player };
  }
  castCount() {
    if (this.state) return this.cast.filter((c) => !c.gone).length;
    return [...this.players.values()].reduce((n, p) => n + p.chars.length, 0);
  }

  // 다른 기기에서 이어하기용 6자리 번호
  newPin() {
    let pin;
    do {
      pin = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => PIN_CHARS[b % PIN_CHARS.length]).join('');
    } while ([...this.players.values()].some((p) => p.pin === pin));
    return pin;
  }
  findByPin(pin) {
    const want = str(pin, 6).toUpperCase();
    return want.length === 6 ? [...this.players.values()].find((p) => p.pin === want) : null;
  }
  playerById(id) { return [...this.players.values()].find((p) => p.id === id); }
  // 캐릭터 id는 "플레이어id" 또는 "플레이어id-번호"
  ownerOf(charId) { return this.playerById(String(charId).split('-')[0]); }
  charIdsOf(player) { return player.chars.map((_, i) => (i ? `${player.id}-${i}` : player.id)); }
  myChars(player) { return this.state ? this.cast.filter((c) => !c.gone && this.ownerOf(c.id) === player) : []; }

  addToCast(player) {
    const s = this.state;
    const ids = this.charIdsOf(player);
    player.chars.forEach((ch, i) => {
      const c = { ...ch, id: ids[i] };
      const start = shuffle(this.scenario.starts)[0];
      s.cast.push(c);
      s.pos[c.id] = start;
      s.inv[c.id] = [];
      s.known[c.id] = [start];
      this.post({ type: 'sys', text: `${c.name} 합류 — 어딘가에서 눈을 떴다.`, global: true });
      this.post({ type: 'narr', text: `${josa(c.name, '이', '가')} ${this.room(start).name}에서 눈을 떴다.`, room: start });
    });
  }

  leave(player) {
    if (this.phase !== 'lobby') return;
    this.removePlayer(player);
  }

  removePlayer(player) {
    this.players.delete(player.token);
    if (this.hostToken === player.token) {
      const next = [...this.players.values()].find((p) => this.online(p)) || this.players.values().next().value;
      this.hostToken = next?.token || null;
    }
  }

  // 방장은 누구든, 다른 사람은 접속이 끊긴 사람만 내보낼 수 있다
  kick(by, targetId) {
    const target = this.playerById(targetId);
    if (!target || target === by) return null;
    if (by.token !== this.hostToken && this.online(target)) return '접속 중인 사람은 방장만 내보낼 수 있어요.';
    const gone = this.myChars(target);
    this.send(target, { t: 'kicked' });
    this.removePlayer(target);
    for (const c of gone) {
      c.gone = true;
      this.post({ type: 'sys', text: `${josa(c.name, '이', '가')} 방을 떠났다.`, global: true });
    }
    return null;
  }

  /* ---------- 공용 도우미 ---------- */
  room(id) { return this.scenario.rooms[id]; }
  get cast() { return this.state.cast; }
  // 플레이어가 고른 캐릭터(as). 없으면 그 사람의 첫 캐릭터.
  charOf(player, as) {
    const mine = this.myChars(player);
    return mine.find((c) => c.id === as) || mine[0];
  }
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
  membersIn(roomId) { return this.cast.filter((c) => !c.gone && this.state.pos[c.id] === roomId); }
  // 지금 실제로 플레이 중인 캐릭터 (방을 떠났거나 주인의 접속이 끊긴 캐릭터는 빠진다)
  isActive(charId) {
    const p = this.ownerOf(charId);
    return !!p && this.online(p);
  }
  activeCast() { return this.cast.filter((c) => !c.gone && this.isActive(c.id)); }
  activePlayers() { return [...this.players.values()].filter((p) => !p.isGM && this.online(p) && this.myChars(p).length); }
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

  /* ---------- 시간 ----------
     기본은 제한 시간 없이 흐른 시간만 센다. 방장이 대기실에서 제한 시간을 켜면 남은 시간도 센다.
     타임어택과 시간 조건도 모두 "흐른 시간" 기준이라 진행자가 멈추면 함께 멈춘다. */
  get paused() { return this.state.clock.pausedAt != null; }
  elapsed() {
    const { start, pausedAt, pausedTotal } = this.state.clock;
    return (pausedAt ?? Date.now()) - start - pausedTotal;
  }
  timeLeft() {
    const s = this.state;
    return s.limit == null ? null : Math.max(0, s.limit + s.bonus - this.elapsed());
  }
  // 제한 시간이 있을 때만 시간을 깎는다. 깎았으면 true
  spendTime(sec) {
    const s = this.state;
    if (s.limit == null) return false;
    s.bonus -= sec * 1000;
    if (this.timeLeft() <= 0) this.end(false);
    return true;
  }
  setPaused(on) {
    const c = this.state.clock;
    if (on && c.pausedAt == null) c.pausedAt = Date.now();
    if (!on && c.pausedAt != null) { c.pausedTotal += Date.now() - c.pausedAt; c.pausedAt = null; }
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
      this.runActions(ev.do, ctx);
    }
  }
  eventMatches(ev, ctx) {
    if (ev.room && ev.room !== ctx.room) return false;
    if (ev.obj && ev.obj !== ctx.obj) return false;
    if (ev.item && ev.item !== ctx.item) return false;
    if (ctx.only && ev.id !== ctx.only) return false;
    if (ev.on === 'together') {
      const active = this.activeCast();
      const n = active.filter((c) => this.state.pos[c.id] === ctx.room).length;
      if (active.length < 2 || n < (ev.count === 'all' || !ev.count ? active.length : ev.count)) return false;
    }
    const cond = ev.if || {};
    if (cond.done && ![].concat(cond.done).every((id) => this.isDone(id))) return false;
    if (cond.notDone && [].concat(cond.notDone).some((id) => this.isDone(id))) return false;
    return true;
  }
  runActions(list, ctx) {
    const s = this.state;
    const fill = (t) => String(t)
      .replace(/\{name\}/g, ctx.char?.name || '누군가')
      .replace(/\{room\}/g, ctx.room ? this.room(ctx.room).name : '');
    for (const act of list || []) {
      if (s.over) return;
      // to: 'here'(조건이 일어난 구역, 기본값) / 'all'(전체) / 구역 id
      const to = act.to || (ctx.room ? 'here' : 'all');
      const where = to === 'all' ? null : to === 'here' ? ctx.room : to;
      const target = where ? { room: where } : { global: true };
      if (act.narr) this.post({ type: 'narr', text: fill(act.narr), ...target });
      if (act.sys) this.post({ type: 'sys', text: fill(act.sys), icon: act.icon, ...target });
      if (act.voice) this.post({ type: 'npc', text: fill(act.voice), speaker: act.speaker || '???', sfx: 'voice', ...target });
      if (act.unlock) {
        if (!s.unlocked.includes(act.unlock)) s.unlocked.push(act.unlock);
        s.relocked = s.relocked.filter((id) => id !== act.unlock);
      }
      if (act.lock && !s.relocked.includes(act.lock)) s.relocked.push(act.lock);
      if (act.release) s.relocked = s.relocked.filter((id) => id !== act.release);
      if (act.time && s.limit != null) {
        if (act.time < 0) this.spendTime(-act.time);
        else s.bonus += act.time * 1000;
      }
      if (act.hint && this.options.autoHint) {
        const h = this.scenario.hints.find((x) => !this.isDone(x.until));
        if (h) this.post({ type: 'sys', text: `${act.hint === true ? '힌트' : act.hint}: ${h.text}`, global: true, icon: 'bulb' });
      }
      if (act.effect) this.effect(act.effect, where);
      // 타임어택에 실패한 캐릭터들을 다른 구역으로 끌고 간다
      if (act.moveTo && ctx.who) {
        for (const id of ctx.who) {
          const c = this.cast.find((x) => x.id === id && !x.gone);
          if (!c) continue;
          s.pos[c.id] = act.moveTo;
          this.learn(c.id, act.moveTo);
        }
      }
      if (act.attack) this.startAttack(act.attack, where, ctx);
      if (act.gameover) return this.end(false, fill(act.gameover));
    }
  }
  // 화면 효과는 기록에 남기지 않고 그 구역(또는 전체)에 캐릭터가 있는 사람에게만 보낸다
  effect(name, roomId) {
    for (const p of this.players.values()) {
      if (roomId && !p.isGM && !this.myChars(p).some((c) => this.state.pos[c.id] === roomId)) continue;
      this.send(p, { t: 'effect', name });
    }
  }

  /* ---------- 타임어택 ----------
     { attack: { id, seconds, label, until, success: [연출], fail: [연출] }, to }
     until: { done: 오브젝트·링크 id } / { allIn: 구역 id } / { noneIn: 구역 id }
     to가 구역이면 그때 그 구역에 있던 캐릭터만, 아니면 플레이 중인 모두가 대상이다. */
  startAttack(a, where, ctx) {
    const s = this.state;
    if (s.attacks.some((x) => x.id === a.id)) return;
    const who = (where ? this.membersIn(where) : this.activeCast()).map((c) => c.id);
    if (!who.length) return;
    s.attacks.push({ id: a.id, label: a.label || '타임어택', ends: this.elapsed() + a.seconds * 1000, who, until: a.until || {}, success: a.success, fail: a.fail, room: ctx.room });
    this.post({ type: 'sys', text: `타임어택 — ${a.label || '서둘러라'} (${a.seconds}초)`, global: !where, room: where || undefined, icon: 'hourglass', sfx: 'alarm' });
  }
  attackCleared(at) {
    const s = this.state;
    const u = at.until;
    const who = at.who.map((id) => this.cast.find((c) => c.id === id)).filter((c) => c && !c.gone && this.isActive(c.id));
    if (u.done) return this.isDone(u.done);
    if (u.allIn) return who.length > 0 && who.every((c) => s.pos[c.id] === u.allIn);
    if (u.noneIn) return who.every((c) => s.pos[c.id] !== u.noneIn);
    return false;
  }
  checkAttacks() {
    const s = this.state;
    for (const at of [...s.attacks]) {
      if (s.over) return;
      const cleared = this.attackCleared(at);
      if (!cleared && this.elapsed() < at.ends) continue;
      s.attacks = s.attacks.filter((x) => x !== at);
      this.runActions(cleared ? at.success : at.fail, { room: at.room, who: at.who });
    }
  }

  // 시간 조건(흐른 시간, 남은 시간, 진전 없음, 타임어택)을 확인한다
  checkTimers() {
    const s = this.state;
    if (this.phase !== 'play') return;
    this.checkAttacks();
    if (this.paused || s.over) return;
    const elapsed = this.elapsed();
    const left = this.timeLeft();
    for (const ev of this.scenario.events || []) {
      if (ev.on !== 'time' || s.fired.includes(ev.id)) continue;
      const due = ev.left != null ? left != null && left <= ev.left * 1000 : elapsed >= (ev.elapsed || 0) * 1000;
      if (due) this.fire('time', { only: ev.id });
    }
    for (const ev of this.scenario.events || []) {
      if (ev.on === 'idle' && this.options.autoHint && Date.now() - s.lastProgress >= ev.seconds * 1000) {
        s.lastProgress = Date.now();
        this.fire('idle', { only: ev.id });
      }
    }
    if (left != null && left <= 0) this.end(false);
  }
  // 다음에 시간 조건을 확인해야 하는 실제 시각
  nextWake() {
    const s = this.state;
    if (this.phase !== 'play' || this.paused) return Infinity;
    const now = Date.now();
    const elapsed = this.elapsed();
    const left = this.timeLeft();
    let next = left != null ? now + left : Infinity;
    for (const at of s.attacks) next = Math.min(next, now + at.ends - elapsed);
    for (const ev of this.scenario.events || []) {
      if (ev.on === 'time' && !s.fired.includes(ev.id)) {
        if (ev.left != null) { if (left != null) next = Math.min(next, now + left - ev.left * 1000); }
        else next = Math.min(next, now + (ev.elapsed || 0) * 1000 - elapsed);
      }
      if (ev.on === 'idle' && this.options.autoHint) next = Math.min(next, s.lastProgress + ev.seconds * 1000);
    }
    return next;
  }

  /* ---------- 메시지 ---------- */
  // type: say / act / narr / sys / npc. 말은 vol에 따라 퍼지고, 나머지는 같은 구역에만 남는다.
  post({ type, text, charId, room, vol, global, icon, speaker, sfx }) {
    if (!text) return;
    const r = room || (charId && this.state.pos[charId]);
    const m = { id: this.state.nextId++, type, text, charId, room: r, icon };
    if (speaker) m.speaker = speaker;
    if (sfx) m.sfx = sfx;
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
  // 내 캐릭터 중 누구라도 들었으면 보인다. 또렷하게 들은 캐릭터가 있으면 그쪽을 쓴다.
  heardBy(player, m) {
    let best = null;
    for (const id of this.charIdsOf(player)) {
      const h = m.heard?.[id];
      if (h && (!best || h[0] === 'clear')) best = [...h, id];
      if (best?.[0] === 'clear') break;
    }
    return best;
  }
  canSee(player, m) {
    return player.isGM || m.global || !!this.heardBy(player, m);
  }
  msgFor(player, m) {
    const base = { id: m.id, icon: m.icon, sfx: m.sfx };
    if (player.isGM) {
      return { ...base, type: m.type, text: m.text, charId: m.charId, speaker: m.speaker, vol: m.vol, global: m.global, tag: m.global ? null : this.room(m.room).name, room: m.room };
    }
    if (m.global) return { ...base, type: m.type, text: m.text, speaker: m.speaker, global: true };
    const [quality, at, by] = this.heardBy(player, m);
    if (quality === 'muffled') {
      const knows = this.charIdsOf(player).some((id) => this.state.known[id]?.includes(m.room));
      return { id: m.id, type: 'muffled', text: garble(m.text, m.id), from: knows ? this.room(m.room).name : null, by };
    }
    return { ...base, type: m.type, text: m.text, charId: m.charId, speaker: m.speaker, vol: m.vol, room: m.room, by, away: m.room !== at ? this.room(m.room).name : null };
  }

  /* ---------- 전송 ---------- */
  send(player, obj) {
    if (!player) return;
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
      id: x.id, isGM: x.isGM, chars: x.chars, online: this.online(x), host: x.token === this.hostToken,
    }));
    const base = {
      phase: this.phase,
      code: this.code,
      me: { id: p.id, isGM: p.isGM, isHost: p.token === this.hostToken, pin: p.pin, chars: this.charIdsOf(p) },
      options: this.options,
      scenario: {
        id: this.scenario.id, title: this.scenario.title, summary: this.scenario.summary, intro: this.scenario.intro,
        map: this.scenario.map, timeLimit: this.scenario.timeLimit,
      },
      players,
    };
    if (this.phase === 'lobby') return base;

    const s = this.state;
    const mine = new Set(this.charIdsOf(p));
    const myRooms = new Set([...mine].filter((id) => s.pos[id] && !this.cast.find((c) => c.id === id)?.gone).map((id) => s.pos[id]));
    const seesChar = (c) => !c.gone && (p.isGM || mine.has(c.id) || myRooms.has(s.pos[c.id]));
    const known = (roomId) => p.isGM || [...mine].some((id) => s.known[id]?.includes(roomId));

    const cast = this.cast.map((c) => ({
      id: c.id, name: c.name, color: c.color, image: c.image, sprite: c.sprite, img: c.img, gone: !!c.gone,
      personality: c.personality, skill: c.skill, intro: c.intro, owner: this.ownerOf(c.id)?.id || null,
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
      tokens: state === 'known' && (p.isGM || myRooms.has(id)) ? this.membersIn(id).map((c) => c.id) : [],
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
    const elapsed = this.elapsed();
    const attacks = s.attacks
      .filter((a) => p.isGM || a.who.some((id) => mine.has(id)))
      .map((a) => ({ id: a.id, label: a.label, left: Math.max(0, a.ends - elapsed) }));
    const voters = new Set(s.hintVotes);

    return {
      ...base,
      cast,
      time: { elapsed, left: this.timeLeft(), limited: s.limit != null, paused: this.paused },
      attacks,
      hint: { votes: voters.size, need: this.hintNeed(), mine: voters.has(p.id), cost: s.limit != null ? HINT_COST : 0 },
      over: s.over,
      result: s.result,
      endText: s.endText || null,
      map: { ...this.scenario.map, rooms: mapRooms, links: mapLinks },
      // 내 캐릭터들이 있는 구역마다의 정보 (진행자는 모든 구역)
      rooms: Object.fromEntries((p.isGM ? Object.keys(this.scenario.rooms) : [...myRooms]).map((id) => [id, detail(id)])),
    };
  }

  /* ---------- 시작 / 종료 ---------- */
  start() {
    const cast = shuffle([...this.players.values()].filter((p) => !p.isGM)
      .flatMap((p) => p.chars.map((ch, i) => ({ ...ch, id: this.charIdsOf(p)[i] }))));
    if (!cast.length) return '캐릭터로 참가한 사람이 한 명 이상 있어야 해요.';
    const starts = shuffle(this.scenario.starts);
    const pos = {};
    const inv = {};
    const known = {};
    cast.forEach((c, i) => { pos[c.id] = starts[i % starts.length]; inv[c.id] = []; known[c.id] = [pos[c.id]]; });
    const limit = this.options.timeLimit && this.scenario.timeLimit ? this.scenario.timeLimit * 1000 : null;
    this.state = {
      cast, pos, inv, known,
      solved: [], unlocked: [], relocked: [], fired: [], hintVotes: [], attacks: [], log: [], nextId: 1, lastProgress: Date.now(),
      clock: { start: Date.now(), pausedAt: null, pausedTotal: 0 }, limit, bonus: 0,
      over: false, result: null,
    };
    this.phase = 'play';
    this.scenario.intro.forEach((t) => this.post({ type: 'narr', text: t, global: true }));
    this.post({ type: 'sys', text: limit ? `녹화 시작! 제한 시간 ${Math.floor(limit / 60000)}분.` : '녹화 시작!', global: true });
    for (const c of cast) {
      this.post({ type: 'narr', text: `${josa(c.name, '이', '가')} ${this.room(pos[c.id]).name}에서 눈을 떴다.`, room: pos[c.id] });
    }
    this.fire('start');
    return null;
  }

  end(success, text) {
    const s = this.state;
    if (s.over) return;
    if (success) {
      const used = Math.round(this.elapsed() / 1000);
      this.post({ type: 'sys', text: `탈출 성공! 소요 시간 ${Math.floor(used / 60)}분 ${used % 60}초`, global: true, sfx: 'win' });
    } else {
      s.endText = text || this.scenario.failText || '시간 초과. 탈출에 실패했다…';
      this.post({ type: 'sys', text: s.endText, global: true, icon: 'skull', sfx: 'lose' });
    }
    this.setPaused(true);
    s.attacks = [];
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
    if (msg.t === 'kick') return this.kick(player, msg.id);
    if (msg.t === 'option') return this.setOption(player, msg);
    if (this.phase === 'lobby') {
      if (msg.t === 'start') {
        if (player.token !== this.hostToken) return '방장만 시작할 수 있어요.';
        return this.start();
      }
      if (msg.t === 'setChar' && !player.isGM) {
        const chars = cleanChars(msg.chars || msg.char);
        if (!chars.length) return '캐릭터 정보가 올바르지 않아요.';
        if (this.castCount() - player.chars.length + chars.length > MAX_CAST) return `방 전체 캐릭터는 최대 ${MAX_CAST}명이에요.`;
        player.chars = chars;
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
        this.setPaused(!this.paused);
        this.post({ type: 'sys', text: this.paused ? '진행자가 시간을 멈췄다.' : '진행자가 시간을 다시 흐르게 했다.', global: true });
      }
      if (msg.t === 'hint') this.hint(false);
      return null;
    }

    if (msg.t === 'hint') return this.voteHint(player);
    const c = this.charOf(player, msg.as);
    if (!c) return null;
    switch (msg.t) {
      case 'say': return this.say(c, msg.mode, msg.text);
      case 'move': return this.move(c, msg.to);
      case 'interact': return this.interact(player, c, msg.obj);
      case 'guess': return this.guess(player, c, msg.obj, msg.value);
      case 'force': return this.force(c, msg.obj);
      case 'give': return this.give(c, msg.item, msg.to);
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

  hint(byVote) {
    const h = this.scenario.hints.find((x) => !this.isDone(x.until));
    if (!h) return '더 줄 힌트가 없어요.';
    this.state.hintVotes = [];
    if (byVote) {
      const spent = this.spendTime(HINT_COST);
      this.post({ type: 'sys', text: `힌트: ${h.text}${spent ? ` (-${HINT_COST / 60}분)` : ''}`, global: true, icon: 'bulb', sfx: 'hint' });
    } else {
      this.post({ type: 'sys', text: `진행자의 힌트: ${h.text}`, global: true, icon: 'bulb', sfx: 'hint' });
    }
    return null;
  }

  // 방장만 바꿀 수 있다. 제한 시간은 시작 전에만, 자동 힌트는 언제든.
  setOption(player, msg) {
    if (player.token !== this.hostToken) return '방장만 바꿀 수 있어요.';
    if (typeof msg.timeLimit === 'boolean') {
      if (this.phase !== 'lobby') return '제한 시간은 녹화를 시작하기 전에만 바꿀 수 있어요.';
      this.options.timeLimit = msg.timeLimit;
    }
    if (typeof msg.autoHint === 'boolean' && msg.autoHint !== this.options.autoHint) {
      this.options.autoHint = msg.autoHint;
      if (this.state) this.state.lastProgress = Date.now();
      if (this.phase === 'play') {
        this.post({ type: 'sys', text: `방장이 자동 힌트를 ${msg.autoHint ? '켰다. 한동안 진전이 없으면 힌트가 나온다' : '껐다'}.`, global: true, icon: 'bulb' });
      }
    }
    return null;
  }

  // 힌트는 지금 플레이 중인 사람 과반수가 찬성해야 나온다 (한 사람이 캐릭터를 여럿 굴려도 한 표)
  hintNeed() { return Math.floor(Math.max(1, this.activePlayers().length) / 2) + 1; }
  voteHint(player) {
    const s = this.state;
    if (!this.scenario.hints.some((x) => !this.isDone(x.until))) return '더 줄 힌트가 없어요.';
    if (s.hintVotes.includes(player.id)) return '이미 찬성했어요. 다른 사람의 찬성을 기다리는 중이에요.';
    s.hintVotes.push(player.id);
    const need = this.hintNeed();
    if (s.hintVotes.length >= need) return this.hint(true);
    const name = this.myChars(player)[0]?.name || '누군가';
    this.post({ type: 'sys', text: `${josa(name, '이', '가')} 힌트를 원한다 (찬성 ${s.hintVotes.length}/${need}). 힌트 버튼을 누르면 찬성.`, global: true, icon: 'bulb' });
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
      return null;
    }
    const first = !this.knows(c.id, to);
    this.post({ type: 'act', text: `${josa(first ? '저편' : this.room(to).name, '으로', '로')} 나간다.`, charId: c.id });
    s.pos[c.id] = to;
    this.learn(c.id, to);
    this.post({ type: 'act', text: '들어왔다.', charId: c.id, sfx: 'step' });
    if (first) this.post({ type: 'narr', text: this.room(to).desc, room: to });
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
      return true;
    }
    if (obj.needAll) {
      const missing = this.activeCast().filter((m) => s.pos[m.id] !== here);
      if (missing.length) {
        this.post({ type: 'sys', text: `전원 탑승 확인 실패 — 아직 ${missing.length}명이 오지 않았다.`, room: here });
        return true;
      }
      const left = this.cast.filter((m) => !m.gone && !this.isActive(m.id) && s.pos[m.id] !== here);
      if (left.length) this.post({ type: 'sys', text: `접속이 끊긴 ${left.map((m) => m.name).join(', ')}은(는) 함께 가지 못한다.`, room: here });
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
    if (s.over) return null;

    if (obj.cctv) {
      const lines = this.cast.filter((m) => !m.gone).map((m) => `${m.name}: ${this.room(s.pos[m.id]).name}`).join(' / ');
      this.post({ type: 'sys', text: lines, room: here, icon: 'monitor' });
      for (const m of this.membersIn(here)) for (const other of this.cast) this.learn(m.id, s.pos[other.id]);
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
          by: c.name, as: c.id,
        },
      });
      return null;
    }
    if (obj.onSolve) return this.solve(c, obj);
    return null;
  }

  guess(player, c, objId, raw) {
    const s = this.state;
    const obj = this.findObj(c, objId);
    if (!obj?.lock) {
      this.send(player, { t: 'lockDone', obj: objId, text: '그 자물쇠는 이제 손이 닿지 않는 곳에 있다.' });
      return null;
    }
    if (this.objDone(obj) || s.over) {
      this.send(player, { t: 'lockDone', obj: objId, text: '이미 누군가 열었다.' });
      return null;
    }
    if ((obj.needItem && !s.inv[c.id].includes(obj.needItem)) || this.blocked(c, obj)) return null;
    const value = str(raw, 20);
    if (!value) return null;
    const here = s.pos[c.id];
    this.post({ type: 'act', text: `${obj.name}에 "${value}" 입력!`, charId: c.id });
    if (value.toUpperCase() === obj.lock.answer.toUpperCase()) return this.solve(c, obj);
    this.post({ type: 'narr', text: '삐빅— 틀렸다.', room: here, sfx: 'wrong' });
    if (c.skill === 'luck') {
      if (s.limit != null || s.attacks.length) this.post({ type: 'sys', text: `${c.name}의 행운 — 시간이 줄지 않았다.`, room: here, icon: 'clover' });
      return null;
    }
    // 타임어택 중에는 그 타임어택의 남은 시간이 줄어든다
    const mine = s.attacks.filter((a) => a.who.includes(c.id));
    if (mine.length) {
      for (const a of mine) a.ends -= ATTACK_WRONG_COST * 1000;
      this.post({ type: 'sys', text: `오답! 타임어택 -${ATTACK_WRONG_COST}초`, room: here, icon: 'hourglass' });
    }
    if (this.spendTime(WRONG_COST)) this.post({ type: 'sys', text: `오답! -${WRONG_COST / 60}분`, global: true, icon: 'hourglass' });
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
    s.hintVotes = [];
    // 같은 구역에서 이 자물쇠 창을 열어 둔 다른 사람의 창을 닫는다
    const me = this.ownerOf(c.id);
    const others = new Set(this.membersIn(here).map((m) => this.ownerOf(m.id)).filter((p) => p && p !== me));
    for (const p of others) this.send(p, { t: 'lockDone', obj: obj.id, text: `${josa(c.name, '이', '가')} 먼저 풀었다.` });
    if (obj.needItem && !obj.keepItem) s.inv[c.id] = s.inv[c.id].filter((i) => i !== obj.needItem);
    this.post({ type: 'narr', text: r.text, room: here, sfx: r.item ? 'item' : r.unlock ? 'unlock' : 'solve' });
    if (r.unlock && !s.unlocked.includes(r.unlock)) s.unlocked.push(r.unlock);
    if (r.item) {
      s.inv[c.id].push(r.item);
      const it = this.scenario.items[r.item];
      this.post({ type: 'sys', text: `${c.name} — ${josa(it.name, '을', '를')} 얻었다!`, room: here, icon: it.icon });
    }
    if (r.ending) return this.end(true);
    this.fire('solve', { char: c, room: here, obj: obj.id });
    if (r.item) this.fire('item', { char: c, room: here, item: r.item });
    return null;
  }

  give(c, item, toId) {
    const s = this.state;
    const to = this.cast.find((m) => m.id === toId && !m.gone);
    if (!to || to.id === c.id || !s.inv[c.id].includes(item)) return null;
    if (s.pos[to.id] !== s.pos[c.id]) return '같은 구역에 있어야 건넬 수 있어요.';
    s.inv[c.id] = s.inv[c.id].filter((i) => i !== item);
    s.inv[to.id].push(item);
    this.post({ type: 'act', text: `${to.name}에게 ${josa(this.scenario.items[item].name, '을', '를')} 건넨다.`, charId: c.id });
    return null;
  }
}
