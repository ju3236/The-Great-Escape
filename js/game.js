const CHAR_KEY = 'tge.characters';
const SAVE_KEY = 'tge.save.v2';
const HINT_COST = 180;
const WRONG_COST = 60;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}

// 받침 유무로 조사 고르기 (이/가, 을/를, 은/는)
function josa(word, withBatchim, without) {
  const code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  const has = code >= 0 && code <= 11171 && code % 28 !== 0;
  // '(으)로'는 ㄹ 받침 뒤에서도 '로'
  if (withBatchim === '으로' && code % 28 === 8) return word + without;
  return word + (has ? withBatchim : without);
}

/* ---------------- 화면 전환 ---------------- */
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'title') $('#btn-continue').hidden = !store(SAVE_KEY);
  if (name === 'chars') renderCharList();
  if (name === 'setup') renderSetup();
  if (name !== 'game') stopTimer();
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
});

/* ---------------- 캐릭터 관리 ---------------- */
let characters = store(CHAR_KEY) || [];
const saveChars = () => store(CHAR_KEY, characters);
const charById = (id) => characters.find((c) => c.id === id) || state?.cast.find((c) => c.id === id);

function avatar(c, size = '') {
  const px = { sm: 28, lg: 72 }[size] || 40;
  const inner = c.image
    ? `<img src="${esc(c.image)}" alt="">`
    : spriteSvg(c.sprite, c.color, px);
  return `<span class="avatar ${size}" style="--c:${esc(c.color)}">${inner}</span>`;
}

const form = $('#char-form');
form.personality.innerHTML = Object.entries(PERSONALITIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
form.skill.innerHTML = Object.entries(SKILLS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
const updateSkillDesc = () => { $('#skill-desc').textContent = SKILLS[form.skill.value].desc; };
function renderSpritePicker() {
  const current = form.sprite?.value || 'short';
  $('#sprite-options').innerHTML = Object.entries(SPRITES).map(([k, v]) => `
    <label class="sprite-opt" title="${v.label}">
      <input type="radio" name="sprite" value="${k}" ${k === current ? 'checked' : ''}>
      ${spriteSvg(k, form.color.value, 40)}<span>${v.label}</span>
    </label>`).join('');
}
form.color.addEventListener('input', renderSpritePicker);
renderSpritePicker();
form.skill.addEventListener('change', updateSkillDesc);
updateSkillDesc();

function resetForm() {
  form.reset();
  form.id.value = '';
  form.sprite.value = 'short';
  renderSpritePicker();
  $('#form-title').textContent = '새 캐릭터';
  updateSkillDesc();
}
$('#form-reset').addEventListener('click', resetForm);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.name = data.name.trim();
  if (!data.name) return;
  if (data.id) {
    Object.assign(characters.find((c) => c.id === data.id), data);
  } else {
    data.id = 'c' + Date.now().toString(36);
    characters.push(data);
  }
  saveChars();
  resetForm();
  renderCharList();
});

function renderCharList() {
  $('#char-count').textContent = `(${characters.length})`;
  $('#char-list').innerHTML = characters.map((c) => `
    <li>
      ${avatar(c)}
      <div class="info">
        <strong>${esc(c.name)}</strong>
        <small>${PERSONALITIES[c.personality]?.label} · ${SKILLS[c.skill]?.label}</small>
        <small class="muted">${esc(c.intro)}</small>
      </div>
      <button data-edit="${c.id}">수정</button>
      <button data-del="${c.id}" class="danger">삭제</button>
    </li>`).join('') || '<li class="muted">아직 캐릭터가 없습니다.</li>';
}
$('#char-list').addEventListener('click', (e) => {
  const edit = e.target.dataset.edit;
  const del = e.target.dataset.del;
  if (edit) {
    const c = characters.find((x) => x.id === edit);
    for (const k of ['id', 'name', 'color', 'image', 'personality', 'skill', 'intro']) form[k].value = c[k] || '';
    if (!c.color) form.color.value = '#8e3a2e';
    form.sprite.value = SPRITES[c.sprite] ? c.sprite : 'short';
    renderSpritePicker();
    $('#form-title').textContent = `${c.name} 수정`;
    updateSkillDesc();
  }
  if (del && confirm('이 캐릭터를 삭제할까요?')) {
    characters = characters.filter((c) => c.id !== del);
    saveChars();
    renderCharList();
  }
});

