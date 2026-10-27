const CHAR_KEY = 'tge.characters';
const SESSION_KEY = 'tge.session';
const LAST_CHAR_KEY = 'tge.lastChar';

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
let screen = 'title';
function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'title') $('#btn-continue').hidden = !store(SESSION_KEY);
  if (name === 'chars') renderCharList();
  if (name === 'online') renderOnline();
  if (name === 'game') startClock(); else stopClock();
  Sound.bgm(name === 'game' || name === 'intro');
}

/* ---------------- 설정: 화면 효과 / 소리 ---------------- */
let fxOn = true;
try { fxOn = localStorage.getItem('tge.fx') !== 'off'; } catch { /* 저장 불가 */ }
function applySettings() {
  document.documentElement.classList.toggle('no-fx', !fxOn);
  const fx = document.querySelector('#btn-fx');
  const snd = document.querySelector('#btn-sound');
  if (fx) { fx.textContent = fxOn ? '효과 켬' : '효과 끔'; fx.classList.toggle('off', !fxOn); }
  if (snd) { snd.textContent = Sound.enabled ? '소리 켬' : '소리 끔'; snd.classList.toggle('off', !Sound.enabled); }
}
document.querySelector('#btn-fx').addEventListener('click', () => {
  fxOn = !fxOn;
  try { localStorage.setItem('tge.fx', fxOn ? 'on' : 'off'); } catch { /* 저장 불가 */ }
  applySettings();
});
document.querySelector('#btn-sound').addEventListener('click', () => { Sound.toggle(); applySettings(); });
applySettings();
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
});

function toast(text) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove('on'), 3200);
}

/* ---------------- 캐릭터 관리 ---------------- */
let characters = store(CHAR_KEY) || [];
function saveChars() {
  try {
    localStorage.setItem(CHAR_KEY, JSON.stringify(characters));
  } catch {
    alert('기기 저장 공간이 부족해서 저장하지 못했어요. 쓰지 않는 캐릭터나 그림을 지워 주세요.');
  }
}

// 캐릭터 그림 주소: 내 기기에 있는 그림, 또는 방 서버에 올라간 그림 (a: 프사, b: 전신)
function imgUrl(c, kind) {
  const local = kind === 'a' ? c.avatar : c.body;
  if (local) return local;
  if (c.img?.[kind] && view?.code) return `/img/${view.code}/${c.img.id}/${kind}`;
  return null;
}

function avatar(c, size = '') {
  const px = { sm: 28, lg: 72 }[size] || 40;
  const src = imgUrl(c, 'a') || c.image;
  const inner = src ? `<img src="${esc(src)}" alt="">` : spriteSvg(c.sprite, c.color, px);
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
form.color.addEventListener('input', () => { renderSpritePicker(); renderImagePreview(); });
renderSpritePicker();
form.skill.addEventListener('change', updateSkillDesc);
updateSkillDesc();

function resetForm() {
  form.reset();
  form.id.value = '';
  form.sprite.value = 'short';
  formImages = { avatar: null, body: null };
  renderImagePreview();
  renderSpritePicker();
  $('#form-title').textContent = '새 캐릭터';
  updateSkillDesc();
}
$('#form-reset').addEventListener('click', resetForm);

/* 캐릭터 그림: 올리기 → 전신(배경 지우기) + 프사 자르기 */
let formImages = { avatar: null, body: null };
function renderImagePreview() {
  const preview = { name: form.name.value || '?', color: form.color.value, sprite: form.sprite?.value, avatar: formImages.avatar };
  $('#avatar-preview').innerHTML = avatar(preview, 'lg');
  $('#body-preview').innerHTML = formImages.body
    ? `<img src="${esc(formImages.body)}" alt="전신 그림">`
    : '<span class="muted small">전신 그림 없음</span>';
  $('#btn-recrop').hidden = !formImages.body;
  $('#btn-img-clear').hidden = !formImages.body && !formImages.avatar;
}

const imgDlg = $('#img-dialog');
let editor = null; // { body, crop }
async function openImageEditor(src, clearWhite) {
  $('#clear-white').checked = clearWhite;
  imgDlg.showModal();
  const refresh = async () => {
    $('#img-busy').hidden = false;
    $('#img-save').disabled = true;
    try {
      const body = await ImageTool.makeBody(src, { clearWhite: $('#clear-white').checked });
      const img = await ImageTool.loadSrc(body);
      $('#body-stage').innerHTML = `<img src="${esc(body)}" alt="">`;
      const crop = ImageTool.cropper($('#crop-canvas'), img, () => {
        if (editor?.crop) $('#crop-preview').innerHTML = avatar({ color: form.color.value, avatar: editor.crop.result() }, 'lg');
      });
      editor = { body, crop };
      $('#crop-scale').value = Math.round(crop.ratio * 100);
      $('#crop-preview').innerHTML = avatar({ color: form.color.value, avatar: crop.result() }, 'lg');
    } catch (err) {
      alert(err.message || '그림을 다듬지 못했어요.');
      imgDlg.close();
    } finally {
      $('#img-busy').hidden = true;
      $('#img-save').disabled = false;
    }
  };
  $('#clear-white').onchange = refresh;
  await refresh();
}
$('#crop-scale').addEventListener('input', (e) => editor?.crop.setScale(e.target.value / 100));
$('#img-save').addEventListener('click', () => {
  if (!editor) return;
  formImages = { body: editor.body, avatar: editor.crop.result() };
  renderImagePreview();
});
$('#img-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('그림 파일만 올릴 수 있어요.');
  try {
    const src = await ImageTool.readFile(file);
    const probe = ImageTool.fit(await ImageTool.loadSrc(src), 400, 400);
    await openImageEditor(src, ImageTool.looksWhiteBg(probe));
  } catch (err) {
    alert(err.message || '그림을 읽을 수 없어요.');
  }
});
$('#btn-recrop').addEventListener('click', () => formImages.body && openImageEditor(formImages.body, false));
$('#btn-img-clear').addEventListener('click', () => {
  formImages = { avatar: null, body: null };
  renderImagePreview();
});
form.name.addEventListener('input', renderImagePreview);
renderImagePreview();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.name = data.name.trim();
  if (!data.name) return;
  data.avatar = formImages.avatar || undefined;
  data.body = formImages.body || undefined;
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
    for (const k of ['id', 'name', 'color', 'personality', 'skill', 'intro']) form[k].value = c[k] || '';
    if (!c.color) form.color.value = '#8e3a2e';
    formImages = { avatar: c.avatar || null, body: c.body || null };
    renderImagePreview();
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
    importCharacters(JSON.parse(await file.text()));
  } catch {
    alert('불러올 수 없는 파일입니다.');
  }
  e.target.value = '';
});

