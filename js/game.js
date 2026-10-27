const CHAR_KEY = 'tge.characters';
const SAVE_KEY = 'tge.save';
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
  const inner = c.image
    ? `<img src="${esc(c.image)}" alt="" onerror="this.remove()">`
    : esc(c.emoji || c.name.slice(0, 1));
  return `<span class="avatar ${size}" style="--c:${esc(c.color)}">${inner}</span>`;
}

const form = $('#char-form');
form.personality.innerHTML = Object.entries(PERSONALITIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
form.skill.innerHTML = Object.entries(SKILLS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
const updateSkillDesc = () => { $('#skill-desc').textContent = SKILLS[form.skill.value].desc; };
form.skill.addEventListener('change', updateSkillDesc);
updateSkillDesc();

function resetForm() {
  form.reset();
  form.id.value = '';
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
    for (const k of ['id', 'name', 'emoji', 'color', 'image', 'personality', 'skill', 'intro']) form[k].value = c[k] || '';
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

$('#btn-new').addEventListener('click', () => show(characters.length ? 'setup' : 'chars'));
$('#btn-chars').addEventListener('click', () => show('chars'));
$('#btn-continue').addEventListener('click', () => {
  state = store(SAVE_KEY);
  scenario = SCENARIOS.find((s) => s.id === state?.scenarioId);
  if (!scenario) return show('title');
  enterGame();
});

$('#btn-start').addEventListener('click', () => {
  scenario = SCENARIOS[epSelect.value];
  const cast = characters.filter((c) => picked.has(c.id)).map((c) => ({ ...c }));
  state = {
    scenarioId: scenario.id,
    cast,
    actor: cast[0].id,
    room: scenario.start,
    solved: [],
    items: [],
    timeLeft: scenario.timeLimit,
    log: [],
    over: false,
  };
  playIntro();
});

function playIntro() {
  let i = 0;
  $('#intro-ep').textContent = scenario.title;
  const box = $('#intro-text');
  box.innerHTML = '';
  const next = () => {
    if (i < scenario.intro.length) {
      box.insertAdjacentHTML('beforeend', `<p>${esc(scenario.intro[i])}</p>`);
      i++;
    } else {
      $('#btn-intro-next').onclick = null;
      scenario.intro.forEach((t) => addLog('narr', t));
      startGame();
    }
  };
  $('#btn-intro-next').onclick = next;
  show('intro');
  next();
}

function startGame() {
  addLog('sys', `[${scenario.rooms[state.room].name}] 녹화 시작! 제한 시간 ${Math.floor(scenario.timeLimit / 60)}분.`);
  for (const c of state.cast) addLog('say', voiceLine(c.personality, 'inspect'), c.id);
  enterGame();
}

function enterGame() {
  show('game');
  $('#ep-name').textContent = scenario.title;
  renderAll();
  startTimer();
}

const isSolved = (id) => state.solved.includes(id);
const actor = () => charById(state.actor);
const save = () => store(SAVE_KEY, state.over ? null : state);

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

/* ---------------- 로그 ---------------- */
function addLog(type, text, charId) {
  if (!text) return;
  state.log.push({ type, text, charId });
  appendLogEntry(state.log[state.log.length - 1]);
  save();
}
function appendLogEntry(entry) {
  const log = $('#log');
  const c = entry.charId && charById(entry.charId);
  let html;
  if (entry.type === 'say' && c) {
    html = `<div class="msg say">${avatar(c, 'sm')}<div><b style="color:${esc(c.color)}">${esc(c.name)}</b><p>${esc(entry.text)}</p></div></div>`;
  } else if (entry.type === 'act' && c) {
    html = `<div class="msg act"><i>* ${esc(josa(c.name, '이', '가'))} ${esc(entry.text)}</i></div>`;
  } else {
    html = `<div class="msg ${entry.type}">${esc(entry.text)}</div>`;
  }
  log.insertAdjacentHTML('beforeend', html);
  log.scrollTop = log.scrollHeight;
}
function logAsText() {
  const lines = [`${scenario.title}`, `출연: ${state.cast.map((c) => c.name).join(', ')}`, ''];
  for (const e of state.log) {
    const c = e.charId && charById(e.charId);
    if (e.type === 'say' && c) lines.push(`${c.name}: "${e.text}"`);
    else if (e.type === 'act' && c) lines.push(`* ${josa(c.name, '이', '가')} ${e.text}`);
    else if (e.type === 'sys') lines.push(`[${e.text}]`);
    else lines.push(e.text);
  }
  return lines.join('\n');
}

/* ---------------- 렌더 ---------------- */
function renderAll() {
  const room = scenario.rooms[state.room];
  $('#room-name').textContent = room.name;
  $('#room-desc').textContent = room.desc;
  renderTimer();
  renderTeam();
  renderObjects();
  renderInventory();
  $('#log').innerHTML = '';
  state.log.forEach(appendLogEntry);
  $('#rp-speaker').innerHTML = '<option value="">나레이션</option>' +
    state.cast.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#rp-speaker').value = state.actor;
}
function renderTeam() {
  $('#team').innerHTML = '<h4>행동할 멤버</h4>' + state.cast.map((c) => `
    <button class="member ${c.id === state.actor ? 'on' : ''}" data-actor="${c.id}" title="${esc(c.intro)}">
      ${avatar(c)}
      <span><b>${esc(c.name)}</b><small>${SKILLS[c.skill]?.label}</small></span>
    </button>`).join('');
}
function renderObjects() {
  const room = scenario.rooms[state.room];
  $('#objects').innerHTML = room.objects
    .filter((o) => !o.showIf || isSolved(o.showIf))
    .map((o) => `
      <button class="obj ${isSolved(o.id) ? 'solved' : ''} ${o.goto && !o.onSolve ? 'exit' : ''}" data-obj="${o.id}">
        <span class="icon">${o.icon}</span><span>${esc(o.name)}</span>
      </button>`).join('');
}
function renderInventory() {
  $('#inventory').innerHTML = state.items.map((id) => {
    const it = scenario.items[id];
    return `<span class="item">${it.icon} ${esc(it.name)}</span>`;
  }).join('') || '<span class="muted">없음</span>';
}

$('#team').addEventListener('click', (e) => {
  const b = e.target.closest('[data-actor]');
  if (!b) return;
  state.actor = b.dataset.actor;
  $('#rp-speaker').value = state.actor;
  renderTeam();
  save();
});

/* ---------------- 상호작용 ---------------- */
$('#objects').addEventListener('click', (e) => {
  const b = e.target.closest('[data-obj]');
  if (!b || state.over) return;
  interact(scenario.rooms[state.room].objects.find((o) => o.id === b.dataset.obj));
});

function interact(obj) {
  const c = actor();
  const isPuzzle = obj.lock || obj.needItem || obj.needSolved || obj.onSolve;

  if (obj.goto && (!isPuzzle || isSolved(obj.id))) return moveTo(obj.goto);

  addLog('act', `${josa(obj.name, '을', '를')} 살펴본다.`, c.id);
  if (isSolved(obj.id)) return addLog('narr', obj.solvedDesc || obj.desc);
  addLog('narr', obj.desc);
  if (obj.bonus && c.skill === 'observe') addLog('sys', `🔍 관찰력 — ${obj.bonus}`);

  if ((obj.needItem && !state.items.includes(obj.needItem)) || (obj.needSolved && !isSolved(obj.needSolved))) {
    addLog('narr', obj.lackText);
    addLog('say', voiceLine(c.personality, 'blocked'), c.id);
    return;
  }
  if (obj.needItem) addLog('sys', `${scenario.items[obj.needItem].icon} ${josa(scenario.items[obj.needItem].name, '을', '를')} 사용했다.`);
  if (obj.lock) return openLock(obj);
  if (obj.onSolve) return solve(obj);
  addLog('say', voiceLine(c.personality, 'inspect'), c.id);
}

function solve(obj) {
  const c = actor();
  const r = obj.onSolve;
  state.solved.push(obj.id);
  if (obj.needItem) state.items = state.items.filter((i) => i !== obj.needItem);
  addLog('narr', r.text);
  if (r.item) {
    state.items.push(r.item);
    const it = scenario.items[r.item];
    addLog('sys', `${it.icon} ${josa(it.name, '을', '를')} 얻었다!`);
    addLog('say', voiceLine(c.personality, 'item'), c.id);
  } else {
    addLog('say', voiceLine(c.personality, 'success'), c.id);
  }
  renderObjects();
  renderInventory();
  if (r.ending) return endGame(true);
  if (r.goto) moveTo(r.goto);
}

function moveTo(roomId) {
  state.room = roomId;
  const room = scenario.rooms[roomId];
  addLog('sys', `— ${room.name} —`);
  addLog('say', voiceLine(actor().personality, 'move'), state.actor);
  $('#room-name').textContent = room.name;
  $('#room-desc').textContent = room.desc;
  renderObjects();
  save();
}

/* ---------------- 자물쇠 ---------------- */
const dlg = $('#lock-dialog');
let lockObj = null;
function openLock(obj) {
  lockObj = obj;
  const c = actor();
  $('#lock-title').textContent = `${obj.icon} ${obj.name}`;
  $('#lock-prompt').textContent = obj.lock.prompt;
  const hint = $('#lock-hint');
  hint.hidden = c.skill !== 'brain' || !obj.lock.hint;
  hint.textContent = `🧠 ${c.name}의 두뇌 — ${obj.lock.hint}`;
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
  addLog('act', `${obj.name}에 "${guess}" 입력!`, c.id);
  if (guess.toUpperCase() === obj.lock.answer.toUpperCase()) {
    solve(obj);
  } else {
    addLog('narr', '삐빅— 틀렸다.');
    addLog('say', voiceLine(c.personality, 'fail'), c.id);
    if (c.skill === 'luck') addLog('sys', `🍀 ${c.name}의 행운 — 시간이 줄지 않았다.`);
    else { addLog('sys', `⏱ 오답! -${WRONG_COST / 60}분`); spendTime(WRONG_COST); }
  }
});
$('#lock-force').addEventListener('click', () => {
  const c = actor();
  dlg.close();
  addLog('act', `${josa(lockObj.name, '을', '를')} 힘으로 비틀어 연다!`, c.id);
  addLog('sys', `💪 ${c.name}의 괴력 발동!`);
  solve(lockObj);
});

/* ---------------- 힌트 / 역극 입력 / 종료 ---------------- */
$('#btn-hint').addEventListener('click', () => {
  if (state.over) return;
  const h = scenario.hints.find((x) => !isSolved(x.until));
  if (!h) return;
  addLog('sys', `💡 힌트: ${h.text}`);
  addLog('sys', `⏱ -${HINT_COST / 60}분`);
  spendTime(HINT_COST);
});

$('#rp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#rp-text').value.trim();
  if (!text) return;
  const speaker = $('#rp-speaker').value;
  if (!speaker) addLog('narr', text);
  else addLog($('#rp-mode').value, text, speaker);
  $('#rp-text').value = '';
});