$('#btn-export-chars').addEventListener('click', () => download('characters.json', JSON.stringify(characters, null, 2)));
$('#import-chars').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const list = JSON.parse(await file.text());
    for (const c of list) {
      if (!c.name) continue;
      c.id = c.id && !characters.some((x) => x.id === c.id) ? c.id : 'c' + Math.random().toString(36).slice(2);
      characters.push(c);
    }
    saveChars();
    renderCharList();
  } catch {
    alert('불러올 수 없는 파일입니다.');
  }
  e.target.value = '';
});

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- 출연진 선택 ---------------- */
const picked = new Set();
const epSelect = $('#episode-select');
epSelect.innerHTML = SCENARIOS.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('');
epSelect.addEventListener('change', () => { $('#episode-desc').textContent = SCENARIOS[epSelect.value].summary; });

function renderSetup() {
  $('#episode-desc').textContent = SCENARIOS[epSelect.value].summary;
  for (const id of picked) if (!characters.some((c) => c.id === id)) picked.delete(id);
  $('#pick-empty').hidden = characters.length > 0;
  $('#pick-list').innerHTML = characters.map((c) => `
    <li data-pick="${c.id}" class="${picked.has(c.id) ? 'on' : ''}">
      ${avatar(c)}
      <div class="info"><strong>${esc(c.name)}</strong><small>${SKILLS[c.skill]?.label}</small></div>
    </li>`).join('');
  $('#btn-start').disabled = picked.size === 0;
}
$('#pick-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-pick]');
  if (!li) return;
  const id = li.dataset.pick;
  if (picked.has(id)) picked.delete(id);
  else if (picked.size < 6) picked.add(id);
  renderSetup();
});

/* ---------------- 게임 상태 ---------------- */
let state = null;
let scenario = null;
let channel = null; // null이면 행동 중인 멤버의 구역을 따라간다. 'all'은 제작진 시점.

$('#btn-new').addEventListener('click', () => show(characters.length ? 'setup' : 'chars'));
$('#btn-chars').addEventListener('click', () => show('chars'));
$('#btn-continue').addEventListener('click', () => {
  state = store(SAVE_KEY);
  scenario = SCENARIOS.find((s) => s.id === state?.scenarioId);
  if (!scenario) return show('title');
  enterGame();
});

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

$('#btn-start').addEventListener('click', () => {
  scenario = SCENARIOS[epSelect.value];
  const cast = shuffle(characters.filter((c) => picked.has(c.id)).map((c) => ({ ...c })));
  const starts = shuffle(scenario.starts);
  const pos = {};
  const inv = {};
  cast.forEach((c, i) => { pos[c.id] = starts[i % starts.length]; inv[c.id] = []; });
  state = {
    scenarioId: scenario.id,
    cast,
    actor: cast[0].id,
    pos,
    inv,
    solved: [],
    unlocked: [],
    known: [...new Set(Object.values(pos))],
    timeLeft: scenario.timeLimit,
    log: [],
    nextId: 1,
    over: false,
  };
  channel = null;
  playIntro();
});

function playIntro() {
  let i = 0;
  $('#intro-ep').textContent = scenario.title;
  const box = $('#intro-text');
  box.innerHTML = '';
  const lines = [
    ...scenario.intro.map(esc),
    ...state.cast.map((c) => `${avatar(c, 'sm')} <b>${esc(c.name)}</b> — ${esc(room(state.pos[c.id]).name)}에서 눈을 떴다.`),
  ];
  const next = () => {
    if (i < lines.length) {
      box.insertAdjacentHTML('beforeend', `<p>${lines[i++]}</p>`);
    } else {
      $('#btn-intro-next').onclick = null;
      startGame();
    }
  };
  $('#btn-intro-next').onclick = next;
  show('intro');
  next();
}