// 같은 캐릭터(id가 같고 이름도 같음)는 덮어쓰고, 나머지는 새로 추가한다
function importCharacters(list) {
  if (!Array.isArray(list)) throw new Error('not a list');
  for (const c of list) {
    if (!c || typeof c.name !== 'string' || !c.name.trim()) continue;
    const same = characters.findIndex((x) => x.id === c.id && x.name === c.name);
    // 이미 있는 캐릭터는 새 정보로 덮되, 가져온 쪽에 없는 그림은 내 기기 것을 남긴다
    if (same >= 0) { characters[same] = { ...characters[same], ...c }; continue; }
    c.id = c.id && !characters.some((x) => x.id === c.id) ? c.id : 'c' + Math.random().toString(36).slice(2);
    characters.push(c);
  }
  saveChars();
  renderCharList();
}

const CODE_PREFIX = 'TGE1:';
$('#btn-copy-chars').addEventListener('click', async () => {
  if (!characters.length) return toast('복사할 캐릭터가 없어요.');
  // 그림까지 넣으면 코드가 너무 길어져서 붙여 넣기가 잘리므로 그림은 뺀다
  const hasArt = characters.some((c) => c.avatar || c.body);
  const plain = characters.map(({ avatar: _a, body: _b, ...rest }) => rest);
  const code = CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(plain))));
  const note = hasArt ? ' 그림은 코드에 들어가지 않아요. 그림까지 옮기려면 "파일로 내보내기"를 쓰세요.' : '';
  try {
    await navigator.clipboard.writeText(code);
    toast(`캐릭터 코드를 복사했어요. 다른 기기에서 "코드 붙여넣기"를 누르세요.${note}`);
  } catch {
    prompt('이 코드를 복사해서 다른 기기에 붙여 넣으세요', code);
  }
});
$('#btn-paste-chars').addEventListener('click', () => {
  const code = (prompt('캐릭터 코드를 붙여 넣으세요') || '').trim();
  if (!code) return;
  try {
    if (!code.startsWith(CODE_PREFIX)) throw new Error();
    importCharacters(JSON.parse(decodeURIComponent(escape(atob(code.slice(CODE_PREFIX.length))))));
    toast('캐릭터를 불러왔어요.');
  } catch {
    alert('올바른 캐릭터 코드가 아니에요.');
  }
});

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}


/* ---------------- 서버 연결 ---------------- */
let ws = null;
let queue = [];
let session = null; // { code, token } — 방에 들어가 있는 동안
let retry = 0;
let scenarios = [];
let view = null;
let viewAt = 0;
let log = [];

let wsCode = null;

