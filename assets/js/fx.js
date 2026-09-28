/* =====================================================================
   fx.js — the fun part: paintbrush cursor, wet-paint trail, splatters,
   palette dock, paint mode, reveals, magnetic buttons, tilt & more.
   ===================================================================== */
(function () {
  'use strict';
  const FX = window.FX = {};
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const PAINTS = ['#e2492f', '#f3a712', '#2f4cc0', '#1f8a70', '#e86a92', '#6b4fa0', '#1c1915'];
  let color = store.get('brushColor', null) || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || PAINTS[0];
  const lite = document.body && document.body.dataset.fx === 'lite';
  let trailOn = store.get('trailOn', true) && !reduce && !lite;
  FX.PAINTS = PAINTS;

  /* ------------------------------------------------------------ canvas layer */
  const cv = document.createElement('canvas'); cv.id = 'fx-trail'; cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  let DPR = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  function size() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function mountCanvas() { document.body.appendChild(cv); size(); }
  addEventListener('resize', () => { size(); if (paintCv) sizePaint(); });

  /* ------------------------------------------------------------ brush cursor */
  const cursor = document.createElement('div'); cursor.className = 'brush-cursor'; cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = `<div class="bc-inner"><svg width="58" height="58" viewBox="0 0 58 58" style="position:absolute;left:-3px;top:-55px;overflow:visible">
      <defs><linearGradient id="bch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2f25"/><stop offset=".5" stop-color="#1c1915"/><stop offset="1" stop-color="#0d0b09"/></linearGradient>
      <linearGradient id="bcf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d877c"/><stop offset=".45" stop-color="#eeebe4"/><stop offset="1" stop-color="#8d877c"/></linearGradient></defs>
      <path d="M22.5 33.5 50 5.2c1.5-1.5 3.9.9 2.4 2.4L25 35.9z" fill="url(#bch)"/>
      <path d="M49.5 6.2 26.8 29.6" stroke="#fff" stroke-opacity=".25" stroke-width="1" stroke-linecap="round"/>
      <path d="M15.6 40.4 22.5 33.5 25 35.9l-7 7z" fill="url(#bcf)" stroke="#5d584f" stroke-width=".6"/>
      <path class="bc-paint" d="M3 55c.7-4.4 3.3-10.4 7.4-14.6 1.7-1.8 3.8-1.6 5.2-.1l2.3 2.3c1.5 1.5 1.6 3.6-.1 5.3C13.6 52 7.4 54.5 3 55z" fill="${color}"/>
      <path d="M6.5 50.5c2-3 4.5-6.6 7.2-8.6" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    </svg></div><span class="bc-label"></span>`;
  const paintPath = () => cursor.querySelector('.bc-paint');
  let mx = -100, my = -100, cx = -100, cy = -100, rot = 0, lastMove = 0, vx = 0;
  function setColor(c, persist) {
    color = c; const p = paintPath(); if (p) p.setAttribute('fill', c);
    const dockBtn = $('.pd-main .pd-dab'); if (dockBtn) dockBtn.setAttribute('fill', c);
    $$('.pd-tray .blob').forEach(b => b.classList.toggle('is-active', b.dataset.c === c));
    if (persist) store.set('brushColor', c);
  }
  FX.setColor = setColor;

  /* ------------------------------------------------------------ trail + splats */
  let pts = [], splats = [], raf = 0, wSm = 4;
  const LIFE = 600, BR = [[-.35, .7, .45], [0, 1, .75], [.35, .7, .45]]; // thin, delicate brush line
  function loop() {
    raf = 0;
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    pts = pts.filter(p => now - p.t < LIFE);
    if (pts.length > 1) drawTrail(now);
    splats = splats.filter(s => now - s.t < s.life);
    splats.forEach(s => drawSplat(s, now));
    if (pts.length > 1 || splats.length) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function drawTrail(now) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let b = 0; b < BR.length; b++) {
      const [off, wf, af] = BR[b];
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i];
        const age = (now - p1.t) / LIFE; if (age >= 1) continue;
        if (p1.gap && ((i * 7 + b * 13) % 5 === 0) && age > .25) continue; // dry-brush breaks
        const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const w0 = p0.w * (1 - age * .55), w1 = p1.w * (1 - age * .55);
        ctx.globalAlpha = Math.max(0, Math.pow(1 - age, 2) * af);
        ctx.strokeStyle = p1.c; ctx.lineWidth = Math.max(.6, w1 * wf * .45);
        ctx.beginPath();
        ctx.moveTo(p0.x + nx * off * w0, p0.y + ny * off * w0);
        ctx.lineTo(p1.x + nx * off * w1, p1.y + ny * off * w1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function makeSplat(x, y, c, scale = 1) {
    const n = 14, blob = []; for (let i = 0; i < n; i++) blob.push(.75 + Math.random() * .5);
    const drops = []; const nd = 7 + Math.floor(Math.random() * 7);
    for (let i = 0; i < nd; i++) drops.push({ a: Math.random() * Math.PI * 2, d: (20 + Math.random() * 48) * scale, r: (1.4 + Math.random() * 3.6) * scale, s: Math.random() < .35 });
    return { x, y, c, t: performance.now(), life: 1100, r: (9 + Math.random() * 6) * scale, blob, drops, rot: Math.random() * 6 };
  }
  function drawSplat(s, now) {
    const age = (now - s.t) / s.life, grow = Math.min(1, (now - s.t) / 140), fly = 1 - Math.pow(1 - Math.min(1, (now - s.t) / 320), 3);
    const alpha = age < .55 ? .92 : .92 * (1 - (age - .55) / .45);
    ctx.globalAlpha = Math.max(0, alpha); ctx.fillStyle = s.c; ctx.strokeStyle = s.c;
    ctx.beginPath();
    const n = s.blob.length;
    for (let i = 0; i <= n; i++) { const a = s.rot + i / n * Math.PI * 2, r = s.r * s.blob[i % n] * (.4 + .6 * grow); const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    s.drops.forEach(d => {
      const x = s.x + Math.cos(d.a) * d.d * fly, y = s.y + Math.sin(d.a) * d.d * fly + (age > .3 ? (age - .3) * 10 : 0);
      if (d.s) { ctx.lineWidth = d.r * .9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(d.a) * s.r * .8, s.y + Math.sin(d.a) * s.r * .8); ctx.lineTo(x, y); ctx.globalAlpha = Math.max(0, alpha * .5); ctx.stroke(); ctx.globalAlpha = Math.max(0, alpha); }
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  FX.splat = (x, y, c, scale = 1) => { if (reduce) return; splats.push(makeSplat(x, y, c || color, scale)); kick(); };
  FX.splatEl = el => { const r = el.getBoundingClientRect(); FX.splat(r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(el).backgroundColor || color, 1.4); };
  FX.confetti = () => {
    if (reduce) return;
    for (let i = 0; i < 26; i++) setTimeout(() => { splats.push(Object.assign(makeSplat(Math.random() * W, Math.random() * H * .8, PAINTS[i % 6], .8 + Math.random() * 1.4), { life: 1600 })); kick(); }, i * 45);
  };
  FX.addTrailPoint = (x, y, c, w) => { pts.push({ x, y, t: performance.now(), w: w || 12, c: c || color, gap: true }); kick(); };

  /* ------------------------------------------------------------ pointer handling */
  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const now = performance.now();
    const dt = Math.max(1, now - lastMove); const dist = Math.hypot(e.clientX - mx, e.clientY - my);
    const speed = dist / dt;
    vx = vx * .8 + (e.clientX - mx) * .2;
    mx = e.clientX; my = e.clientY; lastMove = now;
    if (!cursor.classList.contains('visible')) { cursor.classList.add('visible'); cx = mx; cy = my; }
    if (painting) { paintStroke(mx, my, speed); return; }
    if (trailOn && dist > 1.5 && dist < 300) {
      const target = Math.max(2.5, Math.min(5, 5 - speed * .9));
      wSm += (target - wSm) * .3;
      pts.push({ x: mx, y: my, t: now, w: wSm, c: color, gap: speed > 1.2 });
      if (pts.length > 90) pts.shift();
      kick();
    } else if (dist >= 300) pts = [];
  }
  function cursorLoop() {
    cx += (mx - cx) * .55; cy += (my - cy) * .55;
    const target = Math.max(-28, Math.min(28, vx * 1.6));
    rot += (target - rot) * .12; vx *= .9;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${rot}deg)`;
    requestAnimationFrame(cursorLoop);
  }
  const HOVER_SEL = 'a, button, [role=button], label, summary, select, .opt-card, [data-cursor], .swatch, [data-tilt]';
  function onOver(e) {
    const t = e.target;
    const txt = t.closest && t.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, [contenteditable], iframe');
    cursor.classList.toggle('text-mode', !!txt);
    const h = t.closest && t.closest(HOVER_SEL);
    cursor.classList.toggle('hover', !!h);
    const lab = t.closest && t.closest('[data-cursor-label]');
    cursor.classList.toggle('has-label', !!lab);
    if (lab) cursor.querySelector('.bc-label').textContent = lab.dataset.cursorLabel;
    const card = t.closest && t.closest('[data-accent]');
    if (card && card.dataset.accent && card.dataset.accent !== color) setColor(card.dataset.accent); // dip the brush into the painting
  }
  function onDown(e) {
    cursor.classList.add('down');
    if (painting) return;
    const onBtn = e.target.closest && e.target.closest('.btn, button, a');
    if (!reduce) {
      let c = color;
      if (onBtn && onBtn.classList.contains('btn')) { const bg = getComputedStyle(onBtn).getPropertyValue('--fill').trim(); if (bg && !bg.startsWith('var')) c = bg; }
      if (e.pointerType === 'mouse' || onBtn) FX.splat(e.clientX, e.clientY, c, onBtn ? 1.15 : .8);
    }
  }
  function onUp() { cursor.classList.remove('down'); if (painting) lastPaint = null; }

  /* ------------------------------------------------------------ paint mode (doodle on the page) */
  let painting = false, paintCv = null, pctx = null, lastPaint = null, paintDown = false;
  function sizePaint() { const img = paintCv.width ? pctx.getImageData(0, 0, paintCv.width, paintCv.height) : null; paintCv.width = W * DPR; paintCv.height = H * DPR; pctx.setTransform(DPR, 0, 0, DPR, 0, 0); if (img) pctx.putImageData(img, 0, 0); }
  function paintStroke(x, y, speed) {
    if (!paintDown) return;
    const w = Math.max(5, Math.min(22, 22 - speed * 4));
    if (lastPaint) {
      const dx = x - lastPaint.x, dy = y - lastPaint.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      pctx.lineCap = 'round'; pctx.strokeStyle = color;
      for (let b = 0; b < 9; b++) {
        const off = (b / 8 - .5) * w, jitter = (Math.random() - .5) * 1.4;
        if (Math.random() < .08) continue;
        pctx.globalAlpha = .55 + Math.random() * .4; pctx.lineWidth = w / 9 * (1 + Math.random() * 1.6);
        pctx.beginPath(); pctx.moveTo(lastPaint.x + nx * (off + jitter), lastPaint.y + ny * (off + jitter)); pctx.lineTo(x + nx * off, y + ny * off); pctx.stroke();
      }
      pctx.globalAlpha = 1;
    }
    lastPaint = { x, y };
  }
  function togglePaint(on) {
    painting = on;
    if (on && !paintCv) {
      paintCv = document.createElement('canvas'); paintCv.id = 'fx-paint';
      Object.assign(paintCv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 9989, touchAction: 'none' });
      pctx = paintCv.getContext('2d'); document.body.appendChild(paintCv); sizePaint();
      paintCv.addEventListener('pointerdown', e => { paintDown = true; lastPaint = { x: e.clientX, y: e.clientY }; paintCv.setPointerCapture(e.pointerId); });
      paintCv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') { mx = e.clientX; my = e.clientY; paintStroke(e.clientX, e.clientY, 0.5); } });
      paintCv.addEventListener('pointerup', () => { paintDown = false; lastPaint = null; });
    }
    if (paintCv) paintCv.style.pointerEvents = on ? 'auto' : 'none';
    let bar = $('.paint-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'paint-bar';
      bar.innerHTML = `<span>🎨 Paint mode — drag anywhere to paint</span><button data-pm="save">Save PNG</button><button data-pm="clear">Clear</button><button data-pm="done">Done</button>`;
      document.body.appendChild(bar);
      bar.addEventListener('click', e => {
        const a = e.target.dataset.pm; if (!a) return;
        if (a === 'clear') pctx.clearRect(0, 0, W, H);
        if (a === 'done') togglePaint(false);
        if (a === 'save') { const c = document.createElement('canvas'); c.width = paintCv.width; c.height = paintCv.height; const x = c.getContext('2d'); x.fillStyle = '#f5efe4'; x.fillRect(0, 0, c.width, c.height); x.drawImage(paintCv, 0, 0); const l = document.createElement('a'); l.download = 'my-masterpiece.png'; l.href = c.toDataURL('image/png'); l.click(); }
      });
    }
    bar.classList.toggle('show', on);
    const tool = $('[data-tool="paint"]'); if (tool) tool.classList.toggle('is-on', on);
    if (!on && paintCv) { paintCv.style.transition = 'opacity .8s'; paintCv.style.opacity = '0'; setTimeout(() => { if (!painting && paintCv) { pctx.clearRect(0, 0, W, H); paintCv.style.opacity = '1'; } }, 850); }
  }
  FX.togglePaint = togglePaint;

  /* ------------------------------------------------------------ palette dock */
  function mountDock() {
    const d = document.createElement('div'); d.className = 'palette-dock no-print';
    d.innerHTML = `<button class="pd-main" aria-label="Brush palette" aria-expanded="false" data-cursor-label="Pick a paint">
        <svg viewBox="0 0 40 40"><path d="M20 4C10 4 3 11 3 19.5 3 28 9 33 15 33c3 0 3.5-2 3.5-3.5 0-2.5 1.5-3.8 4-3.8H27c6 0 10-3.5 10-9C37 9.5 29.5 4 20 4Z" fill="#e7cfa6" stroke="#8a6a44" stroke-width="1.4"/><circle cx="11" cy="16" r="3.1" fill="#2f4cc0"/><circle cx="17" cy="10" r="3.1" fill="#f3a712"/><circle cx="25.5" cy="10.5" r="3.1" fill="#1f8a70"/><circle class="pd-dab" cx="11" cy="24" r="3.4" fill="${color}"/><circle cx="31" cy="16.5" r="2.8" fill="#e86a92"/></svg>
      </button>
      <div class="pd-tray" role="group" aria-label="Brush colors">
        ${PAINTS.map(c => `<button class="blob" data-c="${c}" style="background:${c}" aria-label="Paint color ${c}"></button>`).join('')}
        <span class="pd-sep"></span>
        <button class="pd-tool" data-tool="paint" title="Paint on the page">✎ Paint</button>
        <button class="pd-tool ${trailOn ? 'is-on' : ''}" data-tool="trail" title="Toggle brush trail">Trail</button>
      </div>`;
    document.body.appendChild(d);
    const main = d.querySelector('.pd-main');
    main.onclick = () => { const o = d.classList.toggle('open'); main.setAttribute('aria-expanded', o); };
    d.querySelectorAll('.blob').forEach(b => b.onclick = e => { setColor(b.dataset.c, true); FX.splat(e.clientX, e.clientY, b.dataset.c, 1.2); });
    d.querySelector('[data-tool="paint"]').onclick = () => togglePaint(!painting);
    d.querySelector('[data-tool="trail"]').onclick = e => { trailOn = !trailOn; store.set('trailOn', trailOn); e.currentTarget.classList.toggle('is-on', trailOn); };
    setColor(color);
  }

  /* ------------------------------------------------------------ reveals + split text */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;
  function splitWords(el) {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/); const frag = document.createDocumentFragment();
          parts.forEach(p => { if (!p) return; if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' ')); else { const w = document.createElement('span'); w.className = 'w'; const s = document.createElement('span'); s.style.setProperty('--i', i++); s.textContent = p; w.appendChild(s); frag.appendChild(w); } });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
      });
    };
    walk(el); el.classList.add('split');
  }
  FX.enhance = root => {
    root = root || document;
    $$('[data-split]:not(.split)', root).forEach(el => { if (!reduce) splitWords(el); });
    $$('[data-reveal]:not(.in), .split:not(.in), .mark:not(.in)', root).forEach(el => { if (io && !reduce) io.observe(el); else el.classList.add('in'); });
    // paint buttons
    $$('.btn:not([data-fx])', root).forEach(b => {
      b.dataset.fx = '1';
      b.insertAdjacentHTML('afterbegin', '<span class="btn-fill" aria-hidden="true"></span>');
      if (!b.classList.contains('btn-sm')) b.insertAdjacentHTML('beforeend', '<span class="drips" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');
      b.addEventListener('pointerenter', e => { const r = b.getBoundingClientRect(); b.style.setProperty('--x', (e.clientX - r.left) + 'px'); b.style.setProperty('--y', (e.clientY - r.top) + 'px'); });
    });
    $$('img.img-develop:not(.loaded)', root).forEach(img => { if (img.complete && img.naturalWidth) img.classList.add('loaded'); else { img.addEventListener('load', () => img.classList.add('loaded'), { once: true }); img.addEventListener('error', () => img.classList.add('loaded'), { once: true }); } });
    if (!reduce && fine) {
      $$('[data-magnetic]:not([data-mg])', root).forEach(el => {
        el.dataset.mg = '1';
        el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`; });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
      $$('[data-tilt]:not([data-tl])', root).forEach(el => {
        el.dataset.tl = '1';
        el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--ry', (px * 9) + 'deg'); el.style.setProperty('--rx', (-py * 9) + 'deg'); });
        el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
      });
    }
    $$('.wall:not([data-spot])', root).forEach(w => { w.dataset.spot = '1'; w.addEventListener('pointermove', e => { const r = w.getBoundingClientRect(); w.style.setProperty('--mx', (e.clientX - r.left) + 'px'); w.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); });
  };

  /* ------------------------------------------------------------ fly to cart */
  FX.flyToCart = (srcEl, img, c) => new Promise(res => {
    const target = $('#cart-btn'); if (!target || reduce) return res();
    const cardImg = srcEl.closest('.art-card, .artwork-page, .modal-card');
    const fromEl = (cardImg && cardImg.querySelector('img')) || srcEl;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const el = document.createElement('img'); el.src = img; el.alt = '';
    const size = Math.min(140, a.width);
    Object.assign(el.style, { position: 'fixed', left: 0, top: 0, width: size + 'px', height: size + 'px', objectFit: 'cover', zIndex: 9996, borderRadius: '6px', border: '5px solid #fff', boxShadow: '0 20px 40px -10px rgba(0,0,0,.5)', pointerEvents: 'none' });
    document.body.appendChild(el);
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const cxp = (x0 + x1) / 2, cyp = Math.min(y0, y1) - 160;
    const t0 = performance.now(), dur = 850;
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cxp + e * e * x1, y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cyp + e * e * y1;
      const s = 1 - e * .82;
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${s}) rotate(${e * 380}deg)`; el.style.opacity = t > .9 ? (1 - (t - .9) * 10) : 1;
      if (trailOn) { pts.push({ x, y, t: now, w: 5 * s + 2, c: c || color, gap: false }); kick(); }
      if (t < 1) requestAnimationFrame(step); else { el.remove(); FX.splat(x1, y1, c || color, 1.1); res(); }
    })(t0);
  });

  /* ------------------------------------------------------------ preloader (first visit on home) */
  function preloader() {
    const root = document.documentElement;
    if (reduce || document.body.dataset.page !== 'home') { root.classList.remove('intro'); return; }
    try { if (sessionStorage.getItem('seenIntro')) { root.classList.remove('intro'); return; } sessionStorage.setItem('seenIntro', '1'); } catch (e) { root.classList.remove('intro'); return; }
    const name = document.title.split(/[—|-]/)[0].trim();
    const p = document.createElement('div'); p.className = 'preloader';
    p.innerHTML = `<div class="pl-stage"><div class="drop"></div>
      <svg class="splash" viewBox="0 0 200 200"><path fill="var(--accent)" d="M100 38c14 0 18-22 30-18s-2 22 8 30 28-6 32 6-18 14-16 28 22 16 16 30-22 2-30 12 2 30-12 32-10-20-26-20-24 18-34 12 4-24-6-32-28 4-30-10 18-12 16-26-20-18-12-30 22 6 30-4-6-28 6-32 14 22 28 22z"/><circle cx="170" cy="42" r="6" fill="var(--accent)"/><circle cx="24" cy="150" r="5" fill="var(--accent)"/><circle cx="182" cy="126" r="4" fill="var(--accent)"/><circle cx="40" cy="30" r="3.5" fill="var(--accent)"/></svg>
      <div class="pl-name">${(name || '').replace(/</g, '&lt;')}</div></div><div class="pl-sub">Opening the studio</div>`;
    document.body.appendChild(p); root.classList.remove('intro');
    if (window.Site && Site.ready) Site.ready.then(() => { const n = p.querySelector('.pl-name'); if (n && Site.S) n.textContent = Site.S.artistName; });
    const done = () => { p.classList.add('done'); setTimeout(() => p.remove(), 1200); };
    setTimeout(done, 2150); p.addEventListener('click', done);
  }

  /* ------------------------------------------------------------ init */
  function init() {
    mountCanvas();
    if (fine) {
      document.documentElement.classList.add('has-brush');
      document.body.appendChild(cursor);
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onDown, { passive: true });
      addEventListener('pointerup', onUp, { passive: true });
      document.addEventListener('mouseover', onOver, { passive: true });
      document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
      document.addEventListener('mouseout', e => { if (!e.relatedTarget) cursor.classList.remove('visible'); });
      requestAnimationFrame(cursorLoop);
      if (!lite) mountDock();
    } else {
      addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('.btn'); if (b && !reduce) FX.splat(e.clientX, e.clientY, getComputedStyle(b).getPropertyValue('--fill').trim() || color, 1); }, { passive: true });
    }
    FX.enhance(document);
  }
  preloader();
  if (window.Site && Site.ready) Site.ready.then(init, init); else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