function startGame() {
  scenario.intro.forEach((t) => post({ type: 'narr', text: t, global: true }));
  post({ type: 'sys', text: `녹화 시작! 제한 시간 ${Math.floor(scenario.timeLimit / 60)}분.`, global: true });
  for (const c of state.cast) {
    post({ type: 'narr', text: `${josa(c.name, '이', '가')} ${room(state.pos[c.id]).name}에서 눈을 떴다.`, room: state.pos[c.id] });
    post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
  }
  enterGame();
}

function enterGame() {
  show('game');
  $('#ep-name').textContent = scenario.title;
  renderAll();
  startTimer();
}

const room = (id) => scenario.rooms[id];
const isDone = (id) => state.solved.includes(id) || state.unlocked.includes(id);
const actor = () => charById(state.actor);
const here = () => state.pos[state.actor];
const membersIn = (roomId) => state.cast.filter((c) => state.pos[c.id] === roomId);
const save = () => store(SAVE_KEY, state.over ? null : state);
const objDone = (o) => state.solved.includes(o.id) ||
  (o.onSolve?.unlock && !o.onSolve.item && state.unlocked.includes(o.onSolve.unlock));
const linkOpen = (l) => l.kind === 'open' || (l.kind === 'door' && (!l.locked || state.unlocked.includes(l.id)));
const linksOf = (roomId) => scenario.links.filter((l) => l.a === roomId || l.b === roomId);
const other = (l, roomId) => (l.a === roomId ? l.b : l.a);

/* ---------------- 소리 전달 ---------------- */
// 속삭임: 같은 구역만 / 대사: 옆 구역 웅얼 / 외침: 옆 구역 또렷, 두 칸 웅얼
const RANGE = {
  whisper: { clear: 0, muffled: 0 },
  say: { clear: 0, muffled: 1 },
  shout: { clear: 1, muffled: 2 },
};
const VOLUME_DESC = {
  whisper: '같은 구역에만 들립니다.',
  say: '같은 구역에 들리고, 문·벽 너머 옆 구역에는 웅얼거리며 들립니다.',
  shout: '옆 구역까지 또렷하게, 두 칸 떨어진 구역에는 웅얼거리며 들립니다.',
  act: '같은 구역의 멤버만 볼 수 있습니다.',
  narr: '지금 보고 있는 채널에 나레이션을 남깁니다.',
};

function hopsFrom(start) {
  const dist = { [start]: 0 };
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const l of linksOf(cur)) {
      const nb = other(l, cur);
      if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; queue.push(nb); }
    }
  }
  return dist;
}
function hearing(roomId, vol) {
  const range = RANGE[vol] || RANGE.whisper;
  const hear = {};
  for (const [r, d] of Object.entries(hopsFrom(roomId))) {
    if (d <= range.clear) hear[r] = 'clear';
    else if (d <= range.muffled) hear[r] = 'muffled';
  }
  return hear;
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

/* ---------------- 타이머 ---------------- */
let timerId = null;
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    state.timeLeft--;
    if (state.timeLeft % 10 === 0) save();
    renderTimer();
    if (state.timeLeft <= 0) endGame(false);
  }, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; }
function spendTime(sec) {
  state.timeLeft = Math.max(0, state.timeLeft - sec);
  renderTimer();
  if (state.timeLeft <= 0) endGame(false);
}
function renderTimer() {
  const t = Math.max(0, state.timeLeft);
  const el = $('#timer');
  el.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  el.classList.toggle('danger', t <= 300);
}

/* ---------------- 메시지 ---------------- */
const MUFFLED = { o: '#3d3f37', b: '#24251f', y: '#5f6157' };
// type: say(말) / act(행동) / narr(나레이션) / sys(시스템)
// 말은 vol(속삭임·대사·외침)에 따라 퍼지고, 나머지는 같은 구역에만 남는다.
function post({ type, text, charId, room: roomId, vol, global, icon }) {
  if (!text) return;
  const r = roomId || (charId && state.pos[charId]);
  const m = { id: state.nextId++, type, text, charId, room: r };
  if (icon) m.icon = icon;
  if (global) m.global = true;
  else m.hear = hearing(r, type === 'say' ? (vol || 'say') : 'whisper');
  if (type === 'say' && vol && vol !== 'say') m.vol = vol;
  state.log.push(m);
  if (visibleIn(m, currentChannel())) appendMsg(m);
  renderChannels();
  save();
}
const currentChannel = () => channel || here();
const visibleIn = (m, ch) => ch === 'all' || m.global || !!m.hear?.[ch];