// 방마다 접속 주소가 다르다 (/ws?code=XXXX)
function connect(code) {
  if (ws && ws.readyState <= 1 && wsCode === code) return;
  if (ws) { ws.onclose = null; ws.close(); }
  wsCode = code;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?code=${encodeURIComponent(code)}`);
  ws.onopen = () => {
    retry = 0;
    setNet(true);
    if (session?.code === code) ws.send(JSON.stringify({ t: 'resume', ...session }));
    for (const m of queue) ws.send(JSON.stringify(m));
    queue = [];
  };
  ws.onmessage = (e) => {
    try { onServer(JSON.parse(e.data)); } catch (err) { console.error(err); }
  };
  ws.onclose = () => {
    setNet(false);
    if (session?.code === code) setTimeout(() => { if (session?.code === code) connect(code); }, Math.min(8000, 500 * 2 ** retry++));
  };
}
function send(obj) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
  else if (wsCode) { queue.push(obj); connect(wsCode); }
}
function joinRoom(code, payload) {
  session = null;
  queue = [{ t: 'join', ...payload }];
  connect(code);
}
function closeSocket() {
  if (ws) { ws.onclose = null; ws.close(); }
  ws = null;
  wsCode = null;
  setNet(true);
}
function setNet(ok) {
  $('#net-status').hidden = ok || !session;
}
function dropSession() {
  session = null;
  store(SESSION_KEY, null);
  view = null;
  log = [];
}

function onServer(msg) {
  switch (msg.t) {
    case 'joined':
      session = { code: msg.code, token: msg.token };
      store(SESSION_KEY, session);
      break;
    case 'log':
      log = msg.msgs;
      if (screen === 'game') renderLog();
      break;
    case 'msgs':
      log.push(...msg.msgs);
      if (screen === 'game') {
        msg.msgs.forEach((m) => { if (gmShows(m)) appendMsg(m); });
        msg.msgs.forEach((m) => m.sfx && Sound.play(m.sfx));
        markUnread(msg.msgs.length);
      }
      break;
    case 'view': {
      const prev = view;
      view = msg.view;
      viewAt = performance.now();
      route(prev);
      break;
    }
    case 'lock':
      openLock(msg.obj);
      break;
    case 'lockDone':
      if (lockDlg.open && lockObj?.id === msg.obj) lockDlg.close();
      toast(msg.text);
      break;
    case 'effect':
      playEffect(msg.name);
      break;
    case 'left':
      dropSession();
      closeSocket();
      show('title');
      break;
    case 'kicked':
      dropSession();
      closeSocket();
      show('title');
      toast('방에서 나가게 되었어요.');
      break;
    case 'error':
      if (msg.fatal) {
        dropSession();
        closeSocket();
        if (screen !== 'online') show('title');
      }
      if (screen === 'online') {
        $('#online-error').hidden = false;
        $('#online-error').textContent = msg.text;
      } else {
        toast(msg.text);
      }
      break;
    default:
  }
}

function route(prev) {
  if (view.phase === 'lobby') {
    show('lobby');
    renderLobby();
    return;
  }
  const introKey = `tge.intro.${view.code}`;
  let seen = false;
  try { seen = sessionStorage.getItem(introKey) === '1'; } catch { /* 저장 불가 */ }
  if (view.phase === 'play') {
    if (!seen && screen !== 'intro') {
      try { sessionStorage.setItem(introKey, '1'); } catch { /* 저장 불가 */ }
      return playIntro();
    }
    if (screen === 'intro') return;
    if (screen !== 'game') { show('game'); renderAll(); return; }
    renderGame();
    return;
  }
  // 종료
  if (screen === 'game') {
    renderGame();
    if (prev?.phase === 'play') setTimeout(showEnding, 1500);
    else showEnding();
  } else if (screen !== 'ending') {
    showEnding();
  }
}

/* ---------------- 방 만들기 / 참가 ---------------- */
let pickedChar = store(LAST_CHAR_KEY);
const role = () => document.querySelector('[name=role]:checked').value;

$('#btn-online').addEventListener('click', () => show('online'));
$('#btn-chars').addEventListener('click', () => show('chars'));
$('#btn-continue').addEventListener('click', () => {
  session = store(SESSION_KEY);
  if (!session) return show('title');
  closeSocket();
  connect(session.code);
});

async function loadScenarios() {
  if (scenarios.length) return;
  try {
    const res = await fetch('/api/scenarios');
    scenarios = await res.json();
    renderEpisodes();
  } catch {
    showOnlineError('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
function showOnlineError(text) {
  $('#online-error').hidden = false;
  $('#online-error').textContent = text;
}

function renderEpisodes() {
  const sel = $('#episode-select');
  sel.innerHTML = scenarios.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
  $('#episode-desc').textContent = scenarios[0]?.summary || '';
}
$('#episode-select').addEventListener('change', (e) => {
  $('#episode-desc').textContent = scenarios.find((s) => s.id === e.target.value)?.summary || '';
});

function renderOnline() {
  loadScenarios();
  $('#online-error').hidden = true;
  const gm = role() === 'gm';
  $('#role-desc').textContent = gm
    ? '진행자는 캐릭터 없이 모든 구역을 지켜보고, 원하는 구역에 나레이션을 넣고, 시간을 멈출 수 있어요.'
    : '내 캐릭터 하나를 데리고 들어가요. 내 캐릭터가 듣고 볼 수 있는 것만 화면에 나와요.';
  $('#pick-wrap').hidden = gm;
  if (!characters.some((c) => c.id === pickedChar)) pickedChar = characters[0]?.id || null;
  $('#pick-empty').hidden = characters.length > 0;
  $('#pick-list').innerHTML = characters.map((c) => `
    <li data-pick="${c.id}" class="${c.id === pickedChar ? 'on' : ''}">
      ${avatar(c)}
      <div class="info"><strong>${esc(c.name)}</strong><small>${PERSONALITIES[c.personality]?.label} · ${SKILLS[c.skill]?.label}</small></div>
    </li>`).join('');
}
document.querySelectorAll('[name=role]').forEach((r) => r.addEventListener('change', renderOnline));
$('#pick-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-pick]');
  if (!li) return;
  pickedChar = li.dataset.pick;
  store(LAST_CHAR_KEY, pickedChar);
  renderOnline();
});
['#join-code', '#resume-code', '#resume-pin'].forEach((sel) => $(sel).addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); }));
$('#btn-resume-pin').addEventListener('click', () => {
  const code = $('#resume-code').value.trim();
  const pin = $('#resume-pin').value.trim();
  if (!/^[A-Z0-9]{4}$/.test(code) || !/^[A-Z0-9]{6}$/.test(pin)) {
    showOnlineError('초대 코드 4글자와 복귀 번호 6글자를 입력해 주세요.');
    return;
  }
  closeSocket();
  session = null;
  queue = [{ t: 'resume', pin }];
  connect(code);
});

function joinPayload() {
  const gm = role() === 'gm';
  const c = characters.find((x) => x.id === pickedChar);
  if (!gm && !c) {
    showOnlineError('데려갈 캐릭터를 골라 주세요.');
    return null;
  }
  return { gm, char: gm ? null : c };
}
$('#btn-create').addEventListener('click', async (e) => {
  const p = joinPayload();
  if (!p) return;
  e.currentTarget.disabled = true;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: $('#episode-select').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    joinRoom(data.code, p);
  } catch (err) {
    showOnlineError(err.message || '서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  } finally {
    $('#btn-create').disabled = false;
  }
});
$('#btn-join').addEventListener('click', () => {
  const p = joinPayload();
  const code = $('#join-code').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    showOnlineError('초대 코드 4글자를 입력해 주세요.');
    return;
  }
  if (p) joinRoom(code, p);
});

/* ---------------- 대기실 ---------------- */
function renderLobby() {
  $('#lobby-code').textContent = view.code;
  $('#lobby-ep').textContent = view.scenario.title;
  $('#lobby-summary').textContent = view.scenario.summary;
  $('#lobby-players').innerHTML = view.players.map((p) => {
    const face = p.isGM ? `<span class="avatar gm">${pix('monitor', 28)}</span>` : avatar(p.char);
    const tags = [p.host && '방장', p.isGM && '진행자', p.id === view.me.id && '나'].filter(Boolean)
      .map((t) => `<span class="badge">${t}</span>`).join('');
    const kick = canKick(p.id, p.online) ? `<button class="kick" data-kick="${p.id}">내보내기</button>` : '';
    return `<li class="${p.online ? '' : 'offline'}">${face}
      <div class="info"><strong>${p.isGM ? '진행자' : esc(p.char.name)} ${tags}</strong>
      <small>${p.isGM ? '모든 구역을 지켜본다' : `${PERSONALITIES[p.char.personality]?.label} · ${SKILLS[p.char.skill]?.label}`}</small></div>
      ${kick}<span class="dot ${p.online ? 'on' : ''}" title="${p.online ? '접속 중' : '연결 끊김'}"></span></li>`;
  }).join('');
  $('#btn-change-char').hidden = view.me.isGM;
  const castCount = view.players.filter((p) => !p.isGM).length;
  $('#btn-lobby-start').hidden = !view.me.isHost;
  $('#btn-lobby-start').disabled = castCount === 0;
  $('#lobby-wait').hidden = view.me.isHost;
}
$('#btn-lobby-start').addEventListener('click', () => send({ t: 'start' }));

// 방장은 누구든, 다른 사람은 접속이 끊긴 사람만 내보낼 수 있다
function canKick(id, online) {
  return id !== view.me.id && (view.me.isHost || !online);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kick]');
  if (!b || !view) return;
  const p = view.players.find((x) => x.id === b.dataset.kick);
  const name = p?.isGM ? '진행자' : p?.char?.name || '이 멤버';
  if (confirm(`${name}을(를) 방에서 내보낼까요? 다시 들어오려면 새로 참가해야 해요.`)) send({ t: 'kick', id: b.dataset.kick });
});

const charDlg = $('#char-dialog');
$('#btn-change-char').addEventListener('click', () => {
  $('#char-choices').innerHTML = characters.map((c) => `
    <li data-choose="${c.id}">${avatar(c)}<div class="info"><strong>${esc(c.name)}</strong>
    <small>${PERSONALITIES[c.personality]?.label} · ${SKILLS[c.skill]?.label}</small></div></li>`).join('')
    || '<li class="muted">캐릭터 관리에서 먼저 캐릭터를 만들어 주세요.</li>';
  charDlg.showModal();
});
$('#char-choices').addEventListener('click', (e) => {
  const li = e.target.closest('[data-choose]');
  if (!li) return;
  const c = characters.find((x) => x.id === li.dataset.choose);
  pickedChar = c.id;
  store(LAST_CHAR_KEY, c.id);
  send({ t: 'setChar', char: c });
  charDlg.close();
});
$('#btn-leave').addEventListener('click', () => {
  if (confirm('대기실에서 나갈까요?')) send({ t: 'leave' });
});
$('#btn-copy-link').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?room=${view.code}`;
  try {
    await navigator.clipboard.writeText(link);
    toast('초대 링크를 복사했어요. 친구에게 보내 주세요!');
  } catch {
    prompt('이 링크를 친구에게 보내 주세요', link);
  }
});