$('#btn-quit').addEventListener('click', () => {
  if (confirm('타이틀로 나갈까요? 진행 상황은 저장되어 "이어하기"로 돌아올 수 있어요.')) show('title');
});

function endGame(success) {
  if (state.over) return;
  stopTimer();
  if (success) {
    for (const c of state.cast) addLog('say', voiceLine(c.personality, 'escape'), c.id);
    const used = scenario.timeLimit - state.timeLeft;
    addLog('sys', `탈출 성공! 소요 시간 ${Math.floor(used / 60)}분 ${used % 60}초`);
  } else {
    addLog('sys', '시간 초과. 시설이 완전히 봉쇄되었다…');
  }
  state.over = true;
  save();
  $('#ending-title').textContent = success ? '탈출 성공!' : '탈출 실패…';
  $('#ending-text').textContent = success
    ? `남은 시간 ${$('#timer').textContent} — ${scenario.title} 클리어`
    : '다음 화에서는 꼭 나갈 수 있을 거야.';
  $('#ending-team').innerHTML = state.cast.map((c) => `<div>${avatar(c, 'lg')}<span>${esc(c.name)}</span></div>`).join('');
  setTimeout(() => show('ending'), success ? 1200 : 600);
}
$('#btn-save-log').addEventListener('click', () => download(`${scenario.title}_역극로그.txt`, logAsText()));

show('title');
