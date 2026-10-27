// 캐릭터 그림 손질: 흰 배경 지우기, 여백 자르기, 크기 줄이기, 프사 자르기
const ImageTool = (() => {
  const BODY_MAX = { w: 240, h: 360 };
  const AVATAR_SIZE = 128;

  function loadSrc(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('그림을 읽을 수 없어요.'));
      img.src = src;
    });
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('파일을 읽을 수 없어요.'));
      r.readAsDataURL(file);
    });
  }

  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  // 가로세로 비율을 지키며 최대 크기 안으로 줄인다
  function fit(src, maxW, maxH) {
    const k = Math.min(1, maxW / src.width, maxH / src.height);
    const c = canvasOf(src.width * k, src.height * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  // 테두리에서 이어지는 흰색(에 가까운) 영역만 투명하게 만든다. 캐릭터 안쪽 흰색은 남는다.
  function removeWhite(canvas, tolerance = 32) {
    const { width: w, height: h } = canvas;
    const g = canvas.getContext('2d');
    const im = g.getImageData(0, 0, w, h);
    const d = im.data;
    const limit = 255 - tolerance;
    const isBg = (i) => d[i + 3] < 16 || (d[i] >= limit && d[i + 1] >= limit && d[i + 2] >= limit);
    const seen = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      if (!isBg(p * 4)) continue;
      d[p * 4 + 3] = 0;
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
    // 지운 영역과 맞닿은 밝은 테두리 픽셀은 반투명하게 (흰 테두리 줄이기)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const x = p % w;
      const touches = (x > 0 && d[i - 1] === 0) || (x < w - 1 && d[i + 7] === 0) ||
        (p >= w && d[i - w * 4 + 3] === 0) || (p < w * (h - 1) && d[i + w * 4 + 3] === 0);
      if (touches && d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 90;
    }
    g.putImageData(im, 0, 0);
    return canvas;
  }

  // 투명한 여백을 잘라 낸다
  function trim(canvas) {
    const { width: w, height: h } = canvas;
    const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return canvas;
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const c = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
    c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }

  // 네 귀퉁이가 거의 흰색이면 흰 배경 그림으로 본다
  function looksWhiteBg(canvas) {
    const { width: w, height: h } = canvas;
    const g = canvas.getContext('2d');
    return [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].every(([x, y]) => {
      const [r, gg, b, a] = g.getImageData(x, y, 1, 1).data;
      return a > 200 && r > 235 && gg > 235 && b > 235;
    });
  }

  function encode(canvas) {
    const webp = canvas.toDataURL('image/webp', 0.9);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  }

  // 전신 그림: 배경 지우기(선택) → 여백 자르기 → 크기 줄이기
  async function makeBody(src, { clearWhite }) {
    const img = await loadSrc(src);
    let c = fit(img, 720, 720);
    if (clearWhite) c = removeWhite(c);
    c = trim(c);
    return encode(fit(c, BODY_MAX.w, BODY_MAX.h));
  }

  /* ---------- 프사 자르기 ---------- */
  // view: 화면에 보이는 캔버스, crop: 그림 좌표의 정사각형 { x, y, size }
  function cropper(canvas, img, onChange) {
    const g = canvas.getContext('2d');
    const k = Math.min(canvas.width / img.width, canvas.height / img.height);
    const ox = (canvas.width - img.width * k) / 2;
    const oy = (canvas.height - img.height * k) / 2;
    const minSide = Math.min(img.width, img.height);
    // 처음에는 위쪽(머리 부분)을 잡는다
    const size0 = Math.min(img.width, img.height) * (img.height > img.width * 1.2 ? 0.95 : 0.8);
    const crop = { size: size0, x: (img.width - size0) / 2, y: img.height > img.width * 1.2 ? 0 : (img.height - size0) / 2 };

    function clamp() {
      crop.size = Math.max(minSide * 0.15, Math.min(minSide, crop.size));
      crop.x = Math.max(0, Math.min(img.width - crop.size, crop.x));
      crop.y = Math.max(0, Math.min(img.height - crop.size, crop.y));
    }
    function draw() {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, ox, oy, img.width * k, img.height * k);
      g.fillStyle = 'rgba(0,0,0,.6)';
      const sx = ox + crop.x * k, sy = oy + crop.y * k, ss = crop.size * k;
      g.fillRect(0, 0, canvas.width, sy);
      g.fillRect(0, sy + ss, canvas.width, canvas.height - sy - ss);
      g.fillRect(0, sy, sx, ss);
      g.fillRect(sx + ss, sy, canvas.width - sx - ss, ss);
      g.strokeStyle = '#c9b453';
      g.lineWidth = 3;
      g.strokeRect(sx, sy, ss, ss);
      onChange?.();
    }
    let drag = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };
    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      drag = { px: p.x, py: p.y, x: crop.x, y: crop.y };
    };
    canvas.onpointermove = (e) => {
      if (!drag) return;
      const p = pos(e);
      crop.x = drag.x + (p.x - drag.px) / k;
      crop.y = drag.y + (p.y - drag.py) / k;
      clamp();
      draw();
    };
    canvas.onpointerup = () => { drag = null; };
    canvas.onwheel = (e) => {
      e.preventDefault();
      setScale(crop.size / minSide * (e.deltaY > 0 ? 1.06 : 0.94));
    };
    function setScale(ratio) {
      const cx = crop.x + crop.size / 2, cy = crop.y + crop.size / 2;
      crop.size = minSide * ratio;
      crop.x = cx - crop.size / 2;
      crop.y = cy - crop.size / 2;
      clamp();
      draw();
    }
    clamp();
    draw();
    return {
      get ratio() { return crop.size / minSide; },
      setScale,
      result() {
        const c = canvasOf(AVATAR_SIZE, AVATAR_SIZE);
        const cg = c.getContext('2d');
        cg.imageSmoothingQuality = 'high';
        cg.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        return encode(c);
      },
    };
  }

  return { readFile, loadSrc, makeBody, looksWhiteBg, fit, cropper };
})();