function appendMsg(m) {
  const log = $('#log');
  const ch = currentChannel();
  const c = m.charId && charById(m.charId);
  const muffled = ch !== 'all' && !m.global && m.hear[ch] === 'muffled';
  const away = ch !== 'all' && !m.global && m.room !== ch;
  const where = room(m.room)?.name;
  const tag = ch === 'all' && !m.global ? `<span class="tag">${esc(where)}</span>` : '';
  let html;
  if (muffled) {
    const from = state.known.includes(m.room) ? `${where} 쪽` : '어딘가';
    html = `<div class="msg muffled"><span class="from">${pix('door', 14, MUFFLED)} ${esc(from)}에서 웅얼거리는 소리</span><p>${esc(garble(m.text, m.id))}</p></div>`;
  } else if (m.type === 'say' && c) {
    const vol = m.vol === 'shout' ? ' shout' : m.vol === 'whisper' ? ' whisper' : '';
    const from = away ? `<span class="from">${esc(where)}에서</span>` : '';
    html = `<div class="msg say${vol}">${avatar(c, 'sm')}<div>${tag}<b style="color:${esc(c.color)}">${esc(c.name)}</b>${from}<p>${esc(m.text)}</p></div></div>`;
  } else if (m.type === 'act' && c) {
    html = `<div class="msg act">${tag}<i>* ${esc(josa(c.name, '이', '가'))} ${esc(m.text)}</i></div>`;
  } else {
    html = `<div class="msg ${m.type}">${tag}${m.icon ? pix(m.icon, 16) : ''}${esc(m.text)}</div>`;
  }
  log.insertAdjacentHTML('beforeend', html);
  log.scrollTop = log.scrollHeight;
}

function renderLog() {
  $('#log').innerHTML = '';
  const ch = currentChannel();
  state.log.filter((m) => visibleIn(m, ch)).forEach(appendMsg);
}

function renderChannels() {
  const rooms = [...new Set(state.cast.map((c) => state.pos[c.id]))];
  const ch = currentChannel();
  $('#channels').innerHTML = rooms.map((r) => {
    const n = membersIn(r).length;
    return `<button data-ch="${r}" class="${ch === r ? 'on' : ''}">${r === here() ? pix('pin', 12) : ''}${esc(room(r).name)} <small>${n}</small></button>`;
  }).join('') + `<button data-ch="all" class="${ch === 'all' ? 'on' : ''}">${pix('monitor', 12)}제작진</button>`;
}
$('#channels').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ch]');
  if (!b) return;
  channel = b.dataset.ch === here() ? null : b.dataset.ch;
  renderChannels();
  renderLog();
  renderInput();
});

function logAsText() {
  const lines = [scenario.title, `출연: ${state.cast.map((c) => c.name).join(', ')}`, ''];
  for (const m of state.log) {
    const c = m.charId && charById(m.charId);
    const where = m.global ? '' : `[${room(m.room).name}] `;
    if (m.type === 'say' && c) lines.push(`${where}${c.name}${m.vol === 'shout' ? '(외침)' : m.vol === 'whisper' ? '(속삭임)' : ''}: "${m.text}"`);
    else if (m.type === 'act' && c) lines.push(`${where}* ${josa(c.name, '이', '가')} ${m.text}`);
    else if (m.type === 'sys') lines.push(`${where}<${m.text}>`);
    else lines.push(`${where}${m.text}`);
  }
  return lines.join('\n');
}

/* ---------------- 렌더 ---------------- */
function renderAll() {
  renderTimer();
  renderTeam();
  renderMap();
  renderRoom();
  renderChannels();
  renderLog();
  renderInput();
}

