/* artwork.js — single artwork page */
(function () {
  'use strict';
  const { $, $$, esc } = Site;
  const I = Site.icons;

  Site.ready.then(() => {
    const S = Site.S;
    const id = Site.qs.get('id') || decodeURIComponent(location.hash.slice(1));
    const a = Site.art(id);
    if (!a || a.status === 'hidden') return notFound();
    Site.recent.add(a.id);
    Site.setTitle(`${a.title} — ${a.medium || 'Original art'}`);
    const desc = `${a.title} by ${S.artistName}. ${a.medium || ''} ${Site.sizeLabel(a)}. ${(a.description || '').slice(0, 140)}`.trim();
    const md = $('meta[name="description"]'); if (md) md.setAttribute('content', desc);
    setMeta('og:title', `${a.title} — ${S.artistName}`); setMeta('og:description', desc); setMeta('og:image', Site.absUrl(a.image));
    $('#crumbs').insertAdjacentHTML('beforeend', `<span>/</span><span aria-current="page">${esc(a.title)}</span>`);

    const av = Site.availOptions(a), orig = Site.originalOpt(a);
    const accent = Site.accentOf(a);
    document.documentElement.style.setProperty('--art-accent', accent);
    $('#aw-root').dataset.accent = accent;

    /* media */
    const img = $('#aw-img'), frame = $('#aw-frame');
    frame.className = 'frame ' + Site.frameClass(a);
    frame.style.width = Math.min(100, Site.frameWidth(a, .82, 88, 92)) + '%';
    img.src = Site.img(a.image); img.alt = `${a.title} — ${a.medium || 'artwork'} by ${S.artistName}`;
    if (a.imgW) { img.width = a.imgW; img.height = a.imgH; }
    $('#aw-stage').style.setProperty('--glow', accent);
    loupe(frame, img, Site.img(a.image));
    frame.addEventListener('click', () => lightbox(a));
    $('#aw-zoom').addEventListener('click', () => lightbox(a));
    $('#room-card').addEventListener('click', () => Site.viewOnWall(a.id));
    $('#rc-art').style.backgroundImage = `url("${Site.img(a.thumb || a.image)}")`;
    const ar = (a.imgW && a.imgH) ? a.imgW / a.imgH : .8; $('#rc-art').style.aspectRatio = ar; $('#rc-art').style.width = Math.min(46, 30 * Math.sqrt(ar)) + '%';

    /* info */
    $('#aw-kind').innerHTML = `${esc(Site.kindLabel(a))}${a.year ? ' · ' + esc(a.year) : ''}${Site.isNew(a) ? ' · <span style="color:var(--accent)">New</span>' : ''}`;
    $('#aw-title').textContent = a.title;
    $('#aw-artist').textContent = S.artistName;
    $('#aw-desc').textContent = a.description || 'A new piece from the studio.';
    $('#aw-sig').textContent = '— ' + S.artistName;

    const opts = $('#aw-opts');
    if (a.options.length > 1 || (a.options[0] && a.options[0].kind !== 'original')) opts.innerHTML = Site.optionCards(a, 'opt');
    else opts.closest('fieldset').hidden = true;
    const sel = () => { const r = $('#aw-buy').querySelector('input[name=opt]:checked'); return a.options.find(o => o.id === (r ? r.value : (av[0] && av[0].id))) || a.options[0]; };
    function update() {
      const o = sel(), ok = Site.optAvail(o) && a.status !== 'sold';
      const cmp = a.compareAt && o.kind === 'original' && ok ? `<s class="price-old">${Site.money(a.compareAt)}</s>` : '';
      $('#aw-price').innerHTML = `${cmp}<span class="p-now">${Site.money(o.price)}</span>${cmp ? `<span class="pill accent">Save ${Site.money(a.compareAt - o.price)}</span>` : ''}`;
      const sc = Site.scarcity(o);
      $('#aw-avail').innerHTML = ok ? `<span class="live-dot"></span> <b>Available</b> · ${o.kind === 'original' ? 'the only one in existence' : (sc && /left/.test(sc) ? `<span style="color:var(--accent);font-weight:700">${esc(sc)}</span>` : 'signed & numbered')} · ${esc(S.shipping.processing || '')}` : `<b style="color:var(--red)">● Sold</b> — ${a.options.some(Site.optAvail) ? 'choose another version above' : 'but I can paint you something similar'}`;
      $('#aw-ctas').innerHTML = ok ? `
        <button type="button" class="btn btn-buy btn-lg aw-buy-btn" data-buy-sel data-magnetic>${I.lock} Buy Now · ${Site.money(o.price)}</button>
        <button type="button" class="btn btn-ghost btn-lg" data-add-sel aria-label="Add to cart">${I.cartPlus}<span class="hide-sm">Add to cart</span></button>
        <button type="button" class="icon-btn heart-btn big ${Site.Wish.has(a.id) ? 'is-on' : ''}" data-wish="${esc(a.id)}" aria-pressed="${Site.Wish.has(a.id)}" aria-label="Save to wishlist">${I.heart}</button>`
        : `<a class="btn btn-accent btn-lg" href="commissions.html?ref=${encodeURIComponent(a.id)}">Commission something similar ${I.arrow}</a><button type="button" class="icon-btn heart-btn big ${Site.Wish.has(a.id) ? 'is-on' : ''}" data-wish="${esc(a.id)}" aria-label="Save to wishlist">${I.heart}</button>`;
      Site.enhance($('#aw-ctas'));
      const bb = $('[data-buy-sel]'); if (bb) bb.onclick = () => Site.buyNow(a.id, sel().id, bb);
      const ab = $('[data-add-sel]'); if (ab) ab.onclick = () => Site.addToCart(a.id, sel().id, ab);
      sticky(o, ok);
      payLater(o.price);
    }
    $('#aw-buy').addEventListener('change', update);
    update();

    /* delivery estimate */
    const m = String(S.shipping.processing || '').match(/(\d+)\s*[–-]\s*(\d+)/) || String(S.shipping.processing || '').match(/(\d+)/);
    const pMax = m ? +(m[2] || m[1]) : 5;
    const d1 = addBiz(new Date(), pMax + 2), d2 = addBiz(new Date(), pMax + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    $('#aw-delivery').innerHTML = `${I.truck}<span>Order today — estimated delivery <b>${fmt(d1)} – ${fmt(d2)}</b>${S.shipping.freeOver > 0 ? ` · <span class="muted">free shipping over ${Site.money(S.shipping.freeOver)}</span>` : ''}</span>`;
    $('#aw-pay').innerHTML = Site.payChips();

    const trust = [[I.cert, a.signed !== false ? 'Signed + certificate of authenticity' : 'Certificate of authenticity'], [I.shield, 'Secure checkout'], [I.truck, 'Insured, tracked shipping']];
    if (S.policies.returns) trust.push([I.returns, 'Easy returns']);
    $('#aw-trust').innerHTML = trust.map(t => `<li>${t[0]}<span>${esc(t[1])}</span></li>`).join('');

    const specs = [['Medium', a.medium], ['Size', Site.sizeLabel(a) + (a.unit !== 'cm' && a.width ? ` (${Math.round(a.width * 2.54)} × ${Math.round(a.height * 2.54)} cm)` : '')], ['Year', a.year], ['Framing', a.framed ? 'Framed — ready to hang' : (/(canvas|panel)/i.test(a.medium || '') ? 'Unframed · ready to hang (painted edges)' : 'Unframed')], ['Signed', a.signed !== false ? 'Signed by the artist' : ''], ['Edition', (a.options.find(o => o.edition) || {}).edition ? `Limited edition of ${(a.options.find(o => o.edition)).edition}` : ''], ['Palette', Site.families(a).filter(f => !['neutral', 'light', 'dark'].includes(f)).join(', ')], ['Tags', (a.tags || []).join(', ')]].filter(r => r[1]);
    $('#aw-specs').innerHTML = specs.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('');
    $('#aw-ship').innerHTML = `<p>${esc(S.shipping.processing)}. ${esc(S.shipping.note || '')}</p>${S.shipping.freeOver ? `<p>Free shipping on orders over <b>${Site.money(S.shipping.freeOver)}</b> to ${esc(S.shipping.homeCountry)} addresses.</p>` : ''}${S.policies.returns ? `<p>${esc(S.policies.returns)}</p>` : ''}`;
    $('#aw-care').innerHTML = `<p>${esc(S.policies.care || 'Keep out of direct sunlight and dust gently with a soft, dry brush.')}</p>${S.policies.coa ? `<p>${esc(S.policies.coa)}</p>` : ''}`;
    $('#aw-colors').innerHTML = (a.colors || []).map(c => `<button class="swatch-chip" style="--c:${esc(c)}" data-hex="${esc(c)}" aria-label="Color ${esc(c)}"><i></i><span>${esc(c.toUpperCase())}</span></button>`).join('');
    $('#aw-colors').addEventListener('click', e => { const b = e.target.closest('[data-hex]'); if (!b) return; if (window.FX) { FX.setColor(b.dataset.hex, true); FX.splat(e.clientX, e.clientY, b.dataset.hex, 1.3); } Site.copy(b.dataset.hex); Site.toast(`Brush dipped in <b>${esc(b.dataset.hex.toUpperCase())}</b> · hex copied`, { color: b.dataset.hex }); });

    /* share */
    const url = location.href, text = `${a.title} by ${S.artistName}`;
    const shares = [
      navigator.share ? `<button class="icon-btn" data-sh="native" aria-label="Share">${I.share}</button>` : '',
      `<a class="icon-btn" target="_blank" rel="noopener" aria-label="Pin on Pinterest" href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(Site.absUrl(a.image))}&description=${encodeURIComponent(text)}">${I.pinterest}</a>`,
      `<a class="icon-btn" target="_blank" rel="noopener" aria-label="Share on Facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">${I.facebook}</a>`,
      `<a class="icon-btn" target="_blank" rel="noopener" aria-label="Share on X" href="https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}">${I.x}</a>`,
      `<a class="icon-btn" target="_blank" rel="noopener" aria-label="Share on WhatsApp" href="https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}">${I.whatsapp}</a>`,
      `<a class="icon-btn" aria-label="Email a friend" href="mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent('I thought you would love this: ' + url)}">${I.mail}</a>`,
      `<button class="icon-btn" data-sh="copy" aria-label="Copy link">${I.copy}</button>`];
    $('#aw-share').innerHTML = shares.join('');
    $('#aw-share').addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (!b) return; if (b.dataset.sh === 'native') navigator.share({ title: text, url }).catch(() => { }); else { Site.copy(url); Site.toast('Link copied — send it to someone who would love it'); } Site.track('share', { item_id: a.id }); });

    /* related: shared colour families / tags, then others */
    const fam = new Set(Site.families(a)), tg = new Set(a.tags || []);
    const rel = Site.visibleArts().filter(x => x.id !== a.id).map(x => ({ x, s: Site.families(x).filter(f => fam.has(f)).length + (x.tags || []).filter(t => tg.has(t)).length * 2 + (Site.artAvail(x) ? 3 : 0) + (x.featured ? 1 : 0) })).sort((p, q) => q.s - p.s).slice(0, 3).map(p => p.x);
    if (rel.length) { $('#related').innerHTML = rel.map((x, i) => Site.card(x, { i })).join(''); Site.enhance($('#related')); } else $('#related-sec').remove();

    /* Google structured data */
    Site.jsonld({
      '@context': 'https://schema.org', '@type': ['Product', 'VisualArtwork'], name: a.title, image: [Site.absUrl(a.image)], description: a.description || a.title, sku: a.id,
      brand: { '@type': 'Brand', name: S.artistName }, creator: { '@type': 'Person', name: S.artistName }, artMedium: a.medium, artform: 'Painting', dateCreated: String(a.year || ''),
      width: a.width ? { '@type': 'Distance', name: `${a.width} ${a.unit}` } : undefined, height: a.height ? { '@type': 'Distance', name: `${a.height} ${a.unit}` } : undefined,
      offers: a.options.map(o => ({ '@type': 'Offer', name: o.label, price: o.price.toFixed(2), priceCurrency: S.currency, availability: (Site.optAvail(o) && a.status !== 'sold') ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut', url: location.href, itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Person', name: S.artistName } })),
    });
    Site.track('view_item', { currency: S.currency, value: Site.minPrice(a), items: [{ item_id: a.id, item_name: a.title }] });

    function sticky(o, ok) {
      const sb = $('#sticky-buy');
      sb.innerHTML = `<img src="${esc(Site.img(a.thumb || a.image))}" alt=""><div><b>${esc(a.title)}</b><span>${ok ? Site.money(o.price) + ' · ' + esc(o.label) : 'Sold'}</span></div>${ok ? `<button class="btn btn-buy" data-sticky-buy>Buy Now</button>` : `<a class="btn btn-accent btn-sm" href="commissions.html">Commission</a>`}`;
      Site.enhance(sb);
      const b = sb.querySelector('[data-sticky-buy]'); if (b) b.onclick = () => Site.buyNow(a.id, sel().id, b);
      if (!sticky.bound) { sticky.bound = true; const io = new IntersectionObserver(es => { const vis = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; sb.classList.toggle('show', vis); sb.setAttribute('aria-hidden', !vis); }); io.observe($('#aw-ctas')); }
    }
  });

  function setMeta(p, v) { let m = document.querySelector(`meta[property="${p}"]`); if (!m) { m = document.createElement('meta'); m.setAttribute('property', p); document.head.appendChild(m); } m.setAttribute('content', v); }
  function addBiz(d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d; }

  let ppLoading = null;
  function payLater(amount) {
    const cid = Site.S.payments.paypalClientId; if (!cid) return;
    const host = $('#pp-msg');
    const render = () => { try { if (window.paypal && paypal.Messages) paypal.Messages({ amount, placement: 'product', style: { layout: 'text', logo: { type: 'inline' }, text: { size: 13 } } }).render(host); } catch (e) { } };
    if (window.paypal) return render();
    if (!ppLoading) ppLoading = Site.loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cid)}&currency=${encodeURIComponent(Site.S.currency)}&components=messages`).catch(() => { });
    ppLoading.then(render);
  }

  function loupe(frame, img, src) {
    const L = $('#loupe'); if (!matchMedia('(hover: hover)').matches) { $('#aw-hint').textContent = 'tap the painting to zoom'; return; }
    const Z = 2.6;
    frame.addEventListener('pointerenter', () => { L.style.backgroundImage = `url("${src}")`; L.classList.add('on'); });
    frame.addEventListener('pointerleave', () => L.classList.remove('on'));
    frame.addEventListener('pointermove', e => {
      const r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const fr = frame.getBoundingClientRect();
      L.style.left = (e.clientX - fr.left) + 'px'; L.style.top = (e.clientY - fr.top) + 'px';
      L.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
      L.style.backgroundPosition = `${-x * Z + 90}px ${-y * Z + 90}px`;
    });
  }
  function lightbox(a) {
    const m = Site.openModal(`<div class="lb" id="lb"><img src="${esc(Site.img(a.image))}" alt="${esc(a.title)}" id="lb-img" draggable="false"><p class="lb-cap"><b>${esc(a.title)}</b> · <span>click to zoom in, move to explore</span></p></div>`, { width: 1400, label: a.title });
    const box = m.querySelector('#lb'), im = m.querySelector('#lb-img'); let z = false;
    box.addEventListener('click', e => { z = !z; box.classList.toggle('zoomed', z); move(e); });
    box.addEventListener('pointermove', move);
    function move(e) { if (!z) { im.style.transform = ''; return; } const r = box.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5; im.style.transform = `scale(2.4) translate(${-px * 60}%, ${-py * 60}%)`; }
  }
  function notFound() {
    Site.setTitle('Artwork not found');
    $('#aw-root').innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:80px 0"><h1 class="display" style="font-style:italic">This canvas is blank.</h1><p class="lead">That artwork may have found a new home or moved. Let's find you another.</p><a class="btn btn-accent btn-lg" href="gallery.html">Back to the gallery</a></div>`;
    $('#related-sec').remove(); Site.enhance($('#aw-root'));
  }
})();
