// 효과음과 배경음. 파일 없이 브라우저 신시사이저(Web Audio)로 만든다.
// 브라우저 정책상 사용자가 화면을 한 번 누른 뒤부터 소리가 난다.
const Sound = (() => {
  const KEY = 'tge.sound';
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* 저장 불가 */ }
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
      master.gain.value = enabled ? 0.5 : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (wantBgm && !bgm) startBgm();
    return ctx;
  }
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('keydown', ensure);

  function tone({ freq, type = 'square', dur = 0.15, vol = 0.15, slide = 0, delay = 0 }) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noise({ dur = 0.2, vol = 0.1, freq = 1200, q = 1, delay = 0 }) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const SFX = {
    unlock: () => { tone({ freq: 900, dur: 0.05, vol: 0.12 }); tone({ freq: 1350, dur: 0.09, delay: 0.06, vol: 0.1 }); },
    item: () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.14, delay: i * 0.08, vol: 0.13 })),
    solve: () => tone({ freq: 520, type: 'triangle', dur: 0.25, vol: 0.12, slide: 260 }),
    wrong: () => { tone({ freq: 140, type: 'sawtooth', dur: 0.4, vol: 0.14 }); tone({ freq: 105, type: 'sawtooth', dur: 0.4, delay: 0.04, vol: 0.12 }); },
    voice: () => noise({ dur: 0.5, vol: 0.08, freq: 2200, q: 0.7 }),
    step: () => { noise({ dur: 0.07, vol: 0.07, freq: 300 }); noise({ dur: 0.07, vol: 0.06, freq: 280, delay: 0.18 }); },
    hint: () => tone({ freq: 990, type: 'sine', dur: 0.35, vol: 0.1, slide: 120 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, delay: i * 0.16, vol: 0.13 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.5, delay: i * 0.28, vol: 0.1 })),
    flicker: () => [0, 0.12, 0.2, 0.45].forEach((d) => noise({ dur: 0.06, vol: 0.1, freq: 120, q: 4, delay: d })),
    blackout: () => { tone({ freq: 240, type: 'sawtooth', dur: 1.4, vol: 0.12, slide: -210 }); noise({ dur: 0.3, vol: 0.12, freq: 100, q: 2 }); },
    alarm: () => [0, 0.5, 1, 1.5].forEach((d, i) => tone({ freq: i % 2 ? 660 : 880, type: 'square', dur: 0.45, delay: d, vol: 0.07 })),
  };

  // 배경음: 낮게 깔리는 웅웅거림과 먼 바람 소리
  function startBgm() {
    if (!ctx || bgm) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);
    out.connect(master);
    const nodes = [];
    for (const f of [55, 55.6, 82.4]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(out);
      o.start();
      nodes.push(o);
    }
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(4);
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const wg = ctx.createGain();
    wg.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(wg.gain);
    wind.connect(lp).connect(wg).connect(out);
    wind.start();
    lfo.start();
    nodes.push(wind, lfo);
    bgm = { out, nodes };
  }
  function stopBgm() {
    if (!bgm) return;
    const { out, nodes } = bgm;
    bgm = null;
    out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* 이미 멈춤 */ } }), 1200);
  }

  return {
    play(name) { if (enabled && SFX[name]) SFX[name](); },
    bgm(on) {
      wantBgm = on;
      if (on && ctx) startBgm();
      if (!on) stopBgm();
    },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* 저장 불가 */ }
      if (ctx) master.gain.value = enabled ? 0.5 : 0;
      if (enabled) ensure();
      return enabled;
    },
  };
})();