function renderTeam() {
  $('#team').innerHTML = state.cast.map((c) => {
    const items = state.inv[c.id].map((id) => {
      const it = scenario.items[id];
      return `<button class="item" data-give="${id}" data-owner="${c.id}" title="건네주기">${pix(it.icon, 14)}${esc(it.name)}</button>`;
    }).join('');
    return `
    <div class="member ${c.id === state.actor ? 'on' : ''}" data-actor="${c.id}" title="${esc(c.intro)}">
      ${avatar(c)}
      <div class="m-info">
        <b>${esc(c.name)}</b>
        <small>${pix('pin', 10)} ${esc(room(state.pos[c.id]).name)} · ${SKILLS[c.skill]?.label}</small>
        <div class="m-items">${items}</div>
      </div>
    </div>`;
  }).join('');
}

function visibleRooms() {
  const vis = {};
  for (const r of state.known) vis[r] = 'known';
  for (const r of state.known) {
    for (const l of linksOf(r)) {
      const nb = other(l, r);
      if (!vis[nb]) vis[nb] = 'unknown';
    }
  }
  return vis;
}

function linkPoint(l) {
  if (l.at) return l.at;
  const [ax, ay, aw, ah] = room(l.a).rect;
  const [bx, by, bw, bh] = room(l.b).rect;
  if (ax + aw === bx || bx + bw === ax) {
    const x = ax + aw === bx ? bx : ax;
    return [x, (Math.max(ay, by) + Math.min(ay + ah, by + bh)) / 2];
  }
  const y = ay + ah === by ? by : ay;
  return [(Math.max(ax, bx) + Math.min(ax + aw, bx + bw)) / 2, y];
}

function renderMap() {
  const { w, h } = scenario.map;
  const vis = visibleRooms();
  const pct = (v, total) => `${(v / total) * 100}%`;
  let html = '';
  for (const [id, r] of Object.entries(scenario.rooms)) {
    if (!vis[id]) continue;
    const [x, y, rw, rh] = r.rect;
    const style = `left:${pct(x, w)};top:${pct(y, h)};width:${pct(rw, w)};height:${pct(rh, h)}`;
    if (vis[id] === 'unknown') {
      html += `<div class="room unknown" style="${style}" data-room="${id}"><span>???</span></div>`;
      continue;
    }
    const tokens = membersIn(id).map((c) =>
      `<span class="token ${c.id === state.actor ? 'on' : ''}" data-actor="${c.id}" title="${esc(c.name)}">${avatar(c, 'sm')}</span>`).join('');
    html += `<div class="room ${id === here() ? 'here' : ''}" style="${style}" data-room="${id}">
      <span class="room-label">${esc(r.name)}</span><div class="tokens">${tokens}</div></div>`;
  }
  for (const l of scenario.links) {
    if (l.kind === 'wall' || !vis[l.a] || !vis[l.b]) continue;
    const [x, y] = linkPoint(l);
    const icon = l.kind === 'open' ? '' : pix(linkOpen(l) ? 'door' : 'padlock', 14);
    html += `<span class="link ${l.kind} ${linkOpen(l) ? 'open' : 'locked'}" style="left:${pct(x, w)};top:${pct(y, h)}">${icon}</span>`;
  }
  const map = $('#map');
  map.style.aspectRatio = `${w} / ${h}`;
  map.style.width = `min(100%, calc(52vh * ${w / h}))`;
  map.style.setProperty('--gw', w);
  map.style.setProperty('--gh', h);
  map.innerHTML = html;
}

function renderRoom() {
  const id = here();
  const r = room(id);
  $('#room-name').innerHTML = `${pix('pin', 18)} ${esc(r.name)}`;
  const others = membersIn(id).filter((c) => c.id !== state.actor).map((c) => c.name);
  $('#room-people').textContent = others.length ? `함께 있는 멤버: ${others.join(', ')}` : '이 구역엔 혼자다';
  $('#room-desc').textContent = r.desc;
  $('#objects').innerHTML = r.objects.map((o) => `
    <button class="obj ${objDone(o) ? 'solved' : ''}" data-obj="${o.id}">
      <span class="icon">${pix(o.icon, 40)}</span><span>${esc(o.name)}</span>
    </button>`).join('');
  $('#exits').innerHTML = linksOf(id).filter((l) => l.kind !== 'wall').map((l) => {
    const to = other(l, id);
    const name = state.known.includes(to) ? room(to).name : '???';
    return `<button class="exit ${linkOpen(l) ? '' : 'locked'}" data-room="${to}">${linkOpen(l) ? '▶' : pix('padlock', 12)} ${esc(name)}</button>`;
  }).join('');
}

