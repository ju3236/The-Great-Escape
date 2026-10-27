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
  if (name !== 'game') document.querySelector('#memo').hidden = true;
}

/* ---------------- 설정: 화면 효과 / 소리 ---------------- */
let fxOn = true;
try { fxOn = localStorage.getItem('tge.fx') !== 'off'; } catch { /* 저장 불가 */ }
function applySettings() {
  document.documentElement.classList.toggle('no-fx', !fxOn);
  const fx = document.querySelector('#btn-fx');
  const snd = document.querySelector('#btn-sound');
  if (fx) { fx.textContent = fxOn ? '효과 켬' : '효과 끔'; fx.classList.toggle('off', !fxOn); }
  if (snd) { snd.textContent = Sound.label; snd.classList.toggle('off', !Sound.enabled); }
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

function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = name;
  document.body.append(a);
  a.click();
  // 바로 해제하면 일부 브라우저에서 파일 이름이 사라진다
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
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
    case 'fullLog':
      fullLogWait?.(msg.msgs);
      break;
    case 'log':
      log = msg.msgs;
      if (screen === 'game') renderLog();
      break;
    case 'msgs':
      log.push(...msg.msgs);
      if (screen === 'game') {
        msg.msgs.forEach((m) => { if (gmShows(m)) appendMsg(m); });
        renderRoomLog();
        msg.msgs.forEach((m) => {
          if (m.sfx) Sound.play(m.sfx);
          else if (m.type === 'say' && m.charId !== view?.me.id) Sound.play('talk');
          else if (m.type === 'muffled') Sound.play('murmur');
        });
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
// 데려갈 캐릭터들 (한 사람이 여러 명을 데려갈 수 있다)
const MAX_CAST = 6;
let pickedChars = (() => {
  const v = store(LAST_CHAR_KEY);
  return Array.isArray(v) ? v : v ? [v] : [];
})();
const role = () => document.querySelector('[name=role]:checked').value;
const charNames = (list) => list.map((c) => c.name).join(', ');

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

// 캐릭터 고르기 목록 (참가 화면, 대기실 공용)
function pickListHtml(selected) {
  return characters.map((c) => `
    <li data-pick="${c.id}" class="${selected.includes(c.id) ? 'on' : ''}">
      ${avatar(c)}
      <div class="info"><strong>${esc(c.name)}</strong><small>${PERSONALITIES[c.personality]?.label} · ${SKILLS[c.skill]?.label}</small></div>
    </li>`).join('');
}
function togglePick(list, id) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= MAX_CAST) { toast(`한 번에 최대 ${MAX_CAST}명까지 데려갈 수 있어요.`); return list; }
  return [...list, id];
}

function renderOnline() {
  loadScenarios();
  $('#online-error').hidden = true;
  const gm = role() === 'gm';
  $('#role-desc').textContent = gm
    ? '진행자는 캐릭터 없이 모든 구역을 지켜보고, 원하는 구역에 나레이션을 넣고, 시간을 멈출 수 있어요.'
    : '내 캐릭터를 한 명 이상 데리고 들어가요. 여러 명을 데려가면 게임 중에 왼쪽 목록에서 바꿔 가며 굴릴 수 있어요.';
  $('#pick-wrap').hidden = gm;
  pickedChars = pickedChars.filter((id) => characters.some((c) => c.id === id));
  if (!pickedChars.length && characters.length) pickedChars = [characters[0].id];
  $('#pick-empty').hidden = characters.length > 0;
  $('#pick-list').innerHTML = pickListHtml(pickedChars);
  $('#pick-count').textContent = characters.length ? `${pickedChars.length}명 고름` : '';
}
document.querySelectorAll('[name=role]').forEach((r) => r.addEventListener('change', renderOnline));
$('#pick-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-pick]');
  if (!li) return;
  pickedChars = togglePick(pickedChars, li.dataset.pick);
  store(LAST_CHAR_KEY, pickedChars);
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
  const chars = pickedChars.map((id) => characters.find((c) => c.id === id)).filter(Boolean);
  if (!gm && !chars.length) {
    showOnlineError('데려갈 캐릭터를 골라 주세요.');
    return null;
  }
  return { gm, chars: gm ? [] : chars };
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
    const faces = p.isGM ? `<span class="avatar gm">${pix('monitor', 28)}</span>` : `<span class="faces">${p.chars.map((c) => avatar(c)).join('')}</span>`;
    const tags = [p.host && '방장', p.isGM && '진행자', p.id === view.me.id && '나'].filter(Boolean)
      .map((t) => `<span class="badge">${t}</span>`).join('');
    const kick = canKick(p.id, p.online) ? `<button class="kick" data-kick="${p.id}">내보내기</button>` : '';
    const sub = p.isGM ? '모든 구역을 지켜본다'
      : p.chars.map((c) => `${esc(c.name)} (${SKILLS[c.skill]?.label})`).join(' · ');
    return `<li class="${p.online ? '' : 'offline'}">${faces}
      <div class="info"><strong>${p.isGM ? '진행자' : esc(charNames(p.chars))} ${tags}</strong><small>${sub}</small></div>
      ${kick}<span class="dot ${p.online ? 'on' : ''}" title="${p.online ? '접속 중' : '연결 끊김'}"></span></li>`;
  }).join('');
  $('#btn-change-char').hidden = view.me.isGM;
  renderOptions('#lobby-options');
  const castCount = view.players.reduce((n, p) => n + (p.chars?.length || 0), 0);
  $('#lobby-count').textContent = `캐릭터 ${castCount} / ${MAX_CAST}명`;
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
  const name = p?.isGM ? '진행자' : charNames(p?.chars || []) || '이 멤버';
  if (confirm(`${name}을(를) 방에서 내보낼까요? 다시 들어오려면 새로 참가해야 해요.`)) send({ t: 'kick', id: b.dataset.kick });
});

