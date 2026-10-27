// 게임 핵심 로직 테스트. 실제 에피소드 대신 테스트 전용 시나리오를 써서 정답이 드러나지 않게 한다.
// 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, cleanChar } from '../src/room.js';

// a ─(잠긴 문)─ b ─(통로)─ c ~(얇은 벽)~ d
const FIXTURE = {
  id: 'fixture',
  title: '테스트',
  summary: '',
  timeLimit: 600,
  map: { w: 8, h: 2 },
  starts: ['a', 'c'],
  intro: ['인트로'],
  items: { key: { name: '열쇠', icon: 'key' } },
  hints: [
    { until: 'ab', text: '첫 번째 힌트' },
    { until: 'gate', text: '두 번째 힌트' },
  ],
  links: [
    { id: 'ab', a: 'a', b: 'b', kind: 'door', locked: true },
    { id: 'bc', a: 'b', b: 'c', kind: 'open' },
    { id: 'cd', a: 'c', b: 'd', kind: 'wall' },
  ],
  rooms: {
    a: {
      name: '방A', rect: [0, 0, 2, 2], desc: 'A',
      objects: [{
        id: 'lockA', name: '자물쇠', icon: 'padlock', desc: '',
        lock: { answer: 'SECRETANSWER', prompt: '', hint: '', forceable: true },
        onSolve: { text: '열렸다', unlock: 'ab' },
      }],
    },
    b: {
      name: '방B', rect: [2, 0, 2, 2], desc: 'B',
      objects: [{ id: 'box', name: '상자', icon: 'cabinet', desc: '', onSolve: { text: '열쇠', item: 'key' } }],
    },
    c: {
      name: '방C', rect: [4, 0, 2, 2], desc: 'C',
      objects: [
        { id: 'gate', name: '문', icon: 'door', desc: '', needItem: 'key', keepItem: true, lackText: '열쇠 필요', onSolve: { text: '문 열림' } },
        { id: 'exit', name: '출구', icon: 'exit', desc: '', needAll: true, onSolve: { text: '탈출', ending: 'escape' } },
      ],
    },
    d: { name: '방D', rect: [6, 0, 2, 2], desc: 'D', objects: [] },
  },
  events: [
    { id: 'enterB', on: 'enter', room: 'b', do: [{ narr: '{name}이 B에 처음 들어왔다' }] },
    { id: 'boxFx', on: 'inspect', obj: 'box', do: [{ effect: 'flicker' }] },
    { id: 'late', on: 'time', left: 300, do: [{ voice: '5분 남음', speaker: '방송', to: 'all' }, { lock: 'bc' }] },
    { id: 'later', on: 'time', left: 200, do: [{ release: 'bc' }] },
  ],
};

const CHAR = (name, extra = {}) => ({ name, color: '#336699', sprite: 'short', personality: 'calm', skill: 'none', ...extra });

// 가짜 소켓: 보낸 메시지를 모아 두고, online 값으로 접속 상태를 흉내 낸다
function setup(names, opts = {}) {
  const sockets = new Map();
  const io = { socketsOf: (token) => (sockets.get(token)?.online ? [sockets.get(token)] : []) };
  const room = new Room('TEST', FIXTURE, io);
  const players = names.map((n) => {
    const { player } = room.join(false, CHAR(n, opts[n]));
    sockets.set(player.token, { online: true, sent: [], send(d) { this.sent.push(JSON.parse(d)); } });
    return player;
  });
  const sock = (p) => sockets.get(p.token);
  return { room, players, sock, sockets };
}

// 시작 구역을 정해서 시작한다
function start(env, positions) {
  env.room.start();
  env.players.forEach((p, i) => { env.room.state.pos[p.id] = positions[i]; env.room.state.known[p.id] = [positions[i]]; });
  env.room.flush();
  env.players.forEach((p) => { env.sock(p).sent = []; });
}

const received = (env, p) => env.sock(p).sent.filter((m) => m.t === 'msgs').flatMap((m) => m.msgs);
const say = (env, p, mode, text) => env.room.handle(p, { t: 'say', mode, text });