function renderInput() {
  const c = actor();
  const mode = $('#rp-mode').value;
  const ch = currentChannel();
  const spot = mode === 'narr' ? (ch === 'all' ? '전체' : room(ch).name) : room(here()).name;
  $('#rp-who').innerHTML = mode === 'narr'
    ? `${pix('book', 16)} 나레이션 → <b>${esc(spot)}</b>`
    : `${avatar(c, 'sm')} <b style="color:${esc(c.color)}">${esc(c.name)}</b> <span class="muted">@ ${esc(spot)}</span>`;
  $('#rp-range').textContent = VOLUME_DESC[mode];
}
$('#rp-mode').addEventListener('change', renderInput);

function selectActor(id) {
  if (!state.cast.some((c) => c.id === id)) return;
  state.actor = id;
  channel = null;
  renderTeam();
  renderMap();
  renderRoom();
  renderChannels();
  renderLog();
  renderInput();
  save();
}
document.querySelector('#screen-game').addEventListener('click', (e) => {
  if (state?.over) return;
  const give = e.target.closest('[data-give]');
  if (give) return openGive(give.dataset.owner, give.dataset.give);
  const a = e.target.closest('[data-actor]');
  if (a) return selectActor(a.dataset.actor);
  const r = e.target.closest('[data-room]');
  if (r) return tryMove(r.dataset.room);
  const o = e.target.closest('[data-obj]');
  if (o) return interact(room(here()).objects.find((x) => x.id === o.dataset.obj));
});

/* ---------------- 이동 ---------------- */
function tryMove(to) {
  const from = here();
  if (to === from) return;
  const c = actor();
  const link = linksOf(from).find((l) => other(l, from) === to && l.kind !== 'wall');
  if (!link) {
    post({ type: 'sys', text: `${c.name}의 위치(${room(from).name})에서 바로 갈 수 없는 곳이다.`, room: from });
    return;
  }
  if (!linkOpen(link)) {
    post({ type: 'act', text: '문을 밀어 보지만 꿈쩍도 하지 않는다.', charId: c.id });
    post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
    return;
  }
  post({ type: 'act', text: `${josa(state.known.includes(to) ? room(to).name : '저편', '으로', '로')} 나간다.`, charId: c.id });
  state.pos[c.id] = to;
  const first = !state.known.includes(to);
  if (first) state.known.push(to);
  channel = null;
  post({ type: 'act', text: '들어왔다.', charId: c.id });
  if (first) {
    post({ type: 'narr', text: room(to).desc, room: to });
    post({ type: 'say', text: voiceLine(c.personality, 'move'), charId: c.id });
  }
  const met = membersIn(to).filter((m) => m.id !== c.id);
  if (met.length) post({ type: 'sys', text: `${josa(met.map((m) => m.name).join(', '), '과', '와')} 합류했다!`, room: to });
  renderAll();
}

/* ---------------- 상호작용 ---------------- */
const hasItem = (charId, item) => state.inv[charId].includes(item);

