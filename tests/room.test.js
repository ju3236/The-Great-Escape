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
    { id: 'mood', on: 'time', elapsed: 30, do: [{ narr: '어디선가 물방울 소리', to: 'all' }, { effect: 'flicker', to: 'all' }] },
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
function start(env, positions, options = {}) {
  Object.assign(env.room.options, options);
  env.room.start();
  env.players.forEach((p, i) => { env.room.state.pos[p.id] = positions[i]; env.room.state.known[p.id] = [positions[i]]; });
  env.room.flush();
  env.players.forEach((p) => { env.sock(p).sent = []; });
}

// 시계를 ms만큼 앞으로 돌린다
const advance = (env, ms) => { env.room.state.clock.start -= ms; };
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

test('제한 시간을 켜면 오답이 1분을 깎고, 행운 특기는 깎지 않으며, 정답은 문을 연다', () => {
  const env = setup(['가', '나'], { 나: { skill: 'luck' } });
  start(env, ['a', 'a'], { timeLimit: true });
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

test('힌트는 과반수가 찬성해야 나오고, 제한 시간이 있으면 시간이 깎인다', () => {
  const env = setup(['가', '나', '다']);
  start(env, ['a', 'b', 'c'], { timeLimit: true });
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
  start(env, ['b'], { timeLimit: true });
  const s = env.room.state;
  const bc = FIXTURE.links.find((l) => l.id === 'bc');
  advance(env, 301_000); // 600초 중 299초 남음
  env.room.tick();
  assert.ok(!env.room.linkOpen(bc), '5분 남으면 잠긴다');
  assert.ok(s.log.some((m) => m.type === 'npc' && m.text === '5분 남음'));
  advance(env, 100_000);
  env.room.tick();
  assert.ok(env.room.linkOpen(bc), '나중에 다시 열린다');
  assert.ok(env.room.nextWake() <= Date.now() + env.room.timeLeft());
});

test('시간이 다 되면 실패로 끝난다', () => {
  const env = setup(['가']);
  start(env, ['a'], { timeLimit: true });
  advance(env, 601_000);
  env.room.tick();
  assert.equal(env.room.phase, 'ended');
  assert.equal(env.room.state.result, 'fail');
});

test('제한 시간은 기본으로 없고, 오답과 힌트에도 시간이 줄지 않는다', () => {
  const env = setup(['가']);
  start(env, ['a']);
  const [p1] = env.players;
  assert.equal(env.room.timeLeft(), null);
  env.room.handle(p1, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  env.room.handle(p1, { t: 'hint' });
  assert.ok(env.room.state.log.some((m) => m.text === '힌트: 첫 번째 힌트'));
  advance(env, 10 * 3600_000);
  env.room.tick();
  assert.equal(env.room.phase, 'play', '아무리 오래 걸려도 끝나지 않는다');
  assert.equal(env.room.view(p1).time.limited, false);
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
  env.players[0].chars[0].img = { id: '0123456789abcdef', a: true, b: true };
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

test('한 사람이 캐릭터 여러 명을 데려와 번갈아 행동할 수 있다', () => {
  const sockets = new Map();
  const io = { socketsOf: (t) => (sockets.get(t) ? [sockets.get(t)] : []) };
  const room = new Room('TEST', FIXTURE, io);
  const { player: me } = room.join(false, [CHAR('첫째'), CHAR('둘째')]);
  const { player: friend } = room.join(false, CHAR('친구'));
  for (const p of [me, friend]) sockets.set(p.token, { sent: [], send(d) { this.sent.push(JSON.parse(d)); } });
  assert.equal(room.join(false, [CHAR('1'), CHAR('2'), CHAR('3'), CHAR('4')]).error?.includes('최대'), true, '방 전체 6명을 넘을 수 없다');
  room.start();
  const [first, second] = room.charIdsOf(me);
  Object.assign(room.state.pos, { [first]: 'a', [second]: 'd', [friend.id]: 'c' });
  room.handle(me, { t: 'say', as: second, mode: 'whisper', text: '둘째가 속삭임' });
  const said = room.state.log.find((m) => m.text === '둘째가 속삭임');
  assert.equal(said.charId, second, '고른 캐릭터로 말한다');
  const v = room.view(me);
  assert.deepEqual(v.me.chars, [first, second]);
  assert.deepEqual(Object.keys(v.rooms).sort(), ['a', 'd'], '내 캐릭터들이 있는 구역을 모두 본다');
  assert.ok(sockets.get(me.token).sent.some((m) => m.t === 'msgs' && m.msgs.some((x) => x.text === '둘째가 속삭임')));
  room.handle(me, { t: 'hint' });
  assert.equal(room.view(me).hint.need, 2, '힌트 투표는 사람 수 기준');
  room.handle(me, { t: 'say', as: friend.id, mode: 'say', text: '남의 캐릭터로' });
  assert.notEqual(room.state.log.find((m) => m.text === '남의 캐릭터로').charId, friend.id, '남의 캐릭터로는 행동할 수 없다');
});

const ATTACK = {
  ...FIXTURE,
  events: [
    {
      id: 'chase', on: 'enter', room: 'b',
      do: [{ attack: { id: 'run', seconds: 30, label: '도망쳐', until: { allIn: 'c' }, success: [{ narr: '살았다' }], fail: [{ gameover: '잡혔다' }] }, to: 'all' }],
    },
    {
      id: 'bomb', on: 'inspect', obj: 'box',
      do: [{ attack: { id: 'bomb', seconds: 20, label: '폭탄', until: { done: 'lockA' }, fail: [{ narr: '쾅' }, { moveTo: 'd' }] } }],
    },
  ],
};
function attackSetup(names, { openAB = true } = {}) {
  const sockets = new Map();
  const io = { socketsOf: (t) => (sockets.get(t) ? [sockets.get(t)] : []) };
  const room = new Room('TEST', ATTACK, io);
  const players = names.map((n) => room.join(false, CHAR(n)).player);
  for (const p of players) sockets.set(p.token, { send() {} });
  room.start();
  if (openAB) room.state.unlocked.push('ab');
  return { room, players };
}

test('타임어택: 시간 안에 조건을 채우면 성공 연출', () => {
  const { room, players: [p1, p2] } = attackSetup(['가', '나']);
  Object.assign(room.state.pos, { [p1.id]: 'a', [p2.id]: 'c' });
  room.handle(p1, { t: 'move', to: 'b' });
  assert.equal(room.view(p1).attacks[0].label, '도망쳐');
  assert.equal(room.view(p2).attacks.length, 1, '전체 대상이면 모두에게 보인다');
  room.handle(p1, { t: 'move', to: 'c' });
  assert.equal(room.state.attacks.length, 0);
  assert.ok(room.state.log.some((m) => m.text === '살았다'));
  assert.equal(room.phase, 'play');
});

test('타임어택: 시간이 지나면 실패 연출 (게임 오버)', () => {
  const { room, players: [p1] } = attackSetup(['가']);
  room.state.pos[p1.id] = 'a';
  room.handle(p1, { t: 'move', to: 'b' });
  assert.ok(room.nextWake() <= Date.now() + 30_000);
  room.state.clock.start -= 31_000;
  room.tick();
  assert.equal(room.phase, 'ended');
  assert.equal(room.view(p1).endText, '잡혔다');
});

test('타임어택: 그 구역 사람만 대상이고, 오답은 남은 시간을 깎고, 실패하면 끌려간다', () => {
  const { room, players: [p1, p2] } = attackSetup(['가', '나'], { openAB: false });
  Object.assign(room.state.pos, { [p1.id]: 'b', [p2.id]: 'c' });
  room.handle(p1, { t: 'interact', obj: 'box' });
  assert.equal(room.view(p1).attacks.length, 1);
  assert.equal(room.view(p2).attacks.length, 0, '다른 구역 사람은 모른다');
  const before = room.state.attacks[0].ends;
  room.state.pos[p1.id] = 'a';
  room.handle(p1, { t: 'guess', obj: 'lockA', value: 'WRONG' });
  assert.equal(before - room.state.attacks[0].ends, 10_000);
  room.state.clock.start -= 11_000;
  room.tick();
  assert.equal(room.state.pos[p1.id], 'd', '실패하면 대상만 끌려간다');
  assert.equal(room.state.pos[p2.id], 'c');
  assert.equal(room.phase, 'play');
});

test('진행자가 시간을 멈추면 타임어택도 멈춘다', () => {
  const sockets = new Map();
  const io = { socketsOf: (t) => (sockets.get(t) ? [sockets.get(t)] : []) };
  const room = new Room('TEST', ATTACK, io);
  const p1 = room.join(false, CHAR('가')).player;
  const gm = room.join(true).player;
  for (const p of [p1, gm]) sockets.set(p.token, { send() {} });
  room.start();
  room.state.unlocked.push('ab');
  room.state.pos[p1.id] = 'a';
  room.handle(p1, { t: 'move', to: 'b' });
  room.handle(gm, { t: 'pause' });
  const left = room.view(p1).attacks[0].left;
  // 멈춘 채로 1분이 지났다 (시계 전체를 1분 앞당긴 것과 같다)
  room.state.clock.start -= 60_000;
  room.state.clock.pausedAt -= 60_000;
  room.tick();
  assert.equal(room.phase, 'play');
  assert.equal(room.view(p1).attacks[0].left, left);
  room.handle(gm, { t: 'pause' });
  assert.ok(Math.abs(room.view(p1).attacks[0].left - left) < 1_000, '다시 흐르면 멈춘 자리부터 센다');
});

test('단서 물건은 처음 만진 캐릭터만 살펴볼 수 있고, 자물쇠는 여럿이 만질 수 있다', () => {
  const env = setup(['가', '나']);
  start(env, ['b', 'b']);
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  env.sock(p2).sent = [];
  env.room.handle(p2, { t: 'interact', obj: 'box' });
  assert.ok(env.sock(p2).sent.some((m) => m.t === 'error' && m.text.includes('가가 먼저 살펴본')), '두 번째 사람은 안내만 받는다');
  assert.equal(env.room.view(p2).rooms.b.objects.find((o) => o.id === 'box').by, p1.id);
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  assert.ok(!env.sock(p1).sent.some((m) => m.t === 'error'), '처음 만진 사람은 다시 볼 수 있다');
  Object.assign(env.room.state.pos, { [p1.id]: 'a', [p2.id]: 'a' });
  env.room.handle(p1, { t: 'interact', obj: 'lockA' });
  env.room.handle(p2, { t: 'interact', obj: 'lockA' });
  assert.ok(env.sock(p2).sent.some((m) => m.t === 'lock'), '자물쇠는 두 번째 사람도 열어 볼 수 있다');
});

test('조사 결과는 조사한 캐릭터에게만, 같은 방 사람에게는 행동만 보인다', () => {
  const env = setup(['가', '나']);
  start(env, ['b', 'b']);
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  const seen = (p) => received(env, p).map((m) => m.text);
  assert.ok(seen(p1).includes('열쇠'), '조사한 사람은 결과를 본다');
  assert.ok(!seen(p2).includes('열쇠'), '같은 방 사람에게 결과는 안 간다');
  assert.ok(seen(p2).includes('상자를 살펴본다.'), '같은 방 사람은 행동은 본다');
  env.room.handle(p1, { t: 'move', to: 'c' });
  assert.ok(!seen(p2).includes('C'), '처음 들어간 방 설명도 들어간 사람만 본다');
});

test('분위기 연출은 기본으로 꺼져 있고, 켜면 시간이 지나 저절로 나온다', () => {
  const off = setup(['가']);
  start(off, ['a']);
  advance(off, 31_000);
  off.room.tick();
  assert.ok(!off.room.state.log.some((m) => m.text === '어디선가 물방울 소리'));
  assert.ok(!off.sock(off.players[0]).sent.some((m) => m.t === 'effect'));
  const on = setup(['가']);
  start(on, ['a'], { ambient: true });
  advance(on, 31_000);
  on.room.tick();
  assert.ok(on.room.state.log.some((m) => m.text === '어디선가 물방울 소리'));
});

test('모든 사람의 로그는 게임이 끝난 뒤에만 받을 수 있다', () => {
  const env = setup(['가', '나']);
  start(env, ['b', 'd']);
  const [p1, p2] = env.players;
  env.room.handle(p1, { t: 'interact', obj: 'box' });
  env.room.handle(p2, { t: 'fullLog' });
  assert.ok(!env.sock(p2).sent.some((m) => m.t === 'fullLog'), '진행 중에는 안 준다');
  env.room.end(true);
  env.room.handle(p2, { t: 'fullLog' });
  const full = env.sock(p2).sent.find((m) => m.t === 'fullLog');
  assert.ok(full, '끝난 뒤에는 준다');
  const box = full.msgs.find((m) => m.text === '열쇠');
  assert.ok(box && box.only === p1.id, '다른 사람이 혼자 본 문구도 누가 봤는지와 함께 들어간다');
  assert.ok(full.msgs.every((m) => !String(m.text).includes('SECRETANSWER')));
});
