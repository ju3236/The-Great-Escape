// 효과음과 배경음. 파일 없이 브라우저 신시사이저(Web Audio)로 만든다.
// 브라우저 정책상 사용자가 화면을 한 번 누른 뒤부터 소리가 난다.
const Sound = (() => {
  const KEY = 'tge.sound';
  const LEVELS = { high: 0.9, low: 0.4, off: 0 };
  const LABEL = { high: '소리 크게', low: '소리 작게', off: '소리 끔' };
  const NEXT = { high: 'low', low: 'off', off: 'high' };
  let level = 'high';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'off') level = 'off';
    else if (LEVELS[saved] !== undefined) level = saved;
  } catch { /* 저장 불가 */ }
  let ctx = null;
  let master = null;
  let bgm = null;
  let wantBgm = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = LEVELS[level];
      // 소리가 겹쳐도 찢어지지 않게 한 번 눌러 준다
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (wantBgm && !bgm) startBgm();
    return ctx;
  }
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('keydown', ensure);

  function tone({ freq, type = 'square', dur = 0.15, vol = 0.15, slide = 0, delay = 0, out }) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out || master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  let noiseBuf = null;
  function noiseBuffer() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noise({ dur = 0.2, vol = 0.1, freq = 1200, q = 1, delay = 0, out }) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out || master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    unlock: () => { tone({ freq: 900, dur: 0.06, vol: 0.2 }); tone({ freq: 1350, dur: 0.12, delay: 0.07, vol: 0.18 }); },
    item: () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, delay: i * 0.08, vol: 0.22 })),
    solve: () => tone({ freq: 520, type: 'triangle', dur: 0.3, vol: 0.2, slide: 260 }),
    wrong: () => { tone({ freq: 140, type: 'sawtooth', dur: 0.45, vol: 0.2 }); tone({ freq: 104, type: 'sawtooth', dur: 0.45, delay: 0.05, vol: 0.18 }); },
    voice: () => { noise({ dur: 0.6, vol: 0.12, freq: 2400, q: 0.8 }); tone({ freq: 60, type: 'sine', dur: 0.5, vol: 0.12 }); },
    step: () => { noise({ dur: 0.08, vol: 0.18, freq: 260, q: 1.5 }); noise({ dur: 0.08, vol: 0.15, freq: 240, q: 1.5, delay: 0.22 }); },
    hint: () => { tone({ freq: 990, type: 'sine', dur: 0.4, vol: 0.16, slide: 120 }); tone({ freq: 1485, type: 'sine', dur: 0.4, vol: 0.08, delay: 0.1 }); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.45, delay: i * 0.16, vol: 0.2 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.6, delay: i * 0.3, vol: 0.14 })),
    flicker: () => [0, 0.12, 0.2, 0.45, 0.55].forEach((d) => { noise({ dur: 0.07, vol: 0.2, freq: 180, q: 3, delay: d }); tone({ freq: 120, type: 'square', dur: 0.06, vol: 0.06, delay: d }); }),
    blackout: () => { tone({ freq: 260, type: 'sawtooth', dur: 1.6, vol: 0.18, slide: -220 }); noise({ dur: 0.4, vol: 0.2, freq: 120, q: 2 }); },
    alarm: () => [0, 0.5, 1, 1.5].forEach((d, i) => tone({ freq: i % 2 ? 660 : 880, type: 'square', dur: 0.45, delay: d, vol: 0.1 })),
    // 채팅: 누가 또렷하게 말하면 짧은 알림음, 벽 너머 웅얼거림은 낮고 탁한 소리
    talk: () => tone({ freq: 1180, type: 'triangle', dur: 0.07, vol: 0.09 }),
    murmur: () => noise({ dur: 0.35, vol: 0.1, freq: 320, q: 2 }),
    test: () => [523, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.2, delay: i * 0.1, vol: 0.2 })),
  };

  /* 배경음: 일반 스피커로도 들리는 음역의 어두운 화음 + 바람 + 가끔 들리는 주변 소리 */
  function startBgm() {
    if (!ctx || bgm) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    out.connect(master);
    const nodes = [];
    const keep = (n) => { nodes.push(n); return n; };

    // 화음: 단조 느낌의 낮은 톱니파를 걸러서 부드럽게
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 700;
    padFilter.Q.value = 3;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padFilter.connect(padGain).connect(out);
    for (const f of [110, 110.8, 130.8, 164.8]) {
      const o = keep(ctx.createOscillator());
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(padFilter);
      o.start();
    }
    const cutLfo = keep(ctx.createOscillator());
    cutLfo.frequency.value = 0.05;
    const cutDepth = ctx.createGain();
    cutDepth.gain.value = 350;
    cutLfo.connect(cutDepth).connect(padFilter.frequency);
    cutLfo.start();

    // 바람
    const wind = keep(ctx.createBufferSource());
    wind.buffer = noiseBuffer();
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.06;
    const lfo = keep(ctx.createOscillator());
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(wg.gain);
    wind.connect(bp).connect(wg).connect(out);
    wind.start();
    lfo.start();

    // 가끔: 물방울 / 먼 쇳소리 / 삐걱임
    const ambience = [
      () => tone({ freq: 1400, type: 'sine', dur: 0.25, vol: 0.12, slide: -700, out }),
      () => { noise({ dur: 0.5, vol: 0.12, freq: 900, q: 8, out }); tone({ freq: 220, type: 'triangle', dur: 0.9, vol: 0.06, out }); },
      () => tone({ freq: 180, type: 'sawtooth', dur: 1.2, vol: 0.05, slide: 60, out }),
    ];
    let timer = null;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!bgm) return;
        ambience[Math.floor(Math.random() * ambience.length)]();
        schedule();
      }, 7000 + Math.random() * 13000);
    };
    schedule();
    bgm = { out, nodes, stop: () => clearTimeout(timer) };
  }
  function stopBgm() {
    if (!bgm) return;
    const { out, nodes, stop } = bgm;
    bgm = null;
    stop();
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* 이미 멈춤 */ } }), 1200);
  }

  return {
    play(name) { if (level !== 'off' && SFX[name]) SFX[name](); },
    bgm(on) {
      wantBgm = on;
      if (on && ctx) startBgm();
      if (!on) stopBgm();
    },
    get enabled() { return level !== 'off'; },
    get label() { return LABEL[level]; },
    // 크게 → 작게 → 끔 → 크게 순서로 바꾼다
    toggle() {
      level = NEXT[level];
      try { localStorage.setItem(KEY, level); } catch { /* 저장 불가 */ }
      if (ensure()) master.gain.value = LEVELS[level];
      if (level !== 'off') SFX.test();
      return level;
    },
  };
})();