// 방 설정: 방장은 바꾸고, 다른 사람은 지금 상태를 본다
function renderOptions(sel) {
  const o = view.options || {};
  const host = view.me.isHost;
  const minutes = Math.round((view.scenario.timeLimit || 0) / 60);
  const lobby = view.phase === 'lobby';
  const row = (key, label, desc, canChange) => (host && canChange
    ? `<label class="check"><input type="checkbox" data-option="${key}" ${o[key] ? 'checked' : ''}> ${label}</label><p class="muted small">${desc}</p>`
    : `<p class="small">${label}: <b>${o[key] ? '켜짐' : '꺼짐'}</b></p><p class="muted small">${desc}${host ? '' : ' 방장이 바꿀 수 있어요.'}</p>`);
  $(sel).innerHTML = [
    minutes ? row('timeLimit', `제한 시간 ${minutes}분`, lobby ? '켜면 전체 제한 시간이 생기고, 오답과 힌트에 시간이 줄어요. 끄면 시간 제한 없이 하다가 중간중간 타임어택만 나와요.' : '녹화 중에는 바꿀 수 없어요.', lobby) : '',
    row('autoHint', '자동 힌트', '5분 동안 아무 퍼즐도 못 풀면 힌트가 자동으로 나와요.', true),
    row('ambient', '분위기 연출', '시간이 흐르면 아무도 건드리지 않아도 저절로 나오는 나레이션과 화면 효과예요. 진행에 꼭 필요한 연출은 꺼도 나와요.', true),
  ].join('');
}
document.addEventListener('change', (e) => {
  const box = e.target.closest('[data-option]');
  if (box) send({ t: 'option', [box.dataset.option]: box.checked });
});

