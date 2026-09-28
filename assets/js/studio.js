/* =====================================================================
   studio.js — your no-code control room.
   Everything saves as a draft in THIS browser. "Publish" pushes it live
   (one click via GitHub, or by downloading an update .zip).
   ===================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, LS, IDB } = Site;
  const I = Site.icons;
  const ST = { live: null, data: null, view: 'dashboard', saveT: null, queue: [], editing: null, img: null };
  const clone = o => JSON.parse(JSON.stringify(o));
  const getP = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] == null ? (a[k] = /^\d+$/.test(k) ? [] : {}) : a[k]), o); t[last] = v; };
  const slug = s => String(s || 'artwork').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'artwork';
  const rid = () => Math.random().toString(36).slice(2, 6);
  const money = n => Site.money(Number(n) || 0);
  const S = () => ST.data.settings;

  /* ============================================================ boot */
  Site.ready.then(async live => {
    ST.live = clone(live);
    let draft = null;
    try { draft = await IDB.get('kv', 'draft'); } catch (e) { }
    if (draft && draft.data) {
      if (draft.basedOn && live.updatedAt && draft.basedOn !== live.updatedAt && JSON.stringify(draft.data) !== JSON.stringify(live)) {
        ST.data = Site.normalize(clone(draft.data));
        setTimeout(() => conflictPrompt(draft), 400);
      } else ST.data = Site.normalize(clone(draft.data));
    } else ST.data = clone(live);
    Site.data = ST.data; Site.S = ST.data.settings;
    // unpublished images → object URLs for previews
    try { (await IDB.entries('files')).forEach(([k, v]) => { if (v && v.blob) Site.blobUrls[k] = URL.createObjectURL(v.blob); }); } catch (e) { }
    $('#st-for').textContent = `for ${S().artistName}'s website`;
    bind();
    route();
    addEventListener('hashchange', route);
    if (!LS.get('studioWelcomed')) welcome();
  });

  function conflictPrompt(draft) {
    const m = Site.openModal(`<div class="modal-body"><h3 class="h3">Your live site changed</h3><p>Your website was published from somewhere else (another computer or browser) since you started this draft. Which version would you like to keep working on?</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-accent" data-k="live">Use the live version</button><button class="btn btn-ghost" data-k="draft">Keep my draft</button></div><p class="muted small" style="margin-top:14px">Keeping your draft and publishing will overwrite the live version.</p></div>`, { width: 520 });
    m.querySelector('[data-k=live]').onclick = () => { ST.data = clone(ST.live); Site.data = ST.data; Site.S = ST.data.settings; save(true); Site.closeModal(); route(); };
    m.querySelector('[data-k=draft]').onclick = () => { save(true); Site.closeModal(); };
  }

  function welcome() {
    const m = Site.openModal(`<div class="modal-body st-welcome"><div class="hand" style="font-size:30px;color:var(--accent)">Welcome to your Studio ✺</div>
      <h3 class="h2" style="font-size:40px;margin:8px 0 14px">This is where you run your art business.</h3>
      <ol class="st-steps3"><li><b>Add your art</b> — drop in a photo, give it a title and a price. That's it.</li><li><b>Set up payments</b> — paste your PayPal, Venmo, Zelle or Cash App details.</li><li><b>Publish</b> — one click and your changes are live for the world.</li></ol>
      <p class="muted small">Everything saves automatically in this browser as you go. Bookmark this page (<b>studio.html</b>) — it's your private control room. Visitors never see it linked anywhere.</p>
      <button class="btn btn-accent btn-lg" data-modal-close>Let's go</button></div>`, { width: 600 });
    LS.set('studioWelcomed', 1);
  }

  /* ============================================================ save + dirty */
  function save(now) {
    clearTimeout(ST.saveT);
    $('#st-save').textContent = 'Saving…'; $('#st-save').classList.add('busy');
    const run = async () => {
      try { await IDB.set('kv', 'draft', { data: ST.data, basedOn: ST.live.updatedAt, savedAt: Date.now() }); $('#st-save').textContent = '✓ Saved in this browser'; }
      catch (e) { $('#st-save').textContent = '⚠ Could not save draft'; }
      $('#st-save').classList.remove('busy'); markDirty();
    };
    if (now) run(); else ST.saveT = setTimeout(run, 350);
  }
  function changes() {
    const L = ST.live, D = ST.data, out = [];
    const lm = new Map(L.artworks.map(a => [a.id, JSON.stringify(a)])), dm = new Map(D.artworks.map(a => [a.id, JSON.stringify(a)]));
    D.artworks.forEach(a => { if (!lm.has(a.id)) out.push(['+', `New artwork: ${a.title}`]); else if (lm.get(a.id) !== dm.get(a.id)) out.push(['~', `Edited: ${a.title}`]); });
    L.artworks.forEach(a => { if (!dm.has(a.id)) out.push(['−', `Removed: ${a.title}`]); });
    if (L.artworks.filter(a => dm.has(a.id)).map(a => a.id).join() !== D.artworks.filter(a => lm.has(a.id)).map(a => a.id).join()) out.push(['~', 'Artwork order changed']);
    const ls = L.settings, ds = D.settings;
    Object.keys(ds).forEach(k => { if (JSON.stringify(ls[k]) !== JSON.stringify(ds[k])) out.push(['~', SETTING_NAMES[k] || `Setting: ${k}`]); });
    return out;
  }
  const SETTING_NAMES = { artistName: 'Artist name', siteTitle: 'Site title', heroEyebrow: 'Cover page subtitle', tagline: 'Tagline', intro: 'Intro text', bio: 'Bio', statement: 'Artist statement', location: 'Location', portrait: 'Portrait photo', heroArtwork: '“On the easel” painting', contactEmail: 'Contact email', social: 'Social links', currency: 'Currency', announcement: 'Announcement bar', accent: 'Accent color', shipping: 'Shipping settings', taxRate: 'Tax rate', bundle: 'Bundle discount', discounts: 'Discount codes', newsletter: 'Collector’s List', payments: 'Payment methods', orders: 'Order emails', commissions: 'Commissions', policies: 'Policies', faq: 'FAQ', process: 'Process steps', testimonials: 'Testimonials', stats: 'Social proof numbers', analytics: 'Analytics', domain: 'Domain', seo: 'SEO description' };
  function markDirty() { const n = changes().length; $('#nav-dirty').hidden = !n; $('#nav-dirty').textContent = n || ''; $('#st-publish-top').textContent = n ? `Publish (${n})` : 'Publish'; $('#nav-art-count').textContent = ST.data.artworks.length; }

  /* ============================================================ routing */
  const TITLES = { dashboard: 'Dashboard', artworks: 'Artworks', new: 'Add artwork', edit: 'Edit artwork', profile: 'Profile & story', payments: 'Payments', orders: 'Orders & emails', shipping: 'Shipping & pricing', marketing: 'Marketing', publish: 'Publish', help: 'Help & launch guide' };
  function route() {
    const h = (location.hash || '#dashboard').slice(1); const [v, arg] = h.split('/');
    ST.view = TITLES[v] ? v : 'dashboard';
    $$('#st-nav a').forEach(a => a.classList.toggle('on', a.dataset.v === ST.view || (ST.view === 'edit' && a.dataset.v === 'artworks')));
    $('#st-title').textContent = TITLES[ST.view];
    document.body.classList.remove('st-nav-open');
    $$('.modal').forEach(m => m.remove()); const sc = $('[data-scrim]'); if (sc) sc.classList.remove('open'); document.documentElement.style.overflow = '';
    const view = $('#st-view');
    ({ dashboard, artworks, new: () => editor(null), edit: () => editor(arg), profile, payments, orders, shipping, marketing, publish, help })[ST.view]();
    Site.enhance(view); view.scrollTop = 0; scrollTo(0, 0); markDirty();
  }
  function bind() {
    $('#st-menu').onclick = () => document.body.classList.toggle('st-nav-open');
    $('#st-publish-top').onclick = () => location.hash = '#publish';
    $('#st-preview').onclick = async () => { await save(true); LS.set('studio-preview', true); const w = window.open('index.html', '_blank'); if (!w) { location.href = 'index.html'; return; } Site.toast('Opened your site in preview mode — only you can see these changes until you publish.'); };
    // generic field binding
    $('#st-view').addEventListener('input', onField);
    $('#st-view').addEventListener('change', onField);
    addEventListener('beforeunload', e => { if (ST.dirtyEditor) { e.preventDefault(); e.returnValue = ''; } });
  }
  function onField(e) {
    const el = e.target.closest('[data-path]'); if (!el) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.dataset.type === 'num') v = el.value === '' ? (el.dataset.nullable ? null : 0) : Number(el.value);
    else if (el.dataset.type === 'lines') v = el.value.split('\n').map(x => x.trim()).filter(Boolean);
    else v = el.value;
    setP(ST.data, el.dataset.path, v);
    if (el.dataset.rerender && e.type === 'change') route();
    save();
    if (el.dataset.path === 'settings.accent') document.documentElement.style.setProperty('--accent', v);
  }

  /* ============================================================ UI helpers (form builder) */
  const F = {
    text: (p, label, o = {}) => `<div class="field"><label>${label}${o.opt ? ' <span class="opt">(optional)</span>' : ''}</label><input class="input" data-path="${p}" value="${esc(getP(ST.data, p) ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.type ? `type="${o.type}"` : ''} autocomplete="off" spellcheck="${o.spell === false ? 'false' : 'true'}">${o.help ? `<div class="hint">${o.help}</div>` : ''}</div>`,
    area: (p, label, o = {}) => `<div class="field"><label>${label}${o.opt ? ' <span class="opt">(optional)</span>' : ''}</label><textarea class="textarea" data-path="${p}" rows="${o.rows || 4}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(getP(ST.data, p) ?? '')}</textarea>${o.help ? `<div class="hint">${o.help}</div>` : ''}</div>`,
    num: (p, label, o = {}) => `<div class="field"><label>${label}</label><div class="affix">${o.pre ? `<span>${o.pre}</span>` : ''}<input class="input" type="number" inputmode="decimal" step="${o.step || 'any'}" min="${o.min ?? 0}" data-type="num" data-path="${p}" value="${esc(getP(ST.data, p) ?? '')}">${o.suf ? `<span>${o.suf}</span>` : ''}</div>${o.help ? `<div class="hint">${o.help}</div>` : ''}</div>`,
    toggle: (p, label, help) => `<label class="st-toggle"><input type="checkbox" data-path="${p}" ${getP(ST.data, p) ? 'checked' : ''}><span class="tg"></span><span><b>${label}</b>${help ? `<br><span class="muted small">${help}</span>` : ''}</span></label>`,
    select: (p, label, opts, o = {}) => `<div class="field"><label>${label}</label><select class="select" data-path="${p}" ${o.rerender ? 'data-rerender="1"' : ''}>${opts.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(getP(ST.data, p)) === String(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>${o.help ? `<div class="hint">${o.help}</div>` : ''}</div>`,
    card: (title, body, o = {}) => `<section class="st-card ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}>${title ? `<div class="st-card-head"><h2>${title}</h2>${o.aside || ''}</div>` : ''}${o.lead ? `<p class="st-lead">${o.lead}</p>` : ''}${body}</section>`,
    list(p, label, fields, o = {}) {
      const arr = getP(ST.data, p) || [];
      return `<div class="st-list" data-list="${p}"><div class="label" style="margin-bottom:10px">${label}</div>${arr.map((it, i) => `<div class="st-list-item">${fields.map(f => f(`${p}.${i}`)).join('')}<button type="button" class="st-x" data-list-rm="${p}" data-i="${i}" aria-label="Remove">✕ Remove</button></div>`).join('') || `<p class="muted small">${o.empty || 'Nothing here yet.'}</p>`}<button type="button" class="btn btn-ghost btn-sm" data-list-add="${p}">＋ ${o.add || 'Add'}</button></div>`;
    },
  };
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-list-add]'), rm = e.target.closest('[data-list-rm]');
    if (add) { const p = add.dataset.listAdd; const arr = getP(ST.data, p) || []; arr.push(LIST_DEFAULTS[p] ? clone(LIST_DEFAULTS[p]) : {}); setP(ST.data, p, arr); save(); route(); }
    if (rm) { const p = rm.dataset.listRm; const arr = getP(ST.data, p); arr.splice(+rm.dataset.i, 1); save(); route(); }
  });
  const LIST_DEFAULTS = {
    'settings.faq': { q: 'New question?', a: '' }, 'settings.testimonials': { quote: '', name: '', location: '', artwork: '' },
    'settings.discounts': { code: 'NEWCODE', percent: 10, active: true, minSubtotal: 0 }, 'settings.payments.custom': { name: '', short: '', instructions: 'Send {amount} to … and include order {order} in the note.' },
    'settings.process': { title: 'Step', text: '' },
  };

  /* ============================================================ image processing */
  async function processImage(file, rot = 0) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }
    const sw = bmp.width, sh = bmp.height, swap = rot % 180 !== 0;
    const draw = (max) => { const k = Math.min(1, max / Math.max(sw, sh)); const w = Math.round(sw * k), h = Math.round(sh * k); const c = document.createElement('canvas'); c.width = swap ? h : w; c.height = swap ? w : h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h); return c; };
    const full = draw(2000), thumb = draw(760);
    const enc = (c, q) => new Promise(res => c.toBlob(b => { if (b && b.type === 'image/webp') res(b); else c.toBlob(res, 'image/jpeg', q); }, 'image/webp', q));
    const [fb, tb] = await Promise.all([enc(full, .86), enc(thumb, .82)]);
    return { full: fb, thumb: tb, w: full.width, h: full.height, colors: extractColors(thumb), ext: fb.type === 'image/webp' ? 'webp' : 'jpg' };
  }
  function extractColors(canvas, k = 5) {
    const s = 64, c = document.createElement('canvas'); c.width = s; c.height = s;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, s, s);
    const d = x.getImageData(0, 0, s, s).data; const px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    let cents = []; for (let i = 0; i < k; i++) cents.push(px[Math.floor((i + .5) / k * px.length)]);
    let counts = [];
    for (let it = 0; it < 10; it++) {
      const sums = cents.map(() => [0, 0, 0]); counts = cents.map(() => 0);
      for (const p of px) { let bi = 0, bd = 1e9; cents.forEach((q, j) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } }); sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2] += p[2]; counts[bi]++; }
      cents = cents.map((q, j) => counts[j] ? [sums[j][0] / counts[j], sums[j][1] / counts[j], sums[j][2] / counts[j]] : q);
    }
    const hex = q => '#' + q.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    return cents.map((q, j) => ({ c: hex(q), n: counts[j] })).sort((a, b) => b.n - a.n).map(o => o.c);
  }
  async function storeFile(path, blob) { await IDB.set('files', path, { blob, published: false, at: Date.now() }); if (Site.blobUrls[path]) URL.revokeObjectURL(Site.blobUrls[path]); Site.blobUrls[path] = URL.createObjectURL(blob); }

  /* ============================================================ DASHBOARD */
  function dashboard() {
    const D = ST.data, arts = D.artworks, s = S(), P = s.payments;
    const avail = arts.filter(a => a.status !== 'hidden' && Site.artAvail(a));
    const soldOrig = arts.filter(a => Site.originalSold(a));
    const value = avail.reduce((t, a) => { const o = Site.originalOpt(a); return t + (o && Site.optAvail(o) ? o.price : 0); }, 0);
    const printValue = avail.reduce((t, a) => t + a.options.filter(o => o.kind !== 'original' && Site.optAvail(o) && o.stock).reduce((x, o) => x + o.price * o.stock, 0), 0);
    const samples = arts.filter(a => a.sample).length;
    const payOk = !!(P.paypalClientId || P.venmo || P.zelle || P.cashapp || P.paypalMe || P.stripeLink || (P.custom || []).length);
    const mailOk = !!(s.orders.web3formsKey || s.orders.formsubmitEmail);
    const ch = changes().length;
    const steps = [
      [arts.some(a => !a.sample), 'Add your first artwork', 'Drop in a photo, name it, price it.', '#new'],
      [!samples, 'Remove the sample artworks', `${samples} demo pieces are showing so the site looks alive.`, '#artworks'],
      [!!LS.get('profileDone'), 'Make the story yours', 'Name, bio, portrait and social links.', '#profile'],
      [payOk, 'Connect how you get paid', 'PayPal / Venmo / Zelle / Cash App / Stripe.', '#payments'],
      [mailOk, 'Get order emails', 'So buyers’ addresses land in your inbox.', '#orders'],
      [!!(ST.live.publishedAt && !ch), 'Publish your site', ch ? `${ch} change${ch > 1 ? 's' : ''} waiting to go live.` : 'Push your changes live.', '#publish'],
    ];
    const done = steps.filter(x => x[0]).length, pct = Math.round(done / steps.length * 100);
    const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const tip = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
    $('#st-view').innerHTML = `
      <div class="st-hello"><div><div class="hand" style="font-size:28px;color:var(--accent)">${greet}, ${esc(s.artistName)} ✺</div><h2 class="h2">What are we making today?</h2></div>
        <a class="btn btn-accent btn-lg" href="#new">＋ Add artwork</a></div>
      <div class="st-grid-2">
        ${F.card('Launch checklist', `<div class="st-check-top"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div><p class="muted">${done === steps.length ? 'You’re live and ready to sell. Keep adding work!' : `${steps.length - done} step${steps.length - done > 1 ? 's' : ''} to a fully launched shop.`}</p></div>
          <ol class="st-checklist">${steps.map(x => `<li class="${x[0] ? 'ok' : ''}"><a href="${x[3]}"><span class="ck">${x[0] ? '✓' : ''}</span><span><b>${x[1]}</b><span class="muted small">${x[2]}</span></span><span class="go">→</span></a></li>`).join('')}</ol>`)}
        <div>
          <div class="st-stats">
            <div class="st-stat"><b>${arts.filter(a => a.status !== 'hidden').length}</b><span>on the site</span></div>
            <div class="st-stat"><b>${avail.length}</b><span>available</span></div>
            <div class="st-stat"><b>${soldOrig.length}</b><span>originals sold</span></div>
            <div class="st-stat"><b>${money(value)}</b><span>originals for sale</span></div>
          </div>
          ${F.card('Today’s business tip', `<p class="st-tip"><b>${esc(tip[0])}</b><br>${esc(tip[1])}</p>`, { cls: 'st-tipcard' })}
          ${printValue ? F.card('', `<p class="muted small" style="margin:0">Your print inventory is worth <b>${money(printValue)}</b> at full price. Prints are how a single painting keeps earning after the original sells.</p>`) : ''}
          ${F.card('Quick links', `<div class="st-quick"><a href="#artworks">Choose cover-page favorites ★</a><a href="#marketing">Discount codes & announcement</a><a href="#shipping">Pricing calculator</a><a href="#payments">Fee comparison</a></div>`)}
        </div>
      </div>`;
  }
  const TIPS = [
    ['Show the price.', 'Listings with visible prices sell far more often than “price on request”. Buyers who have to ask usually leave.'],
    ['Offer prints next to originals.', 'A $35 print beside a $480 original makes both feel reasonable — and lets more people take your work home.'],
    ['Keep your prices consistent.', 'Collectors trust artists whose prices only go up. Avoid deep discounts on originals; offer a small welcome code instead.'],
    ['Photograph in daylight.', 'Shoot straight-on near a window, no flash, and crop tight. Good photos are the #1 driver of online art sales.'],
    ['Tell the story.', 'Two or three sentences about what inspired a piece makes buyers feel connected — people buy the story as much as the painting.'],
    ['Post the process.', 'Short videos of a painting in progress are the best free marketing there is. Link your shop in your bio.'],
    ['Use the free-shipping nudge.', 'A free-shipping threshold slightly above your average order encourages buyers to add a print.'],
    ['Grow your Collector’s List.', 'Email subscribers buy far more often than social followers. Announce new work to them first.'],
    ['Size matters.', 'Always enter dimensions — it powers the “View on your wall” preview, which helps buyers feel confident.'],
    ['Know your numbers.', 'Price = materials + (hours × your hourly rate) + overhead. Use the pricing calculator in Shipping & pricing.'],
  ];

  /* ============================================================ ARTWORKS LIST */
  function artworks() {
    const arts = ST.data.artworks, samples = arts.filter(a => a.sample).length;
    const f = ST.filter || 'all';
    const vis = arts.filter(a => f === 'all' || (f === 'available' && a.status !== 'hidden' && Site.artAvail(a)) || (f === 'sold' && (Site.originalSold(a) || !Site.artAvail(a))) || (f === 'hidden' && a.status === 'hidden') || (f === 'featured' && a.featured));
    $('#st-view').innerHTML = `
      ${samples ? `<div class="st-banner"><div><b>These ${samples} pieces are samples</b> so your site looks alive while you set up. Add your own art, then remove them.</div><button class="btn btn-ghost btn-sm" id="rm-samples">Remove all samples</button></div>` : ''}
      <div class="st-toolbar">
        <div class="seg" id="art-filter">${[['all', 'All'], ['available', 'Available'], ['sold', 'Sold'], ['featured', '★ Cover picks'], ['hidden', 'Hidden']].map(([k, l]) => `<button class="${f === k ? 'is-active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
        <a class="btn btn-accent" href="#new">＋ Add artwork</a>
      </div>
      <p class="muted small">Drag rows to change the order they appear on your site. Toggle <b>★</b> to feature a piece in the “Hand-picked favorites” section of your cover page.</p>
      <div class="st-rows" id="st-rows">${vis.map(a => row(a)).join('') || `<div class="st-empty"><p>No artworks here yet.</p><a class="btn btn-accent" href="#new">＋ Add your first artwork</a></div>`}</div>`;
    $('#art-filter').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { ST.filter = b.dataset.f; route(); } };
    const rs = $('#rm-samples'); if (rs) rs.onclick = () => confirmBox('Remove all sample artworks?', 'Your own artworks stay. You can’t undo this (but nothing changes on your live site until you publish).', 'Remove samples', () => { ST.data.artworks = ST.data.artworks.filter(a => !a.sample); if (ST.data.settings.heroArtwork && !ST.data.artworks.find(a => a.id === ST.data.settings.heroArtwork)) ST.data.settings.heroArtwork = ''; save(); route(); Site.toast('Samples removed ✓'); });
    const rows = $('#st-rows');
    rows.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = ST.data.artworks.find(x => x.id === b.dataset.id); if (!a) return;
      const act = b.dataset.act;
      if (act === 'feat') { a.featured = !a.featured; if (window.FX && a.featured) FX.splat(e.clientX, e.clientY, '#f3a712', 1); }
      if (act === 'sold') { const o = Site.originalOpt(a); if (o) o.stock = Site.optAvail(o) ? 0 : 1; else a.status = a.status === 'sold' ? 'available' : 'sold'; if (window.FX) FX.splat(e.clientX, e.clientY, '#e2492f', 1); }
      if (act === 'hide') a.status = a.status === 'hidden' ? 'available' : 'hidden';
      if (act === 'dup') { const c = clone(a); c.id = uniqueId(a.id + '-copy'); c.title = a.title + ' (copy)'; c.sample = false; c.createdAt = new Date().toISOString().slice(0, 10); ST.data.artworks.splice(ST.data.artworks.indexOf(a) + 1, 0, c); }
      if (act === 'del') return confirmBox(`Delete “${esc(a.title)}”?`, 'It will disappear from your site when you next publish.', 'Delete', () => { ST.data.artworks = ST.data.artworks.filter(x => x !== a); save(); route(); });
      if (act === 'up' || act === 'down') { const L = ST.data.artworks, i = L.indexOf(a), j = act === 'up' ? i - 1 : i + 1; if (j >= 0 && j < L.length) { [L[i], L[j]] = [L[j], L[i]]; } }
      save(); route();
    });
    // drag & drop reorder
    let dragId = null;
    rows.addEventListener('dragstart', e => { const r = e.target.closest('.st-row'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    rows.addEventListener('dragend', e => { const r = e.target.closest('.st-row'); r && r.classList.remove('dragging'); });
    rows.addEventListener('dragover', e => { e.preventDefault(); const r = e.target.closest('.st-row'); $$('.st-row', rows).forEach(x => x.classList.toggle('drop-target', x === r && x.dataset.id !== dragId)); });
    rows.addEventListener('drop', e => { e.preventDefault(); const r = e.target.closest('.st-row'); if (!r || !dragId || r.dataset.id === dragId) return; const L = ST.data.artworks; const from = L.findIndex(a => a.id === dragId); const item = L.splice(from, 1)[0]; const to = L.findIndex(a => a.id === r.dataset.id); L.splice(to, 0, item); save(); route(); });
  }
  function row(a) {
    const o = Site.originalOpt(a), prints = a.options.filter(x => x.kind !== 'original');
    const st = a.status === 'hidden' ? ['Hidden', 'muted'] : !Site.artAvail(a) ? ['Sold out', 'red'] : Site.originalSold(a) ? ['Original sold', 'red'] : ['Available', 'ok'];
    return `<div class="st-row" draggable="true" data-id="${esc(a.id)}">
      <span class="grip" title="Drag to reorder">⋮⋮</span>
      <img src="${esc(Site.img(a.thumb || a.image))}" alt="">
      <div class="st-row-main"><span><b>${esc(a.title)}</b>${a.sample ? ' <span class="pill light st-sample">sample</span>' : ''}</span><span class="muted small">${esc([a.medium, Site.sizeLabel(a)].filter(Boolean).join(' · '))}</span></div>
      <div class="st-row-price">${o ? `<span><b>${money(o.price)}</b> original</span>` : ''}${prints.length ? `<span class="muted small">${prints.length} print size${prints.length > 1 ? 's' : ''} from ${money(Math.min(...prints.map(p => p.price)))}</span>` : ''}</div>
      <span class="st-pill ${st[1]}">${st[0]}</span>
      <div class="st-row-acts">
        <button class="st-ic ${a.featured ? 'on' : ''}" data-act="feat" data-id="${esc(a.id)}" title="${a.featured ? 'Featured on cover page' : 'Feature on cover page'}">★</button>
        <button class="st-ic" data-act="sold" data-id="${esc(a.id)}" title="${Site.originalSold(a) || a.status === 'sold' ? 'Mark original available again' : 'Mark original as sold'}">${Site.originalSold(a) || a.status === 'sold' ? '↺' : '●'}</button>
        <a class="st-ic" href="#edit/${encodeURIComponent(a.id)}" title="Edit">✎</a>
        <details class="st-more"><summary class="st-ic" title="More">⋯</summary><div>
          <button data-act="up" data-id="${esc(a.id)}">Move up</button><button data-act="down" data-id="${esc(a.id)}">Move down</button>
          <button data-act="hide" data-id="${esc(a.id)}">${a.status === 'hidden' ? 'Show on site' : 'Hide from site'}</button>
          <button data-act="dup" data-id="${esc(a.id)}">Duplicate</button>
          <a href="artwork.html?id=${encodeURIComponent(a.id)}" target="_blank" rel="noopener">View on site ↗</a>
          <button data-act="del" data-id="${esc(a.id)}" class="danger">Delete</button></div></details>
      </div></div>`;
  }
  function uniqueId(base) { let id = slug(base), n = 2; while (ST.data.artworks.some(a => a.id === id)) id = slug(base) + '-' + n++; return id; }
  function confirmBox(title, text, ok, fn) {
    const m = Site.openModal(`<div class="modal-body"><h3 class="h3">${title}</h3><p class="muted">${text}</p><div style="display:flex;gap:10px"><button class="btn btn-accent" data-ok>${ok}</button><button class="btn btn-ghost" data-modal-close>Cancel</button></div></div>`, { width: 460 });
    m.querySelector('[data-ok]').onclick = () => { Site.closeModal(); fn(); };
  }

  /* ============================================================ ADD / EDIT ARTWORK */
  const MEDIUMS = ['Oil on canvas', 'Acrylic on canvas', 'Acrylic on wood panel', 'Watercolor on paper', 'Gouache on paper', 'Ink on paper', 'Charcoal on paper', 'Pastel on paper', 'Mixed media', 'Digital painting', 'Giclée print'];
  const PROMPTS = ['This painting started when…', 'I painted this in… using…', 'The colors remind me of…', 'I hope it makes you feel…', 'It looks especially beautiful in…'];
  function editor(id) {
    const existing = id ? ST.data.artworks.find(a => a.id === decodeURIComponent(id)) : null;
    if (id && !existing) { location.hash = '#artworks'; return; }
    ST.dirtyEditor = false;
    ST.editing = existing ? clone(existing) : null;
    ST.img = null;
    if (!ST.editing) return dropStep();
    editorForm();
  }
  function dropStep() {
    $('#st-view').innerHTML = `
      <label class="st-drop" id="st-drop" tabindex="0">
        <input type="file" accept="image/*" multiple id="st-file" hidden>
        <svg viewBox="0 0 120 100" fill="none" class="st-drop-art"><rect x="18" y="12" width="84" height="64" rx="4" stroke="currentColor" stroke-width="3"/><path d="M26 66c12-14 20-20 30-14s16-8 26-16 12 6 16 10" stroke="#e2492f" stroke-width="5" stroke-linecap="round"/><circle cx="82" cy="30" r="7" fill="#f3a712"/><path d="M60 92V56m0 0-10 10m10-10 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
        <b class="h2" style="font-size:38px">Drop a photo of your artwork</b>
        <span>or <u>click to choose</u> · you can also paste an image (Ctrl/⌘ + V) · add several at once to list them one after another</span>
        <span class="muted small">Tip: photograph straight-on in daylight and crop to the edges of the painting. Big photos are fine — they’re optimized automatically.</span>
      </label>
      ${ST.queue.length ? `<p class="center muted">${ST.queue.length} more photo${ST.queue.length > 1 ? 's' : ''} waiting in your queue.</p>` : ''}`;
    const drop = $('#st-drop'), inp = $('#st-file');
    inp.onchange = () => takeFiles([...inp.files]);
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => takeFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))));
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    if (ST.queue.length) takeFiles([]);
  }
  document.addEventListener('paste', e => { if (ST.view !== 'new' || ST.editing) return; const f = [...(e.clipboardData || {}).files || []].filter(x => x.type.startsWith('image/')); if (f.length) takeFiles(f); });
  async function takeFiles(files) {
    ST.queue.push(...files);
    const f = ST.queue.shift(); if (!f) return;
    $('#st-view').innerHTML = `<div class="st-processing"><div class="st-spin"></div><b>Preparing your image…</b><span class="muted small">Resizing, optimizing and reading its colors</span></div>`;
    try {
      const r = await processImage(f);
      ST.img = { ...r, file: f, rot: 0 };
      const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(img|dsc|image|photo|pxl|screenshot)\s*\d*/gi, '').trim();
      const title = base && !/^\d+$/.test(base) ? base.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 60) : '';
      ST.editing = {
        id: '', title, image: '', thumb: '', imgW: r.w, imgH: r.h, medium: '', width: null, height: null, unit: 'in', year: new Date().getFullYear(), description: '', tags: [], colors: r.colors,
        featured: false, status: 'available', framed: false, signed: true, createdAt: new Date().toISOString().slice(0, 10),
        options: [{ id: 'original', label: 'Original painting', price: null, stock: 1, kind: 'original' }], compareAt: null,
      };
      ST.dirtyEditor = true;
      editorForm();
    } catch (e) { console.error(e); Site.toast('Sorry — that image could not be read. Try a JPG or PNG.', { color: 'var(--red)' }); dropStep(); }
  }
  function kindOf(a) { const o = a.options.some(x => x.kind === 'original'), p = a.options.some(x => x.kind !== 'original'); return o && p ? 'both' : o ? 'original' : 'prints'; }
  function editorForm() {
    const a = ST.editing, isNew = !ST.data.artworks.find(x => x.id === a.id && a.id);
    const kind = kindOf(a), orig = a.options.find(o => o.kind === 'original'), prints = a.options.filter(o => o.kind !== 'original');
    const imgSrc = ST.img ? URL.createObjectURL(ST.img.thumb) : Site.img(a.thumb || a.image);
    $('#st-view').innerHTML = `
    <div class="st-editor">
      <form class="st-ed-form" id="ed-form" novalidate autocomplete="off">
        <div class="st-card st-ed-photo">
          <img src="${esc(imgSrc)}" alt="" id="ed-img">
          <div class="st-ed-photo-acts"><button type="button" class="chip" id="ed-rot-l" title="Rotate left">⟲ Rotate</button><button type="button" class="chip" id="ed-rot-r" title="Rotate right">⟳</button><label class="chip" style="cursor:pointer">Replace photo<input type="file" accept="image/*" id="ed-replace" hidden></label></div>
          <div class="ed-colors">${(a.colors || []).map(c => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}<span class="muted small">colors detected — powers “shop by color”</span></div>
        </div>

        <div class="st-card">
          <div class="field"><label for="ed-title">Title</label><input class="input big" id="ed-title" value="${esc(a.title)}" placeholder="e.g. Golden Hour Over the Valley" required><div class="err">Give your piece a title.</div></div>
          <div class="field"><span class="label">What are you selling?</span>
            <div class="seg big" id="ed-kind">${[['original', 'Original only'], ['both', 'Original + prints'], ['prints', 'Prints only']].map(([k, l]) => `<button type="button" data-k="${k}" class="${kind === k ? 'is-active' : ''}">${l}</button>`).join('')}</div></div>
          ${orig ? `<div class="grid-2">
            <div class="field"><label for="ed-price">Price of the original</label><div class="affix big"><span>${esc(Site.currencySymbol())}</span><input class="input" id="ed-price" type="number" inputmode="decimal" min="0" step="1" value="${orig.price ?? ''}" placeholder="450"></div><div class="err">Add a price — visible prices sell far better.</div><div class="hint" id="fee-hint"></div></div>
            <div class="field"><span class="label">Availability</span><label class="st-toggle" style="margin-top:6px"><input type="checkbox" id="ed-sold" ${orig.stock === 0 ? 'checked' : ''}><span class="tg"></span><span><b>Original is sold</b><br><span class="muted small">Shows a gallery-style red dot; prints stay for sale</span></span></label></div>
          </div>` : ''}
          ${kind !== 'original' ? `<div class="field"><span class="label">Prints for sale <span class="opt">— leave quantity empty for unlimited (print-on-demand)</span></span>
            <div class="st-prints" id="ed-prints">${prints.map((p, i) => `<div class="st-print" data-i="${i}"><input class="input" data-pf="label" value="${esc(p.label)}" placeholder="Giclée print · 8 × 10 in"><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" data-pf="price" type="number" min="0" value="${p.price ?? ''}" placeholder="35"></div><input class="input" data-pf="stock" type="number" min="0" value="${p.stock ?? ''}" placeholder="Qty ∞"><input class="input" data-pf="edition" type="number" min="0" value="${p.edition ?? ''}" placeholder="Edition of"><button type="button" class="st-x" data-prm="${i}" aria-label="Remove print">✕</button></div>`).join('')}</div>
            <div class="st-presets"><span class="muted small">Quick add:</span>${[['8 × 10 in', 35], ['11 × 14 in', 55], ['16 × 20 in', 85], ['A4', 35], ['A3', 60]].map(([s, p]) => `<button type="button" class="chip" data-preset="${s}|${p}">+ ${s}</button>`).join('')}<button type="button" class="chip" data-preset="|">+ Custom</button></div></div>` : ''}
        </div>

        <div class="st-card">
          <div class="field"><label for="ed-medium">Medium</label><input class="input" id="ed-medium" value="${esc(a.medium)}" placeholder="Acrylic on canvas" list="med-list"><datalist id="med-list">${MEDIUMS.map(m => `<option value="${m}">`).join('')}</datalist>
            <div class="st-presets">${MEDIUMS.slice(0, 7).map(m => `<button type="button" class="chip sm" data-med="${m}">${m}</button>`).join('')}</div></div>
          <div class="grid-3">
            <div class="field"><label for="ed-w">Width</label><input class="input" id="ed-w" type="number" min="0" step="0.1" value="${a.width ?? ''}" placeholder="24"></div>
            <div class="field"><label for="ed-h">Height</label><input class="input" id="ed-h" type="number" min="0" step="0.1" value="${a.height ?? ''}" placeholder="30"></div>
            <div class="field"><span class="label">Units</span><div class="seg" id="ed-unit"><button type="button" data-u="in" class="${a.unit !== 'cm' ? 'is-active' : ''}">inches</button><button type="button" data-u="cm" class="${a.unit === 'cm' ? 'is-active' : ''}">cm</button></div></div>
          </div>
          <div class="hint" style="margin-top:-6px">Size powers the “View on your wall” preview. <button type="button" class="link-u" id="ed-ratio" style="color:var(--blue);font-weight:700">Fill height from photo proportions</button></div>
          <div class="field"><label for="ed-desc">The story <span class="opt">(2–4 sentences sells better than none)</span></label><textarea class="textarea" id="ed-desc" rows="4" placeholder="What inspired it? How was it made? How should it feel?">${esc(a.description)}</textarea>
            <div class="st-presets">${PROMPTS.map(p => `<button type="button" class="chip sm" data-prompt="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>
          <div class="grid-2">
            <div class="field"><label for="ed-year">Year</label><input class="input" id="ed-year" type="number" value="${a.year ?? ''}"></div>
            <div class="field"><label for="ed-tags">Tags <span class="opt">(comma separated — helps search)</span></label><input class="input" id="ed-tags" value="${esc((a.tags || []).join(', '))}" placeholder="landscape, sunset, warm"></div>
          </div>
        </div>

        <div class="st-card st-toggles">
          <label class="st-toggle"><input type="checkbox" id="ed-feat" ${a.featured ? 'checked' : ''}><span class="tg"></span><span><b>★ Feature on my cover page</b><br><span class="muted small">Shows in “Hand-picked favorites”</span></span></label>
          <label class="st-toggle"><input type="checkbox" id="ed-framed" ${a.framed ? 'checked' : ''}><span class="tg"></span><span><b>Framed</b><br><span class="muted small">Arrives ready to hang</span></span></label>
          <label class="st-toggle"><input type="checkbox" id="ed-signed" ${a.signed !== false ? 'checked' : ''}><span class="tg"></span><span><b>Signed</b></span></label>
          <label class="st-toggle"><input type="checkbox" id="ed-hidden" ${a.status === 'hidden' ? 'checked' : ''}><span class="tg"></span><span><b>Hide from site</b><br><span class="muted small">Keep as a private draft</span></span></label>
        </div>

        <details class="st-card st-adv"><summary><b>Advanced</b> <span class="muted small">— sale price, web address, date</span></summary>
          <div class="grid-3" style="margin-top:16px">
            <div class="field"><label for="ed-cmp">“Was” price (shows as a sale)</label><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" id="ed-cmp" type="number" min="0" value="${a.compareAt ?? ''}" placeholder="—"></div></div>
            <div class="field"><label for="ed-id">Web address</label><input class="input" id="ed-id" value="${esc(a.id)}" placeholder="auto from title" ${isNew ? '' : 'readonly title="Fixed after creation so shared links keep working"'}></div>
            <div class="field"><label for="ed-date">Date listed</label><input class="input" id="ed-date" type="date" value="${esc(a.createdAt || '')}"></div>
          </div></details>

        <div class="st-ed-actions">
          <button type="submit" class="btn btn-accent btn-lg" id="ed-save">${isNew ? 'Publish to my gallery' : 'Save changes'}</button>
          ${isNew ? `<button type="button" class="btn btn-ghost btn-lg" id="ed-save-next">Save & add another</button>` : `<button type="button" class="btn btn-ghost" id="ed-del">Delete</button>`}
          <a href="#artworks" class="link-u muted" id="ed-cancel">Cancel</a>
        </div>
      </form>

      <aside class="st-ed-preview">
        <div class="label">Live preview — exactly how buyers see it</div>
        <div class="st-prev-card" id="ed-prev"></div>
        <div class="st-prev-note muted small">Every listing gets a <b>Buy Now</b> button, wishlist heart, “View on your wall” preview, Google-friendly product data and share buttons automatically.</div>
      </aside>
    </div>`;
    wireEditor();
  }
  function readEditor() {
    const a = ST.editing, v = id => $('#' + id) ? $('#' + id).value : '';
    a.title = v('ed-title').trim();
    const orig = a.options.find(o => o.kind === 'original');
    if (orig && $('#ed-price')) { orig.price = v('ed-price') === '' ? null : Number(v('ed-price')); orig.stock = $('#ed-sold').checked ? 0 : 1; orig.label = a.framed ? 'Original painting (framed)' : 'Original painting'; }
    $$('#ed-prints .st-print').forEach(r => { const p = a.options.filter(o => o.kind !== 'original')[+r.dataset.i]; if (!p) return; const g = f => r.querySelector(`[data-pf="${f}"]`).value; p.label = g('label') || 'Print'; p.price = g('price') === '' ? null : Number(g('price')); p.stock = g('stock') === '' ? null : Number(g('stock')); p.edition = g('edition') === '' ? undefined : Number(g('edition')); });
    a.medium = v('ed-medium').trim(); a.width = v('ed-w') === '' ? null : Number(v('ed-w')); a.height = v('ed-h') === '' ? null : Number(v('ed-h'));
    a.description = v('ed-desc').trim(); a.year = v('ed-year') ? Number(v('ed-year')) : ''; a.tags = v('ed-tags').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    a.featured = $('#ed-feat').checked; a.framed = $('#ed-framed').checked; a.signed = $('#ed-signed').checked;
    a.status = $('#ed-hidden').checked ? 'hidden' : 'available';
    a.compareAt = v('ed-cmp') === '' ? null : Number(v('ed-cmp')); a.createdAt = v('ed-date') || a.createdAt;
    if (orig) orig.label = a.framed ? 'Original painting (framed)' : 'Original painting';
    return a;
  }
  function wireEditor() {
    const form = $('#ed-form');
    const prev = () => {
      const a = clone(readEditor());
      a.id = a.id || 'preview'; a.title = a.title || 'Untitled'; a.options.forEach(o => { if (o.price == null) o.price = 0; });
      if (ST.img) { if (!ST.img.url) ST.img.url = URL.createObjectURL(ST.img.thumb); a.thumb = a.image = ST.img.url; }
      $('#ed-prev').innerHTML = Site.card(Site.normalize({ settings: S(), artworks: [a] }).artworks[0], { reveal: false }).replace('img-develop', '');
      Site.enhance($('#ed-prev'));
      const orig = a.options.find(o => o.kind === 'original'); const fh = $('#fee-hint');
      if (fh) { const p = orig && orig.price; fh.innerHTML = p ? `After PayPal’s ~3.49% + $0.49 fee you keep ≈ <b>${money(p - (p * .0349 + .49))}</b> · Zelle: <b>${money(p)}</b>` : ''; }
    };
    form.addEventListener('input', () => { ST.dirtyEditor = true; prev(); });
    form.addEventListener('change', prev);
    prev();
    $('#ed-kind').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return; readEditor(); const a = ST.editing, k = b.dataset.k;
      let orig = a.options.find(o => o.kind === 'original'); let prints = a.options.filter(o => o.kind !== 'original');
      if (k !== 'prints' && !orig) orig = { id: 'original', label: 'Original painting', price: null, stock: 1, kind: 'original' };
      if (k === 'prints') orig = null;
      if (k === 'original') prints = [];
      if (k !== 'original' && !prints.length) prints = [{ id: 'print-' + rid(), label: 'Giclée print · 8 × 10 in', price: 35, stock: null, kind: 'print' }];
      a.options = [orig, ...prints].filter(Boolean); editorForm();
    };
    const pr = $('#ed-prints');
    if (pr) pr.onclick = e => { const b = e.target.closest('[data-prm]'); if (!b) return; readEditor(); const prints = ST.editing.options.filter(o => o.kind !== 'original'); const p = prints[+b.dataset.prm]; ST.editing.options = ST.editing.options.filter(o => o !== p); if (!ST.editing.options.length) ST.editing.options = [{ id: 'original', label: 'Original painting', price: null, stock: 1, kind: 'original' }]; editorForm(); };
    $$('[data-preset]').forEach(b => b.onclick = () => { readEditor(); const [s, p] = b.dataset.preset.split('|'); ST.editing.options.push({ id: 'print-' + rid(), label: s ? `Giclée print · ${s}` : '', price: p ? Number(p) : null, stock: null, kind: 'print' }); editorForm(); setTimeout(() => { const rows = $$('#ed-prints .st-print'); const last = rows[rows.length - 1]; last && last.querySelector(s ? '[data-pf=stock]' : '[data-pf=label]').focus(); }, 30); });
    $$('[data-med]').forEach(b => b.onclick = () => { $('#ed-medium').value = b.dataset.med; prev(); });
    $$('[data-prompt]').forEach(b => b.onclick = () => { const t = $('#ed-desc'); t.value = (t.value ? t.value.trim() + ' ' : '') + b.dataset.prompt + ' '; t.focus(); t.setSelectionRange(t.value.length, t.value.length); prev(); });
    $('#ed-unit').onclick = e => { const b = e.target.closest('[data-u]'); if (!b) return; ST.editing.unit = b.dataset.u; $$('#ed-unit button').forEach(x => x.classList.toggle('is-active', x === b)); prev(); };
    $('#ed-ratio').onclick = () => { const w = Number($('#ed-w').value); const a = ST.editing; if (!w) { Site.toast('Enter the width first.'); $('#ed-w').focus(); return; } const r = (ST.img ? ST.img.h / ST.img.w : a.imgH / a.imgW) || 1.25; $('#ed-h').value = Math.round(w * r * 10) / 10; prev(); };
    const rot = async d => { const src = ST.img ? ST.img.file : null; if (!src) { Site.toast('Rotate works on newly added photos — use “Replace photo” to rotate this one.'); return; } const r = ((ST.img.rot || 0) + d + 360) % 360; const out = await processImage(src, r); ST.img = { ...out, file: src, rot: r }; ST.editing.imgW = out.w; ST.editing.imgH = out.h; ST.editing.colors = out.colors; $('#ed-img').src = URL.createObjectURL(out.thumb); prev(); };
    $('#ed-rot-l').onclick = () => rot(-90); $('#ed-rot-r').onclick = () => rot(90);
    $('#ed-replace').onchange = async e => { const f = e.target.files[0]; if (!f) return; const out = await processImage(f); ST.img = { ...out, file: f, rot: 0 }; ST.editing.imgW = out.w; ST.editing.imgH = out.h; ST.editing.colors = out.colors; editorForm(); };
    const del = $('#ed-del'); if (del) del.onclick = () => confirmBox(`Delete “${esc(ST.editing.title)}”?`, 'It will disappear from your site when you next publish.', 'Delete', () => { ST.data.artworks = ST.data.artworks.filter(x => x.id !== ST.editing.id); ST.dirtyEditor = false; save(); location.hash = '#artworks'; });
    $('#ed-cancel').onclick = () => { ST.dirtyEditor = false; ST.queue = []; };
    form.addEventListener('submit', e => { e.preventDefault(); commit(false); });
    const nx = $('#ed-save-next'); if (nx) nx.onclick = () => commit(true);
  }
  async function commit(another) {
    const a = readEditor();
    let bad = null;
    const t = $('#ed-title').closest('.field'); t.classList.toggle('invalid', !a.title); if (!a.title) bad = $('#ed-title');
    const orig = a.options.find(o => o.kind === 'original'); if (orig && $('#ed-price')) { const f = $('#ed-price').closest('.field'); const ok = orig.price > 0; f.classList.toggle('invalid', !ok); if (!ok && !bad) bad = $('#ed-price'); }
    const badPrint = a.options.find(o => o.kind !== 'original' && !(o.price > 0));
    if (badPrint && !bad) { Site.toast('Each print needs a price.', { color: 'var(--red)' }); return; }
    if (bad) { bad.focus(); bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const isNew = !ST.data.artworks.some(x => x.id === a.id && a.id);
    if (isNew) a.id = uniqueId(($('#ed-id').value || a.title));
    a.options.forEach(o => { if (o.kind !== 'original' && (!o.id || o.id === 'print')) o.id = 'print-' + rid(); if (o.edition === undefined) delete o.edition; });
    const btn = $('#ed-save'); btn.classList.add('is-loading');
    if (ST.img) {
      const stem = `art/${a.id}-${rid()}`;
      a.image = `${stem}.${ST.img.ext}`; a.thumb = `${stem}-thumb.${ST.img.ext}`; a.imgW = ST.img.w; a.imgH = ST.img.h; a.colors = ST.img.colors;
      await storeFile(a.image, ST.img.full); await storeFile(a.thumb, ST.img.thumb);
    }
    delete a.sample;
    const L = ST.data.artworks, i = L.findIndex(x => x.id === a.id);
    if (i >= 0) L[i] = a; else L.unshift(a);
    if (!S().heroArtwork || !L.find(x => x.id === S().heroArtwork) || (L.find(x => x.id === S().heroArtwork) || {}).sample) { if (a.featured || !S().heroArtwork) S().heroArtwork = a.id; }
    ST.dirtyEditor = false; ST.img = null; await save(true);
    if (window.FX) FX.confetti();
    Site.toast(`${isNew ? 'Listed' : 'Saved'} “${esc(a.title)}” ✓ — <a href="#publish" style="color:var(--ochre);text-decoration:underline">publish</a> when you're ready to go live`, { ms: 5000 });
    if (another || ST.queue.length) { location.hash = '#new'; if (location.hash === '#new') route(); }
    else location.hash = '#artworks';
  }

  /* ============================================================ PROFILE */
  function profile() {
    LS.set('profileDone', 1);
    const arts = ST.data.artworks.filter(a => a.status !== 'hidden');
    const ACC = ['#e2492f', '#f3a712', '#2f4cc0', '#1f8a70', '#e86a92', '#6b4fa0', '#c65a3a', '#1c1915'];
    $('#st-view').innerHTML = `<div class="st-grid-2">
      <div>
        ${F.card('The basics', F.text('settings.artistName', 'Artist name', { help: 'Appears in the logo, the big cover-page title and your signature.' }) + F.text('settings.heroEyebrow', 'What you make (one line)', { ph: 'Original paintings & limited-edition prints' }) + F.area('settings.tagline', 'Tagline under your name', { rows: 2 }) + F.text('settings.location', 'Where you paint', { opt: true, ph: 'Austin, Texas' }) + F.text('settings.contactEmail', 'Public contact email', { type: 'email', opt: true, spell: false, help: 'Shown on the About page and at checkout for questions.' }))}
        ${F.card('Your story', F.area('settings.intro', 'Short intro (cover page)', { rows: 4 }) + F.area('settings.bio', 'Full bio (About page)', { rows: 9, help: 'Leave an empty line between paragraphs.' }) + F.area('settings.statement', 'Artist statement (one or two sentences)', { rows: 2 }))}
        ${F.card('Process (cover page)', F.list('settings.process', 'Four steps that show how you work', [p => F.text(p + '.title', 'Step title'), p => F.area(p + '.text', 'Description', { rows: 2 })], { add: 'Add a step' }))}
      </div>
      <div>
        ${F.card('Portrait / studio photo', `<div class="st-portrait"><img src="${esc(Site.img(S().portrait))}" alt="" id="pf-img"><label class="btn btn-ghost btn-sm" style="cursor:pointer">Upload photo<input type="file" accept="image/*" id="pf-file" hidden></label></div><p class="hint">A photo of you, your hands, or your studio builds trust. Portrait orientation (4:5) looks best.</p>`)}
        ${F.card('Cover page', F.select('settings.heroArtwork', '“On the easel” painting (the interactive sketch-to-color hero)', [['', 'Automatic (first featured)'], ...arts.map(a => [a.id, a.title])]) + `<div class="field"><span class="label">Accent color</span><div class="swatches">${ACC.map(c => `<button type="button" class="swatch ${S().accent === c ? 'is-active' : ''}" style="background:${c}" data-acc="${c}" aria-label="${c}"></button>`).join('')}<input type="color" data-path="settings.accent" value="${esc(S().accent)}" style="width:40px;height:34px;border:0;background:none"></div></div>`)}
        ${F.card('Social links', ['instagram', 'tiktok', 'youtube', 'pinterest', 'x', 'facebook'].map(k => F.text('settings.social.' + k, k[0].toUpperCase() + k.slice(1), { opt: true, ph: k === 'x' ? '@handle or full link' : '@yourhandle or full link', spell: false })).join(''))}
        ${F.card('Commissions', F.toggle('settings.commissions.open', 'Accept commission requests', 'Shows the Commissions page and form') + F.area('settings.commissions.text', 'Commission intro', { rows: 3 }) + `<div class="grid-2">${F.num('settings.commissions.startingAt', 'Starting at', { pre: Site.currencySymbol() })}${F.text('settings.commissions.leadTime', 'Typical timeline', { ph: '4–6 weeks' })}</div>`)}
      </div></div>
      ${F.card('Collector testimonials', F.list('settings.testimonials', 'Only real quotes from real buyers — the section stays hidden until you add one.', [p => F.area(p + '.quote', 'Quote', { rows: 2 }), p => `<div class="grid-3">${F.text(p + '.name', 'Name')}${F.text(p + '.location', 'City', { opt: true })}${F.text(p + '.artwork', 'Artwork they bought', { opt: true })}</div>`], { add: 'Add testimonial', empty: 'No testimonials yet. After your first sales, ask buyers for a sentence — it’s powerful social proof.' }))}
      ${F.card('FAQ & policies', F.list('settings.faq', 'Frequently asked questions (About page + Google rich results)', [p => F.text(p + '.q', 'Question'), p => F.area(p + '.a', 'Answer', { rows: 3 })], { add: 'Add question' }) + '<hr class="st-hr">' + F.area('settings.policies.returns', 'Returns policy', { rows: 3 }) + F.area('settings.policies.coa', 'Certificate of authenticity', { rows: 2 }) + F.area('settings.policies.care', 'Care instructions', { rows: 2 }))}
      ${F.card('Search engines (SEO)', F.text('settings.siteTitle', 'Site title (browser tab & Google)') + F.area('settings.seo.description', 'Description shown in Google results', { rows: 2, help: 'About 150 characters. Mention what you make and where you ship.' }) + F.text('settings.domain', 'Your domain', { ph: 'yourname.art', opt: true, spell: false, help: 'Used to build your sitemap.xml for Google Search Console.' }))}`;
    $$('[data-acc]').forEach(b => b.onclick = () => { S().accent = b.dataset.acc; document.documentElement.style.setProperty('--accent', b.dataset.acc); save(); route(); });
    $('#pf-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; const r = await processImage(f); const p = `art/portrait-${rid()}.${r.ext}`; await storeFile(p, r.full); S().portrait = p; save(); $('#pf-img').src = Site.img(p); Site.toast('Portrait updated ✓'); };
  }

  /* ============================================================ PAYMENTS */
  function payments() {
    const P = S().payments;
    const help = (t) => `<details class="st-how"><summary>How do I get this?</summary><div>${t}</div></details>`;
    $('#st-view').innerHTML = `
      <p class="st-lead">Turn on as many as you like — buyers pick their favorite at checkout. Only filled-in methods appear on your site. <b>Tip:</b> PayPal alone gives buyers PayPal, Venmo, Pay Later and credit/debit cards.</p>
      <div class="st-grid-2">
      <div>
        ${F.card('PayPal checkout <span class="pill ok">Recommended</span>', F.text('settings.payments.paypalClientId', 'PayPal Client ID', { spell: false, ph: 'AbC123…', help: 'Enables real PayPal buttons: PayPal, Venmo (US mobile), Pay Later and guest card checkout, with buyer & seller protection. Money lands in your PayPal account instantly.' }) + help(`<ol><li>Create a free <b>PayPal Business</b> account (or upgrade your personal one) at paypal.com/business.</li><li>Go to <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener">developer.paypal.com → Apps & Credentials</a> and log in.</li><li>Switch the toggle to <b>Live</b>, click <b>Create App</b>, give it any name.</li><li>Copy the <b>Client ID</b> (NOT the secret) and paste it here.</li><li>Publish. Test with a small real purchase and refund yourself.</li></ol>`), { cls: 'pay-card pp' })}
        ${F.card('Venmo', F.text('settings.payments.venmo', 'Venmo username', { ph: '@your-name', spell: false, help: 'Buyers get a one-tap Venmo link (and a QR code on desktop) with the exact amount and order number pre-filled. A Venmo <b>business profile</b> gives you purchase protection & lower friction.' }), { cls: 'pay-card vm' })}
        ${F.card('Zelle', `<div class="grid-2">${F.text('settings.payments.zelle', 'Zelle email or US phone', { spell: false })}${F.text('settings.payments.zelleName', 'Name buyers will see', { opt: true })}</div><p class="hint">No fees. Buyers see copy buttons for your Zelle contact, the amount and memo. Best for returning buyers you trust (Zelle has no purchase protection).</p>`, { cls: 'pay-card zl' })}
        ${F.card('Cash App', F.text('settings.payments.cashapp', 'Cash App $cashtag', { ph: '$yourname', spell: false, help: 'Opens Cash App with the amount pre-filled.' }), { cls: 'pay-card ca' })}
      </div>
      <div>
        ${F.card('Apple Pay · Google Pay · cards (Stripe)', F.text('settings.payments.stripeLink', 'Stripe Payment Link (customer-chooses-amount)', { spell: false, ph: 'https://buy.stripe.com/…' }) + help(`<ol><li>Create a free <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener">Stripe account</a>.</li><li>Go to <b>Payment Links → + New</b>, choose <b>“Customers choose what to pay”</b>, name it “Art order”.</li><li>Under <b>After payment</b> choose <b>Don't show confirmation page → redirect</b> to <code>https://YOUR-DOMAIN/thank-you.html</code></li><li>Copy the link and paste it here. Buyers are told the exact amount to enter, and the order number is attached automatically.</li></ol>`), { cls: 'pay-card st' })}
        ${F.card('PayPal.me (simple option)', F.text('settings.payments.paypalMe', 'PayPal.me username', { ph: 'yourname', spell: false, help: 'Used only when no PayPal Client ID is set. Opens paypal.me with the amount filled in.' }))}
        ${F.card('Other methods', F.list('settings.payments.custom', 'Anything else — bank transfer, Wise, Revolut, crypto, cash on pickup…', [p => `<div class="grid-2">${F.text(p + '.name', 'Name shown to buyers')}${F.text(p + '.short', 'One-line description', { opt: true })}</div>`, p => F.area(p + '.instructions', 'Instructions (use {amount} and {order})', { rows: 2 })], { add: 'Add a payment method' }) + F.toggle('settings.payments.invoice', 'Offer “Request an invoice”', 'Buyer places the order; you email them a payment link. Always shown if nothing else is set up.'))}
        ${F.card('Currency', F.select('settings.currency', 'Prices are in', ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'INR', 'NZD', 'SGD', 'JPY', 'MXN'], { help: 'PayPal & Stripe support all of these. Venmo, Zelle and Cash App are USD only.' }))}
      </div></div>
      ${F.card('What you actually keep — fee comparison', `<div class="st-fee-top"><label class="label" for="fee-amt">For a sale of</label><div class="affix" style="max-width:180px"><span>${esc(Site.currencySymbol())}</span><input class="input" id="fee-amt" type="number" value="480"></div></div><div id="fee-table"></div><p class="muted small">Approximate US rates as of mid-2026 — providers change pricing, so check their sites. Card-based methods include fraud & buyer protection; bank transfers (Zelle) are free but offer no protection.</p>`)}`;
    const FEES = [['PayPal checkout / Venmo via PayPal', 3.49, .49], ['Stripe (cards, Apple & Google Pay)', 2.9, .30], ['Venmo business profile', 1.9, .10], ['Cash App for Business', 2.75, 0], ['Zelle', 0, 0]];
    const drawFees = () => { const v = Number($('#fee-amt').value) || 0; $('#fee-table').innerHTML = `<table class="st-table"><thead><tr><th>Method</th><th>Fee</th><th>You keep</th></tr></thead><tbody>${FEES.map(([n, p, f]) => { const fee = v ? v * p / 100 + f : 0; return `<tr><td>${n}<br><span class="muted small">${p}%${f ? ` + $${f.toFixed(2)}` : ''}</span></td><td>${money(fee)}</td><td><b>${money(v - fee)}</b></td></tr>`; }).join('')}</tbody></table>`; };
    $('#fee-amt').oninput = drawFees; drawFees();
  }

  /* ============================================================ ORDERS & EMAILS */
  function orders() {
    const O = S().orders;
    $('#st-view').innerHTML = `<div class="st-grid-2"><div>
      ${F.card('Where do orders go?', `<p class="st-lead" style="margin-top:0">When someone checks out, their name, email, phone, shipping address and order details are emailed to you instantly. Your website has no database to hack — orders live in your inbox.</p>` + F.text('settings.orders.web3formsKey', 'Web3Forms access key <span class="pill ok">Recommended · free</span>', { spell: false, ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', help: 'Free for 250 emails a month. <a class="link-u" href="https://web3forms.com/" target="_blank" rel="noopener">Get your key at web3forms.com</a> — enter your email, and they send you the key instantly. No password, no credit card.' }) + `<div class="or">or</div>` + F.text('settings.orders.formsubmitEmail', 'Just use my email (FormSubmit)', { type: 'email', spell: false, ph: 'you@gmail.com', help: 'Zero setup: the very first order sends you a one-time “activate” email from FormSubmit — click it and you’re done.' }) + `<button class="btn btn-ghost" id="test-mail" type="button">Send a test order email</button><div id="test-res" class="hint" style="margin-top:10px"></div>`)}
      </div><div>
      ${F.card('When an order comes in', `<ol class="st-flow"><li><b>Check the payment arrived</b> in PayPal / Venmo / Zelle / Stripe. The email tells you which method and the order number (e.g. SK-1027-7QX2).</li><li><b>Mark it sold</b> in <a class="link-u" href="#artworks">Artworks</a> (the ● button) and hit <b>Publish</b> — the red “sold” dot appears on your site.</li><li><b>Reply to the buyer</b> (just hit reply — their email is the reply-to) with a thank-you.</li><li><b>Pack & ship</b> with tracking + insurance, then send them the tracking number.</li></ol><p class="muted small">Tip: for originals, only one person can buy — but two people could click “buy” within minutes of each other before you mark it sold. If that happens, refund the second buyer and offer them a print or a commission.</p>`)}
      ${F.card('Google Analytics (optional)', F.text('settings.analytics.ga4', 'GA4 Measurement ID', { ph: 'G-XXXXXXXXXX', spell: false, help: 'See visitors, where they come from, and which paintings get viewed, added to cart and bought (e-commerce events are sent automatically).' }))}
      </div></div>`;
    $('#test-mail').onclick = async () => {
      const b = $('#test-mail'); b.classList.add('is-loading'); Site.S = S();
      const r = await Site.sendForm('🎨 Test order from your Studio', { Order: 'TEST-0001', Status: 'This is a test', 'Payment method': 'Venmo', Total: '$1.00', 'Ship to': 'Jane Collector\n123 Gallery Lane\nArt City, CA 90000\nUnited States', email: S().contactEmail || S().orders.formsubmitEmail || 'test@example.com' });
      b.classList.remove('is-loading');
      $('#test-res').innerHTML = r.ok ? '<b style="color:var(--green)">✓ Sent! Check your inbox (and spam folder).</b>' : r.reason === 'not-configured' ? 'Add a Web3Forms key or your email above first.' : '<b style="color:var(--red)">Couldn’t send. Double-check the key/email. (If you opened this page as a file on your computer, publish first — some services block local files.)</b>';
    };
  }

  /* ============================================================ SHIPPING & PRICING */
  function shipping() {
    const s = S();
    $('#st-view').innerHTML = `<div class="st-grid-2"><div>
      ${F.card('Shipping rates', F.select('settings.shipping.homeCountry', 'You ship from', [['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['IN', 'India'], ['DE', 'Germany'], ['FR', 'France'], ['NZ', 'New Zealand'], ['IE', 'Ireland'], ['NL', 'Netherlands'], ['SG', 'Singapore']]) + `<div class="grid-2">${F.num('settings.shipping.domestic', 'Domestic (per order)', { pre: Site.currencySymbol() })}${F.num('settings.shipping.international', 'International (per order)', { pre: Site.currencySymbol() })}</div>` + F.num('settings.shipping.freeOver', 'Free domestic shipping on orders over', { pre: Site.currencySymbol(), help: 'Set 0 to turn off. Tip: set it a bit above your most common print price so buyers add a second piece.' }) + F.toggle('settings.shipping.expressEnabled', 'Offer express shipping') + F.num('settings.shipping.express', 'Express surcharge', { pre: Site.currencySymbol() }) + F.text('settings.shipping.processing', 'Processing time', { ph: 'Ships in 3–5 business days' }) + F.area('settings.shipping.note', 'How you pack', { rows: 2 }) + F.num('settings.taxRate', 'Sales tax (%)', { suf: '%', step: '0.01', help: 'Leave 0 unless you are registered to collect sales tax. Rules vary by state/country — check with a tax professional.' }))}
      </div><div>
      ${F.card('Pricing calculator', `<p class="st-lead" style="margin-top:0">Two proven ways artists price originals. Use the higher one as your floor — and keep prices consistent everywhere you sell.</p>
        <div class="grid-2"><div class="field"><label>Materials & canvas</label><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" id="pc-mat" type="number" value="60"></div></div><div class="field"><label>Framing (if any)</label><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" id="pc-frame" type="number" value="0"></div></div></div>
        <div class="grid-2"><div class="field"><label>Hours spent</label><input class="input" id="pc-hrs" type="number" value="12"></div><div class="field"><label>Your hourly rate</label><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" id="pc-rate" type="number" value="25"></div></div></div>
        <div class="grid-2"><div class="field"><label>Width × height (in)</label><div style="display:flex;gap:6px"><input class="input" id="pc-w" type="number" value="24"><input class="input" id="pc-h" type="number" value="30"></div></div><div class="field"><label>Price per square inch</label><div class="affix"><span>${esc(Site.currencySymbol())}</span><input class="input" id="pc-sq" type="number" step="0.05" value="0.60"></div><div class="hint">Emerging artists often use $0.30–$1.50/sq in.</div></div></div>
        <div class="st-price-out" id="pc-out"></div>`)}
      ${F.card('Pricing wisdom', `<ul class="st-wisdom"><li><b>Never undercut your own originals.</b> Prices that only go up build collector confidence.</li><li><b>Round, confident numbers</b> ($450, not $449.99) signal art, not merchandise.</li><li><b>Prints are your volume engine.</b> Aim for prints at 5–15% of the original’s price.</li><li><b>Limited editions</b> (e.g. “edition of 50”) justify higher print prices and create real scarcity.</li><li><b>Account for fees and shipping</b> — use the fee table in Payments to see your true take-home.</li></ul>`)}
      </div></div>`;
    const calc = () => {
      const g = id => Number($('#' + id).value) || 0;
      const cost = g('pc-mat') + g('pc-frame'), labor = g('pc-hrs') * g('pc-rate'), a = cost + labor, b = g('pc-w') * g('pc-h') * g('pc-sq') + cost;
      const lo = Math.min(a, b), hi = Math.max(a, b), round = v => v < 100 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10;
      $('#pc-out').innerHTML = `<div><span>Time + materials</span><b>${money(round(a))}</b></div><div><span>Square-inch method</span><b>${money(round(b))}</b></div><div class="rec"><span>Suggested original price</span><b>${money(round(hi))}</b><span class="muted small">Prints: ${money(round(hi * .07))}–${money(round(hi * .15))}</span></div>`;
    };
    $$('#pc-mat,#pc-frame,#pc-hrs,#pc-rate,#pc-w,#pc-h,#pc-sq').forEach(el => el.oninput = calc); calc();
  }

  /* ============================================================ MARKETING */
  function marketing() {
    $('#st-view').innerHTML = `<div class="st-grid-2"><div>
      ${F.card('Announcement bar', F.text('settings.announcement', 'Message across the top of every page', { opt: true, ph: 'Free shipping over $200 · New collection just dropped' }) + '<p class="hint">Leave empty to hide it. Great for launches, sales and free-shipping offers.</p>')}
      ${F.card('Discount codes', F.list('settings.discounts', 'Codes buyers can enter at checkout', [p => `<div class="grid-3">${F.text(p + '.code', 'Code', { spell: false })}${F.num(p + '.percent', '% off')}${F.num(p + '.minSubtotal', 'Min. order', { pre: Site.currencySymbol() })}</div>`, p => F.toggle(p + '.active', 'Active')], { add: 'Add a code' }))}
      ${F.card('Collector bundle', F.toggle('settings.bundle.enabled', 'Automatic multi-piece discount', 'Rewards buyers who take home more than one piece — shown in the cart as a nudge') + `<div class="grid-2">${F.num('settings.bundle.minItems', 'When buying at least', { suf: 'pieces', min: 2 })}${F.num('settings.bundle.percent', 'Discount', { suf: '%' })}</div>`)}
      </div><div>
      ${F.card('Collector’s List (email signups)', F.toggle('settings.newsletter.enabled', 'Show signup forms') + F.toggle('settings.newsletter.popup', 'Gentle popup', 'Appears once after ~40 seconds or 60% scroll; hidden for 10 days after') + F.text('settings.newsletter.headline', 'Headline') + F.area('settings.newsletter.text', 'Pitch', { rows: 2 }) + F.text('settings.newsletter.offerCode', 'Welcome code (from the list on the left)', { opt: true, spell: false, help: 'Shown after someone signs up, and remembered at checkout.' }) + '<p class="hint">Signups arrive by email (set up in Orders & emails). Paste them into Mailchimp, Kit or Buttondown when you send a newsletter.</p>')}
      ${F.card('Social proof numbers', `<div class="grid-2">${F.num('settings.stats.collectors', 'Happy collectors')}${F.num('settings.stats.countries', 'Countries shipped to')}</div><p class="hint">Only shown when above zero. Keep them honest — they’re shown on your cover page.</p>`)}
      ${F.card('Marketing playbook', `<ol class="st-wisdom"><li><b>Link your site everywhere</b> — Instagram/TikTok bio, email signature, business cards at markets.</li><li><b>Pinterest is a search engine for art.</b> Every artwork page has a “Pin it” button — pin your own work to boards.</li><li><b>Launch in “drops”.</b> Announce a date, show previews, email your list first — scarcity that’s real.</li><li><b>Show scale.</b> Buyers love the “View on your wall” preview — share screenshots of it.</li><li><b>Ask every buyer for a photo</b> of the piece in their home — then add their words as a testimonial.</li><li><b>Submit your sitemap</b> to Google Search Console after launch so your paintings appear in Google.</li></ol>`)}
      </div></div>`;
  }

  /* ============================================================ PUBLISH */
  function publish() {
    const ch = changes(), gh = LS.get('ghConfig', {}) || {};
    $('#st-view').innerHTML = `
      ${F.card(ch.length ? `${ch.length} change${ch.length > 1 ? 's' : ''} ready to go live` : 'Everything is published ✓', ch.length ? `<ul class="st-changes">${ch.slice(0, 14).map(c => `<li><span class="sym">${c[0]}</span>${esc(c[1])}</li>`).join('')}${ch.length > 14 ? `<li class="muted">…and ${ch.length - 14} more</li>` : ''}</ul><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="pv">Preview changes ↗</button><button class="btn btn-ghost btn-sm" id="discard">Discard all changes</button></div>` : `<p class="muted" style="margin:0">Your live website matches your Studio. Add or edit something and it will show up here.</p>`)}
      <div class="st-grid-2">
        ${F.card('<span class="pill accent">A</span> One-click publish', `
          <p class="st-lead" style="margin-top:0">Best if your site is hosted on <b>GitHub Pages</b>, Netlify or Cloudflare Pages connected to a GitHub repository. Publishing takes ~1 minute to appear.</p>
          <div class="grid-2"><div class="field"><label for="gh-owner">GitHub username</label><input class="input" id="gh-owner" value="${esc(gh.owner || '')}" spellcheck="false" autocomplete="off"></div><div class="field"><label for="gh-repo">Repository name</label><input class="input" id="gh-repo" value="${esc(gh.repo || '')}" spellcheck="false" autocomplete="off" placeholder="my-art-site"></div></div>
          <div class="grid-2"><div class="field"><label for="gh-branch">Branch</label><input class="input" id="gh-branch" value="${esc(gh.branch || 'main')}" spellcheck="false"></div><div class="field"><label for="gh-dir">Site folder in repo <span class="opt">(if not the root)</span></label><input class="input" id="gh-dir" value="${esc(gh.dir || '')}" placeholder="(root)" spellcheck="false"></div></div>
          <div class="field"><label for="gh-token">Access token</label><input class="input" id="gh-token" type="password" value="${esc(LS.get('ghToken', '') || '')}" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><div class="hint">Stored only in this browser. <a class="link-u" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a fine-grained token</a> → Repository access: <b>Only select repositories</b> (your site) → Permissions → <b>Contents: Read and write</b>.</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn btn-accent btn-lg" id="gh-go" ${ch.length ? '' : 'disabled'}>Publish now</button><button class="btn btn-ghost btn-sm" id="gh-test">Test connection</button><button class="link-u muted small" id="gh-forget">Forget token</button></div>
          <div class="st-progress" id="gh-prog" hidden><div class="bar"><i id="gh-bar"></i></div><ol id="gh-log"></ol></div>`)}
        ${F.card('<span class="pill">B</span> Download update', `
          <p class="st-lead" style="margin-top:0">For any host (Netlify Drop, Hostinger, cPanel, etc.). Download a small .zip with your updated data and new images, unzip it <b>into your website folder</b> (say “replace” when asked), then upload/drag the folder to your host again.</p>
          <button class="btn btn-ghost btn-lg" id="zip-go">Download update (.zip)</button>
          <label class="check" style="margin-top:12px"><input type="checkbox" id="zip-all"> Include <i>all</i> images I've added in this browser (use this if you're not sure what's uploaded)</label>
          <hr class="st-hr">
          <p class="label">Backups</p><p class="muted small">Save everything (including images you added here) as one file — to move to another computer or keep safe.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="bk-save">Download backup</button><label class="btn btn-ghost btn-sm" style="cursor:pointer">Restore backup<input type="file" accept=".json,application/json" id="bk-load" hidden></label></div>`)}
      </div>`;
    const pv = $('#pv'); if (pv) pv.onclick = () => $('#st-preview').click();
    const dc = $('#discard'); if (dc) dc.onclick = () => confirmBox('Discard all unpublished changes?', 'Your Studio will go back to exactly what’s live on your website.', 'Discard', () => { ST.data = clone(ST.live); Site.data = ST.data; Site.S = ST.data.settings; save(true); route(); });
    const cfg = () => { const c = { owner: $('#gh-owner').value.trim(), repo: $('#gh-repo').value.trim().replace(/\.git$/, ''), branch: $('#gh-branch').value.trim() || 'main', dir: $('#gh-dir').value.trim().replace(/^\/+|\/+$/g, '') }; LS.set('ghConfig', c); const t = $('#gh-token').value.trim(); if (t) LS.set('ghToken', t); return { ...c, token: t }; };
    $('#gh-test').onclick = async () => { const c = cfg(); try { const r = await ghApi(c, `/repos/${c.owner}/${c.repo}`); Site.toast(r.permissions && r.permissions.push === false ? '⚠ Connected, but this token can’t write to the repo.' : `✓ Connected to ${esc(r.full_name)}`, { color: 'var(--green)' }); } catch (e) { Site.toast('✗ ' + esc(e.message), { color: 'var(--red)', ms: 7000 }); } };
    $('#gh-forget').onclick = () => { LS.del('ghToken'); $('#gh-token').value = ''; Site.toast('Token removed from this browser.'); };
    $('#gh-go').onclick = () => ghPublish(cfg());
    $('#zip-go').onclick = () => zipUpdate($('#zip-all').checked);
    $('#bk-save').onclick = backup;
    $('#bk-load').onchange = e => restore(e.target.files[0]);
  }
  function dataFile(d) { return `/* =====================================================================\n   SITE DATA — generated by your Studio on ${new Date().toLocaleString()}.\n   Edit it from studio.html, then Publish. (Hand edits are fine too.)\n   ===================================================================== */\nwindow.SITE_DATA = ${JSON.stringify(d, null, 1)};\n`; }
  function referenced(d) { const set = new Set(); d.artworks.forEach(a => { a.image && set.add(a.image); a.thumb && set.add(a.thumb); }); if (d.settings.portrait) set.add(d.settings.portrait); return set; }
  function extras(d) {
    const dom = String(d.settings.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''); if (!dom) return [];
    const base = 'https://' + dom + '/', today = new Date().toISOString().slice(0, 10);
    const urls = ['', 'gallery.html', 'about.html', ...(d.settings.commissions.open ? ['commissions.html'] : []), ...d.artworks.filter(a => a.status !== 'hidden').map(a => 'artwork.html?id=' + encodeURIComponent(a.id))];
    return [['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${(base + u).replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`],
    ['robots.txt', `User-agent: *\nAllow: /\nDisallow: /studio.html\nDisallow: /checkout.html\nDisallow: /thank-you.html\nSitemap: ${base}sitemap.xml\n`]];
  }
  async function pendingFiles(all) { const out = []; const refs = referenced(ST.data); for (const [k, v] of await IDB.entries('files')) { if (refs.has(k) && v && v.blob && (all || !v.published)) out.push([k, v.blob]); } return out; }
  function stamp() { const d = clone(ST.data); d.updatedAt = new Date().toISOString(); d.publishedAt = d.updatedAt; return d; }
  async function afterPublish(d, files) { for (const [k, b] of files) await IDB.set('files', k, { blob: b, published: true, at: Date.now() }); ST.data = d; ST.live = clone(d); Site.data = ST.data; Site.S = ST.data.settings; await save(true); LS.del('studio-preview'); if (window.FX) FX.confetti(); }

  /* ---- GitHub ---- */
  async function ghApi(c, path, opts = {}) {
    if (!c.owner || !c.repo || !c.token) throw new Error('Fill in username, repository and token first.');
    const r = await fetch('https://api.github.com' + path, { ...opts, headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (!r.ok) { let m = r.status + ''; try { m = (await r.json()).message || m; } catch (e) { } if (r.status === 401) m = 'Token not accepted — check it was copied fully and hasn’t expired.'; if (r.status === 404) m = 'Repository not found — check the username/repo name, and that the token has access to it.'; if (r.status === 403) m = 'Permission denied — the token needs “Contents: Read and write”. ' + m; throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  const b64text = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const b64blob = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); });
  async function ghPublish(c) {
    const prog = $('#gh-prog'), bar = $('#gh-bar'), log = $('#gh-log'), btn = $('#gh-go');
    prog.hidden = false; log.innerHTML = ''; btn.classList.add('is-loading');
    const say = (t, p) => { log.insertAdjacentHTML('beforeend', `<li>${t}</li>`); if (p != null) bar.style.width = p + '%'; };
    try {
      const pre = c.dir ? c.dir + '/' : '', base = `/repos/${c.owner}/${c.repo}`;
      say('Connecting to GitHub…', 5);
      const ref = await ghApi(c, `${base}/git/ref/heads/${encodeURIComponent(c.branch)}`);
      const head = await ghApi(c, `${base}/git/commits/${ref.object.sha}`);
      const tree = await ghApi(c, `${base}/git/trees/${head.tree.sha}?recursive=1`);
      const inRepo = new Set(tree.tree.filter(t => t.type === 'blob').map(t => t.path));
      if (!inRepo.has(pre + 'index.html')) say(`⚠ No index.html found in ${pre || 'the repository root'} — did you upload the website files there? Publishing data anyway.`);
      const d = stamp();
      const files = await pendingFiles(false);
      // also upload any referenced local image the repo doesn't have yet
      for (const [k, v] of await IDB.entries('files')) if (referenced(d).has(k) && !inRepo.has(pre + k) && !files.find(f => f[0] === k) && v && v.blob) files.push([k, v.blob]);
      const entries = [];
      let n = 0; const total = files.length + 1 + extras(d).length;
      for (const [k, blob] of files) { say(`Uploading ${esc(k)}…`, 10 + (++n / total) * 70); const b = await ghApi(c, `${base}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: await b64blob(blob), encoding: 'base64' }) }); entries.push({ path: pre + k, mode: '100644', type: 'blob', sha: b.sha }); }
      for (const [k, txt] of [['data/site-data.js', dataFile(d)], ...extras(d)]) { say(`Writing ${k}…`, 10 + (++n / total) * 70); const b = await ghApi(c, `${base}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: b64text(txt), encoding: 'base64' }) }); entries.push({ path: pre + k, mode: '100644', type: 'blob', sha: b.sha }); }
      // tidy: remove images no longer used (only inside art/)
      const refs = referenced(d); const orphans = [...inRepo].filter(p => p.startsWith(pre + 'art/') && !refs.has(p.slice(pre.length)));
      orphans.forEach(p => entries.push({ path: p, mode: '100644', type: 'blob', sha: null }));
      if (orphans.length) say(`Cleaning up ${orphans.length} unused image${orphans.length > 1 ? 's' : ''}…`);
      say('Saving a new version…', 88);
      const nt = await ghApi(c, `${base}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
      const cm = await ghApi(c, `${base}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Studio update: ${changes().slice(0, 3).map(x => x[1]).join('; ') || 'publish'}`, tree: nt.sha, parents: [ref.object.sha] }) });
      await ghApi(c, `${base}/git/refs/heads/${encodeURIComponent(c.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: cm.sha }) });
      await afterPublish(d, files);
      say(`<b style="color:var(--green)">✓ Published!</b> Your site updates in about a minute${d.settings.domain ? ` at <a class="link-u" target="_blank" rel="noopener" href="https://${esc(String(d.settings.domain).replace(/^https?:\/\//, ''))}">${esc(d.settings.domain)}</a>` : ''}. (Refresh with Ctrl/⌘+Shift+R if you don’t see it.)`, 100);
      markDirty(); btn.disabled = true;
    } catch (e) { console.error(e); say(`<b style="color:var(--red)">✗ ${esc(e.message)}</b>`); }
    btn.classList.remove('is-loading');
  }

  /* ---- ZIP (store-only, no library needed) ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function makeZip(files) { // files: [[name, Uint8Array]]
    const parts = [], central = []; let off = 0; const enc = new TextEncoder();
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    for (const [name, data] of files) {
      const nm = enc.encode(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  async function zipUpdate(all) {
    const d = stamp(), files = await pendingFiles(all), enc = new TextEncoder();
    const list = [['data/site-data.js', enc.encode(dataFile(d))], ...extras(d).map(([k, t]) => [k, enc.encode(t)])];
    for (const [k, b] of files) list.push([k, new Uint8Array(await b.arrayBuffer())]);
    download(await makeZip(list), `site-update-${new Date().toISOString().slice(0, 10)}.zip`);
    const m = Site.openModal(`<div class="modal-body"><h3 class="h3">Your update is downloading</h3><ol class="st-flow"><li>Unzip <b>site-update-….zip</b>.</li><li>Copy its contents into your website folder — choose <b>Replace</b> when asked. (${list.length} file${list.length > 1 ? 's' : ''}: data${files.length ? ` + ${files.length} image${files.length > 1 ? 's' : ''}` : ''}.)</li><li>Upload the website folder to your host again (e.g. drag it onto Netlify).</li></ol><p>Once it’s uploaded, click below so the Studio knows it’s live.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-accent" data-ok>I’ve uploaded it — mark as published</button><button class="btn btn-ghost" data-modal-close>Not yet</button></div></div>`, { width: 560 });
    m.querySelector('[data-ok]').onclick = async () => { await afterPublish(d, files); Site.closeModal(); route(); Site.toast('Marked as published ✓'); };
  }
  async function backup() {
    const files = {}; for (const [k, v] of await IDB.entries('files')) if (v && v.blob) files[k] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(v.blob); });
    download(new Blob([JSON.stringify({ kind: 'art-studio-backup', v: 1, at: new Date().toISOString(), data: ST.data, files })], { type: 'application/json' }), `studio-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }
  async function restore(file) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text()); if (j.kind !== 'art-studio-backup') throw new Error('Not a Studio backup file');
      for (const [k, du] of Object.entries(j.files || {})) { const b = await (await fetch(du)).blob(); await storeFile(k, b); }
      ST.data = Site.normalize(j.data); Site.data = ST.data; Site.S = ST.data.settings; await save(true); route(); Site.toast('Backup restored ✓ — publish to put it live.');
    } catch (e) { Site.toast('Could not restore: ' + esc(e.message), { color: 'var(--red)' }); }
  }

  /* ============================================================ HELP */
  function help() {
    $('#st-view').innerHTML = `<div class="st-grid-2"><div>
      ${F.card('How your website works', `<ul class="st-wisdom"><li><b>Your site is plain HTML files</b> — fast, secure, and free to host. No monthly platform fees, no commission on your sales.</li><li><b>This Studio</b> edits one file (<code>data/site-data.js</code>) plus your images. Changes are drafts in this browser until you <b>Publish</b>.</li><li><b>Payments</b> go straight from buyers to your PayPal / Venmo / Zelle / Cash App / Stripe.</li><li><b>Orders</b> (with shipping address) arrive in your email.</li></ul>`)}
      ${F.card('Everyday routine', `<ol class="st-flow"><li><a class="link-u" href="#new">Add artwork</a> → drop photo → title → price → save.</li><li>Click <b>Preview my changes</b> to see them on your real site.</li><li><a class="link-u" href="#publish">Publish</a>.</li></ol>`)}
      ${F.card('Working on another computer or phone', `<p>Drafts live in the browser you used. To continue elsewhere: <b>Publish</b> first (the other device loads what's live), or use <b>Publish → Download backup / Restore backup</b>.</p>`)}
      </div><div>
      ${F.card('Launch guide (first time only)', `<ol class="st-flow">
        <li><b>Get a domain</b> (~$10–15/yr) at Cloudflare Registrar, Porkbun or Namecheap — e.g. <i>${esc(slug(S().artistName))}art.com</i> or <i>${esc(slug(S().artistName))}.art</i>.</li>
        <li><b>Create a free GitHub account</b> → New repository (public) → “uploading an existing file” → drag in <b>everything inside your website folder</b> → Commit.</li>
        <li>Repository <b>Settings → Pages</b> → Source: <i>Deploy from a branch</i> → <i>main</i> / <i>(root)</i> → Save.</li>
        <li>In <b>Pages → Custom domain</b> type your domain; at your registrar add the DNS records GitHub shows (4 A records + a CNAME for www). Tick <b>Enforce HTTPS</b>.</li>
        <li>Come back here → <a class="link-u" href="#publish">Publish</a> → fill in GitHub details once. From now on, publishing is one click.</li></ol>
        <p class="muted small">Prefer drag-and-drop? Netlify Drop (app.netlify.com/drop) hosts the folder instantly; use “Download update” to publish changes. Full step-by-step instructions are in <b>START-HERE.html</b> (next to your website folder in the download).</p>`)}
      </div></div>`;
  }
})();
