/* =====================================================================
   core.js — data, cart, wishlist, shared layout, modals & helpers
   ===================================================================== */
(function () {
  'use strict';
  const Site = window.Site = {};

  /* ------------------------------------------------------------ utils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const qs = new URLSearchParams(location.search);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  Object.assign(Site, { $, $$, esc, LS, qs, sleep });

  /* IndexedDB (shared with the Studio for drafts + unpublished images) */
  const IDB = Site.IDB = {
    _p: null,
    open() {
      if (this._p) return this._p;
      this._p = new Promise((res, rej) => {
        if (!('indexedDB' in window)) return rej(new Error('no idb'));
        const r = indexedDB.open('art-studio', 1);
        r.onupgradeneeded = () => { const db = r.result; ['kv', 'files'].forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      return this._p;
    },
    async tx(store, mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction(store, mode); const st = t.objectStore(store); const req = fn(st); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); }); },
    get(store, key) { return this.tx(store, 'readonly', s => s.get(key)); },
    set(store, key, val) { return this.tx(store, 'readwrite', s => s.put(val, key)); },
    del(store, key) { return this.tx(store, 'readwrite', s => s.delete(key)); },
    async entries(store) { const db = await this.open(); return new Promise((res, rej) => { const out = []; const t = db.transaction(store).objectStore(store).openCursor(); t.onsuccess = () => { const c = t.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); }; t.onerror = () => rej(t.error); }); },
  };

  /* ------------------------------------------------------------ icons */
  const I = Site.icons = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path class="fillp" d="M12 20.3s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.8 2.8c0 5.8-7.8 10.4-7.8 10.4Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h11"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    wall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="7" y="3.5" width="10" height="8" rx=".5"/><path d="M3 20.5h18M5 20.5v-4.5h14v4.5M5 16c0-1 .7-1.8 1.7-1.8h10.6c1 0 1.7.8 1.7 1.8"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    cartPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8M12 11.5v5M9.5 14h5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    cert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 4h16v11H4z"/><path d="M8 8h8M8 11h5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="m15 18.5-.8 3 2.3-1 2.3 1-.8-3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/></svg>',
    returns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="m8 5-4 4 4 4"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 3.5 11 12.5M13.5 10l-2.5-2.5"/><path d="M9.5 13.5c-2.5-.3-4.5 1.2-4.7 3.4-.1 1.6-1 2.6-2.3 3.1 3.6 1.3 7.5.5 8.2-2.9.3-1.4 0-2.8-1.2-3.6Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 2.8Z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8v6M8 11h6"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2.2 1.8 3.7 4 3.9v3.1c-1.5 0-2.9-.4-4-1.1v6.3a6 6 0 1 1-6-6h.6v3.2a2.9 2.9 0 1 0 2.3 2.8V3h3.1Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8c.2.9 1 1.6 1.9 1.9 1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.6-1.8-4.4-4.5-4.4-3 0-4.8 2.3-4.8 4.6 0 .9.4 1.9.8 2.4l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.4-.7-2.2-2.7-2.2-4.3 0-3.5 2.5-6.7 7.3-6.7 3.8 0 6.8 2.7 6.8 6.4 0 3.8-2.4 6.9-5.8 6.9-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.3 1-.9 2.2-1.4 2.9A10 10 0 1 0 12 2Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.3l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>',
  };
  const navStroke = '<svg class="nav-stroke" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6.5c18-3 40-4.5 62-3.4 12 .6 23 1.5 34 .2"/></svg>';

  /* ------------------------------------------------------------ defaults + normalise */
  const DEFAULTS = {
    artistName: 'Artist', siteTitle: '', heroEyebrow: 'Original paintings & prints', tagline: '', intro: '', bio: '', statement: '', location: '', portrait: '', heroArtwork: '', contactEmail: '',
    social: {}, currency: 'USD', announcement: '', accent: '#e2492f',
    shipping: { homeCountry: 'US', domestic: 0, international: 0, freeOver: 0, expressEnabled: false, express: 0, processing: 'Ships in 3–5 business days', note: '' },
    taxRate: 0, bundle: { enabled: false, minItems: 2, percent: 0 }, discounts: [],
    newsletter: { enabled: true, popup: false, headline: "Join the Collector's List", text: '', offerCode: '' },
    payments: { paypalClientId: '', paypalMe: '', venmo: '', cashapp: '', zelle: '', zelleName: '', stripeLink: '', custom: [], invoice: true },
    orders: { web3formsKey: '', formsubmitEmail: '' },
    commissions: { open: false, text: '', startingAt: 0, leadTime: '' },
    policies: { returns: '', coa: '', care: '' }, faq: [], testimonials: [], stats: { collectors: 0, countries: 0 }, analytics: { ga4: '' }, domain: '', seo: { description: '' },
  };
  function deepDefaults(obj, def) {
    for (const k in def) {
      if (obj[k] === undefined || obj[k] === null) obj[k] = JSON.parse(JSON.stringify(def[k]));
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof obj[k] === 'object') deepDefaults(obj[k], def[k]);
    }
    return obj;
  }
  function normalize(d) {
    d.settings = deepDefaults(d.settings || {}, DEFAULTS);
    if (d.settings.payments.invoice === undefined) d.settings.payments.invoice = true;
    d.artworks = (d.artworks || []).filter(a => a && a.id).map(a => {
      a.options = (a.options && a.options.length) ? a.options : [{ id: 'original', label: 'Original', price: Number(a.price) || 0, stock: 1, kind: 'original' }];
      a.options.forEach(o => { o.price = Number(o.price) || 0; if (o.stock === '' || o.stock === undefined) o.stock = null; else if (o.stock !== null) o.stock = Number(o.stock); });
      a.colors = a.colors || []; a.tags = a.tags || [];
      a.status = a.status || 'available';
      return a;
    });
    return d;
  }
  Site.normalize = normalize;
  Site.DEFAULTS = DEFAULTS;

  /* ------------------------------------------------------------ data loading */
  Site.blobUrls = {};
  Site.isStudio = document.body && document.body.dataset.page === 'studio';
  Site.isPreview = !Site.isStudio && LS.get('studio-preview', false) === true;
  function loadDataScript() {
    return new Promise((res, rej) => {
      if (window.SITE_DATA) return res(window.SITE_DATA);
      const s = document.createElement('script');
      const base = document.body && document.body.dataset.base || '';
      s.src = base + 'data/site-data.js?v=' + (Site.isStudio ? Date.now() : Math.floor(Date.now() / 60000));
      s.onload = () => window.SITE_DATA ? res(window.SITE_DATA) : rej(new Error('SITE_DATA missing'));
      s.onerror = () => rej(new Error('Could not load data/site-data.js'));
      document.head.appendChild(s);
    });
  }
  Site.ready = (async () => {
    let data = null;
    if (Site.isPreview) {
      try {
        const d = await IDB.get('kv', 'draft');
        if (d && d.data) {
          data = JSON.parse(JSON.stringify(d.data));
          const files = await IDB.entries('files');
          files.forEach(([k, v]) => { const blob = v && v.blob ? v.blob : v; if (blob instanceof Blob) Site.blobUrls[k] = URL.createObjectURL(blob); });
        }
      } catch (e) { console.warn('Preview draft unavailable', e); }
    }
    if (!data) {
      try { data = await loadDataScript(); }
      catch (e) { console.error(e); data = { settings: {}, artworks: [] }; }
    }
    normalize(data);
    Site.data = data; Site.S = data.settings;
    if (Site.isStudio) { document.body.insertAdjacentHTML('beforeend', '<div class="scrim" data-scrim></div><div class="toast-host" aria-live="polite"></div>'); bindStudioBasics(); return data; }
    applyTheme();
    renderChrome();
    initAnalytics();
    welcomeBack();
    schedulePopup();
    return data;
  })();

  Site.img = p => (p && Site.blobUrls[p]) || p || '';

  /* ------------------------------------------------------------ money + art helpers */
  let _fmt = null;
  Site.money = (n, opts = {}) => {
    const cur = (Site.S && Site.S.currency) || 'USD';
    const whole = Math.round(n * 100) % 100 === 0;
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: (whole && !opts.cents) ? 0 : 2, maximumFractionDigits: 2 }).format(n); }
    catch (e) { return '$' + Number(n).toFixed(whole ? 0 : 2); }
  };
  Site.currencySymbol = () => { try { return (0).toLocaleString('en-US', { style: 'currency', currency: Site.S.currency, maximumFractionDigits: 0 }).replace(/\d/g, '').trim(); } catch (e) { return '$'; } };
  const cents = n => Math.round(Number(n) * 100);
  Site.optAvail = o => o && (o.stock === null || o.stock === undefined || o.stock > 0);
  Site.artAvail = a => a && a.status !== 'sold' && a.options.some(Site.optAvail);
  Site.availOptions = a => a.status === 'sold' ? [] : a.options.filter(Site.optAvail);
  Site.originalOpt = a => a.options.find(o => o.kind === 'original');
  Site.originalSold = a => { const o = Site.originalOpt(a); return !!o && (a.status === 'sold' || !Site.optAvail(o)); };
  Site.minPrice = a => { const av = Site.availOptions(a); const list = av.length ? av : a.options; return Math.min(...list.map(o => o.price)); };
  Site.visibleArts = () => (Site.data.artworks || []).filter(a => a.status !== 'hidden');
  Site.art = id => (Site.data.artworks || []).find(a => a.id === id);
  Site.sizeLabel = a => (a.width && a.height) ? `${+a.width} × ${+a.height} ${a.unit || 'in'}` : '';
  Site.isNew = a => a.createdAt && (Date.now() - new Date(a.createdAt).getTime()) < 1000 * 60 * 60 * 24 * 21;
  Site.kindLabel = a => {
    const orig = Site.originalOpt(a), av = Site.availOptions(a);
    if (!av.length) return 'Sold';
    if (orig && Site.optAvail(orig) && a.status !== 'sold') return 'Original';
    if (av.some(o => o.edition)) return 'Limited edition';
    return orig ? 'Prints available' : 'Print';
  };
  Site.scarcity = o => {
    if (!o || o.stock === null || o.stock === undefined) return '';
    if (o.kind === 'original') return o.stock > 0 ? 'One of a kind' : 'Sold';
    if (o.stock <= 0) return 'Sold out';
    if (o.edition) return `${o.stock} of ${o.edition} left`;
    if (o.stock <= 8) return `Only ${o.stock} left`;
    return '';
  };
  function hexToHsl(h) {
    h = (h || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
    return [hh, s, l];
  }
  Site.hexToHsl = hexToHsl;
  Site.accentOf = a => {
    const cs = (a && a.colors) || []; let best = cs[0] || '#e2492f', bs = -1;
    cs.forEach(c => { const [, s, l] = hexToHsl(c); const score = s * (1 - Math.abs(l - .55) * 1.6); if (score > bs) { bs = score; best = c; } });
    return best;
  };
  Site.colorFamily = hex => {
    const [h, s, l] = hexToHsl(hex);
    if (l < .16) return 'dark';
    if (s < .18 || (l > .88)) return l > .6 ? 'light' : 'neutral';
    if (h < 15 || h >= 345) return 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 165) return 'green';
    if (h < 250) return 'blue';
    if (h < 290) return 'purple';
    return 'pink';
  };
  Site.families = a => Array.from(new Set((a.colors || []).map(Site.colorFamily)));
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  Site.hash = hash;
  Site.artUrl = a => 'artwork.html?id=' + encodeURIComponent(a.id);

  /* ------------------------------------------------------------ wishlist + recent */
  const Wish = Site.Wish = {
    list() { return LS.get('wishlist', []); },
    has(id) { return this.list().includes(id); },
    toggle(id) { let l = this.list(); const on = !l.includes(id); l = on ? [id, ...l] : l.filter(x => x !== id); LS.set('wishlist', l); updateBadges(); if (on) Site.track('add_to_wishlist', { item_id: id }); return on; },
  };
  Site.recent = { add(id) { let l = LS.get('recent', []).filter(x => x !== id); l.unshift(id); LS.set('recent', l.slice(0, 10)); }, list() { return LS.get('recent', []); } };

  /* ------------------------------------------------------------ cart */
  const Cart = Site.Cart = {
    raw() { return LS.get('cart', []); },
    save(l) { LS.set('cart', l); LS.set('cartTouched', Date.now()); updateBadges(); document.dispatchEvent(new CustomEvent('cart:change')); },
    items() {
      const out = [];
      this.raw().forEach(r => {
        const art = Site.art(r.id); if (!art || art.status === 'hidden') return;
        const opt = art.options.find(o => o.id === r.opt); if (!opt) return;
        const max = (opt.stock === null || opt.stock === undefined) ? 99 : opt.stock;
        const qty = Math.max(0, Math.min(r.qty || 1, max));
        out.push({ key: r.id + '::' + r.opt, art, opt, qty, max, price: opt.price, line: opt.price * qty, avail: Site.optAvail(opt) && art.status !== 'sold' });
      });
      return out;
    },
    count() { return this.items().reduce((s, i) => s + i.qty, 0); },
    add(id, opt, qty = 1) {
      const art = Site.art(id); const o = art && art.options.find(x => x.id === opt);
      if (!o || !Site.optAvail(o) || art.status === 'sold') return false;
      const l = this.raw(); const ex = l.find(r => r.id === id && r.opt === opt);
      const max = (o.stock === null || o.stock === undefined) ? 99 : o.stock;
      if (ex) { if (ex.qty >= max) return 'max'; ex.qty = Math.min(max, ex.qty + qty); } else l.push({ id, opt, qty: Math.min(max, qty) });
      this.save(l);
      Site.track('add_to_cart', { currency: Site.S.currency, value: o.price * qty, items: [{ item_id: id, item_name: art.title, item_variant: o.label, price: o.price, quantity: qty }] });
      return true;
    },
    setQty(key, q) { const [id, opt] = key.split('::'); let l = this.raw(); const r = l.find(x => x.id === id && x.opt === opt); if (!r) return; if (q <= 0) l = l.filter(x => x !== r); else r.qty = q; this.save(l); },
    remove(key) { this.setQty(key, 0); },
    clear() { this.save([]); },
    totals(o = {}) {
      const S = Site.S, items = this.items().filter(i => i.avail && i.qty > 0);
      const subtotalC = items.reduce((s, i) => s + cents(i.price) * i.qty, 0);
      const pieces = items.reduce((s, i) => s + i.qty, 0);
      let bundleC = 0, codeC = 0, codeValid = null, codeInfo = null;
      if (S.bundle && S.bundle.enabled && pieces >= (S.bundle.minItems || 2) && S.bundle.percent > 0) bundleC = Math.round(subtotalC * S.bundle.percent / 100);
      if (o.code) {
        const d = (S.discounts || []).find(x => x.active !== false && String(x.code).trim().toUpperCase() === String(o.code).trim().toUpperCase());
        if (d && !(d.minSubtotal && subtotalC / 100 < d.minSubtotal)) { codeValid = true; codeInfo = d; codeC = d.amount ? Math.min(cents(d.amount), subtotalC - bundleC) : Math.round((subtotalC - bundleC) * (Number(d.percent) || 0) / 100); }
        else codeValid = false;
      }
      const discountC = bundleC + codeC, afterC = Math.max(0, subtotalC - discountC);
      const country = (o.country || S.shipping.homeCountry || 'US').toUpperCase();
      const domestic = country === String(S.shipping.homeCountry || 'US').toUpperCase();
      let shipC = 0, freeLeftC = 0;
      if (items.length) {
        if (domestic) {
          shipC = cents(S.shipping.domestic || 0);
          if (S.shipping.freeOver > 0) { if (afterC >= cents(S.shipping.freeOver)) shipC = 0; else freeLeftC = cents(S.shipping.freeOver) - afterC; }
          if (o.express && S.shipping.expressEnabled) shipC += cents(S.shipping.express || 0);
        } else shipC = cents(S.shipping.international || S.shipping.domestic || 0);
      }
      const taxC = Math.round(afterC * (Number(S.taxRate) || 0) / 100);
      const totalC = afterC + shipC + taxC;
      return { items, pieces, subtotal: subtotalC / 100, bundle: bundleC / 100, code: codeC / 100, codeValid, codeInfo, discount: discountC / 100, shipping: shipC / 100, tax: taxC / 100, total: totalC / 100, freeLeft: freeLeftC / 100, domestic, subtotalC, discountC, shipC, taxC, totalC };
    },
  };

  function updateBadges() {
    const c = Cart.count(), w = Wish.list().length;
    $$('[data-cart-count]').forEach(el => { el.textContent = c; el.classList.toggle('show', c > 0); });
    $$('[data-wish-count]').forEach(el => { el.textContent = w; el.classList.toggle('show', w > 0); });
  }
  Site.updateBadges = updateBadges;

  /* ------------------------------------------------------------ theme + meta */
  function applyTheme() {
    const S = Site.S;
    if (S.accent) document.documentElement.style.setProperty('--accent', S.accent);
    $$('[data-artist-name]').forEach(el => el.textContent = S.artistName);
    const desc = $('meta[name="description"]');
    if (desc && !desc.dataset.fixed && S.seo && S.seo.description) desc.setAttribute('content', S.seo.description);
  }
  Site.setTitle = t => { document.title = t ? `${t} — ${Site.S.artistName}` : (Site.S.siteTitle || Site.S.artistName); };
  Site.jsonld = obj => { const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(obj); document.head.appendChild(s); };
  Site.absUrl = p => { try { return new URL(p, location.href).href; } catch (e) { return p; } };

  /* ------------------------------------------------------------ payment methods (labels) */
  Site.payLabels = () => {
    const P = Site.S.payments, out = [];
    if (P.paypalClientId) out.push('PayPal', 'Venmo', 'Credit / Debit', 'Pay Later');
    if (P.stripeLink) out.push('Apple Pay', 'Google Pay', 'Cards');
    if (P.venmo) out.push('Venmo');
    if (P.cashapp) out.push('Cash App');
    if (P.zelle) out.push('Zelle');
    if (P.paypalMe) out.push('PayPal');
    (P.custom || []).forEach(c => c && c.name && out.push(c.name));
    return Array.from(new Set(out));
  };
  Site.payChips = () => { const l = Site.payLabels(); return (l.length ? l : ['Secure checkout']).map(x => `<span class="pay-chip">${esc(x)}</span>`).join(''); };

  /* ------------------------------------------------------------ layout chrome */
  function socialLinks(cls = '') {
    const s = Site.S.social || {}; const map = { instagram: 'https://instagram.com/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@', pinterest: 'https://pinterest.com/', x: 'https://x.com/', facebook: 'https://facebook.com/' };
    return Object.keys(map).filter(k => s[k]).map(k => { const v = String(s[k]).trim(); const url = /^https?:/.test(v) ? v : map[k] + v.replace(/^@/, ''); return `<a class="icon-btn ${cls}" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${k}">${I[k]}</a>`; }).join('');
  }
  Site.socialLinks = socialLinks;

  function renderChrome() {
    const S = Site.S, page = document.body.dataset.page || '';
    const minimal = document.body.hasAttribute('data-minimal');
    const navItems = [['index.html', 'Home', 'home'], ['gallery.html', 'Gallery', 'gallery'], ['about.html', 'About', 'about'], ['commissions.html', 'Commissions', 'commissions']].filter(n => n[2] !== 'commissions' || S.commissions.open);
    const headerHost = $('#site-header');
    if (headerHost) {
      const annDismissed = LS.get('annDismissed', '') === S.announcement;
      headerHost.outerHTML = `
      ${S.announcement && !annDismissed && !minimal ? `<div class="announce" role="region" aria-label="Announcement"><span class="ann-text">${I.spark.replace('<svg', '<svg width="12" height="12" style="color:var(--ochre)"')} ${esc(S.announcement)}</span><button class="ann-close" aria-label="Dismiss announcement">${I.close.replace('<svg', '<svg width="14" height="14"')}</button></div>` : ''}
      <header class="site-header" id="top">
        <div class="wrap">
          <a class="logo" href="index.html" aria-label="${esc(S.artistName)} — home">${esc(S.artistName)}<span class="dot"></span></a>
          ${minimal ? `<span class="pill ok" style="margin-left:auto">${I.lock.replace('<svg', '<svg width="12" height="12"')} Secure checkout</span>` : `
          <nav class="nav" aria-label="Main">${navItems.map(n => `<a href="${n[0]}"${page === n[2] ? ' aria-current="page"' : ''}>${n[1]}${navStroke}</a>`).join('')}</nav>
          <div class="header-actions">
            <a class="icon-btn" href="gallery.html?saved=1" aria-label="Saved artworks" data-wish-btn>${I.heart}<span class="count" data-wish-count>0</span></a>
            <button class="icon-btn" data-open-cart aria-label="Open cart" id="cart-btn">${I.bag}<span class="count" data-cart-count>0</span></button>
            <button class="icon-btn menu-btn" data-open-menu aria-label="Open menu">${I.menu}</button>
          </div>`}
        </div>
      </header>
      <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
        <button class="icon-btn mm-close" data-close-menu aria-label="Close menu">${I.close}</button>
        ${navItems.map(n => `<a class="mm-link" href="${n[0]}">${n[1]}</a>`).join('')}
        <a class="mm-link" href="gallery.html?saved=1">Saved ♡</a>
        <div class="mm-foot"><div style="display:flex;gap:4px;margin-bottom:12px">${socialLinks()}</div>© ${new Date().getFullYear()} ${esc(S.artistName)}</div>
        <div class="mm-blob"></div>
      </div>`;
    }
    const footHost = $('#site-footer');
    if (footHost) {
      footHost.outerHTML = minimal ? `<footer class="site-footer" style="padding:34px 0 26px"><div class="wrap foot-bottom" style="border:0;padding:0"><span>© ${new Date().getFullYear()} ${esc(S.artistName)} · All artwork protected by copyright</span><span><a class="link-u" href="about.html#faq">Help & FAQ</a></span></div></footer>` : `
      <footer class="site-footer">
        <div class="wrap">
          <div class="foot-top">
            <div class="foot-big" data-reveal>Let's put some <span>color</span> on your walls.</div>
            ${S.newsletter.enabled ? `<div class="foot-news" data-reveal style="--d:.1s">
              <h4 class="h3" style="margin-bottom:10px">${esc(S.newsletter.headline)}</h4>
              <p>${esc(S.newsletter.text)}</p>
              <form class="inline-form" data-newsletter novalidate>
                <label class="sr-only" for="foot-email">Email address</label>
                <input id="foot-email" type="email" name="email" autocomplete="email" placeholder="you@email.com" required>
                <button class="btn btn-accent btn-sm" type="submit">Join</button>
              </form>
            </div>` : '<div></div>'}
          </div>
          <div class="foot-cols">
            <div><h4>Shop</h4><a href="gallery.html">All artwork</a><a href="gallery.html?type=original">Originals</a><a href="gallery.html?type=print">Prints</a><a href="gallery.html?saved=1">Your saved pieces</a></div>
            <div><h4>Studio</h4><a href="about.html">About the artist</a>${S.commissions.open ? '<a href="commissions.html">Commissions</a>' : ''}<a href="about.html#faq">FAQ</a>${S.contactEmail ? `<a href="mailto:${esc(S.contactEmail)}">Contact</a>` : ''}</div>
            <div><h4>Care</h4><a href="about.html#shipping">Shipping</a><a href="about.html#returns">Returns</a><a href="about.html#faq">Certificate of authenticity</a></div>
            <div><h4>Follow</h4><div style="display:flex;flex-wrap:wrap;gap:2px;margin-left:-10px">${socialLinks() || '<span style="color:rgba(245,239,228,.5);font-size:14px;padding-left:10px">Coming soon</span>'}</div></div>
          </div>
          <div class="foot-bottom">
            <span>© ${new Date().getFullYear()} ${esc(S.artistName)}. All artwork and images protected by copyright.</span>
            <div class="pay-chips" style="margin:0;justify-content:flex-end">${Site.payChips()}</div>
          </div>
        </div>
        <div class="foot-sig" aria-hidden="true">${esc(S.artistName)}</div>
      </footer>`;
    }
    // cart drawer + scrim + toast host
    document.body.insertAdjacentHTML('beforeend', `
      <div class="scrim" data-scrim></div>
      <aside class="drawer" id="cart-drawer" aria-label="Shopping cart" aria-hidden="true">
        <div class="drawer-head"><h2>Your cart</h2><button class="icon-btn" data-close-cart aria-label="Close cart">${I.close}</button></div>
        <div class="drawer-body" data-cart-body></div>
        <div class="drawer-foot" data-cart-foot></div>
      </aside>
      <div class="toast-host" aria-live="polite"></div>
      ${Site.isPreview ? `<div class="preview-ribbon">Previewing your unpublished Studio changes <a href="#" data-exit-preview>Exit preview</a></div>` : ''}`);

    // events
    const onScroll = () => { const h = $('.site-header'); if (h) h.classList.toggle('scrolled', scrollY > 10); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-open-cart],[data-close-cart],[data-scrim],[data-open-menu],[data-close-menu],.ann-close,[data-exit-preview],[data-buy],[data-add],[data-wish],[data-quick],[data-wall],[data-modal-close]');
      if (!t) return;
      if (t.matches('[data-open-cart]')) { e.preventDefault(); openCart(); }
      else if (t.matches('[data-close-cart]')) closeCart();
      else if (t.matches('[data-scrim]')) { closeCart(); closeModal(); }
      else if (t.matches('[data-open-menu]')) { $('#mobile-menu').classList.add('open'); $('#mobile-menu').setAttribute('aria-hidden', 'false'); }
      else if (t.matches('[data-close-menu]')) { $('#mobile-menu').classList.remove('open'); $('#mobile-menu').setAttribute('aria-hidden', 'true'); }
      else if (t.matches('.ann-close')) { LS.set('annDismissed', Site.S.announcement); t.closest('.announce').remove(); }
      else if (t.matches('[data-exit-preview]')) { e.preventDefault(); LS.del('studio-preview'); location.reload(); }
      else if (t.matches('[data-buy]')) { e.preventDefault(); Site.buyNow(t.dataset.buy, t.dataset.opt || null, t); }
      else if (t.matches('[data-add]')) { e.preventDefault(); Site.addToCart(t.dataset.add, t.dataset.opt || null, t); }
      else if (t.matches('[data-wish]')) { e.preventDefault(); const on = Wish.toggle(t.dataset.wish); $$(`[data-wish="${CSS.escape(t.dataset.wish)}"]`).forEach(b => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }); t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); if (on) toast(`Saved to your wishlist`, { action: 'View saved', href: 'gallery.html?saved=1', color: 'var(--rose)' }); if (window.FX && on) FX.splat(e.clientX, e.clientY, '#e86a92', 0.8); }
      else if (t.matches('[data-quick]')) { e.preventDefault(); Site.quickView(t.dataset.quick); }
      else if (t.matches('[data-wall]')) { e.preventDefault(); Site.viewOnWall(t.dataset.wall); }
      else if (t.matches('[data-modal-close]')) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeModal(); const m = $('#mobile-menu'); if (m) m.classList.remove('open'); } });
    document.addEventListener('submit', e => { const f = e.target.closest('[data-newsletter]'); if (f) { e.preventDefault(); newsletterSubmit(f); } });
    document.addEventListener('cart:change', () => { if ($('#cart-drawer').classList.contains('open')) renderCart(); });
    updateBadges();
    Site.enhance(document);
  }

  function bindStudioBasics() {
    document.addEventListener('click', e => { const t = e.target.closest('[data-modal-close],[data-scrim]'); if (t) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
  Site.enhance = root => { if (window.FX && FX.enhance) FX.enhance(root || document); };
  Site.mount = (el, html) => { if (typeof el === 'string') el = $(el); if (!el) return; el.innerHTML = html; Site.enhance(el); return el; };

  /* ------------------------------------------------------------ cart drawer */
  function openCart() { renderCart(); $('#cart-drawer').classList.add('open'); $('#cart-drawer').setAttribute('aria-hidden', 'false'); $('[data-scrim]').classList.add('open'); document.documentElement.style.overflow = 'hidden'; setTimeout(() => { const b = $('#cart-drawer .icon-btn'); b && b.focus({ preventScroll: true }); }, 400); Site.track('view_cart', {}); }
  function closeCart() { const d = $('#cart-drawer'); if (!d || !d.classList.contains('open')) return; d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); if (!$('.modal.open')) { $('[data-scrim]').classList.remove('open'); document.documentElement.style.overflow = ''; } }
  Site.openCart = openCart; Site.closeCart = closeCart;
  function shipMeter(t) {
    const S = Site.S; if (!(S.shipping.freeOver > 0) || !t.items.length) return '';
    const p = Math.min(100, (t.subtotal - t.discount) / S.shipping.freeOver * 100);
    return `<div class="ship-meter">${t.freeLeft > 0 ? `You're <b>${Site.money(t.freeLeft)}</b> away from <b>free shipping</b>` : `<b>🎉 Your order ships free</b>${S.shipping.homeCountry ? ` <span class="muted">(${esc(S.shipping.homeCountry)} addresses)</span>` : ''}`}<div class="bar"><i style="--p:${p}%"></i></div></div>`;
  }
  Site.shipMeter = shipMeter;
  function renderCart() {
    const body = $('[data-cart-body]'), foot = $('[data-cart-foot]'); if (!body) return;
    const t = Cart.totals(), items = Cart.items();
    if (!items.length) {
      body.innerHTML = `<div class="empty-state"><svg viewBox="0 0 120 100" fill="none"><rect x="22" y="14" width="76" height="60" rx="3" stroke="#1c1915" stroke-width="3"/><rect x="31" y="23" width="58" height="42" fill="#ede4d4"/><path d="M35 58c9-9 15-14 22-10s12-6 18-12 10 4 13 7" stroke="#e2492f" stroke-width="4" stroke-linecap="round"/><circle cx="74" cy="34" r="5" fill="#f3a712"/><path d="M40 86h40" stroke="#1c1915" stroke-width="3" stroke-linecap="round"/></svg><h3 class="h3" style="font-style:italic">Your walls are waiting</h3><p class="muted">Nothing in your cart yet — let's find something you love.</p><a class="btn btn-accent" href="gallery.html">Browse the gallery ${I.arrow}</a></div>`;
      foot.innerHTML = ''; foot.style.display = 'none'; Site.enhance(body); return;
    }
    foot.style.display = '';
    body.innerHTML = shipMeter(t) + items.map(i => `
      <div class="cart-item">
        <a href="${Site.artUrl(i.art)}"><img class="ci-img" src="${esc(Site.img(i.art.thumb || i.art.image))}" alt=""></a>
        <div><h4><a href="${Site.artUrl(i.art)}">${esc(i.art.title)}</a></h4><div class="ci-opt">${esc(i.opt.label)}${!i.avail ? ' · <b style="color:var(--red)">No longer available</b>' : ''}</div>
          ${i.max > 1 ? `<div class="qty"><button aria-label="Decrease" data-q="${esc(i.key)}" data-d="-1">−</button><span>${i.qty}</span><button aria-label="Increase" data-q="${esc(i.key)}" data-d="1">+</button></div>` : `<span class="pill light" style="box-shadow:inset 0 0 0 1px var(--line)">${i.opt.kind === 'original' ? 'One of a kind' : 'Qty 1'}</span>`}
          <br><button class="ci-remove" data-rm="${esc(i.key)}">Remove</button></div>
        <div class="ci-price">${Site.money(i.line)}</div>
      </div>`).join('') + (Site.S.bundle.enabled && Site.S.bundle.percent > 0 && t.pieces < Site.S.bundle.minItems ? `<p class="hand" style="font-size:22px;margin:18px 0 0;color:var(--ink-2)">✺ Add ${Site.S.bundle.minItems - t.pieces} more piece${Site.S.bundle.minItems - t.pieces > 1 ? 's' : ''} & save ${Site.S.bundle.percent}% on everything</p>` : '');
    foot.innerHTML = `
      <div class="totals-row"><span>Subtotal</span><span>${Site.money(t.subtotal)}</span></div>
      ${t.bundle ? `<div class="totals-row"><span>Collector bundle (−${Site.S.bundle.percent}%)</span><span class="save">−${Site.money(t.bundle)}</span></div>` : ''}
      <div class="totals-row"><span>Shipping</span><span class="muted">${t.shipping === 0 && t.domestic && Site.S.shipping.freeOver > 0 && t.freeLeft === 0 ? 'Free' : 'Calculated at checkout'}</span></div>
      <a class="btn btn-buy btn-lg btn-block" href="checkout.html" style="margin-top:14px">${I.lock} Checkout · ${Site.money(t.subtotal - t.discount)}</a>
      <div class="pay-chips">${Site.payChips()}</div>`;
    body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const it = items.find(x => x.key === b.dataset.q); Cart.setQty(b.dataset.q, Math.min(it.max, it.qty + Number(b.dataset.d))); renderCart(); });
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { Cart.remove(b.dataset.rm); renderCart(); });
    Site.enhance(body); Site.enhance(foot);
  }
  Site.renderCart = renderCart;

  /* ------------------------------------------------------------ toast */
  function toast(msg, o = {}) {
    const host = $('.toast-host'); if (!host) return;
    const el = document.createElement('div'); el.className = 'toast'; if (o.color) el.style.setProperty('--c', o.color);
    el.innerHTML = `${o.img ? `<img src="${esc(o.img)}" alt="">` : ''}<span>${msg}</span>${o.action ? (o.href ? `<a class="t-act" href="${esc(o.href)}">${esc(o.action)}</a>` : `<button class="t-act">${esc(o.action)}</button>`) : ''}`;
    if (o.onAction) el.querySelector('.t-act').onclick = () => { o.onAction(); el.remove(); };
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, o.ms || 4200);
  }
  Site.toast = toast;

  /* ------------------------------------------------------------ modal */
  function openModal(html, o = {}) {
    closeModal(true);
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); if (o.label) m.setAttribute('aria-label', o.label);
    m.innerHTML = `<div class="modal-card" style="--mw:${o.width || 560}px">${o.noClose ? '' : `<button class="icon-btn modal-close" data-modal-close aria-label="Close">${I.close}</button>`}${html}</div>`;
    m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
    document.body.appendChild(m); $('[data-scrim]').classList.add('open'); document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
    Site.enhance(m);
    Site._lastFocus = document.activeElement;
    setTimeout(() => { const f = m.querySelector('[autofocus]') || m.querySelector('.modal-close'); f && f.focus({ preventScroll: true }); }, 60);
    return m;
  }
  function closeModal(instant) {
    $$('.modal').forEach(m => { m.classList.remove('open'); if (instant) m.remove(); else setTimeout(() => m.remove(), 450); });
    if (!instant) { if (!$('#cart-drawer') || !$('#cart-drawer').classList.contains('open')) { const s = $('[data-scrim]'); s && s.classList.remove('open'); document.documentElement.style.overflow = ''; } if (Site._lastFocus && Site._lastFocus.focus) try { Site._lastFocus.focus({ preventScroll: true }); } catch (e) { } }
  }
  Site.openModal = openModal; Site.closeModal = closeModal;

  /* ------------------------------------------------------------ buying */
  function optionCards(a, name = 'opt', selected) {
    const av = Site.availOptions(a); const sel = selected || (av[0] && av[0].id);
    return a.options.map(o => {
      const ok = Site.optAvail(o) && a.status !== 'sold'; const sc = Site.scarcity(o);
      return `<label class="opt-card ${ok ? '' : 'is-out'}"><input type="radio" name="${name}" value="${esc(o.id)}" ${ok ? '' : 'disabled'} ${o.id === sel && ok ? 'checked' : ''}><span class="radio"></span>
        <span><span class="o-title">${esc(o.label)}</span><br><span class="o-sub">${ok ? (sc ? `<span class="scarce">${esc(sc)}</span>` : (o.kind === 'original' ? 'One of a kind' : 'Signed by the artist')) : 'Sold'}</span></span>
        <span class="o-price">${Site.money(o.price)}</span></label>`;
    }).join('');
  }
  Site.optionCards = optionCards;

  Site.buyNow = (id, optId, srcEl) => {
    const a = Site.art(id); if (!a) return;
    const av = Site.availOptions(a);
    if (!av.length) { toast(`“${esc(a.title)}” has sold — but I'd love to paint you something similar.`, { action: 'Commission', href: 'commissions.html' }); return; }
    if (!optId && av.length > 1) return pickOption(a, 'buy');
    const opt = optId || av[0].id;
    const r = Cart.add(id, opt, 1);
    if (r === false) { toast('Sorry — that option just sold out.'); return; }
    Site.track('begin_checkout', { currency: Site.S.currency, value: a.options.find(o => o.id === opt).price });
    if (window.FX && srcEl) FX.splatEl(srcEl);
    setTimeout(() => { location.href = 'checkout.html'; }, window.FX ? 260 : 0);
  };
  Site.addToCart = (id, optId, srcEl) => {
    const a = Site.art(id); if (!a) return;
    const av = Site.availOptions(a);
    if (!av.length) return toast('This piece has sold.');
    if (!optId && av.length > 1) return pickOption(a, 'add');
    const opt = optId || av[0].id;
    const r = Cart.add(id, opt, 1);
    if (r === 'max') return toast(a.options.find(o => o.id === opt).kind === 'original' ? 'This original is already in your cart — there is only one!' : 'You have all available copies in your cart.', { action: 'View cart', onAction: openCart });
    if (!r) return toast('Sorry — that option just sold out.');
    const img = Site.img(a.thumb || a.image);
    const go = () => { const btn = $('#cart-btn'); if (btn) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); } openCart(); };
    if (window.FX && srcEl && $('#cart-btn')) FX.flyToCart(srcEl, img, Site.accentOf(a)).then(go); else go();
  };
  function pickOption(a, mode) {
    const m = openModal(`<div class="modal-body">
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:6px"><img src="${esc(Site.img(a.thumb || a.image))}" alt="" style="width:74px;height:74px;object-fit:cover;border:5px solid #fff;box-shadow:var(--shadow-1)">
      <div><div class="eyebrow no-line">Choose your version</div><h3 class="h3" style="margin-top:6px">${esc(a.title)}</h3></div></div>
      <form data-pick><div class="opt-list">${optionCards(a, 'pick')}</div>
      <div style="display:flex;gap:10px"><button class="btn btn-buy btn-lg" style="flex:1" type="submit" data-mode="buy">Buy Now</button><button class="btn btn-ghost btn-lg" type="submit" data-mode="add" aria-label="Add to cart">${I.cartPlus}</button></div></form></div>`, { width: 520, label: 'Choose an option' });
    const f = m.querySelector('[data-pick]');
    let md = mode;
    f.querySelectorAll('button[type=submit]').forEach(b => b.addEventListener('click', () => md = b.dataset.mode));
    f.addEventListener('submit', e => { e.preventDefault(); const v = f.pick.value; if (!v) return; closeModal(true); $('[data-scrim]').classList.remove('open'); document.documentElement.style.overflow = ''; if (md === 'buy') Site.buyNow(a.id, v); else Site.addToCart(a.id, v, $(`[data-add="${CSS.escape(a.id)}"]`)); });
  }

  /* ------------------------------------------------------------ cards */
  Site.frameClass = a => ['', 'oak', 'white'][hash(a.id) % 3];
  Site.frameWidth = (a, slot = 4 / 4.6, maxW = 80, maxH = 82) => {
    const ar = (a.imgW && a.imgH) ? a.imgW / a.imgH : (a.width && a.height ? a.width / a.height : .8);
    const byH = maxH * ar / slot; return Math.min(maxW, byH);
  };
  Site.card = (a, o = {}) => {
    const av = Site.availOptions(a), sold = !av.length, many = av.length > 1;
    const orig = Site.originalOpt(a), origAvail = orig && Site.optAvail(orig) && a.status !== 'sold', origSold = Site.originalSold(a);
    const prints = av.filter(o => o.kind !== 'original');
    const mainPrice = origAvail ? orig.price : Site.minPrice(a);
    const showFrom = !origAvail && many;
    const scarce = av.map(Site.scarcity).find(s => /left/.test(s));
    const fc = o.frame !== undefined ? o.frame : Site.frameClass(a);
    const wished = Wish.has(a.id);
    let status;
    if (sold) status = 'Sold — commission something similar';
    else if (origAvail) status = 'Original · one of a kind' + (prints.length ? ` · prints from ${Site.money(Math.min(...prints.map(p => p.price)))}` : '');
    else if (origSold) status = 'Original sold · signed prints available';
    else status = scarce || 'Signed print';
    return `<article class="art-card" data-id="${esc(a.id)}" data-accent="${esc(Site.accentOf(a))}" ${o.reveal !== false ? `data-reveal style="--d:${(o.i || 0) % 3 * 0.08}s"` : ''}>
      <div class="art-slot">
        <a class="frame ${fc}" href="${Site.artUrl(a)}" style="width:${Site.frameWidth(a).toFixed(1)}%" data-tilt aria-label="${esc(a.title)} — view details">
          <img class="img-develop" src="${esc(Site.img(a.thumb || a.image))}" alt="${esc(a.title)} — ${esc(a.medium || 'artwork')} by ${esc(Site.S.artistName)}" loading="lazy" decoding="async" width="${a.imgW || 800}" height="${a.imgH || 1000}">
          <span class="glare"></span>
          ${origSold || sold ? '<span class="red-dot" aria-label="Original sold"></span>' : ''}
        </a>
        <div class="badges">${Site.isNew(a) && !sold ? '<span class="pill accent">New</span>' : ''}${a.compareAt && !sold ? '<span class="pill">Sale</span>' : ''}${a.featured && o.showFeatured ? '<span class="pill light">★ Artist pick</span>' : ''}</div>
        <button class="icon-btn heart-btn ${wished ? 'is-on' : ''}" data-wish="${esc(a.id)}" aria-pressed="${wished}" aria-label="Save ${esc(a.title)}">${I.heart}</button>
        <div class="hover-tools"><button class="tool-chip" data-quick="${esc(a.id)}">${I.eye} Quick look</button><button class="tool-chip" data-wall="${esc(a.id)}">${I.wall} On my wall</button></div>
      </div>
      <div class="placard">
        <div class="pl-top"><h3><a href="${Site.artUrl(a)}">${esc(a.title)}</a></h3><span class="price">${a.compareAt && !sold && origAvail ? `<s>${Site.money(a.compareAt)}</s>` : ''}${showFrom ? '<span class="from">from</span>' : ''}${Site.money(mainPrice)}</span></div>
        <p class="pl-meta">${esc([a.medium, Site.sizeLabel(a)].filter(Boolean).join(' · '))}</p>
        <div class="pl-status">${sold ? '' : '<span class="live-dot" style="width:7px;height:7px"></span>'}<span class="${scarce && !origAvail ? 'scarce' : ''}">${esc(status)}</span></div>
        <div class="pl-cta">${sold ? `<a class="btn btn-ghost" href="commissions.html?ref=${encodeURIComponent(a.id)}">Request similar</a>` : `<button class="btn btn-buy" data-buy="${esc(a.id)}" data-magnetic>Buy Now</button><button class="icon-btn" data-add="${esc(a.id)}" aria-label="Add ${esc(a.title)} to cart" title="Add to cart">${I.cartPlus}</button>`}</div>
      </div>
    </article>`;
  };

  /* ------------------------------------------------------------ quick view */
  Site.quickView = id => {
    const a = Site.art(id); if (!a) return;
    const av = Site.availOptions(a);
    const m = openModal(`<div style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)" class="qv-grid">
      <div style="background:var(--paper-2);display:grid;place-items:center;padding:36px"><span class="frame ${Site.frameClass(a)}" style="width:${Math.min(92, Site.frameWidth(a, 1, 92, 92))}%"><img src="${esc(Site.img(a.image))}" alt="${esc(a.title)}"></span></div>
      <div class="modal-body">
        <div class="eyebrow no-line">${esc(Site.kindLabel(a))} · ${esc(a.year || '')}</div>
        <h3 class="h2" style="font-size:40px;margin:10px 0 8px">${esc(a.title)}</h3>
        <p class="muted" style="font-size:14.5px">${esc([a.medium, Site.sizeLabel(a)].filter(Boolean).join(' · '))}</p>
        <p style="font-size:15px">${esc((a.description || '').slice(0, 190))}${(a.description || '').length > 190 ? '…' : ''}</p>
        ${av.length ? `<form data-qv><div class="opt-list" style="margin:14px 0">${optionCards(a, 'qv')}</div>
        <div style="display:flex;gap:10px"><button class="btn btn-buy btn-lg" style="flex:1" data-mode="buy">Buy Now</button><button class="btn btn-ghost btn-lg" data-mode="add" aria-label="Add to cart">${I.cartPlus}</button></div></form>` : `<p><b style="color:var(--red)">● Sold</b></p><a class="btn btn-ghost" href="commissions.html?ref=${encodeURIComponent(a.id)}">Commission something similar</a>`}
        <p style="margin:18px 0 0"><a class="text-link" href="${Site.artUrl(a)}">Full details & story ${I.arrow}</a></p>
      </div></div>
      <style>@media(max-width:760px){.qv-grid{grid-template-columns:1fr!important}}</style>`, { width: 980, label: a.title });
    const f = m.querySelector('[data-qv]');
    if (f) { let md = 'buy'; f.querySelectorAll('button').forEach(b => b.addEventListener('click', () => md = b.dataset.mode)); f.addEventListener('submit', e => { e.preventDefault(); const v = f.qv.value; closeModal(); if (md === 'buy') Site.buyNow(a.id, v); else setTimeout(() => Site.addToCart(a.id, v), 300); }); }
    Site.track('view_item', { items: [{ item_id: a.id, item_name: a.title }] });
  };

  /* ------------------------------------------------------------ view on your wall */
  const WALLS = [['Gallery white', '#eeeae3'], ['Warm linen', '#e7dccb'], ['Sage', '#b9c2ab'], ['Terracotta', '#c98a6b'], ['Midnight', '#2d3440'], ['Charcoal', '#4a4642']];
  const SOFA = '<svg viewBox="0 0 400 130"><defs><linearGradient id="sf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f7f78"/><stop offset="1" stop-color="#55635d"/></linearGradient></defs><rect x="18" y="10" width="364" height="70" rx="20" fill="url(#sf)"/><rect x="0" y="48" width="56" height="70" rx="18" fill="#627169"/><rect x="344" y="48" width="56" height="70" rx="18" fill="#627169"/><rect x="40" y="62" width="160" height="46" rx="12" fill="#71827a"/><rect x="200" y="62" width="160" height="46" rx="12" fill="#6c7d75"/><rect x="60" y="26" width="70" height="44" rx="14" fill="#e2a24a" transform="rotate(-6 95 48)"/><rect x="270" y="26" width="66" height="42" rx="14" fill="#e6ddcc" transform="rotate(5 303 47)"/><rect x="30" y="116" width="8" height="14" fill="#3b2e24"/><rect x="362" y="116" width="8" height="14" fill="#3b2e24"/></svg>';
  const CONSOLE = '<svg viewBox="0 0 400 130"><rect x="20" y="40" width="360" height="16" rx="3" fill="#8a5f3c"/><rect x="34" y="56" width="332" height="50" rx="3" fill="#9a6d47"/><rect x="40" y="62" width="100" height="38" rx="2" fill="#a57a52"/><rect x="150" y="62" width="100" height="38" rx="2" fill="#a57a52"/><rect x="260" y="62" width="100" height="38" rx="2" fill="#a57a52"/><rect x="48" y="106" width="8" height="24" fill="#4a3322"/><rect x="344" y="106" width="8" height="24" fill="#4a3322"/><rect x="62" y="6" width="26" height="34" rx="6" fill="#e9e1d2"/><path d="M75 6c-8-14 6-22 0-6 10-12 12 4 0 6" fill="#6f8f5f"/><rect x="290" y="18" width="46" height="8" rx="2" fill="#2f4cc0"/><rect x="294" y="26" width="42" height="7" rx="2" fill="#e2492f"/><rect x="290" y="33" width="48" height="7" rx="2" fill="#f3a712"/></svg>';
  const PLANT = '<svg viewBox="0 0 80 160" width="100%"><path d="M40 90C20 70 6 50 12 20c14 20 22 40 28 70Z" fill="#5d7d4d"/><path d="M40 92c14-26 34-40 34-72-18 16-28 40-34 72Z" fill="#6f9160"/><path d="M40 95C30 60 34 30 44 6c6 30 4 60-4 89Z" fill="#4f6d42"/><path d="M22 96h36l-5 60H27z" fill="#c9b79c"/></svg>';
  Site.viewOnWall = id => {
    const a = Site.art(id); if (!a) return;
    const unitIn = a.unit === 'cm' ? 1 / 2.54 : 1;
    const wIn = (+a.width || 24) * unitIn, hIn = (+a.height || (wIn / ((a.imgW && a.imgH) ? a.imgW / a.imgH : .8))) * unitIn;
    const m = openModal(`
      <div class="room" id="room" style="--wallc:${WALLS[1][1]}">
        <div class="room-light"></div><div class="skirting"></div><div class="floor"></div>
        <div class="furniture" id="furn"></div>
        <div class="plant" id="plant" style="left:6%;width:7%">${PLANT}</div>
        <div class="hung" id="hung" style="--fw:5"><img src="${esc(Site.img(a.image))}" alt="${esc(a.title)} on a wall" draggable="false"></div>
        <div class="scale-note" id="scale-note"></div>
      </div>
      <div class="room-controls">
        <div><div class="label" style="margin-bottom:8px">Wall color</div><div class="swatches">${WALLS.map((w, i) => `<button class="swatch ${i === 1 ? 'is-active' : ''}" style="background:${w[1]}" data-wc="${w[1]}" aria-label="${w[0]}" title="${w[0]}"></button>`).join('')}</div></div>
        <div><div class="label" style="margin-bottom:8px">Room</div><div class="seg" id="roomseg"><button class="is-active" data-room="sofa">Living room</button><button data-room="console">Hallway</button><button data-room="photo">My wall 📷</button></div></div>
        <div style="flex-basis:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><b style="font-family:var(--serif);font-size:22px;font-weight:500">${esc(a.title)}</b> <span class="muted">· ${esc(Site.sizeLabel(a) || 'size approximate')}</span></div>
        <div style="display:flex;gap:10px"><button class="btn btn-buy" data-buy="${esc(a.id)}">Buy Now · ${Site.money(Site.minPrice(a))}</button></div></div>
        <input type="file" accept="image/*" id="wallphoto" hidden>
        <div id="photo-tools" hidden style="flex-basis:100%"><label class="label" for="artscale">Resize artwork</label><input type="range" id="artscale" min="5" max="90" value="30" style="width:100%;accent-color:var(--accent)"><p class="muted" style="font-size:13px;margin:6px 0 0">Tip: drag the painting to move it. Your photo never leaves your device.</p></div>
      </div>`, { width: 1000, label: 'View on your wall' });
    const room = m.querySelector('#room'), hung = m.querySelector('#hung'), furn = m.querySelector('#furn'), note = m.querySelector('#scale-note'), plant = m.querySelector('#plant');
    let mode = 'sofa', pos = null;
    function layout() {
      const W = room.clientWidth; if (!W) return;
      if (mode === 'photo') return;
      const roomIn = 150; // visible wall width in inches
      const ppi = W / roomIn;
      const refIn = mode === 'sofa' ? 84 : 60;
      furn.innerHTML = mode === 'sofa' ? SOFA : CONSOLE;
      furn.style.width = (refIn * ppi) + 'px';
      plant.style.display = mode === 'sofa' ? '' : 'none';
      hung.style.width = (wIn * ppi) + 'px'; hung.style.height = (hIn * ppi) + 'px';
      const furnTop = room.clientHeight * (1 - .136) - furn.getBoundingClientRect().height;
      const centerY = Math.max(hIn * ppi / 2 + room.clientHeight * .05, furnTop - 9 * ppi - hIn * ppi / 2);
      hung.style.left = '50%'; hung.style.top = centerY + 'px';
      note.textContent = `${mode === 'sofa' ? 'Sofa ≈ 84 in' : 'Console ≈ 60 in'} · artwork ${Site.sizeLabel(a) || '(approx.)'} to scale`;
    }
    const ro = new ResizeObserver(layout); ro.observe(room); setTimeout(layout, 50);
    m.querySelectorAll('[data-wc]').forEach(b => b.onclick = () => { room.style.setProperty('--wallc', b.dataset.wc); m.querySelectorAll('[data-wc]').forEach(x => x.classList.toggle('is-active', x === b)); });
    m.querySelectorAll('[data-room]').forEach(b => b.onclick = () => {
      if (b.dataset.room === 'photo') { m.querySelector('#wallphoto').click(); return; }
      mode = b.dataset.room; room.classList.remove('photo'); room.style.backgroundImage = ''; m.querySelector('#photo-tools').hidden = true;
      m.querySelectorAll('[data-room]').forEach(x => x.classList.toggle('is-active', x === b)); layout();
    });
    m.querySelector('#wallphoto').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const url = URL.createObjectURL(f); mode = 'photo'; room.classList.add('photo'); room.style.backgroundImage = `url("${url}")`;
      m.querySelectorAll('[data-room]').forEach(x => x.classList.toggle('is-active', x.dataset.room === 'photo'));
      m.querySelector('#photo-tools').hidden = false; note.textContent = 'Your wall';
      const sc = m.querySelector('#artscale'); const setS = () => { const w = room.clientWidth * sc.value / 100; hung.style.width = w + 'px'; hung.style.height = (w * hIn / wIn) + 'px'; };
      sc.oninput = setS; setS(); hung.style.left = '50%'; hung.style.top = '42%';
    };
    // drag artwork
    let drag = null;
    hung.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, l: hung.offsetLeft, t: hung.offsetTop }; hung.setPointerCapture(e.pointerId); });
    hung.addEventListener('pointermove', e => { if (!drag) return; hung.style.left = (drag.l + e.clientX - drag.x) + 'px'; hung.style.top = (drag.t + e.clientY - drag.y) + 'px'; });
    hung.addEventListener('pointerup', () => drag = null);
    Site.track('view_on_wall', { item_id: a.id });
  };

  /* ------------------------------------------------------------ forms: orders, newsletter, commissions */
  Site.formsConfigured = () => !!(Site.S.orders.web3formsKey || Site.S.orders.formsubmitEmail);
  Site.sendForm = async (subject, fields, o = {}) => {
    const S = Site.S, key = (S.orders.web3formsKey || '').trim(), fs = (S.orders.formsubmitEmail || '').trim();
    const flat = {}; Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v); });
    try {
      if (key) {
        const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ access_key: key, subject, from_name: `${S.artistName} — website`, replyto: o.replyTo || flat.email || undefined, ...flat }) });
        const j = await r.json().catch(() => ({})); return { ok: r.ok && j.success !== false, via: 'web3forms' };
      }
      if (fs) {
        const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(fs), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: subject, _template: 'table', _captcha: 'false', _replyto: o.replyTo || flat.email || undefined, ...flat }) });
        const j = await r.json().catch(() => ({})); return { ok: r.ok && String(j.success) !== 'false', via: 'formsubmit' };
      }
    } catch (e) { console.warn('Form send failed', e); return { ok: false, error: e }; }
    return { ok: false, reason: 'not-configured' };
  };
  Site.mailto = (subject, body) => { const to = Site.S.contactEmail || Site.S.orders.formsubmitEmail || ''; return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  Site.validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  async function newsletterSubmit(f) {
    const input = f.querySelector('input[type=email]'), v = input.value.trim(), btn = f.querySelector('button');
    if (!Site.validEmail(v)) { input.focus(); toast('Please enter a valid email address.', { color: 'var(--red)' }); return; }
    btn.classList.add('is-loading');
    const r = await Site.sendForm(`New collector's list signup: ${v}`, { email: v, type: 'Newsletter signup', page: location.pathname });
    btn.classList.remove('is-loading');
    LS.set('subscribed', v); Site.track('sign_up', { method: 'newsletter' });
    const code = Site.S.newsletter.offerCode;
    const html = `<div style="padding:4px 0"><div class="hand" style="font-size:30px;line-height:1.1;color:inherit">You're on the list ✺</div>${code ? `<p style="margin:6px 0 0;opacity:.85">Your welcome gift: use code <b style="letter-spacing:.08em">${esc(code)}</b> at checkout.</p>` : '<p style="margin:6px 0 0;opacity:.85">Watch your inbox for new work.</p>'}</div>`;
    if (!r.ok && r.reason !== 'not-configured') console.warn('Newsletter delivery failed');
    f.outerHTML = html;
    if (code) LS.set('offerCode', code);
    if (window.FX) FX.confetti();
  }

  /* ------------------------------------------------------------ popup + welcome back */
  function schedulePopup() {
    const S = Site.S, page = document.body.dataset.page;
    if (!S.newsletter.enabled || !S.newsletter.popup || LS.get('subscribed') || !['home', 'gallery', 'artwork', 'about'].includes(page) || innerWidth < 700) return; // no interstitials on phones (Google penalizes them)
    const last = LS.get('popupSeen', 0); if (Date.now() - last < 1000 * 60 * 60 * 24 * 10) return;
    let shown = false;
    const show = () => {
      if (shown || $('.modal.open') || ($('#cart-drawer') && $('#cart-drawer').classList.contains('open'))) return; shown = true; LS.set('popupSeen', Date.now());
      const code = S.newsletter.offerCode, d = code && (S.discounts || []).find(x => String(x.code).toUpperCase() === String(code).toUpperCase() && x.active !== false);
      openModal(`<div style="display:grid;grid-template-columns:.9fr 1.1fr" class="pop-grid">
        <div style="background:url('${esc(Site.img((Site.visibleArts()[0] || {}).image || ''))}') center/cover;min-height:260px"></div>
        <div class="modal-body" style="padding:38px 32px">
          <div class="eyebrow no-line" style="color:var(--accent)">✺ Studio letters</div>
          <h3 class="h2" style="font-size:40px;margin:12px 0 12px">${d ? `Take <em class="ital">${d.percent ? d.percent + '%' : Site.money(d.amount)} off</em> your first piece` : esc(S.newsletter.headline)}</h3>
          <p class="muted" style="font-size:15px">${esc(S.newsletter.text)}</p>
          <form class="inline-form light" data-newsletter novalidate style="margin-top:18px"><label class="sr-only" for="pop-email">Email</label><input id="pop-email" type="email" name="email" autocomplete="email" placeholder="you@email.com" required autofocus><button class="btn btn-accent btn-sm" type="submit">Join</button></form>
          <button class="muted" data-modal-close style="font-size:13px;margin-top:14px;text-decoration:underline">No thanks, I'll keep browsing</button>
        </div></div><style>.pop-grid>*{min-width:0}@media(max-width:640px){.pop-grid{grid-template-columns:minmax(0,1fr)!important}.pop-grid>div:first-child{min-height:160px!important}}</style>`, { width: 780, label: 'Join the collector list' });
    };
    setTimeout(show, 40000);
    const onS = () => { if (scrollY / (document.documentElement.scrollHeight - innerHeight) > .6) { removeEventListener('scroll', onS); setTimeout(show, 1200); } };
    addEventListener('scroll', onS, { passive: true });
  }
  function welcomeBack() {
    const last = LS.get('lastVisit', 0), now = Date.now(); LS.set('lastVisit', now);
    const page = document.body.dataset.page; if (['checkout', 'thanks'].includes(page)) return;
    const items = Cart.items().filter(i => i.avail);
    if (items.length && last && now - last > 1000 * 60 * 45) setTimeout(() => toast(`Welcome back! “${esc(items[0].art.title)}” is still waiting in your cart.`, { img: Site.img(items[0].art.thumb), action: 'Checkout', href: 'checkout.html', ms: 7000 }), 1800);
  }

  /* ------------------------------------------------------------ analytics (GA4, optional) */
  function initAnalytics() {
    const id = Site.S.analytics && Site.S.analytics.ga4; if (!id || Site.isPreview) return;
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', id);
  }
  Site.track = (name, params) => { try { if (window.gtag) gtag('event', name, params || {}); } catch (e) { } };

  /* ------------------------------------------------------------ misc */
  Site.copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (er) { } t.remove(); }
    if (btn) { const o = btn.innerHTML; btn.innerHTML = I.check + ' Copied'; setTimeout(() => btn.innerHTML = o, 1600); }
  };
  Site.loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src)); document.head.appendChild(s); });
})();