/* ---------------- 인트로 ---------------- */
function playIntro() {
  let i = 0;
  $('#intro-ep').textContent = view.scenario.title;
  const box = $('#intro-text');
  box.innerHTML = '';
  const me = castById(view.me.id);
  const lines = [
    ...view.scenario.intro.map(esc),
    ...(view.me.isGM
      ? view.cast.map((c) => `${avatar(c, 'sm')} <b>${esc(c.name)}</b> — ${esc(c.roomName)}에서 눈을 떴다.`)
      : [`${avatar(me, 'sm')} <b>${esc(me.name)}</b> — ${esc(me.roomName)}에서 눈을 떴다. 다른 멤버들은 보이지 않는다.`]),
  ];
  const next = () => {
    if (i < lines.length) {
      box.insertAdjacentHTML('beforeend', `<p>${lines[i++]}</p>`);
    } else {
      $('#btn-intro-next').onclick = null;
      show('game');
      renderAll();
      if (view.phase === 'ended') showEnding();
    }
  };
  $('#btn-intro-next').onclick = next;
  show('intro');
  next();
}

/* ---------------- 게임 화면 ---------------- */
const VOLUME_DESC = {
  say: '같은 구역에 들리고, 문·벽 너머 옆 구역에는 웅얼거리며 들립니다.',
  whisper: '같은 구역에만 들립니다.',
  shout: '옆 구역까지 또렷하게, 두 칸 떨어진 구역에는 웅얼거리며 들립니다.',
  act: '같은 구역의 멤버만 볼 수 있습니다.',
  narr: '선택한 구역(또는 전체)에 나레이션을 남깁니다.',
};
const MODE_LABEL = { say: '대사', whisper: '속삭임', shout: '외침', act: '행동', narr: '나레이션' };
const MUFFLED = { o: '#3d3f37', b: '#24251f', y: '#5f6157' };
let gmRoom = null; // 진행자가 보고 있는 구역 (채널과 구역 패널)

