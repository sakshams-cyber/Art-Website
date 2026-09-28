/* gallery.js — shop page with filters, search, sort & shop-by-color */
(function () {
  'use strict';
  const { $, $$, esc } = Site;
  const MEDIUMS = [['oil', 'Oil'], ['acrylic', 'Acrylic'], ['watercolor', 'Watercolor'], ['gouache', 'Gouache'], ['ink', 'Ink'], ['charcoal', 'Charcoal'], ['pencil', 'Pencil'], ['pastel', 'Pastel'], ['digital', 'Digital'], ['mixed', 'Mixed media'], ['photo', 'Photography'], ['print', 'Prints & editions']];
  const COLORS = [['red', '#d8412b'], ['orange', '#ee8a3c'], ['yellow', '#f0c43a'], ['green', '#4f8a4a'], ['blue', '#2f5cc0'], ['purple', '#7a4fa0'], ['pink', '#e86a92'], ['neutral', '#b9ab98'], ['light', '#f1ebe0'], ['dark', '#1f1c2a']];
  const PRICES = [['0-100', 'Under $100'], ['100-300', '$100–300'], ['300-600', '$300–600'], ['600-', '$600+']];
  const SIZES = [['s', 'Small (≤ 16 in)'], ['m', 'Medium'], ['l', 'Large (≥ 30 in)']];
  const st = { type: 'all', saved: false, avail: false, q: '', sort: 'featured', color: '', medium: '', price: '', size: '' };

  const mediumOf = a => { const m = (a.medium || '').toLowerCase(); const found = MEDIUMS.filter(([k]) => m.includes(k)).map(x => x[0]); if (a.options.every(o => o.kind !== 'original')) found.push('print'); return found; };
  const longSide = a => { const k = a.unit === 'cm' ? 1 / 2.54 : 1; return Math.max(+a.width || 0, +a.height || 0) * k; };
  const sizeOf = a => { const L = longSide(a); if (!L) return ''; return L <= 16 ? 's' : L >= 30 ? 'l' : 'm'; };

  Site.ready.then(() => {
    const S = Site.S;
    Site.setTitle('Gallery');
    const all = Site.visibleArts();
    // read URL
    const p = Site.qs;
    if (p.get('type')) st.type = p.get('type');
    if (p.get('saved')) st.saved = true;
    if (p.get('avail')) st.avail = true;
    ['q', 'sort', 'color', 'medium', 'price', 'size'].forEach(k => { if (p.get(k)) st[k] = p.get(k); });
    $('#q').value = st.q; $('#sort').value = st.sort;
    if (S.commissions && S.commissions.text) $('#cb-text').textContent = S.commissions.text;
    if (!S.commissions.open) $('.commission-band').remove();

    // build filter UI (only show options that exist in the data)
    const typeChips = [['all', 'All work'], ['original', 'Originals'], ['print', 'Prints'], ['avail', 'Available now'], ['saved', 'Saved ♡']];
    $('#fb-type').innerHTML = typeChips.map(([k, l]) => `<button class="chip" data-type="${k}">${l}${k === 'saved' ? ` <span data-wish-count class="show" style="opacity:.6">${Site.Wish.list().length}</span>` : ''}</button>`).join('');
    const famCount = {}; all.forEach(a => Site.families(a).forEach(f => famCount[f] = (famCount[f] || 0) + 1));
    $('#fb-color').innerHTML = COLORS.filter(([k]) => famCount[k]).map(([k, c]) => `<button class="color-dot" data-color="${k}" style="--c:${c}" aria-label="${k} (${famCount[k]})" title="${k[0].toUpperCase() + k.slice(1)} · ${famCount[k]}"></button>`).join('');
    const medCount = {}; all.forEach(a => mediumOf(a).forEach(m => medCount[m] = (medCount[m] || 0) + 1));
    $('#fb-medium').innerHTML = MEDIUMS.filter(([k]) => medCount[k]).map(([k, l]) => `<button class="chip" data-medium="${k}">${l} <span class="muted">${medCount[k]}</span></button>`).join('');
    $('#fb-price').innerHTML = PRICES.map(([k, l]) => `<button class="chip" data-price="${k}">${l}</button>`).join('');
    $('#fb-size').innerHTML = SIZES.filter(([k]) => all.some(a => sizeOf(a) === k)).map(([k, l]) => `<button class="chip" data-size="${k}">${l}</button>`).join('');
    if (st.color || st.medium || st.price || st.size) toggleMore(true);

    // events
    $('#fb-type').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; const k = b.dataset.type; if (k === 'saved') st.saved = !st.saved; else if (k === 'avail') st.avail = !st.avail; else { st.type = k; if (k === 'all') { st.saved = false; st.avail = false; } } render(); });
    $('#fb-color').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; st.color = st.color === b.dataset.color ? '' : b.dataset.color; if (window.FX && st.color) { FX.setColor(getComputedStyle(b).getPropertyValue('--c').trim()); FX.splat(e.clientX, e.clientY, getComputedStyle(b).getPropertyValue('--c').trim(), 1.2); } render(); });
    $('#fb-medium').addEventListener('click', e => { const b = e.target.closest('[data-medium]'); if (!b) return; st.medium = st.medium === b.dataset.medium ? '' : b.dataset.medium; render(); });
    $('#fb-price').addEventListener('click', e => { const b = e.target.closest('[data-price]'); if (!b) return; st.price = st.price === b.dataset.price ? '' : b.dataset.price; render(); });
    $('#fb-size').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (!b) return; st.size = st.size === b.dataset.size ? '' : b.dataset.size; render(); });
    let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); render(); }, 180); });
    $('#sort').addEventListener('change', e => { st.sort = e.target.value; render(); });
    $('#fb-more-btn').addEventListener('click', () => toggleMore());
    const clear = () => { Object.assign(st, { type: 'all', saved: false, avail: false, q: '', color: '', medium: '', price: '', size: '' }); $('#q').value = ''; render(); };
    $('#clear-all').onclick = clear; $('#empty-clear').onclick = clear;
    document.addEventListener('click', e => { if (e.target.closest('[data-wish]') && st.saved) setTimeout(render, 350); });

    render(true);
    recent();
    // structured data: list of products
    Site.jsonld({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: all.slice(0, 30).map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: Site.absUrl(Site.artUrl(a)), name: a.title })) });

    function toggleMore(force) { const m = $('#fb-more'), open = force !== undefined ? force : m.hidden; m.hidden = !open; $('#fb-more-btn').setAttribute('aria-expanded', open); $('#fb-more-btn').classList.toggle('is-active', open); }

    function filtered() {
      const q = st.q.toLowerCase();
      let list = all.filter(a => {
        if (st.type === 'original' && !Site.originalOpt(a)) return false;
        if (st.type === 'print' && !a.options.some(o => o.kind !== 'original')) return false;
        if (st.avail && !Site.artAvail(a)) return false;
        if (st.saved && !Site.Wish.has(a.id)) return false;
        if (st.color && !Site.families(a).includes(st.color)) return false;
        if (st.medium && !mediumOf(a).includes(st.medium)) return false;
        if (st.size && sizeOf(a) !== st.size) return false;
        if (st.price) { const [lo, hi] = st.price.split('-').map(Number); const pr = Site.availOptions(a).map(o => o.price); const any = (pr.length ? pr : a.options.map(o => o.price)).some(v => v >= (lo || 0) && (!hi || v < hi)); if (!any) return false; }
        if (q) { const hay = [a.title, a.medium, a.description, (a.tags || []).join(' '), Site.families(a).join(' '), a.year].join(' ').toLowerCase(); if (!q.split(/\s+/).every(w => hay.includes(w))) return false; }
        return true;
      });
      const idx = new Map(all.map((a, i) => [a.id, i]));
      const byAvail = (a, b) => (Site.artAvail(b) ? 1 : 0) - (Site.artAvail(a) ? 1 : 0);
      if (st.sort === 'featured') list.sort((a, b) => byAvail(a, b) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || idx.get(a.id) - idx.get(b.id));
      if (st.sort === 'new') list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      if (st.sort === 'price-asc') list.sort((a, b) => byAvail(a, b) || Site.minPrice(a) - Site.minPrice(b));
      if (st.sort === 'price-desc') list.sort((a, b) => byAvail(a, b) || Site.minPrice(b) - Site.minPrice(a));
      if (st.sort === 'size-desc') list.sort((a, b) => longSide(b) - longSide(a));
      return list;
    }

    function render(first) {
      // chips state
      $$('#fb-type [data-type]').forEach(b => { const k = b.dataset.type; b.classList.toggle('is-active', k === 'saved' ? st.saved : k === 'avail' ? st.avail : (st.type === k && (k !== 'all' || (!st.saved && !st.avail)))); });
      $$('#fb-color [data-color]').forEach(b => b.classList.toggle('is-active', b.dataset.color === st.color));
      $$('#fb-medium [data-medium]').forEach(b => b.classList.toggle('is-active', b.dataset.medium === st.medium));
      $$('#fb-price [data-price]').forEach(b => b.classList.toggle('is-active', b.dataset.price === st.price));
      $$('#fb-size [data-size]').forEach(b => b.classList.toggle('is-active', b.dataset.size === st.size));
      const nMore = [st.color, st.medium, st.price, st.size].filter(Boolean).length;
      $('#fb-n').textContent = nMore ? `· ${nMore}` : '';
      const any = st.type !== 'all' || st.saved || st.avail || st.q || nMore;
      $('#clear-all').hidden = !any;
      // url
      const u = new URLSearchParams(); if (st.type !== 'all') u.set('type', st.type); if (st.saved) u.set('saved', '1'); if (st.avail) u.set('avail', '1'); ['q', 'color', 'medium', 'price', 'size'].forEach(k => st[k] && u.set(k, st[k])); if (st.sort !== 'featured') u.set('sort', st.sort);
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));

      const list = filtered();
      const draw = () => {
        const grid = $('#grid');
        grid.innerHTML = list.map((a, i) => Site.card(a, { i, showFeatured: true })).join('');
        $$('.art-card', grid).forEach(c => c.style.viewTransitionName = 'c-' + c.dataset.id.replace(/[^a-z0-9_-]/gi, ''));
        Site.enhance(grid);
        const availN = list.filter(Site.artAvail).length;
        $('#result-count').innerHTML = `Showing <b>${list.length}</b> ${list.length === 1 ? 'work' : 'works'}${availN !== list.length ? ` · ${availN} available` : ''}`;
        $('#empty').hidden = list.length > 0;
        if (st.saved && !list.length) $('#empty-msg').textContent = 'Tap the ♡ on any artwork to save it here for later.';
      };
      if (!first && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('vt-soft');
        const t = document.startViewTransition(draw);
        t.finished.finally(() => document.documentElement.classList.remove('vt-soft'));
      } else draw();
      if (!first) Site.track('view_item_list', { item_list_name: 'gallery-filter' });
    }

    function recent() {
      const ids = Site.recent.list().filter(id => Site.art(id) && Site.art(id).status !== 'hidden').slice(0, 6);
      if (ids.length < 2) return;
      $('#recent').hidden = false;
      $('#recent-row').innerHTML = ids.map(id => { const a = Site.art(id); return `<a class="mini" href="${Site.artUrl(a)}" data-accent="${esc(Site.accentOf(a))}"><img src="${esc(Site.img(a.thumb || a.image))}" alt="" loading="lazy"><span>${esc(a.title)}</span><b>${Site.money(Site.minPrice(a))}</b></a>`; }).join('');
    }
  });
})();