const charDlg = $('#char-dialog');
let dialogPicks = [];
$('#btn-change-char').addEventListener('click', () => {
  const mine = view.players.find((p) => p.id === view.me.id);
  dialogPicks = pickedChars.filter((id) => characters.some((c) => c.id === id));
  if (!dialogPicks.length && mine) dialogPicks = characters.filter((c) => mine.chars.some((m) => m.name === c.name)).map((c) => c.id);
  $('#char-choices').innerHTML = pickListHtml(dialogPicks) || '<li class="muted">캐릭터 관리에서 먼저 캐릭터를 만들어 주세요.</li>';
  charDlg.showModal();
});
$('#char-choices').addEventListener('click', (e) => {
  const li = e.target.closest('[data-pick]');
  if (!li) return;
  dialogPicks = togglePick(dialogPicks, li.dataset.pick);
  $('#char-choices').innerHTML = pickListHtml(dialogPicks);
});
$('#char-choices-ok').addEventListener('click', () => {
  const chars = dialogPicks.map((id) => characters.find((c) => c.id === id)).filter(Boolean);
  if (!chars.length) return toast('캐릭터를 한 명 이상 골라 주세요.');
  pickedChars = dialogPicks;
  store(LAST_CHAR_KEY, pickedChars);
  send({ t: 'setChar', chars });
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
  const shown = view.me.isGM ? view.cast : myIds().map(castById);
  const lines = [
    ...view.scenario.intro.map(esc),
    ...shown.map((c) => `${avatar(c, 'sm')} <b>${esc(c.name)}</b> — ${esc(c.roomName)}에서 눈을 떴다.`),
    ...(view.me.isGM ? [] : ['다른 멤버들은 보이지 않는다.']),
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
let activeChar = null; // 지금 행동하는 내 캐릭터

const isGM = () => view?.me.isGM;
const castById = (id) => view?.cast?.find((c) => c.id === id) || { id, name: '???', color: '#555555', sprite: 'short' };
const isMine = (id) => !!view?.me.chars?.includes(id);
const myIds = () => (view?.me.chars || []).filter((id) => view?.cast?.some((c) => c.id === id && !c.gone));
const myChar = () => (isGM() ? null : castById(activeChar));
function ensureActive() {
  const ids = myIds();
  if (!ids.includes(activeChar)) activeChar = ids[0] || null;
}
function switchChar(id) {
  if (!isMine(id) || id === activeChar) return;
  activeChar = id;
  renderGame();
  toast(`${josa(castById(id).name, '으로', '로')} 행동해요.`);
}
const fmt = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function renderAll() {
  $('#ep-name').textContent = view.scenario.title;
  $('#btn-pause').hidden = !isGM();
  $('#rp-mode').innerHTML = (isGM() ? ['narr'] : ['say', 'whisper', 'shout', 'act'])
    .map((m) => `<option value="${m}">${MODE_LABEL[m]}</option>`).join('');
  $('#rp-text').placeholder = isGM() ? '상황을 묘사하거나 돌발 이벤트를 알려 주세요' : '캐릭터로 말하거나 행동해 보세요';
  renderGame();
  renderLog();
}

function renderGame() {
  ensureActive();
  renderClock();
  renderTeam();
  renderMap();
  renderRoom();
  renderRoomLog();
  renderChannels();
  renderInput();
  $('#btn-pause').textContent = view.time.paused ? '재개' : '일시정지';
  if (isGM()) {
    $('#btn-hint').textContent = '힌트 주기';
  } else {
    const h = view.hint;
    $('#btn-hint').textContent = h.votes ? `힌트 찬성 ${h.votes}/${h.need}` : h.cost ? `힌트 (-${h.cost / 60}분)` : '힌트';
    $('#btn-hint').classList.toggle('voted', h.mine);
  }
  renderOptions('#game-options');
  $('#resume-info').innerHTML = `다른 기기로 이어하기<br>초대 코드 <b>${esc(view.code)}</b> · 복귀 번호 <b>${esc(view.me.pin)}</b>`;
}

/* 시계: 서버가 알려 준 시간에서 로컬로 센다. 제한 시간이 없으면 흐른 시간을 보여 준다. */
let clockId = null;
function startClock() { stopClock(); clockId = setInterval(renderClock, 250); }
function stopClock() { clearInterval(clockId); clockId = null; }
function renderClock() {
  if (!view?.time) return;
  const dt = view.time.paused || view.over ? 0 : performance.now() - viewAt;
  const el = $('#timer');
  if (view.time.limited) {
    const left = view.time.left - dt;
    el.textContent = fmt(left);
    el.classList.toggle('danger', left <= 300_000);
    el.classList.remove('elapsed');
    el.title = '남은 시간';
  } else {
    el.textContent = fmt(view.time.elapsed + dt);
    el.classList.remove('danger');
    el.classList.add('elapsed');
    el.title = '흐른 시간 (제한 시간 없음)';
  }
  el.classList.toggle('paused', view.time.paused && !view.over);
  const banner = $('#attack-banner');
  const attacks = view.attacks || [];
  banner.hidden = !attacks.length || view.over;
  banner.innerHTML = attacks.map((a) => {
    const left = a.left - dt;
    return `<div class="attack ${left <= 10_000 ? 'hurry' : ''}">${pix('hourglass', 20)}<span class="label">${esc(a.label)}</span><span class="count">${fmt(left)}</span></div>`;
  }).join('');
}

function renderTeam() {
  const online = Object.fromEntries(view.players.map((p) => [p.id, p.online]));
  const mineFirst = [...view.cast].sort((a, b) => isMine(b.id) - isMine(a.id));
  $('#team').innerHTML = mineFirst.map((c) => {
    const mine = isMine(c.id);
    if (c.gone) {
      return `<div class="member gone">${avatar(c)}<div class="m-info"><b>${esc(c.name)}</b><small>방을 떠났다</small></div></div>`;
    }
    const kick = view.phase === 'play' && !mine && c.owner && canKick(c.owner, online[c.owner])
      ? `<button class="kick" data-kick="${c.owner}" title="${online[c.owner] ? '' : '접속이 끊긴 멤버를 내보내면 탈출할 때 기다리지 않아도 돼요'}">내보내기</button>` : '';
    const items = (c.items || []).map((it) => mine
      ? `<button class="item" data-give="${esc(it.id)}" data-from="${c.id}" title="건네주기">${pix(it.icon, 14)}${esc(it.name)}</button>`
      : `<span class="item static">${pix(it.icon, 14)}${esc(it.name)}</span>`).join('');
    const switchable = mine && myIds().length > 1;
    return `
    <div class="member ${c.id === activeChar ? 'on' : ''} ${mine ? 'mine' : ''} ${online[c.owner] === false ? 'offline' : ''}"
      ${mine ? `data-switch="${c.id}"` : ''} title="${switchable ? '눌러서 이 캐릭터로 행동하기' : esc(c.intro)}">
      ${avatar(c)}
      <div class="m-info">
        <b>${esc(c.name)}${mine ? ' <span class="badge">나</span>' : ''}</b>
        <small>${pix('pin', 10)} ${c.roomName ? esc(c.roomName) : '어딘가'} · ${SKILLS[c.skill]?.label}</small>
        <div class="m-items">${items}</div>
        ${online[c.owner] === false ? '<small class="offline-tag">접속 끊김</small>' : ''}${kick}
      </div>
    </div>`;
  }).join('') + (myIds().length > 1 ? '<p class="muted small switch-tip">내 캐릭터를 누르면 그 캐릭터로 바꿔서 행동해요.</p>' : '');
}

function renderMap() {
  const { w, h, rooms, links } = view.map;
  const pct = (v, total) => `${(v / total) * 100}%`;
  const rect = Object.fromEntries(rooms.map((r) => [r.id, r.rect]));
  const here = isGM() ? gmRoom : myChar()?.room;
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
  const mine = isMine(c.id);
  return `<span class="token ${c.id === activeChar ? 'on' : ''} ${mine ? 'mine' : ''} ${body ? 'has-body' : ''}" data-token="${c.id}"
    ${mine ? `data-switch="${c.id}"` : ''} title="${esc(c.name)}" style="left:${((i + 1) / (n + 1)) * 100}%">
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
  if (!isGM()) return view.rooms?.[myChar()?.room] || null;
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
  const who = isGM() ? '' : ` <span class="acting">${avatar(myChar(), 'sm')} ${esc(myChar().name)}</span>`;
  $('#room-name').innerHTML = `${pix('pin', 18)} ${esc(r.name)}${who}`;
  const others = r.people.filter((id) => id !== activeChar).map((id) => castById(id).name);
  $('#room-people').textContent = isGM()
    ? (others.length ? `이 구역: ${others.join(', ')}` : '아무도 없다')
    : (others.length ? `함께 있는 멤버: ${others.join(', ')}` : '이 구역엔 혼자다');
  $('#room-desc').textContent = r.desc;
  $('#objects').innerHTML = r.objects.map((o) => {
    // 단서 물건은 처음 살펴본 캐릭터만 다시 볼 수 있다
    const by = o.by ? castById(o.by) : null;
    const taken = by && !isGM() && o.by !== activeChar;
    const label = by ? `<small class="by">${esc(josa(by.name, '이', '가'))} 살펴봄${isMine(o.by) ? ' (나)' : ''}</small>` : '';
    return `
    <button class="obj ${o.done ? 'solved' : ''} ${taken ? 'taken' : ''}" data-obj="${o.id}" ${isGM() ? 'disabled' : ''}
      title="${taken ? `${esc(by.name)}에게 무엇을 봤는지 물어보세요` : ''}">
      <span class="icon">${pix(o.icon, 40)}</span><span>${esc(o.name)}</span>${label}
    </button>`;
  }).join('');
  $('#exits').innerHTML = r.exits.map((x) => `
    <button class="exit ${x.open ? '' : 'locked'}" data-room="${x.to}" ${isGM() ? 'disabled' : ''}>
      ${x.open ? '▶' : pix('padlock', 12)} ${esc(x.name || '???')}</button>`).join('');
}

// 가운데 창: 지금 구역에서 나온 설명문(나레이션·결과)을 최근 것부터 보여 준다
function renderRoomLog() {
  const r = currentRoom();
  const box = $('#room-log');
  const items = r ? log.filter((m) => !m.global && m.room === r.id && (m.type === 'narr' || m.type === 'sys')).slice(-4) : [];
  box.hidden = !items.length;
  box.innerHTML = items.map((m, i) => `<p class="${m.type} ${i === items.length - 1 ? 'latest' : ''}">${m.icon ? pix(m.icon, 14) : ''}${esc(m.text)}</p>`).join('');
}

function renderChannels() {
  const nav = $('#channels');
  if (!isGM()) {
    const ids = myIds();
    const me = myChar();
    nav.innerHTML = ids.length > 1
      ? `<span class="ear">${pix('pin', 12)} 내 캐릭터 ${ids.length}명에게 들리는 소리</span>`
      : `<span class="ear">${pix('pin', 12)} ${esc(me?.roomName)} — ${esc(me?.name)}에게 들리는 소리</span>`;
    nav.insertAdjacentHTML('beforeend', SAVE_LOG_BUTTON);
    return;
  }
  const occupied = view.map.rooms.filter((r) => r.tokens.length);
  nav.innerHTML = `<button data-ch="" class="${gmRoom ? '' : 'on'}">${pix('monitor', 12)}전체</button>` +
    occupied.map((r) => `<button data-ch="${r.id}" class="${gmRoom === r.id ? 'on' : ''}">${esc(r.name)} <small>${r.tokens.length}</small></button>`).join('') +
    SAVE_LOG_BUTTON;
}
const SAVE_LOG_BUTTON = '<button type="button" class="save-log" data-savelog title="지금까지 내 캐릭터가 본 로그를 HTML 파일로 저장 (게임이 끝나면 모든 사람의 로그가 저장돼요)">로그 저장</button>';
$('#channels').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ch]');
  if (!b) return;
  selectGmRoom(b.dataset.ch || null);
});
function selectGmRoom(id) {
  gmRoom = id;
  renderMap();
  renderRoom();
  renderRoomLog();
  renderChannels();
  renderInput();
  renderLog();
}

// 진행자는 고른 구역의 메시지만 걸러 볼 수 있다
function gmShows(m) {
  if (!isGM() || !gmRoom) return true;
  return m.global || m.room === gmRoom;
}

function renderInput() {
  const mode = $('#rp-mode').value || (isGM() ? 'narr' : 'say');
  if (isGM()) {
    const target = gmRoom ? view.rooms[gmRoom].name : '전체';
    $('#rp-who').innerHTML = `${pix('book', 16)} 진행자 나레이션 → <b>${esc(target)}</b>`;
  } else {
    const me = myChar();
    const more = myIds().length > 1 ? ' <span class="muted small">(왼쪽 목록에서 바꾸기)</span>' : '';
    $('#rp-who').innerHTML = `${avatar(me, 'sm')} <b style="color:${esc(me.color)}">${esc(me.name)}</b> <span class="muted">@ ${esc(me.roomName)}</span>${more}`;
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
  // 내 캐릭터가 여럿이면 누가 들었는지 작게 표시한다
  const ear = !isGM() && myIds().length > 1 && m.by && !m.global ? `<span class="heard-by">${esc(castById(m.by).name)}</span>` : '';
  let html;
  if (m.type === 'muffled') {
    html = `<div class="msg muffled"><span class="from">${pix('door', 14, MUFFLED)} ${esc(m.from ? `${m.from} 쪽` : '어딘가')}에서 웅얼거리는 소리 ${ear}</span><p>${esc(m.text)}</p></div>`;
  } else if (m.type === 'npc') {
    const from = m.away ? `<span class="from">${esc(m.away)}에서</span>` : '';
    html = `<div class="msg npc"><span class="avatar sm npc">${pix('speaker', 24)}</span><div>${tag}<b>${esc(m.speaker)}</b>${from}${ear}<p>${esc(m.text)}</p></div></div>`;
  } else if (m.type === 'say' && m.charId) {
    const c = castById(m.charId);
    const vol = m.vol === 'shout' ? ' shout' : m.vol === 'whisper' ? ' whisper' : '';
    const from = m.away ? `<span class="from">${esc(m.away)}에서</span>` : '';
    html = `<div class="msg say${vol}">${avatar(c, 'sm')}<div>${tag}<b style="color:${esc(c.color)}">${esc(c.name)}</b>${from}<p>${esc(m.text)}</p></div></div>`;
  } else if (m.type === 'act' && m.charId) {
    html = `<div class="msg act">${tag}<i>* ${esc(josa(castById(m.charId).name, '이', '가'))} ${esc(m.text)}</i></div>`;
  } else {
    html = `<div class="msg ${esc(m.type)}">${tag}${icon}${esc(m.text)}${ear}</div>`;
  }
  el.insertAdjacentHTML('beforeend', html);
  el.scrollTop = el.scrollHeight;
}

/* ---------------- HTML 로그 백업 ----------------
   게임 채팅처럼 보이는 HTML 파일 하나로 저장한다. 프사·전신 그림·도트 아이콘을 파일 안에 넣어서
   인터넷 없이 열어도 그대로 보인다. */
function logFileName() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  return `${view.scenario.title.replace(/[\\/:*?"<>|]/g, '')}_역극로그_${stamp}`;
}
async function toDataUrl(url) {
  if (!url || url.startsWith('data:')) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
// 게임이 끝났으면 모든 사람의 기록을 받아 온다. 진행 중에는 내가 본 것만.
let fullLogWait = null;
function exportLog() {
  if (view.phase !== 'ended' && !isGM()) return Promise.resolve({ msgs: log, full: false });
  return new Promise((resolve) => {
    const done = (msgs) => { clearTimeout(timer); fullLogWait = null; resolve(msgs ? { msgs, full: true } : { msgs: log, full: false }); };
    const timer = setTimeout(() => done(null), 5000);
    fullLogWait = done;
    send({ t: 'fullLog' });
  });
}
const onlyTag = (m) => (m.only && castById(m.only) ? `${castById(m.only).name}만 봄` : '');
let savingLog = false;
async function saveHtmlLog() {
  if (!view || savingLog) return;
  savingLog = true;
  toast('로그를 만드는 중이에요…');
  try {
    // 그림을 파일 안에 넣기 위해 미리 받아 둔다
    const art = {};
    await Promise.all(view.cast.map(async (c) => {
      art[c.id] = { a: await toDataUrl(imgUrl(c, 'a') || c.image), b: await toDataUrl(imgUrl(c, 'b')) };
    }));
    const { msgs, full } = await exportLog();
    download(`${logFileName()}.html`, buildHtmlLog(art, msgs, full), 'text/html');
    toast(full ? '모든 사람의 로그를 HTML로 저장했어요.' : '내 캐릭터가 본 로그를 저장했어요. 게임이 끝나면 모든 사람의 로그를 저장할 수 있어요.');
  } finally {
    savingLog = false;
  }
}
function buildHtmlLog(art, msgs = log, full = false) {
  const face = (c, cls = '') => {
    const src = art[c.id]?.a;
    const inner = src ? `<img src="${src}" alt="">` : spriteSvg(c.sprite, c.color, 40);
    return `<span class="av ${cls}" style="--c:${esc(c.color)}">${inner}</span>`;
  };
  const who = (id) => castById(id);
  const roomNames = Object.fromEntries((view.map?.rooms || []).filter((r) => r.name).map((r) => [r.id, r.name]));
  for (const [id, r] of Object.entries(view.rooms || {})) roomNames[id] = r.name;
  const place = (m) => m.tag || (m.room && roomNames[m.room]) || '';
  const viewer = full ? '모든 사람의 기록 (모든 구역)' : isGM() ? '진행자 시점 (모든 구역)' : `${myIds().map((id) => who(id).name).join(', ')} 시점`;
  const result = view.phase === 'ended'
    ? (view.result === 'escape' ? `탈출 성공 · 소요 시간 ${fmt(view.time.elapsed)}` : `탈출 실패${view.endText ? ` — ${view.endText}` : ''}`)
    : `진행 중 · 흐른 시간 ${fmt(view.time.elapsed)}`;

  let lastPlace = '';
  const rows = msgs.map((m) => {
    const where = place(m);
    // 장소가 바뀌면 구분선을 넣는다 (전체 메시지는 그대로)
    let sep = '';
    if (where && where !== lastPlace && !m.global && m.type !== 'muffled') {
      sep = `<div class="place">${pix('pin', 12)} ${esc(where)}</div>`;
      lastPlace = where;
    }
    const by = full ? (onlyTag(m) ? `<span class="by">${esc(onlyTag(m))}</span>` : '')
      : !isGM() && myIds().length > 1 && m.by && !m.global ? `<span class="by">${esc(who(m.by).name)}</span>` : '';
    let body;
    if (m.type === 'muffled') {
      body = `<div class="m muffled"><span class="from">${pix('door', 14, MUFFLED)} ${esc(m.from ? `${m.from} 쪽` : '어딘가')}에서 웅얼거리는 소리 ${by}</span><p>${esc(m.text)}</p></div>`;
    } else if (m.type === 'npc') {
      body = `<div class="m say npc"><span class="av npc">${pix('speaker', 24)}</span><div><b>${esc(m.speaker)}</b>${m.away ? `<span class="from">${esc(m.away)}에서</span>` : ''}${by}<p>${esc(m.text)}</p></div></div>`;
    } else if (m.type === 'say' && m.charId) {
      const c = who(m.charId);
      const vol = m.vol === 'shout' ? ' shout' : m.vol === 'whisper' ? ' whisper' : '';
      const volTag = m.vol === 'shout' ? '<span class="vol">외침</span>' : m.vol === 'whisper' ? '<span class="vol">속삭임</span>' : '';
      body = `<div class="m say${vol}">${face(c)}<div><b style="color:${esc(c.color)}">${esc(c.name)}</b>${volTag}${m.away ? `<span class="from">${esc(m.away)}에서</span>` : ''}<p>${esc(m.text)}</p></div></div>`;
    } else if (m.type === 'act' && m.charId) {
      body = `<div class="m act">* ${esc(josa(who(m.charId).name, '이', '가'))} ${esc(m.text)}</div>`;
    } else {
      body = `<div class="m ${m.type === 'sys' ? 'sys' : 'narr'}">${m.icon ? pix(m.icon, 16) : ''}<span>${esc(m.text)}</span>${by}</div>`;
    }
    return sep + body;
  }).join('\n');

  const castCards = view.cast.map((c) => `
    <figure class="card ${c.gone ? 'gone' : ''}">
      ${art[c.id]?.b ? `<img class="body" src="${art[c.id].b}" alt="">` : face(c, 'big')}
      <figcaption><b style="color:${esc(c.color)}">${esc(c.name)}</b><small>${esc([c.skill && c.skill !== 'none' ? SKILLS[c.skill]?.label : '', c.intro].filter(Boolean).join(' · '))}</small></figcaption>
    </figure>`).join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(view.scenario.title)} — 역극 로그</title>
<style>
  :root { --bg:#131512; --panel:#1d201b; --panel2:#272b24; --line:#43493f; --text:#e2dbc5; --dim:#bdb7a1; --muted:#94968a; --accent:#c4ae4c; --danger:#a3362b; --blood:#6e221c; --shadow:#030303; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: "Galmuri11", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif; line-height: 1.65; }
  svg { image-rendering: pixelated; vertical-align: -3px; flex: none; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 28px 16px 60px; }
  header { border: 3px solid #615a4a; background: var(--panel); padding: 18px 20px; margin-bottom: 22px; box-shadow: 6px 6px 0 var(--shadow); }
  header h1 { margin: 0 0 6px; font-size: 22px; color: var(--text); text-shadow: 2px 0 0 var(--blood); }
  header p { margin: 2px 0; color: var(--dim); font-size: 13px; }
  .cast { display: flex; flex-wrap: wrap; gap: 14px; margin: 16px 0 0; }
  .card { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 110px; text-align: center; }
  .card.gone { opacity: .4; }
  .card .body { height: 110px; width: auto; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.6)); }
  .card figcaption { display: flex; flex-direction: column; font-size: 12px; }
  .card small { color: var(--muted); font-size: 11px; }
  .log { display: flex; flex-direction: column; gap: 10px; font-size: 15px; }
  .place { margin-top: 10px; font-size: 12px; color: var(--accent); border-bottom: 1px dashed var(--line); padding-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .m.narr { color: var(--dim); display: flex; gap: 6px; }
  .m.sys { color: var(--accent); font-size: 13px; text-align: center; display: flex; gap: 6px; justify-content: center; align-items: center; }
  .m.act { color: var(--muted); font-style: italic; }
  .m.say { display: flex; gap: 10px; align-items: flex-start; }
  .m.say b { font-size: 13px; }
  .m.say p { margin: 4px 0 0; padding: 7px 11px; background: var(--panel2); box-shadow: 0 0 0 2px var(--shadow), 3px 3px 0 2px var(--shadow); white-space: pre-wrap; }
  .m.say.shout p { font-weight: 700; color: #f0cfc3; background: #2a1513; box-shadow: 0 0 0 2px var(--danger), 3px 3px 0 2px var(--shadow); }
  .m.say.whisper p { opacity: .7; background: transparent; box-shadow: 0 0 0 1px var(--line); }
  .m.npc b { color: #d0574a; }
  .m.npc p { font-style: italic; color: #d8c6b4; background: #1c1412; box-shadow: 0 0 0 2px var(--blood), 3px 3px 0 2px var(--shadow); }
  .m.muffled { color: var(--muted); padding: 6px 10px; border: 2px dashed var(--line); }
  .m.muffled p { margin: 2px 0 0; letter-spacing: .08em; }
  .from, .vol { font-size: 11px; color: var(--muted); margin-left: 6px; }
  .vol { color: var(--accent); }
  .by { font-size: 10px; color: var(--shadow); background: var(--dim); padding: 0 4px; margin-left: 6px; font-style: normal; }
  .av { --c:#888; flex: none; width: 36px; height: 36px; display: grid; place-items: center; overflow: hidden; background: color-mix(in srgb, var(--c) 18%, var(--shadow)); box-shadow: 0 0 0 2px var(--shadow), 0 0 0 4px color-mix(in srgb, var(--c) 55%, var(--shadow)); margin: 4px; }
  .av img, .av svg { width: 100%; height: 100%; object-fit: cover; }
  .av.big { width: 72px; height: 72px; }
  .av.npc { --c: #6e221c; background: #120c0b; }
  footer { margin-top: 40px; color: var(--muted); font-size: 11px; text-align: center; }
  .memo { margin-top: 28px; background: #b3a682; color: #17120d; padding: 12px 16px; box-shadow: 4px 4px 0 var(--shadow); }
  .memo h2 { margin: 0 0 6px; font-size: 14px; }
  .memo pre { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 14px; }
  .truth { margin-top: 28px; border: 3px solid #615a4a; background: var(--panel); padding: 16px 20px; box-shadow: 6px 6px 0 var(--shadow); }
  .truth h2, .truth summary { margin: 0 0 8px; font-size: 16px; color: var(--accent); cursor: pointer; }
  .truth p { color: var(--dim); margin: 0 0 10px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(view.scenario.title)}</h1>
    <p>${esc(result)}</p>
    <p>${esc(viewer)} · 저장한 때 ${esc(new Date().toLocaleString('ko-KR'))}</p>
    <div class="cast">${castCards}</div>
  </header>
  <main class="log">
${rows}
  </main>
  ${truthHtml()}
  ${memoText().trim() ? `<section class="memo"><h2>내 메모</h2><pre>${esc(memoText())}</pre></section>` : ''}
  <footer>THE GREAT ESCAPE — 자캐 역극 탈출 게임 로그</footer>
</div>
</body>
</html>
`;
}

// 진상: 탈출했으면 그대로, 실패했으면 접어 둔다
function truthHtml() {
  const lines = view.epilogue || [];
  if (!lines.length) return '';
  const body = lines.map((t) => `<p>${esc(t)}</p>`).join('');
  return view.result === 'escape'
    ? `<section class="truth"><h2>진상</h2>${body}</section>`
    : `<details class="truth"><summary>진상 보기 (스포 주의)</summary>${body}</details>`;
}
function logAsText(msgs = log, full = false) {
  const who = full ? '모든 사람의 기록' : isGM() ? '진행자 시점' : `${myIds().map((id) => castById(id).name).join(', ')} 시점`;
  const lines = [view.scenario.title, `출연: ${view.cast.map((c) => c.name).join(', ')}`, `(${who})`, ''];
  for (const m of msgs) {
    const where = (m.tag ? `[${m.tag}] ` : '') + (full && onlyTag(m) ? `(${onlyTag(m)}) ` : '');
    const c = m.charId && castById(m.charId);
    if (m.type === 'muffled') lines.push(`(${m.from || '어딘가'}에서 웅얼거리는 소리) ${m.text}`);
    else if (m.type === 'npc') lines.push(`${where}${m.speaker}: "${m.text}"`);
    else if (m.type === 'say' && c) lines.push(`${where}${c.name}${m.vol === 'shout' ? '(외침)' : m.vol === 'whisper' ? '(속삭임)' : ''}: "${m.text}"`);
    else if (m.type === 'act' && c) lines.push(`${where}* ${josa(c.name, '이', '가')} ${m.text}`);
    else if (m.type === 'sys') lines.push(`${where}<${m.text}>`);
    else lines.push(`${where}${m.text}`);
  }
  if (view.result === 'escape' && view.epilogue?.length) lines.push('', '[진상]', ...view.epilogue);
  return lines.join('\n');
}

/* ---------------- 조작 ---------------- */
document.querySelector('#screen-game').addEventListener('click', (e) => {
  if (!view || view.phase !== 'play') return;
  const give = e.target.closest('[data-give]');
  if (give) return openGive(give.dataset.give, give.dataset.from);
  const sw = e.target.closest('[data-switch]');
  if (sw && !isGM()) return switchChar(sw.dataset.switch);
  const r = e.target.closest('[data-room]');
  if (r) {
    if (isGM()) return selectGmRoom(r.dataset.room);
    return send({ t: 'move', as: activeChar, to: r.dataset.room });
  }
  const o = e.target.closest('[data-obj]');
  if (o && !isGM()) send({ t: 'interact', as: activeChar, obj: o.dataset.obj });
});

$('#rp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#rp-text').value.trim();
  if (!text || view?.phase !== 'play') return;
  if (isGM()) send({ t: 'narr', room: gmRoom, text });
  else send({ t: 'say', as: activeChar, mode: $('#rp-mode').value, text });
  $('#rp-text').value = '';
});

$('#btn-hint').addEventListener('click', () => {
  if (view?.phase !== 'play') return;
  if (isGM()) return send({ t: 'hint' });
  const h = view.hint;
  if (h.mine) return toast('이미 찬성했어요. 다른 사람의 찬성을 기다리는 중이에요.');
  const cost = h.cost ? `, 모두의 시간이 ${h.cost / 60}분 줄어요` : '';
  const ask = h.need > 1
    ? `힌트는 과반수(${h.need}명)가 찬성하면 나와요${cost}. 찬성할까요?`
    : `힌트를 볼까요?${h.cost ? ` 남은 시간이 ${h.cost / 60}분 줄어요.` : ''}`;
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

/* 아이템 건네기: 같은 구역에 있는 다른 멤버(내 다른 캐릭터 포함)에게 */
const giveDlg = $('#give-dialog');
function openGive(itemId, fromId) {
  const from = castById(fromId || activeChar);
  const it = from.items?.find((x) => x.id === itemId);
  if (!it) return;
  const mates = view.cast.filter((c) => c.id !== from.id && !c.gone && c.room && c.room === from.room);
  $('#give-title').innerHTML = `${pix(it.icon, 20)} ${esc(from.name)} — ${esc(josa(it.name, '을', '를'))} 누구에게 건넬까?`;
  $('#give-targets').innerHTML = mates.length
    ? mates.map((m) => `<button value="${m.id}" data-to="${m.id}">${avatar(m, 'sm')} ${esc(m.name)}</button>`).join('')
    : '<p class="muted">같은 구역에 있는 멤버가 없다. 같은 구역에 있어야 건넬 수 있다.</p>';
  $('#give-targets').onclick = (e) => {
    const b = e.target.closest('[data-to]');
    if (!b) return;
    send({ t: 'give', as: from.id, item: itemId, to: b.dataset.to });
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
  if (value) send({ t: 'guess', as: lockObj.as, obj: lockObj.id, value });
});
$('#lock-force').addEventListener('click', () => {
  lockDlg.close();
  send({ t: 'force', as: lockObj.as, obj: lockObj.id });
});

/* ---------------- 메모장 ----------------
   나만 보는 메모. 방마다 따로 이 기기에 저장한다. 머리 부분을 끌어서 옮긴다. */
const memoBox = $('#memo');
const memoKey = () => `tge.memo.${view?.code || 'none'}`;
function memoText() {
  try { return localStorage.getItem(memoKey()) || ''; } catch { return ''; }
}
function toggleMemo(on = memoBox.hidden) {
  memoBox.hidden = !on;
  $('#btn-memo').classList.toggle('on', on);
  if (!on) return;
  $('#memo-text').value = memoText();
  try {
    const pos = JSON.parse(localStorage.getItem('tge.memo.pos'));
    if (pos) placeMemo(pos.x, pos.y);
  } catch { /* 저장 불가 */ }
  $('#memo-text').focus();
}
function placeMemo(x, y) {
  const r = memoBox.getBoundingClientRect();
  const nx = Math.max(0, Math.min(window.innerWidth - Math.min(r.width, 120), x));
  const ny = Math.max(0, Math.min(window.innerHeight - 40, y));
  Object.assign(memoBox.style, { left: `${nx}px`, top: `${ny}px`, right: 'auto' });
  return { x: nx, y: ny };
}
$('#btn-memo').addEventListener('click', () => toggleMemo());
$('#memo-close').addEventListener('click', () => toggleMemo(false));
$('#memo-text').addEventListener('input', (e) => {
  try { localStorage.setItem(memoKey(), e.target.value); } catch { /* 저장 불가 */ }
});
let memoDrag = null;
$('#memo-head').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const r = memoBox.getBoundingClientRect();
  memoDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  e.currentTarget.setPointerCapture(e.pointerId);
});
$('#memo-head').addEventListener('pointermove', (e) => {
  if (memoDrag) placeMemo(e.clientX - memoDrag.dx, e.clientY - memoDrag.dy);
});
$('#memo-head').addEventListener('pointerup', (e) => {
  if (!memoDrag) return;
  memoDrag = null;
  const pos = placeMemo(e.clientX - (e.clientX - memoBox.getBoundingClientRect().left), memoBox.getBoundingClientRect().top);
  try { localStorage.setItem('tge.memo.pos', JSON.stringify(pos)); } catch { /* 저장 불가 */ }
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
  $('#ending-text').textContent = success
    ? `소요 시간 ${fmt(view.time.elapsed)} — ${view.scenario.title} 클리어`
    : `${view.endText || ''} 다음 화에서는 꼭 나갈 수 있을 거야.`.trim();
  $('#ending-team').innerHTML = view.cast.map((c) => {
    const body = imgUrl(c, 'b');
    return `<div>${body ? `<img class="ending-body" src="${esc(body)}" alt="">` : avatar(c, 'lg')}<span>${esc(c.name)}</span></div>`;
  }).join('');
  renderTruth(success);
  show('ending');
}
// 탈출하면 진상을 바로 보여 주고, 실패하면 다시 도전할 수 있게 버튼을 눌러야 보인다
function renderTruth(open) {
  const lines = view.epilogue || [];
  $('#truth-text').innerHTML = lines.map((t, i) => `<p style="animation-delay:${(i * 0.6).toFixed(1)}s">${esc(t)}</p>`).join('');
  $('#ending-truth').hidden = !lines.length || !open;
  $('#btn-truth').hidden = !lines.length || open;
}
$('#btn-truth').addEventListener('click', () => renderTruth(true));
$('#btn-save-log').addEventListener('click', () => saveHtmlLog());
$('#btn-save-txt').addEventListener('click', async () => {
  const { msgs, full } = await exportLog();
  download(`${logFileName()}.txt`, logAsText(msgs, full));
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-savelog]')) saveHtmlLog(); });
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