const isGM = () => view?.me.isGM;
const castById = (id) => view?.cast?.find((c) => c.id === id) || { id, name: '???', color: '#555555', sprite: 'short' };
const myChar = () => (isGM() ? null : castById(view.me.id));

function renderAll() {
  $('#ep-name').textContent = view.scenario.title;
  $('#btn-pause').hidden = !isGM();
  $('#btn-hint').textContent = isGM() ? '힌트 주기' : '힌트 (-3분)';
  $('#rp-mode').innerHTML = (isGM() ? ['narr'] : ['say', 'whisper', 'shout', 'act'])
    .map((m) => `<option value="${m}">${MODE_LABEL[m]}</option>`).join('');
  $('#rp-text').placeholder = isGM() ? '상황을 묘사하거나 돌발 이벤트를 알려 주세요' : '캐릭터로 말하거나 행동해 보세요';
  renderGame();
  renderLog();
}

function renderGame() {
  if (isGM() && !gmRoom) gmRoom = null;
  renderClock();
  renderTeam();
  renderMap();
  renderRoom();
  renderChannels();
  renderInput();
  $('#btn-pause').textContent = view.time.paused ? '재개' : '일시정지';
  if (!isGM()) {
    const h = view.hint;
    $('#btn-hint').textContent = h.votes ? `힌트 찬성 ${h.votes}/${h.need}` : '힌트 (-3분)';
    $('#btn-hint').classList.toggle('voted', h.mine);
  }
  $('#resume-info').innerHTML = `다른 기기로 이어하기<br>초대 코드 <b>${esc(view.code)}</b> · 복귀 번호 <b>${esc(view.me.pin)}</b>`;
}

/* 시계: 서버가 알려 준 남은 시간에서 로컬로 센다 */
let clockId = null;
function startClock() { stopClock(); clockId = setInterval(renderClock, 250); }
function stopClock() { clearInterval(clockId); clockId = null; }
function renderClock() {
  if (!view?.time) return;
  const elapsed = view.time.paused ? 0 : performance.now() - viewAt;
  const t = Math.max(0, Math.ceil((view.time.left - elapsed) / 1000));
  const el = $('#timer');
  el.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  el.classList.toggle('danger', t <= 300);
  el.classList.toggle('paused', view.time.paused && !view.over);
}

function renderTeam() {
  const online = Object.fromEntries(view.players.map((p) => [p.id, p.online]));
  $('#team').innerHTML = view.cast.map((c) => {
    const mine = c.id === view.me.id;
    if (c.gone) {
      return `<div class="member gone">${avatar(c)}<div class="m-info"><b>${esc(c.name)}</b><small>방을 떠났다</small></div></div>`;
    }
    const kick = view.phase === 'play' && canKick(c.id, online[c.id])
      ? `<button class="kick" data-kick="${c.id}" title="${online[c.id] ? '' : '접속이 끊긴 멤버를 내보내면 탈출할 때 기다리지 않아도 돼요'}">내보내기</button>` : '';
    const items = (c.items || []).map((it) => mine
      ? `<button class="item" data-give="${esc(it.id)}" title="건네주기">${pix(it.icon, 14)}${esc(it.name)}</button>`
      : `<span class="item static">${pix(it.icon, 14)}${esc(it.name)}</span>`).join('');
    return `
    <div class="member ${mine ? 'on' : ''} ${online[c.id] ? '' : 'offline'}" title="${esc(c.intro)}">
      ${avatar(c)}
      <div class="m-info">
        <b>${esc(c.name)}${mine ? ' <span class="badge">나</span>' : ''}</b>
        <small>${pix('pin', 10)} ${c.roomName ? esc(c.roomName) : '어딘가'} · ${SKILLS[c.skill]?.label}</small>
        <div class="m-items">${items}</div>
        ${online[c.id] ? '' : '<small class="offline-tag">접속 끊김</small>'}${kick}
      </div>
    </div>`;
  }).join('');
}