test('대사는 옆 구역에 웅얼거리고, 두 칸 너머에는 닿지 않는다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['b', 'c', 'd']); // b-c 통로, c-d 벽 → b와 d는 두 칸
  const [p1, p2, p3] = env.players;
  say(env, p1, 'say', '안녕하세요여러분');
  const near = received(env, p2).find((m) => m.type === 'muffled');
  assert.ok(near, '옆 구역은 웅얼거림을 받는다');
  assert.notEqual(near.text, '안녕하세요여러분');
  assert.equal(near.charId, undefined, '웅얼거림에는 누가 말했는지 없다');
  assert.equal(received(env, p3).length, 0, '두 칸 너머에는 아무것도 안 간다');
});

test('외침은 옆 구역에 또렷하고, 두 칸 너머에 웅얼거린다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['b', 'c', 'd']);
  const [p1, p2, p3] = env.players;
  say(env, p1, 'shout', '거기누구없어요');
  assert.ok(received(env, p2).some((m) => m.type === 'say' && m.text === '거기누구없어요'));
  assert.ok(received(env, p3).some((m) => m.type === 'muffled'));
  assert.ok(!JSON.stringify(env.sock(p3).sent).includes('거기누구없어요'), '멀리 있는 사람에게 원문이 새지 않는다');
});

test('속삭임과 행동은 같은 구역에만 남는다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['b', 'b', 'c']);
  const [p1, p2, p3] = env.players;
  say(env, p1, 'whisper', '비밀');
  say(env, p1, 'act', '주위를 둘러본다');
  assert.equal(received(env, p2).length, 2);
  assert.equal(received(env, p3).length, 0);
});

test('퍼즐 정답은 어떤 플레이어에게도 보내지 않는다', () => {
  const env = setup(['가', '나']);
  start(env, ['a', 'c']);
  const [p1] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'lockA' });
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: '0000' });
  for (const p of env.players) assert.ok(!JSON.stringify(env.sock(p).sent).includes('SECRETANSWER'));
});

test('오답은 1분을 깎고, 행운 특기는 깎지 않으며, 정답은 문을 연다', () => {
  const env = setup(['가', '나'], { 나: { skill: 'luck' } });
  start(env, ['a', 'a']);
  const [p1, p2] = env.players;
  const t0 = env.room.timeLeft();
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  assert.ok(t0 - env.room.timeLeft() >= 59_000);
  const t1 = env.room.timeLeft();
  env.room.handle(p2, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  assert.ok(t1 - env.room.timeLeft() < 2_000);
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'secretanswer' });
  assert.ok(env.room.state.unlocked.includes('ab'));
});

test('괴력 특기는 힘으로 열 수 있는 자물쇠만 연다', () => {
  const env = setup(['가', '나'], { 가: { skill: 'strength' } });
  start(env, ['a', 'a']);
  const [p1, p2] = env.players;
  env.room.handle(p2, { t: 'force', obj: 'lockA' });
  assert.ok(!env.room.state.unlocked.includes('ab'), '괴력이 없으면 못 연다');
  env.room.handle(p1, { t: 'force', obj: 'lockA' });
  assert.ok(env.room.state.unlocked.includes('ab'));
});

test('keepItem 아이템은 써도 남고, 같은 구역 멤버에게 건넬 수 있다', () => {
  const env = setup(['가', '나']);
  start(env, ['b', 'b']);
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  assert.deepEqual(env.room.state.inv[p1.id], ['key']);
  env.room.handle(p1, { t: 'give', item: 'key', to: p2.id });
  assert.deepEqual(env.room.state.inv[p2.id], ['key']);
  env.room.handle(p2, { t: 'move', to: 'c' });
  env.room.handle(p2, { t: 'interact', obj: 'gate' });
  assert.deepEqual(env.room.state.inv[p2.id], ['key']);
});

test('전원 모이기는 접속이 끊긴 멤버를 기다리지 않는다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['c', 'c', 'a']);
  const [p1, , p3] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'exit' });
  assert.equal(env.room.phase, 'play', '접속 중인 멤버가 없으면 막힌다');
  env.sock(p3).online = false;
  env.room.handle(p1, { t: 'interact', obj: 'exit' });
  assert.equal(env.room.phase, 'ended');
  assert.equal(env.room.state.result, 'escape');
});