function interact(obj) {
  const c = actor();
  post({ type: 'act', text: `${josa(obj.name, '을', '를')} 살펴본다.`, charId: c.id });
  if (objDone(obj)) return post({ type: 'narr', text: obj.solvedDesc || '이미 해결했다.', room: here() });
  post({ type: 'narr', text: obj.desc, room: here() });
  if (obj.bonus && c.skill === 'observe') post({ type: 'sys', text: `관찰력 — ${obj.bonus}`, room: here(), icon: 'eye' });

  if (obj.cctv) {
    const lines = state.cast.map((m) => `${m.name}: ${room(state.pos[m.id]).name}`).join(' / ');
    post({ type: 'sys', text: lines, room: here(), icon: 'monitor' });
    state.cast.forEach((m) => { if (!state.known.includes(state.pos[m.id])) state.known.push(state.pos[m.id]); });
    renderMap();
    return post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
  }
  if (obj.needItem && !hasItem(c.id, obj.needItem)) {
    post({ type: 'narr', text: obj.lackText, room: here() });
    return post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
  }
  if (obj.needAll) {
    const missing = state.cast.filter((m) => state.pos[m.id] !== here());
    if (missing.length) {
      post({ type: 'sys', text: `전원 탑승 확인 실패 — 아직 ${josa(missing.map((m) => m.name).join(', '), '이', '가')} 오지 않았다.`, room: here() });
      return post({ type: 'say', text: voiceLine(c.personality, 'blocked'), charId: c.id });
    }
  }
  if (obj.needItem) {
    const it = scenario.items[obj.needItem];
    post({ type: 'sys', text: `${josa(it.name, '을', '를')} 사용했다.`, room: here(), icon: it.icon });
  }
  if (obj.lock) return openLock(obj);
  if (obj.onSolve) return solve(obj);
  post({ type: 'say', text: voiceLine(c.personality, 'inspect'), charId: c.id });
}

function solve(obj) {
  const c = actor();
  const r = obj.onSolve;
  state.solved.push(obj.id);
  if (obj.needItem) state.inv[c.id] = state.inv[c.id].filter((i) => i !== obj.needItem);
  post({ type: 'narr', text: r.text, room: here() });
  if (r.unlock && !state.unlocked.includes(r.unlock)) state.unlocked.push(r.unlock);
  if (r.item) {
    state.inv[c.id].push(r.item);
    const it = scenario.items[r.item];
    post({ type: 'sys', text: `${c.name} — ${josa(it.name, '을', '를')} 얻었다!`, room: here(), icon: it.icon });
    post({ type: 'say', text: voiceLine(c.personality, 'item'), charId: c.id });
  } else {
    post({ type: 'say', text: voiceLine(c.personality, 'success'), charId: c.id });
  }
  renderTeam();
  renderMap();
  renderRoom();
  if (r.ending) endGame(true);
}

/* ---------------- 아이템 건네기 ---------------- */
const giveDlg = $('#give-dialog');
function openGive(ownerId, item) {
  const owner = charById(ownerId);
  const it = scenario.items[item];
  const mates = membersIn(state.pos[ownerId]).filter((m) => m.id !== ownerId);
  $('#give-title').innerHTML = `${pix(it.icon, 20)} ${esc(josa(it.name, '을', '를'))} 누구에게 건넬까?`;
  $('#give-targets').innerHTML = mates.length
    ? mates.map((m) => `<button value="${m.id}" data-to="${m.id}">${avatar(m, 'sm')} ${esc(m.name)}</button>`).join('')
    : `<p class="muted">${esc(josa(owner.name, '과', '와'))} 같은 구역에 있는 멤버가 없다. 같은 구역에 있어야 건넬 수 있다.</p>`;
  $('#give-targets').onclick = (e) => {
    const b = e.target.closest('[data-to]');
    if (!b) return;
    const to = charById(b.dataset.to);
    state.inv[ownerId] = state.inv[ownerId].filter((i) => i !== item);
    state.inv[to.id].push(item);
    post({ type: 'act', text: `${to.name}에게 ${josa(it.name, '을', '를')} 건넨다.`, charId: ownerId });
    giveDlg.close();
    renderTeam();
  };
  giveDlg.showModal();
}