function renderMap() {
  const { w, h, rooms, links } = view.map;
  const pct = (v, total) => `${(v / total) * 100}%`;
  const rect = Object.fromEntries(rooms.map((r) => [r.id, r.rect]));
  const here = isGM() ? gmRoom : view.here?.id;
  let html = '';
  for (const r of rooms) {
    const [x, y, rw, rh] = r.rect;
    const style = `left:${pct(x, w)};top:${pct(y, h)};width:${pct(rw, w)};height:${pct(rh, h)}`;
    if (r.state === 'unknown') {
      html += `<div class="room unknown" style="${style}" data-room="${r.id}"><span>???</span></div>`;
      continue;
    }
    const tokens = r.tokens.map((id, i, all) => token(castById(id), i, all.length)).join('');
    html += `<div class="room ${r.id === here ? 'here' : ''}" style="${style}" data-room="${r.id}">
      <span class="room-label">${esc(r.name)}</span><div class="tokens">${tokens}</div></div>`;
  }
  for (const l of links) {
    const [x, y] = l.at || linkPoint(rect[l.a], rect[l.b]);
    const icon = l.kind === 'open' ? '' : pix(l.open ? 'door' : 'padlock', 14);
    html += `<span class="link ${l.kind} ${l.open ? 'open' : 'locked'}" style="left:${pct(x, w)};top:${pct(y, h)}">${icon}</span>`;
  }
  const map = $('#map');
  map.style.aspectRatio = `${w} / ${h}`;
  map.style.width = `min(100%, calc(52vh * ${w / h}))`;
  map.style.setProperty('--gw', w);
  map.style.setProperty('--gh', h);
  // 다른 방으로 옮긴 캐릭터는 원래 자리에서 새 자리로 걸어가게 한다
  const before = {};
  map.querySelectorAll('[data-token]').forEach((el) => { before[el.dataset.token] = el.getBoundingClientRect(); });
  map.innerHTML = html;
  map.querySelectorAll('[data-token]').forEach((el) => {
    const old = before[el.dataset.token];
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.classList.add('walking', dx > 0 ? 'to-left' : 'to-right');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 1.1s ease-in-out';
      el.style.transform = '';
    }));
    el.addEventListener('transitionend', () => el.classList.remove('walking', 'to-left', 'to-right'), { once: true });
  });
}

// 지도 위 캐릭터: 전신 그림(없으면 프사·도트)이 방 안을 천천히 오간다
function token(c, i, n) {
  const seed = [...c.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const body = imgUrl(c, 'b');
  const figure = body ? `<img class="body-img" src="${esc(body)}" alt="">` : avatar(c, 'sm');
  const style = `--dx:${6 + (seed % 14)}px;--dur:${6 + (seed % 5)}s;--delay:-${seed % 7}s`;
  return `<span class="token ${c.id === view.me.id ? 'on' : ''} ${body ? 'has-body' : ''}" data-token="${c.id}"
    title="${esc(c.name)}" style="left:${((i + 1) / (n + 1)) * 100}%">
    <span class="center"><span class="walker" style="${style}"><span class="bob">${figure}</span><span class="shadow"></span></span></span></span>`;
}

function linkPoint([ax, ay, aw, ah], [bx, by, bw, bh]) {
  if (ax + aw === bx || bx + bw === ax) {
    const x = ax + aw === bx ? bx : ax;
    return [x, (Math.max(ay, by) + Math.min(ay + ah, by + bh)) / 2];
  }
  const y = ay + ah === by ? by : ay;
  return [(Math.max(ax, bx) + Math.min(ax + aw, bx + bw)) / 2, y];
}

function currentRoom() {
  if (!isGM()) return view.here;
  return gmRoom ? view.rooms[gmRoom] : null;
}

function renderRoom() {
  const r = currentRoom();
  const panel = $('.room-panel');
  if (!r) {
    $('#room-name').innerHTML = `${pix('monitor', 18)} 제작진 모니터`;
    $('#room-people').textContent = '';
    $('#room-desc').textContent = '지도에서 구역을 누르면 그 구역의 상황과 채팅을 볼 수 있어요.';
    $('#objects').innerHTML = '';
    $('#exits').innerHTML = '';
    panel.classList.toggle('readonly', true);
    return;
  }
  panel.classList.toggle('readonly', isGM());
  $('#room-name').innerHTML = `${pix('pin', 18)} ${esc(r.name)}`;
  const others = r.people.filter((id) => id !== view.me.id).map((id) => castById(id).name);
  $('#room-people').textContent = isGM()
    ? (others.length ? `이 구역: ${others.join(', ')}` : '아무도 없다')
    : (others.length ? `함께 있는 멤버: ${others.join(', ')}` : '이 구역엔 혼자다');
  $('#room-desc').textContent = r.desc;
  $('#objects').innerHTML = r.objects.map((o) => `
    <button class="obj ${o.done ? 'solved' : ''}" data-obj="${o.id}" ${isGM() ? 'disabled' : ''}>
      <span class="icon">${pix(o.icon, 40)}</span><span>${esc(o.name)}</span>
    </button>`).join('');
  $('#exits').innerHTML = r.exits.map((x) => `
    <button class="exit ${x.open ? '' : 'locked'}" data-room="${x.to}" ${isGM() ? 'disabled' : ''}>
      ${x.open ? '▶' : pix('padlock', 12)} ${esc(x.name || '???')}</button>`).join('');
}

function renderChannels() {
  const nav = $('#channels');
  if (!isGM()) {
    const me = myChar();
    nav.innerHTML = `<span class="ear">${pix('pin', 12)} ${esc(me.roomName)} — ${esc(me.name)}에게 들리는 소리</span>`;
    return;
  }
  const occupied = view.map.rooms.filter((r) => r.tokens.length);
  nav.innerHTML = `<button data-ch="" class="${gmRoom ? '' : 'on'}">${pix('monitor', 12)}전체</button>` +
    occupied.map((r) => `<button data-ch="${r.id}" class="${gmRoom === r.id ? 'on' : ''}">${esc(r.name)} <small>${r.tokens.length}</small></button>`).join('');
}
$('#channels').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ch]');
  if (!b) return;
  selectGmRoom(b.dataset.ch || null);
});
function selectGmRoom(id) {
  gmRoom = id;
  renderMap();
  renderRoom();
  renderChannels();
  renderInput();
  renderLog();
}