test('방장은 누구든, 다른 사람은 접속이 끊긴 사람만 내보낼 수 있다', () => {
  const env = setup(['방장', '나', '다']);
  start(env, ['a', 'b', 'c']);
  const [host, p2, p3] = env.players;
  env.room.handle(p2, { t: 'kick', id: p3.id });
  assert.ok(env.room.players.has(p3.token), '접속 중인 사람은 방장만 내보낸다');
  env.sock(p3).online = false;
  env.room.handle(p2, { t: 'kick', id: p3.id });
  assert.ok(!env.room.players.has(p3.token));
  assert.ok(env.room.cast.find((c) => c.id === p3.id).gone);
  env.room.handle(host, { t: 'kick', id: p2.id });
  assert.ok(env.sock(p2).sent.some((m) => m.t === 'kicked'));
  assert.ok(!env.room.players.has(p2.token));
});

test('게임 도중에도 들어올 수 있고, 시작 구역에서 깨어난다', () => {
  const env = setup(['가']);
  start(env, ['a']);
  const { player } = env.room.join(false, CHAR('늦은사람'));
  assert.ok(env.room.cast.some((c) => c.id === player.id));
  assert.ok(FIXTURE.starts.includes(env.room.state.pos[player.id]));
});

test('복귀 번호로 자기 자리를 찾고, 남의 화면에는 내 번호가 없다', () => {
  const env = setup(['가', '나']);
  start(env, ['a', 'c']);
  const [p1, p2] = env.players;
  assert.equal(env.room.findByPin(p1.pin.toLowerCase()), p1);
  assert.equal(env.room.findByPin('XXXXXX'), undefined);
  assert.ok(!JSON.stringify(env.room.view(p2)).includes(p1.pin));
  assert.equal(env.room.view(p1).me.pin, p1.pin);
});

test('힌트는 과반수가 찬성해야 나오고, 그때 시간이 깎인다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['a', 'b', 'c']);
  const [p1, p2] = env.players;
  const t0 = env.room.timeLeft();
  env.room.handle(p1, { t: 'hint' });
  assert.equal(env.room.view(p1).hint.votes, 1);
  assert.ok(t0 - env.room.timeLeft() < 2_000, '한 명만 찬성하면 아직 안 나온다');
  env.room.handle(p2, { t: 'hint' });
  assert.ok(t0 - env.room.timeLeft() >= 179_000);
  assert.equal(env.room.view(p1).hint.votes, 0);
});

test('이벤트: 처음 들어갈 때 한 번, 화면 효과는 그 구역 사람에게만', () => {
  const env = setup(['가', '나']);
  start(env, ['a', 'c']);
  env.room.state.unlocked.push('ab');
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'move', to: 'b' });
  env.room.handle(p1, { t: 'move', to: 'a' });
  env.room.handle(p1, { t: 'move', to: 'b' });
  const narr = env.room.state.log.filter((m) => m.text === '가이 B에 처음 들어왔다');
  assert.equal(narr.length, 1);
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  assert.ok(env.sock(p1).sent.some((m) => m.t === 'effect' && m.name === 'flicker'));
  assert.ok(!env.sock(p2).sent.some((m) => m.t === 'effect'));
});

test('이벤트: 남은 시간 조건으로 문을 잠갔다가 원래대로 돌린다', () => {
  const env = setup(['가']);
  start(env, ['b']);
  const s = env.room.state;
  const bc = FIXTURE.links.find((l) => l.id === 'bc');
  s.endsAt = Date.now() + 299_000;
  env.room.tick();
  assert.ok(!env.room.linkOpen(bc), '5분 남으면 잠긴다');
  assert.ok(s.log.some((m) => m.type === 'npc' && m.text === '5분 남음'));
  s.endsAt = Date.now() + 199_000;
  env.room.tick();
  assert.ok(env.room.linkOpen(bc), '나중에 다시 열린다');
  assert.ok(env.room.nextWake() <= s.endsAt);
});

test('시간이 다 되면 실패로 끝난다', () => {
  const env = setup(['가']);
  start(env, ['a']);
  env.room.state.endsAt = Date.now() - 1;
  env.room.tick();
  assert.equal(env.room.phase, 'ended');
  assert.equal(env.room.state.result, 'fail');
});

test('저장했다 불러와도 진행 상황이 그대로다', () => {
  const env = setup(['가', '나']);
  start(env, ['a', 'c']);
  const [p1] = env.players;
  say(env, p1, 'say', '기록');
  env.room.state.unlocked.push('ab');
  const restored = Room.restore(env.room.snapshot(), env.room.state.log, { socketsOf: () => [] }, FIXTURE);
  assert.deepEqual(restored.state.unlocked, ['ab']);
  assert.equal(restored.state.pos[p1.id], 'a');
  assert.ok(restored.state.log.some((m) => m.text === '기록'));
  assert.equal(restored.players.size, 2);
});