/* ---------------- 자물쇠 ---------------- */
const dlg = $('#lock-dialog');
let lockObj = null;
function openLock(obj) {
  lockObj = obj;
  const c = actor();
  $('#lock-title').innerHTML = `${pix(obj.icon, 24)} ${esc(obj.name)}`;
  $('#lock-prompt').textContent = obj.lock.prompt;
  const hint = $('#lock-hint');
  hint.hidden = c.skill !== 'brain' || !obj.lock.hint;
  hint.innerHTML = `${pix('brain', 16)} ${esc(c.name)}의 두뇌 — ${esc(obj.lock.hint)}`;
  $('#lock-force').hidden = c.skill !== 'strength' || !obj.lock.forceable;
  $('#lock-input').value = '';
  dlg.showModal();
}
$('#lock-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'ok') return;
  const obj = lockObj;
  const c = actor();
  const guess = $('#lock-input').value.trim();
  if (!guess) return;
  post({ type: 'act', text: `${obj.name}에 "${guess}" 입력!`, charId: c.id });
  if (guess.toUpperCase() === obj.lock.answer.toUpperCase()) {
    solve(obj);
  } else {
    post({ type: 'narr', text: '삐빅— 틀렸다.', room: here() });
    post({ type: 'say', text: voiceLine(c.personality, 'fail'), charId: c.id });
    if (c.skill === 'luck') post({ type: 'sys', text: `${c.name}의 행운 — 시간이 줄지 않았다.`, room: here(), icon: 'clover' });
    else { post({ type: 'sys', text: `오답! -${WRONG_COST / 60}분`, global: true, icon: 'hourglass' }); spendTime(WRONG_COST); }
  }
});
$('#lock-force').addEventListener('click', () => {
  const c = actor();
  dlg.close();
  post({ type: 'act', text: `${josa(lockObj.name, '을', '를')} 힘으로 비틀어 연다!`, charId: c.id });
  post({ type: 'sys', text: `${c.name}의 괴력 발동!`, room: here(), icon: 'fist' });
  solve(lockObj);
});

/* ---------------- 힌트 / 역극 입력 / 종료 ---------------- */
$('#btn-hint').addEventListener('click', () => {
  if (state.over) return;
  const h = scenario.hints.find((x) => !isDone(x.until));
  if (!h) return;
  post({ type: 'sys', text: `힌트: ${h.text} (-${HINT_COST / 60}분)`, global: true, icon: 'bulb' });
  spendTime(HINT_COST);
});

$('#rp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#rp-text').value.trim();
  if (!text || state.over) return;
  const mode = $('#rp-mode').value;
  if (mode === 'narr') {
    const ch = currentChannel();
    post(ch === 'all' ? { type: 'narr', text, global: true } : { type: 'narr', text, room: ch });
  } else if (mode === 'act') {
    post({ type: 'act', text, charId: state.actor });
  } else {
    post({ type: 'say', text, charId: state.actor, vol: mode });
  }
  $('#rp-text').value = '';
});

$('#btn-quit').addEventListener('click', () => {
  if (confirm('타이틀로 나갈까요? 진행 상황은 저장되어 "이어하기"로 돌아올 수 있어요.')) show('title');
});

function endGame(success) {
  if (state.over) return;
  stopTimer();
  if (success) {
    for (const c of state.cast) post({ type: 'say', text: voiceLine(c.personality, 'escape'), charId: c.id });
    const used = scenario.timeLimit - state.timeLeft;
    post({ type: 'sys', text: `탈출 성공! 소요 시간 ${Math.floor(used / 60)}분 ${used % 60}초`, global: true });
  } else {
    post({ type: 'sys', text: '시간 초과. 시설이 완전히 봉쇄되었다…', global: true });
  }
  state.over = true;
  save();
  $('#ending-title').innerHTML = success ? `${pix('door', 48)} 탈출 성공` : `${pix('skull', 48)} 탈출 실패…`;
  $('#ending-text').textContent = success
    ? `남은 시간 ${$('#timer').textContent} — ${scenario.title} 클리어`
    : '다음 화에서는 꼭 나갈 수 있을 거야.';
  $('#ending-team').innerHTML = state.cast.map((c) => `<div>${avatar(c, 'lg')}<span>${esc(c.name)}</span></div>`).join('');
  setTimeout(() => show('ending'), success ? 1200 : 600);
}
$('#btn-save-log').addEventListener('click', () => download(`${scenario.title}_역극로그.txt`, logAsText()));

$('#title-icon').innerHTML = pix('padlock', 72);
show('title');