// 진행자는 고른 구역의 메시지만 걸러 볼 수 있다
function gmShows(m) {
  if (!isGM() || !gmRoom) return true;
  return m.global || m.tag === view.rooms[gmRoom].name;
}

function renderInput() {
  const mode = $('#rp-mode').value || (isGM() ? 'narr' : 'say');
  if (isGM()) {
    const target = gmRoom ? view.rooms[gmRoom].name : '전체';
    $('#rp-who').innerHTML = `${pix('book', 16)} 진행자 나레이션 → <b>${esc(target)}</b>`;
  } else {
    const me = myChar();
    $('#rp-who').innerHTML = `${avatar(me, 'sm')} <b style="color:${esc(me.color)}">${esc(me.name)}</b> <span class="muted">@ ${esc(me.roomName)}</span>`;
  }
  $('#rp-range').textContent = VOLUME_DESC[mode];
}
$('#rp-mode').addEventListener('change', renderInput);

/* ---------------- 로그 ---------------- */
function renderLog() {
  $('#log').innerHTML = '';
  log.filter(gmShows).forEach(appendMsg);
}
function appendMsg(m) {
  const el = $('#log');
  const tag = m.tag ? `<span class="tag">${esc(m.tag)}</span>` : '';
  const icon = m.icon ? pix(m.icon, 16) : '';
  let html;
  if (m.type === 'muffled') {
    html = `<div class="msg muffled"><span class="from">${pix('door', 14, MUFFLED)} ${esc(m.from ? `${m.from} 쪽` : '어딘가')}에서 웅얼거리는 소리</span><p>${esc(m.text)}</p></div>`;
  } else if (m.type === 'npc') {
    const from = m.away ? `<span class="from">${esc(m.away)}에서</span>` : '';
    html = `<div class="msg npc"><span class="avatar sm npc">${pix('speaker', 24)}</span><div>${tag}<b>${esc(m.speaker)}</b>${from}<p>${esc(m.text)}</p></div></div>`;
  } else if (m.type === 'say' && m.charId) {
    const c = castById(m.charId);
    const vol = m.vol === 'shout' ? ' shout' : m.vol === 'whisper' ? ' whisper' : '';
    const from = m.away ? `<span class="from">${esc(m.away)}에서</span>` : '';
    html = `<div class="msg say${vol}">${avatar(c, 'sm')}<div>${tag}<b style="color:${esc(c.color)}">${esc(c.name)}</b>${from}<p>${esc(m.text)}</p></div></div>`;
  } else if (m.type === 'act' && m.charId) {
    html = `<div class="msg act">${tag}<i>* ${esc(josa(castById(m.charId).name, '이', '가'))} ${esc(m.text)}</i></div>`;
  } else {
    html = `<div class="msg ${esc(m.type)}">${tag}${icon}${esc(m.text)}</div>`;
  }
  el.insertAdjacentHTML('beforeend', html);
  el.scrollTop = el.scrollHeight;
}

function logAsText() {
  const who = isGM() ? '진행자 시점' : `${myChar().name} 시점`;
  const lines = [view.scenario.title, `출연: ${view.cast.map((c) => c.name).join(', ')}`, `(${who})`, ''];
  for (const m of log) {
    const where = m.tag ? `[${m.tag}] ` : '';
    const c = m.charId && castById(m.charId);
    if (m.type === 'muffled') lines.push(`(${m.from || '어딘가'}에서 웅얼거리는 소리) ${m.text}`);
    else if (m.type === 'npc') lines.push(`${where}${m.speaker}: "${m.text}"`);
    else if (m.type === 'say' && c) lines.push(`${where}${c.name}${m.vol === 'shout' ? '(외침)' : m.vol === 'whisper' ? '(속삭임)' : ''}: "${m.text}"`);
    else if (m.type === 'act' && c) lines.push(`${where}* ${josa(c.name, '이', '가')} ${m.text}`);
    else if (m.type === 'sys') lines.push(`${where}<${m.text}>`);
    else lines.push(`${where}${m.text}`);
  }
  return lines.join('\n');
}

/* ---------------- 조작 ---------------- */
document.querySelector('#screen-game').addEventListener('click', (e) => {
  if (!view || view.phase !== 'play') return;
  const give = e.target.closest('[data-give]');
  if (give) return openGive(give.dataset.give);
  const r = e.target.closest('[data-room]');
  if (r) {
    if (isGM()) return selectGmRoom(r.dataset.room);
    return send({ t: 'move', to: r.dataset.room });
  }
  const o = e.target.closest('[data-obj]');
  if (o && !isGM()) send({ t: 'interact', obj: o.dataset.obj });
});

$('#rp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#rp-text').value.trim();
  if (!text || view?.phase !== 'play') return;
  if (isGM()) send({ t: 'narr', room: gmRoom, text });
  else send({ t: 'say', mode: $('#rp-mode').value, text });
  $('#rp-text').value = '';
});

