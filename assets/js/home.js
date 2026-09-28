/* home.js — cover page: living easel, artist intro, featured wall */
(function () {
  'use strict';
  const { $, $$, esc } = Site;
  const I = Site.icons;

  Site.ready.then(() => {
    const S = Site.S, arts = Site.visibleArts();
    Site.setTitle('');
    const avail = arts.filter(Site.artAvail);
    const originals = avail.filter(a => { const o = Site.originalOpt(a); return o && Site.optAvail(o); });
    const featured = arts.filter(a => a.featured);
    const heroArt = Site.art(S.heroArtwork) && Site.art(S.heroArtwork).status !== 'hidden' ? Site.art(S.heroArtwork) : (featured[0] || arts[0]);

    /* ---------- hero copy */
    $('#hero-name').textContent = S.artistName;
    Site.enhance($('.hero'));
    $('#hero-eyebrow').textContent = S.heroEyebrow;
    $('#hero-tagline').textContent = S.tagline;
    const newest = arts.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    $('#hero-status').textContent = newest && Site.isNew(newest) ? `New work just added · ${avail.length} pieces available` : `Studio open · ${avail.length} pieces available`;

    /* ---------- marquee */
    const words = ['Original paintings', 'Limited-edition prints', S.commissions.open ? 'Commissions open' : 'Signed by hand', 'Shipped with care', 'One of a kind'];
    const seq = words.map((w, i) => `<span class="${i % 2 ? 'outline' : ''}">${esc(w)} ${I.spark}</span>`).join('');
    $('#marquee-track').innerHTML = seq + seq;

    /* ---------- artist */
    if (S.portrait) $('#artist-portrait').src = Site.img(S.portrait);
    $('#artist-portrait').alt = `${S.artistName} — in the studio`;
    $('#artist-intro').textContent = S.intro;
    if (S.statement) $('#artist-statement').innerHTML = `“${esc(S.statement)}”`; else $('#artist-statement').remove();
    $('#artist-sig').textContent = S.artistName;
    if (S.location) $('#portrait-cap').textContent = `painting in ${S.location} ✺`;
    const soldOriginals = arts.filter(a => Site.originalSold(a)).length;
    const stats = [
      [avail.length, 'works available now'],
      [originals.length, 'one-of-a-kind originals'],
      soldOriginals ? [soldOriginals, 'originals in collectors’ homes'] : null,
      S.stats.collectors ? [S.stats.collectors, 'happy collectors'] : null,
      S.stats.countries ? [S.stats.countries, 'countries shipped to'] : null,
    ].filter(Boolean).slice(0, 3);
    $('#stats').innerHTML = stats.map((s, i) => `<div class="stat" data-reveal style="--d:${i * .1}s"><b data-count="${s[0]}">0</b><span>${esc(s[1])}</span></div>`).join('');
    countUp($('#stats'));

    /* ---------- promise */
    const promise = [
      [I.cert, 'Signed & certified', S.policies.coa || 'Every original is signed and comes with a certificate of authenticity.', 'var(--ochre)'],
      [I.truck, 'Packed like treasure', S.shipping.note || 'Wrapped by hand, boxed with corner protection and fully insured.', 'var(--blue)'],
      [I.shield, 'Safe, easy checkout', `Pay your way${Site.payLabels().length ? ' — ' + Site.payLabels().slice(0, 5).join(', ') : ''}. Your address autofills in seconds.`, 'var(--green)'],
      S.policies.returns ? [I.returns, 'Love it or return it', S.policies.returns, 'var(--rose)'] : [I.brush, 'Made by a real artist', 'Every piece is painted by hand in my studio — no mass production, ever.', 'var(--rose)'],
    ];
    $('#promise-grid').innerHTML = promise.map((p, i) => `<article class="promise" data-reveal style="--d:${i * .08}s;--pc:${p[3]}"><span class="p-icon">${p[0]}</span><h3>${esc(p[1])}</h3><p>${esc(p[2])}</p></article>`).join('');

    /* ---------- process */
    const steps = (S.process && S.process.length ? S.process : [
      { title: 'Sketch', text: 'Every piece begins as a pencil sketch — sometimes dozens — until the composition feels right.' },
      { title: 'Layers', text: 'Color is built slowly, in thin glazes and thick textured strokes, over days or weeks.' },
      { title: 'Signed & certified', text: 'Each original is signed, varnished, photographed and documented with a certificate.' },
      { title: 'Delivered', text: 'Wrapped by hand, insured and tracked all the way to your door — ready to hang.' },
    ]).slice(0, 4);
    const dots = ['var(--red)', 'var(--ochre)', 'var(--blue)', 'var(--green)'];
    $('#process-steps').innerHTML = steps.map((s, i) => `<div class="step" data-reveal style="--d:${i * .12}s;--sc:${dots[i]}"><span class="step-dot"></span><span class="step-n">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('');
    drawOnScroll($('#process-path'), $('#process'));

    /* ---------- featured wall */
    const featList = (featured.length ? featured : arts).slice(0, 12);
    $('#feat-track').innerHTML = featList.map((a, i) => Site.card(a, { i, reveal: false })).join('') + `<a class="feat-more" href="gallery.html"><span class="h3 ital">See the whole collection</span><span class="btn btn-light btn-sm">${arts.length} works ${I.arrow}</span></a>`;
    Site.enhance($('#feat-track'));
    featTrack();

    /* ---------- testimonials */
    if (S.testimonials && S.testimonials.length) {
      $('#testimonials').hidden = false;
      $('#testi-grid').innerHTML = S.testimonials.map((t, i) => `<figure class="testi" data-reveal style="--d:${i % 3 * .1}s"><div class="stars" aria-label="5 stars">${I.star.repeat(5)}</div><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b>${t.location ? ` · ${esc(t.location)}` : ''}${t.artwork ? `<br><span class="muted">collected “${esc(t.artwork)}”</span>` : ''}</figcaption></figure>`).join('');
      Site.enhance($('#testimonials'));
    }

    /* ---------- newsletter */
    if (!S.newsletter.enabled) $('#join').remove();
    else {
      $('#news-h').textContent = S.newsletter.headline;
      const code = S.newsletter.offerCode, d = code && (S.discounts || []).find(x => String(x.code).toUpperCase() === String(code).toUpperCase() && x.active !== false);
      $('#news-text').textContent = S.newsletter.text + (d ? ` Plus ${d.percent ? d.percent + '%' : Site.money(d.amount)} off your first piece.` : '');
      if (Site.LS.get('subscribed')) $('#join form').outerHTML = `<p class="hand" style="font-size:30px">You're already on the list — thank you ✺</p>`;
    }

    /* ---------- hero reveal */
    if (heroArt) {
      $('#ep-title').textContent = heroArt.title;
      const ho = Site.originalOpt(heroArt), hoAvail = ho && Site.optAvail(ho) && heroArt.status !== 'sold';
      $('#ep-price').textContent = !Site.artAvail(heroArt) ? 'Sold' : hoAvail ? Site.money(ho.price) : (Site.availOptions(heroArt).length > 1 ? 'from ' : '') + Site.money(Site.minPrice(heroArt));
      $('#easel-plaque').href = Site.artUrl(heroArt);
      $('.hero-easel').dataset.accent = Site.accentOf(heroArt);
      heroReveal(heroArt);
    } else $('.hero-easel').style.display = 'none';

    Site.enhance($('#main'));

    /* ---------- structured data for Google */
    Site.jsonld({ '@context': 'https://schema.org', '@type': 'Person', name: S.artistName, jobTitle: 'Artist', description: S.intro, url: Site.absUrl('index.html'), image: Site.absUrl(S.portrait || ''), sameAs: Object.values(S.social || {}).filter(v => /^https?:/.test(v)) });
    Site.jsonld({ '@context': 'https://schema.org', '@type': 'WebSite', name: S.siteTitle || S.artistName, url: Site.absUrl('index.html') });
  });

  /* =============== helpers =============== */
  function countUp(root) {
    const els = $$('[data-count]', root);
    const run = el => { const target = +el.dataset.count, t0 = performance.now(), dur = 1400; const step = now => { const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4); el.textContent = Math.round(target * e); if (t < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    if (!('IntersectionObserver' in window)) return els.forEach(el => el.textContent = el.dataset.count);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: .5 });
    els.forEach(el => io.observe(el));
  }
  function drawOnScroll(path, host) {
    if (!path) return;
    const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    const upd = () => { const r = host.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .3))); path.style.strokeDashoffset = len * (1 - p); };
    addEventListener('scroll', upd, { passive: true }); upd();
  }
  function featTrack() {
    const tr = $('#feat-track'), bar = $('#feat-bar');
    const upd = () => { const m = tr.scrollWidth - tr.clientWidth; bar.style.width = (m > 0 ? (tr.clientWidth / tr.scrollWidth * 100 + tr.scrollLeft / m * (100 - tr.clientWidth / tr.scrollWidth * 100)) : 100) + '%'; };
    tr.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); setTimeout(upd, 100);
    const step = () => { const c = tr.querySelector('.art-card'); return c ? c.getBoundingClientRect().width + 40 : 400; };
    $('#feat-prev').onclick = () => tr.scrollBy({ left: -step(), behavior: 'smooth' });
    $('#feat-next').onclick = () => tr.scrollBy({ left: step(), behavior: 'smooth' });
    // drag to scroll (mouse)
    let d = null, moved = false;
    tr.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target.closest('button, .btn')) return; d = { x: e.clientX, s: tr.scrollLeft }; moved = false; });
    addEventListener('pointermove', e => { if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 5) { moved = true; tr.classList.add('dragging'); } tr.scrollLeft = d.s - dx; });
    addEventListener('pointerup', () => { d = null; setTimeout(() => tr.classList.remove('dragging'), 0); });
    tr.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    tr.addEventListener('keydown', e => { if (e.key === 'ArrowRight') tr.scrollBy({ left: step(), behavior: 'smooth' }); if (e.key === 'ArrowLeft') tr.scrollBy({ left: -step(), behavior: 'smooth' }); });
  }

  /* ---------- the living easel: pencil sketch → painted in by your brush */
  function heroReveal(art) {
    const cvs = $('#reveal-canvas'), box = cvs.parentElement, ctx = cvs.getContext('2d');
    const img = new Image(); img.decoding = 'async'; img.src = Site.img(art.image);
    const mk = () => document.createElement('canvas');
    const color = mk(), sketch = mk(), mask = mk(), tmp = mk(), probe = mk(); probe.width = 40; probe.height = 50;
    const cctx = color.getContext('2d'), sctx = sketch.getContext('2d'), mctx = mask.getContext('2d'), tctx = tmp.getContext('2d'), pctx = probe.getContext('2d', { willReadFrequently: true });
    let W = 0, H = 0, dpr = 1, dirty = true, coverage = 0, done = false, finishing = 0, userPainted = false, lastUser = 0, visible = true, last = null, auto = { t: Math.random() * 10, y: 0 };
    const pct = $('#reveal-pct'), reset = $('#reveal-reset'), hint = $('.hero-hint');
    let stamp = null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    img.onload = () => {
      box.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      requestAnimationFrame(() => { build(); loop(); });
      new ResizeObserver(() => { const r = box.getBoundingClientRect(); if (Math.abs(r.width * dpr - W) > 4) build(true); }).observe(box);
      if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(box);
    };
    img.onerror = () => { box.classList.add('no-img'); };

    function build(keep) {
      const r = box.getBoundingClientRect(); if (!r.width) return;
      dpr = Math.min(1.5, devicePixelRatio || 1);
      const oldMask = keep && W ? (() => { const c = mk(); c.width = W; c.height = H; c.getContext('2d').drawImage(mask, 0, 0); return c; })() : null;
      W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
      [cvs, color, sketch, mask, tmp].forEach(c => { c.width = W; c.height = H; });
      cctx.drawImage(img, 0, 0, W, H);
      try { makeSketch(); }
      catch (e) { // opened from a local file: pixels can't be read, so use a filter-based sketch instead
        sctx.fillStyle = '#f7f2e9'; sctx.fillRect(0, 0, W, H);
        sctx.filter = 'grayscale(1) contrast(1.35) brightness(1.2)'; sctx.globalAlpha = .55; sctx.drawImage(img, 0, 0, W, H);
        sctx.filter = 'none'; sctx.globalAlpha = 1;
      }
      if (oldMask) mctx.drawImage(oldMask, 0, 0, W, H);
      makeStamp();
      dirty = true;
    }
    function makeSketch() {
      // edge-detect on a softened, half-size copy so canvas texture doesn't turn into noise
      const w2 = Math.max(2, Math.round(W / 2)), h2 = Math.max(2, Math.round(H / 2));
      const sm = mk(); sm.width = w2; sm.height = h2; const smx = sm.getContext('2d');
      smx.filter = 'blur(1.6px)'; smx.drawImage(color, 0, 0, w2, h2); smx.filter = 'none';
      const src = smx.getImageData(0, 0, w2, h2).data, n = w2 * h2, g = new Float32Array(n);
      for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (src[j] * .299 + src[j + 1] * .587 + src[j + 2] * .114) / 255;
      const edge = new Float32Array(n);
      for (let y = 1; y < h2 - 1; y++) for (let x = 1; x < w2 - 1; x++) {
        const i = y * w2 + x;
        const gx = -g[i - w2 - 1] - 2 * g[i - 1] - g[i + w2 - 1] + g[i - w2 + 1] + 2 * g[i + 1] + g[i + w2 + 1];
        const gy = -g[i - w2 - 1] - 2 * g[i - w2] - g[i - w2 + 1] + g[i + w2 - 1] + 2 * g[i + w2] + g[i + w2 + 1];
        const m = Math.sqrt(gx * gx + gy * gy); edge[i] = Math.min(1, Math.max(0, (m - .07) / .32));
      }
      const out = sctx.createImageData(W, H), o = out.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i2 = Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1), j = (y * W + x) * 4;
        const lum = g[i2], e = edge[i2];
        let tone = .8 + .2 * Math.pow(lum, .8);
        if (lum < .5 && (x + y) % 9 < 1) tone -= .1 * (1 - lum);
        if (lum < .28 && ((x - y) % 9 + 9) % 9 < 1) tone -= .1;
        const v = Math.max(0, Math.min(1, tone * (1 - e * .85) + (Math.random() - .5) * .03));
        o[j] = 62 + (248 - 62) * v; o[j + 1] = 60 + (243 - 60) * v; o[j + 2] = 66 + (234 - 66) * v; o[j + 3] = 255;
      }
      sctx.putImageData(out, 0, 0);
    }
    function makeStamp() {
      const R = Math.round(Math.max(40, W * .085));
      stamp = mk(); stamp.width = stamp.height = R * 2;
      const s = stamp.getContext('2d');
      const grd = s.createRadialGradient(R, R, R * .2, R, R, R); grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(.6, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      s.fillStyle = grd; s.beginPath(); s.ellipse(R, R, R, R * .62, 0, 0, Math.PI * 2); s.fill();
      s.strokeStyle = '#fff'; s.lineCap = 'round';
      for (let k = 0; k < 90; k++) { const yy = R + (Math.random() - .5) * R * 1.2, x0 = R * (.1 + Math.random() * .4), x1 = R * (1.5 + Math.random() * .4); s.globalAlpha = .1 + Math.random() * .35; s.lineWidth = 1 + Math.random() * 2.5; s.beginPath(); s.moveTo(x0, yy); s.lineTo(x1, yy + (Math.random() - .5) * 4); s.stroke(); }
    }
    function dab(x, y, ang, sc = 1) {
      if (!stamp) return;
      mctx.save(); mctx.translate(x, y); mctx.rotate(ang); mctx.scale(sc * (.85 + Math.random() * .3), sc * (.85 + Math.random() * .3));
      mctx.drawImage(stamp, -stamp.width / 2, -stamp.height / 2); mctx.restore(); dirty = true;
    }
    function strokeTo(x, y, sc) {
      if (!last) { last = { x, y }; dab(x, y, 0, sc); return; }
      const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), step = Math.max(4, (stamp ? stamp.width : 80) * .16);
      for (let d = step; d <= dist; d += step) dab(last.x + dx * d / dist, last.y + dy * d / dist, ang, sc);
      if (dist >= step) last = { x, y };
    }
    function pos(e) { const r = cvs.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
    cvs.addEventListener('pointerenter', () => { last = null; });
    cvs.addEventListener('pointermove', e => {
      if (done) return;
      const [x, y] = pos(e); strokeTo(x, y, 1);
      lastUser = performance.now();
      if (!userPainted) { userPainted = true; hint && hint.classList.add('gone'); Site.track('hero_paint', {}); }
    });
    cvs.addEventListener('pointerleave', () => { last = null; });
    reset.addEventListener('click', () => { mctx.clearRect(0, 0, W, H); done = false; finishing = 0; coverage = 0; reset.hidden = true; dirty = true; auto.y = 0; lastUser = performance.now(); });

    let probeT = 0, autoLast = null;
    function loop(now = 0) {
      requestAnimationFrame(loop);
      if (!W || !visible) return;
      // automatic painter when idle (and on touch devices)
      if (!done && !reduce && now - lastUser > 2200) {
        auto.t += .028; auto.y += .0016;
        const yy = ((auto.y % 1.05)) * H, xx = W * (.5 + .46 * Math.sin(auto.t * 2.1) * Math.cos(auto.t * .37));
        const p = { x: xx, y: yy + Math.sin(auto.t * 5) * H * .03 };
        if (autoLast) { const saved = last; last = autoLast; strokeTo(p.x, p.y, .9); last = saved; }
        autoLast = p;
      } else autoLast = null;
      if (reduce && !done) { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, W, H); dirty = true; }
      if (now - probeT > 350 && !done) {
        probeT = now; pctx.clearRect(0, 0, 40, 50); pctx.drawImage(mask, 0, 0, 40, 50);
        const d = pctx.getImageData(0, 0, 40, 50).data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 150) c++;
        coverage = c / 2000;
        pct.textContent = coverage < .02 ? 'Sketch · 0% painted' : `${Math.min(100, Math.round(coverage / .9 * 100))}% painted`;
        if (coverage > .88) { done = true; finishing = now; pct.textContent = '✓ Painted!'; reset.hidden = false; if (window.FX) { const r = cvs.getBoundingClientRect(); FX.splat(r.left + r.width * .8, r.top + r.height * .15, Site.accentOf(art), 1.4); } }
      }
      if (finishing) { const t = Math.min(1, (now - finishing) / 900); mctx.globalAlpha = .08 + t * .2; mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, W, H); mctx.globalAlpha = 1; dirty = true; if (t >= 1) finishing = 0; }
      if (!dirty) return; dirty = false;
      ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(sketch, 0, 0);
      tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, W, H); tctx.drawImage(color, 0, 0);
      tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(mask, 0, 0); tctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0);
    }
  }
})();