test('캐릭터 그림은 올바른 그림 id만 남긴다', () => {
  assert.deepEqual(cleanChar(CHAR('가', { img: { id: '0123456789abcdef', a: 1, b: 0 } })).img, { id: '0123456789abcdef', a: true, b: false });
  assert.equal(cleanChar(CHAR('가', { img: { id: '../etc' } })).img, undefined);
  assert.equal(cleanChar(CHAR('가', { avatar: 'data:image/png;base64,AAAA' })).avatar, undefined, '그림 원본은 방 정보에 남지 않는다');
});

test('게임 화면의 출연진 정보에도 그림 id가 들어간다', () => {
  const env = setup(['가']);
  env.players[0].char.img = { id: '0123456789abcdef', a: true, b: true };
  start(env, ['a']);
  assert.deepEqual(env.room.view(env.players[0]).cast[0].img, { id: '0123456789abcdef', a: true, b: true });
});

test('자물쇠 창을 열어 둔 사이 다른 사람이 풀면 창을 닫으라고 알린다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['a', 'a', 'c']);
  const [p1, p2, p3] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'lockA' });
  assert.ok(env.sock(p1).sent.some((m) => m.t === 'lock'));
  env.room.handle(p2, { t: 'guess', obj: 'lockA', value: 'SECRETANSWER' });
  assert.ok(env.sock(p1).sent.some((m) => m.t === 'lockDone' && m.obj === 'lockA'), '같은 구역 사람에게 알린다');
  assert.ok(!env.sock(p3).sent.some((m) => m.t === 'lockDone'), '다른 구역에는 알리지 않는다');
  env.sock(p1).sent = [];
  const t0 = env.room.timeLeft();
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  assert.ok(env.sock(p1).sent.some((m) => m.t === 'lockDone'), '늦게 낸 답에도 이미 열렸다고 알린다');
  assert.ok(t0 - env.room.timeLeft() < 2_000, '이미 열린 자물쇠에 낸 답으로 시간이 줄지 않는다');
});

test('캐릭터 이름으로 나가는 말은 플레이어가 직접 쓴 것뿐이다', () => {
  const env = setup(['가', '나']);
  start(env, ['a', 'b']);
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'lockA' });
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'SECRETANSWER' });
  env.room.handle(p2, { t: 'interact', obj: 'box' });
  env.room.handle(p2, { t: 'move', to: 'c' });
  env.room.handle(p2, { t: 'interact', obj: 'gate' });
  say(env, p1, 'say', '내가 쓴 말');
  const says = env.room.state.log.filter((m) => m.type === 'say');
  assert.deepEqual(says.map((m) => m.text), ['내가 쓴 말']);
});

test('자동 힌트는 기본으로 꺼져 있고, 방장만 켜고 끌 수 있다', () => {
  const idle = { ...FIXTURE, events: [{ id: 'idle', on: 'idle', seconds: 60, repeat: true, do: [{ voice: '도와줄까', speaker: '스피커', to: 'all' }, { hint: '자동 힌트' }] }] };
  const sockets = new Map();
  const io = { socketsOf: (t) => (sockets.get(t) ? [sockets.get(t)] : []) };
  const room = new Room('TEST', idle, io);
  const host = room.join(false, CHAR('방장')).player;
  const guest = room.join(false, CHAR('손님')).player;
  for (const p of [host, guest]) sockets.set(p.token, { send() {} });
  room.start();
  const hints = () => room.state.log.filter((m) => m.text.startsWith('자동 힌트')).length;
  room.state.lastProgress = Date.now() - 120_000;
  room.tick();
  assert.equal(hints(), 0, '기본은 꺼짐');
  assert.equal(room.view(guest).options.autoHint, false);
  room.handle(guest, { t: 'option', autoHint: true });
  assert.equal(room.options.autoHint, false, '방장이 아니면 못 바꾼다');
  room.handle(host, { t: 'option', autoHint: true });
  room.state.lastProgress = Date.now() - 120_000;
  room.tick();
  assert.equal(hints(), 1, '켜면 나온다');
  room.handle(host, { t: 'option', autoHint: false });
  room.state.lastProgress = Date.now() - 120_000;
  room.tick();
  assert.equal(hints(), 1, '다시 끄면 안 나온다');
});