$('#btn-hint').addEventListener('click', () => {
  if (view?.phase !== 'play') return;
  if (isGM()) return send({ t: 'hint' });
  const h = view.hint;
  if (h.mine) return toast('이미 찬성했어요. 다른 멤버의 찬성을 기다리는 중이에요.');
  const ask = h.need > 1
    ? `힌트는 과반수(${h.need}명)가 찬성하면 나오고, 모두의 시간이 3분 줄어요. 찬성할까요?`
    : '힌트를 보면 남은 시간이 3분 줄어들어요. 볼까요?';
  if (confirm(ask)) send({ t: 'hint' });
});
$('#btn-pause').addEventListener('click', () => send({ t: 'pause' }));

$('#btn-quit').addEventListener('click', () => {
  if (!confirm('타이틀로 나갈까요? 게임은 계속 진행되고, "이어하기"로 다시 들어올 수 있어요.')) return;
  const keep = session;
  session = null;
  closeSocket();
  store(SESSION_KEY, keep);
  show('title');
});

/* 아이템 건네기 */
const giveDlg = $('#give-dialog');
function openGive(itemId) {
  const me = myChar();
  const it = me.items.find((x) => x.id === itemId);
  if (!it) return;
  const mates = view.cast.filter((c) => c.id !== me.id && c.room && c.room === me.room);
  $('#give-title').innerHTML = `${pix(it.icon, 20)} ${esc(josa(it.name, '을', '를'))} 누구에게 건넬까?`;
  $('#give-targets').innerHTML = mates.length
    ? mates.map((m) => `<button value="${m.id}" data-to="${m.id}">${avatar(m, 'sm')} ${esc(m.name)}</button>`).join('')
    : '<p class="muted">같은 구역에 있는 멤버가 없다. 같은 구역에 있어야 건넬 수 있다.</p>';
  $('#give-targets').onclick = (e) => {
    const b = e.target.closest('[data-to]');
    if (!b) return;
    send({ t: 'give', item: itemId, to: b.dataset.to });
    giveDlg.close();
  };
  giveDlg.showModal();
}

/* 자물쇠 */
const lockDlg = $('#lock-dialog');
let lockObj = null;
function openLock(obj) {
  lockObj = obj;
  $('#lock-title').innerHTML = `${pix(obj.icon, 24)} ${esc(obj.name)}`;
  $('#lock-prompt').textContent = obj.prompt;
  const hint = $('#lock-hint');
  hint.hidden = !obj.hint;
  hint.innerHTML = obj.hint ? `${pix('brain', 16)} ${esc(obj.by)}의 두뇌 — ${esc(obj.hint)}` : '';
  $('#lock-force').hidden = !obj.force;
  $('#lock-input').value = '';
  if (!lockDlg.open) lockDlg.showModal();
}
$('#lock-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'ok') return;
  const value = $('#lock-input').value.trim();
  if (value) send({ t: 'guess', obj: lockObj.id, value });
});
$('#lock-force').addEventListener('click', () => {
  lockDlg.close();
  send({ t: 'force', obj: lockObj.id });
});

/* ---------------- 모바일: 한 번에 한 칸씩 ---------------- */
const narrow = window.matchMedia('(max-width: 860px)');
let unread = 0;
function setTab(tab) {
  $('.game-layout').dataset.tab = tab;
  document.querySelectorAll('#mobile-tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'chat') {
    unread = 0;
    $('#unread').hidden = true;
    $('#log').scrollTop = $('#log').scrollHeight;
  }
}
function markUnread(n) {
  if (!narrow.matches || $('.game-layout').dataset.tab === 'chat') return;
  unread += n;
  $('#unread').hidden = false;
  $('#unread').textContent = unread > 99 ? '99+' : unread;
}
$('#mobile-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

/* ---------------- 화면 효과 ---------------- */
// flicker(형광등 깜빡임) / blackout(정전) / alarm(경보)
function playEffect(name) {
  if (!['flicker', 'blackout', 'alarm'].includes(name)) return;
  Sound.play(name);
  if (!fxOn) return;
  const fx = $('#fx');
  fx.className = '';
  void fx.offsetWidth; // 같은 효과를 연달아 다시 재생
  fx.className = `fx-${name}`;
}
$('#fx').addEventListener('animationend', (e) => { e.currentTarget.className = ''; });

/* ---------------- 엔딩 ---------------- */
function showEnding() {
  if (screen === 'ending' || !view) return;
  const success = view.result === 'escape';
  $('#ending-title').innerHTML = success ? `${pix('door', 48)} 탈출 성공` : `${pix('skull', 48)} 탈출 실패…`;
  const t = Math.max(0, Math.ceil(view.time.left / 1000));
  $('#ending-text').textContent = success
    ? `남은 시간 ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')} — ${view.scenario.title} 클리어`
    : '다음 화에서는 꼭 나갈 수 있을 거야.';
  $('#ending-team').innerHTML = view.cast.map((c) => {
    const body = imgUrl(c, 'b');
    return `<div>${body ? `<img class="ending-body" src="${esc(body)}" alt="">` : avatar(c, 'lg')}<span>${esc(c.name)}</span></div>`;
  }).join('');
  show('ending');
}
$('#btn-save-log').addEventListener('click', () => download(`${view.scenario.title}_역극로그.txt`, logAsText()));
$('#btn-ending-title').addEventListener('click', () => {
  dropSession();
  closeSocket();
  show('title');
});

/* ---------------- 시작 ---------------- */
$('#title-icon').innerHTML = pix('padlock', 72);
const invite = new URLSearchParams(location.search).get('room');
if (invite) {
  $('#join-code').value = invite.toUpperCase().slice(0, 4);
  history.replaceState(null, '', location.pathname);
  show('online');
} else {
  show('title');
}
