/* checkout.js — autofill-friendly checkout + every payment method */
(function () {
  'use strict';
  const { $, $$, esc, LS } = Site;
  const I = Site.icons;

  const ISO = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const US_STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico', GU: 'Guam', VI: 'U.S. Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands', AA: 'Armed Forces Americas', AE: 'Armed Forces Europe', AP: 'Armed Forces Pacific' };
  const ADDR = {
    US: { zip: 'ZIP code', state: 'State', stateReq: true, zipRe: /^\d{5}(-\d{4})?$/ },
    CA: { zip: 'Postal code', state: 'Province', stateReq: true, zipRe: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/ },
    GB: { zip: 'Postcode', state: 'County (optional)', stateReq: false, zipRe: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/ },
    AU: { zip: 'Postcode', state: 'State / territory', stateReq: true, zipRe: /^\d{4}$/ },
    IN: { zip: 'PIN code', state: 'State', stateReq: true, zipRe: /^\d{6}$/ },
    DE: { zip: 'Postleitzahl', state: 'State (optional)', stateReq: false, zipRe: /^\d{5}$/ },
    FR: { zip: 'Code postal', state: 'Region (optional)', stateReq: false, zipRe: /^\d{5}$/ },
    IE: { zip: 'Eircode', state: 'County', stateReq: false },
    MX: { zip: 'Código postal', state: 'Estado', stateReq: true, zipRe: /^\d{5}$/ },
    JP: { zip: 'Postal code', state: 'Prefecture', stateReq: true },
    _: { zip: 'Postal code', state: 'State / province / region', stateReq: false },
  };
  const ZIPPO = ['US', 'CA', 'GB', 'DE', 'FR', 'IN', 'AU', 'ES', 'IT', 'NL', 'MX', 'JP', 'NZ', 'CH', 'AT', 'BE', 'PT', 'PL', 'SE', 'NO', 'DK', 'FI'];
  const DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'me.com', 'mac.com', 'comcast.net', 'proton.me', 'protonmail.com', 'ymail.com', 'hotmail.co.uk', 'yahoo.co.uk', 'googlemail.com', 'att.net', 'verizon.net', 'sbcglobal.net'];

  let S, form, method = null, express = false, code = '', paypalRendered = false, finalized = false;

  Site.ready.then(() => {
    S = Site.S; form = $('#checkout-form');
    Site.setTitle('Secure checkout');
    if (!Site.Cart.items().filter(i => i.avail).length) {
      const last = LS.get('lastOrder');
      if (last && Site.qs.get('order') === last.id) { finalized = true; return (last.status === 'AWAITING PAYMENT' && last.method !== 'invoice' && last.method !== 'stripe') ? showPayment(last) : showThanks(last); }
      $('#co-empty').hidden = false; form.hidden = true; $('.co-summary').style.display = 'none'; $('#co-steps').hidden = true; Site.enhance($('#co-empty')); return;
    }
    buildCountries();
    restoreForm();
    applyCountry(false);
    code = (LS.get('checkoutCode', '') || '').toUpperCase();
    const offer = LS.get('offerCode'); if (!code && offer) { $('#code-msg').innerHTML = `<button type="button" class="text-link" id="use-offer">Use your welcome code ${esc(offer)}</button>`; $('#use-offer').onclick = () => { $('#code').value = offer; applyCode(); }; }
    if (code) $('#code').value = code;
    $('#trust-returns span').textContent = S.policies.returns ? 'Easy returns — see policy' : 'Carefully packed & insured';
    $('#terms-line').innerHTML = `By placing your order you agree to the <a class="link-u" href="about.html#shipping" target="_blank">shipping</a>${S.policies.returns ? ' & <a class="link-u" href="about.html#returns" target="_blank">returns</a>' : ''} policy. Questions? ${S.contactEmail ? `<a class="link-u" href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a>` : 'Reply to your confirmation email.'}`;
    buildShip();
    buildMethods();
    renderSummary();
    bindFields();
    Site.track('begin_checkout', { currency: S.currency, value: Site.Cart.totals().total });
    $('#sum-toggle').onclick = () => { const o = $('.co-summary').classList.toggle('open'); $('#sum-toggle').setAttribute('aria-expanded', o); };
    $('#code-apply').onclick = applyCode;
    $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } });
    form.addEventListener('submit', e => { e.preventDefault(); placeOrder(); });
    document.addEventListener('cart:change', renderSummary);
  });

  /* ------------------------------------------------------------ fields */
  function buildCountries() {
    let dn = null; try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { }
    const home = (S.shipping.homeCountry || 'US').toUpperCase();
    const list = ISO.map(c => [c, dn ? dn.of(c) : c]).sort((a, b) => a[1].localeCompare(b[1]));
    const top = [home, ...['US', 'CA', 'GB', 'AU', 'IN'].filter(c => c !== home)].map(c => list.find(x => x[0] === c)).filter(Boolean);
    $('#country').innerHTML = top.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('') + '<option disabled>──────────</option>' + list.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
    $('#country').value = home;
  }
  function applyCountry(clear) {
    const c = $('#country').value, cfg = ADDR[c] || ADDR._;
    $('#zip-label').textContent = cfg.zip; $('#state-label').textContent = cfg.state;
    $('#state').required = !!cfg.stateReq;
    $('#state-list').innerHTML = c === 'US' ? Object.entries(US_STATES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('') : '';
    $('#zip').inputMode = /^(US|IN|AU|DE|FR|MX)$/.test(c) ? 'numeric' : 'text';
    if (clear) { $('#zip-hint').textContent = ''; }
    renderSummary(); buildShip();
  }
  function bindFields() {
    $('#country').addEventListener('change', () => applyCountry(true));
    $('#is-gift').addEventListener('change', e => { $('#gift-wrap').hidden = !e.target.checked; if (e.target.checked) setTimeout(() => $('#gift-note').focus(), 50); });
    // live validation on blur, clear error on input
    $$('input, select, textarea', form).forEach(el => {
      el.addEventListener('blur', () => { if (el.value) validateField(el); });
      el.addEventListener('input', () => { const f = el.closest('.field'); if (f && f.classList.contains('invalid')) validateField(el); saveForm(); });
      el.addEventListener('change', () => { saveForm(); if (el.id === 'zip') zipLookup(); });
    });
    $('#email').addEventListener('blur', emailSuggest);
    $('#zip').addEventListener('blur', zipLookup);
    // Chrome autofill fires 'change' on every field; re-check shortly after
    form.addEventListener('change', () => setTimeout(() => { $$('.field.invalid input, .field.invalid select', form).forEach(validateField); }, 30));
  }
  function validateField(el) {
    const f = el.closest('.field'); if (!f) return true;
    let ok = true; const v = (el.value || '').trim();
    if (el.required && !v) ok = false;
    if (ok && el.type === 'email' && v) ok = Site.validEmail(v);
    if (ok && el.id === 'zip' && v) { const re = (ADDR[$('#country').value] || {}).zipRe; if (re) ok = re.test(v); }
    if (ok && el.id === 'name' && v) ok = v.length >= 2;
    f.classList.toggle('invalid', !ok); f.classList.toggle('valid', ok && !!v);
    el.setAttribute('aria-invalid', !ok);
    return ok;
  }
  function validateAll(focus = true) {
    const els = ['email', 'name', 'address1', 'zip', 'city', 'state'].map(id => $('#' + id));
    const bad = els.filter(el => !validateField(el));
    if (bad.length && focus) { bad[0].focus({ preventScroll: true }); bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); Site.toast(`Almost there — please check ${bad.length === 1 ? 'the highlighted field' : 'the ' + bad.length + ' highlighted fields'}.`, { color: 'var(--red)' }); }
    return !bad.length;
  }
  function lev(a, b) { const m = []; for (let i = 0; i <= b.length; i++) m[i] = [i]; for (let j = 0; j <= a.length; j++) m[0][j] = j; for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++) m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1); return m[b.length][a.length]; }
  function emailSuggest() {
    const v = $('#email').value.trim().toLowerCase(), box = $('#email-suggest'); box.innerHTML = '';
    const at = v.lastIndexOf('@'); if (at < 1) return;
    const dom = v.slice(at + 1); if (!dom || DOMAINS.includes(dom)) return;
    let best = null, bd = 3; DOMAINS.forEach(d => { const x = lev(dom, d); if (x < bd) { bd = x; best = d; } });
    let fix = best && bd <= 2 ? best : null;
    if (!fix && /\.(con|cmo|comm|om|co)$/.test(dom) && !/\.co\.[a-z]{2}$/.test(dom)) fix = dom.replace(/\.(con|cmo|comm|om|co)$/, '.com');
    if (fix && fix !== dom) { const sug = v.slice(0, at + 1) + fix; box.innerHTML = `Did you mean <button type="button">${esc(sug)}</button>?`; box.querySelector('button').onclick = () => { $('#email').value = sug; box.innerHTML = ''; validateField($('#email')); saveForm(); }; }
  }
  let zipTimer = null, lastZip = '';
  function zipLookup() {
    const c = $('#country').value, z = $('#zip').value.trim(); if (!z || !ZIPPO.includes(c)) return;
    const key = c + z; if (key === lastZip) return; lastZip = key;
    let q = z; if (c === 'CA') q = z.slice(0, 3).toUpperCase(); if (c === 'GB') q = z.toUpperCase().replace(/\s+/g, ' ').split(' ')[0]; if (c === 'US') q = z.slice(0, 5);
    clearTimeout(zipTimer);
    zipTimer = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.zippopotam.us/${c.toLowerCase()}/${encodeURIComponent(q)}`); if (!r.ok) return;
        const j = await r.json(); const p = j.places && j.places[0]; if (!p) return;
        const city = $('#city'), st = $('#state');
        if (!city.value || city.dataset.auto) { city.value = p['place name']; city.dataset.auto = '1'; validateField(city); }
        const sv = p['state abbreviation'] || p.state; if (sv && (!st.value || st.dataset.auto)) { st.value = sv; st.dataset.auto = '1'; validateField(st); }
        $('#zip-hint').innerHTML = `${I.check.replace('<svg', '<svg width="12" height="12" style="display:inline;vertical-align:-1px;color:var(--green)"')} ${esc(p['place name'])}, ${esc(sv || '')}`;
        saveForm();
      } catch (e) { }
    }, 150);
  }
  ['city', 'state'].forEach(id => document.addEventListener('input', e => { if (e.target.id === id) delete e.target.dataset.auto; }));
  const FIELDS = ['email', 'tel', 'name', 'address1', 'address2', 'city', 'state', 'zip', 'country', 'giftNote', 'notes'];
  function saveForm() { const d = {}; FIELDS.forEach(k => { const el = form.elements[k]; if (el) d[k] = el.value; }); d.gift = $('#is-gift').checked; d.optin = $('#optin').checked; try { sessionStorage.setItem('checkoutForm', JSON.stringify(d)); } catch (e) { } }
  function restoreForm() { let d = null; try { d = JSON.parse(sessionStorage.getItem('checkoutForm') || 'null'); } catch (e) { } if (!d) return; FIELDS.forEach(k => { const el = form.elements[k]; if (el && d[k]) el.value = d[k]; }); $('#is-gift').checked = !!d.gift; $('#gift-wrap').hidden = !d.gift; $('#optin').checked = !!d.optin; }
  function data() { const d = {}; FIELDS.forEach(k => { const el = form.elements[k]; d[k] = el ? String(el.value || '').trim() : ''; }); d.gift = $('#is-gift').checked; d.optin = $('#optin').checked; d.countryName = $('#country').selectedOptions[0] ? $('#country').selectedOptions[0].textContent : d.country; return d; }

  /* ------------------------------------------------------------ delivery */
  function buildShip() {
    const host = $('#ship-opts'); if (!host || !S) return;
    const t = totals(), dom = t.domestic;
    const std = dom ? (S.shipping.freeOver > 0 && t.freeLeft === 0 ? 0 : S.shipping.domestic) : (S.shipping.international || S.shipping.domestic);
    const opts = [['std', dom ? 'Standard — insured & tracked' : 'International — insured & tracked', std, S.shipping.processing]];
    if (dom && S.shipping.expressEnabled) opts.push(['exp', 'Express — priority handling', std + (S.shipping.express || 0), 'Ships within 1–2 business days']);
    if (!opts.find(o => o[0] === 'exp')) express = false;
    host.innerHTML = opts.map(o => `<label class="opt-card"><input type="radio" name="ship" value="${o[0]}" ${(o[0] === 'exp') === express ? 'checked' : ''}><span class="radio"></span><span><span class="o-title">${esc(o[1])}</span><br><span class="o-sub">${esc(o[3] || '')}</span></span><span class="o-price">${o[2] === 0 ? 'Free' : Site.money(o[2])}</span></label>`).join('');
    host.onchange = e => { express = e.target.value === 'exp'; renderSummary(); };
  }

  /* ------------------------------------------------------------ totals + summary */
  function totals() { return Site.Cart.totals({ code, country: $('#country') ? $('#country').value : S.shipping.homeCountry, express }); }
  function renderSummary() {
    if (!S || !$('#sum-items') || finalized) return;
    const t = totals();
    if (!t.items.length) return;
    $('#sum-items').innerHTML = t.items.map(i => `<div class="sum-item"><span class="si-img"><img src="${esc(Site.img(i.art.thumb || i.art.image))}" alt=""><i>${i.qty}</i></span><div><b>${esc(i.art.title)}</b><span>${esc(i.opt.label)}</span></div><span class="si-price">${Site.money(i.line)}</span></div>`).join('');
    $('#sum-meter').innerHTML = t.domestic ? Site.shipMeter(t) : '';
    const rows = [['Subtotal', Site.money(t.subtotal)]];
    if (t.bundle) rows.push([`Collector bundle −${S.bundle.percent}%`, `<span class="save">−${Site.money(t.bundle)}</span>`]);
    if (t.code) rows.push([`Code ${esc(t.codeInfo.code)}`, `<span class="save">−${Site.money(t.code)}</span>`]);
    rows.push([express ? 'Shipping (express)' : 'Shipping', t.shipping === 0 ? '<b style="color:var(--green)">Free</b>' : Site.money(t.shipping)]);
    if (t.tax) rows.push([`Tax (${S.taxRate}%)`, Site.money(t.tax)]);
    $('#sum-totals').innerHTML = rows.map(r => `<div class="totals-row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('') + `<div class="totals-row big"><span>Total</span><span>${Site.money(t.total, { cents: true })} <small class="muted" style="font-size:12px;font-weight:600">${esc(S.currency)}</small></span></div>` + (t.discount ? `<p class="save-note">You're saving ${Site.money(t.discount)} 🎉</p>` : '');
    $('#sum-toggle-total').textContent = Site.money(t.total, { cents: true });
    const pb = $('#place-btn'); if (pb) pb.querySelector('.pb-amt').textContent = Site.money(t.total, { cents: true });
  }
  function applyCode() {
    const v = $('#code').value.trim().toUpperCase(); code = v;
    const t = totals(), msg = $('#code-msg');
    if (!v) { msg.innerHTML = ''; LS.del('checkoutCode'); }
    else if (t.codeValid) { msg.innerHTML = `<span style="color:var(--green);font-weight:700">✓ ${esc(v)} applied — you save ${Site.money(t.code)}</span>`; LS.set('checkoutCode', v); if (window.FX) FX.confetti(); }
    else { const d = (S.discounts || []).find(x => String(x.code).toUpperCase() === v && x.active !== false); msg.innerHTML = `<span style="color:var(--red);font-weight:700">${d && d.minSubtotal ? `This code needs a ${Site.money(d.minSubtotal)} minimum order` : 'That code isn’t valid — double-check the spelling?'}</span>`; code = ''; LS.del('checkoutCode'); }
    renderSummary();
    if (paypalRendered) { paypalRendered = false; renderPanel(); }
  }

  /* ------------------------------------------------------------ payment methods */
  function methods() {
    const P = S.payments, out = [];
    if (P.paypalClientId) out.push({ id: 'paypal', title: 'PayPal, Venmo, Pay Later or card', sub: 'Pay instantly — buyer protection included', logos: ['PayPal', 'Venmo', 'Pay Later', 'Visa · MC · Amex'], kind: 'sdk' });
    if (P.stripeLink) out.push({ id: 'stripe', title: 'Card, Apple Pay or Google Pay', sub: 'Secure checkout powered by Stripe', logos: ['Apple Pay', 'Google Pay', 'Cards'], kind: 'redirect' });
    if (P.venmo) out.push({ id: 'venmo', title: 'Venmo', sub: `Send to @${String(P.venmo).replace(/^@/, '')}`, logos: ['Venmo'], kind: 'manual', color: '#008CFF' });
    if (P.cashapp) out.push({ id: 'cashapp', title: 'Cash App', sub: `Send to $${String(P.cashapp).replace(/^\$/, '')}`, logos: ['Cash App'], kind: 'manual', color: '#00D632' });
    if (P.zelle) out.push({ id: 'zelle', title: 'Zelle', sub: 'Bank-to-bank from your banking app — no fees', logos: ['Zelle'], kind: 'manual', color: '#6D1ED4' });
    if (P.paypalMe && !P.paypalClientId) out.push({ id: 'paypalme', title: 'PayPal', sub: `Pay via paypal.me/${String(P.paypalMe).replace(/^.*paypal\.me\//i, '')}`, logos: ['PayPal'], kind: 'manual', color: '#003087' });
    (P.custom || []).forEach((c, i) => { if (c && c.name) out.push({ id: 'custom' + i, title: c.name, sub: c.short || 'Instructions shown after you place your order', logos: [], kind: 'manual', custom: c }); });
    if (P.invoice !== false || !out.length) out.push({ id: 'invoice', title: out.length ? 'Request an invoice' : 'Place order — pay by secure invoice', sub: 'I’ll email you a secure payment link within 24 hours', logos: [], kind: 'manual' });
    return out;
  }
  function buildMethods() {
    const list = methods();
    method = list[0].id;
    $('#pay-methods').innerHTML = list.map((m, i) => `<label class="pay-tile" style="--mc:${m.color || 'var(--ink)'}"><input type="radio" name="paymethod" value="${m.id}" ${i === 0 ? 'checked' : ''}><span class="radio"></span><span class="pt-text"><b>${esc(m.title)}</b><span>${esc(m.sub)}</span></span><span class="pt-logos">${m.logos.map(l => `<span class="pay-chip">${esc(l)}</span>`).join('')}</span></label>`).join('');
    $('#pay-methods').onchange = e => { method = e.target.value; renderPanel(); };
    renderPanel();
  }
  function renderPanel() {
    const m = methods().find(x => x.id === method), panel = $('#pay-panel');
    const t = totals();
    if (m.kind === 'sdk') {
      panel.innerHTML = `<div id="paypal-buttons" class="pp-wrap"><div class="pp-loading">Loading secure PayPal checkout…</div></div><p class="muted small center" style="margin:10px 0 0">Venmo appears on eligible US mobile devices. Choose “Debit or Credit Card” to pay without a PayPal account.</p>`;
      loadPayPal();
    } else {
      const label = m.id === 'stripe' ? 'Continue to secure payment' : m.id === 'invoice' ? 'Place order' : `Place order & pay with ${m.title}`;
      panel.innerHTML = `<button class="btn btn-buy btn-lg btn-block" type="submit" form="checkout-form" id="place-btn" data-magnetic>${I.lock} ${esc(label)} · <span class="pb-amt">${Site.money(t.total, { cents: true })}</span></button>
        <p class="muted small center" style="margin:12px 0 0">${m.id === 'stripe' ? `On Stripe’s secure page, enter <b style="color:var(--ink)">${Site.money(t.total, { cents: true })}</b> as the amount — your order number is attached automatically.` : m.id === 'invoice' ? 'Nothing is charged now. You’ll receive a secure payment link by email.' : 'Next you’ll see exactly how to send your payment — it takes about 30 seconds.'}</p>`;
    }
    Site.enhance(panel);
  }

  /* ------------------------------------------------------------ PayPal Smart Buttons (PayPal, Venmo, Pay Later, cards) */
  function loadPayPal() {
    const cid = S.payments.paypalClientId;
    const go = () => {
      if (!window.paypal || !paypal.Buttons) return ppFail();
      const host = $('#paypal-buttons'); if (!host) return; host.innerHTML = '';
      paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 50 },
        onClick: (d, actions) => { if (!validateAll()) return actions.reject(); saveForm(); return actions.resolve(); },
        createOrder: (d, actions) => {
          const t = totals(), c = data(), cur = S.currency, f = n => (n / 100).toFixed(2);
          const order = currentOrder('paypal');
          const pu = {
            reference_id: order.id, custom_id: order.id, invoice_id: order.id, description: `Artwork order ${order.id}`.slice(0, 127),
            amount: { currency_code: cur, value: f(t.totalC), breakdown: { item_total: { currency_code: cur, value: f(t.subtotalC) }, shipping: { currency_code: cur, value: f(t.shipC) }, tax_total: { currency_code: cur, value: f(t.taxC) }, discount: { currency_code: cur, value: f(t.discountC) } } },
            items: t.items.map(i => ({ name: `${i.art.title} — ${i.opt.label}`.slice(0, 127), sku: `${i.art.id}:${i.opt.id}`.slice(0, 127), unit_amount: { currency_code: cur, value: i.price.toFixed(2) }, quantity: String(i.qty), category: 'PHYSICAL_GOODS' })),
            shipping: { name: { full_name: c.name.slice(0, 300) }, address: { address_line_1: c.address1, address_line_2: c.address2 || undefined, admin_area_2: c.city, admin_area_1: stateCode(c.state, c.country) || undefined, postal_code: c.zip, country_code: c.country } },
          };
          return actions.order.create({ intent: 'CAPTURE', purchase_units: [pu], application_context: { shipping_preference: 'SET_PROVIDED_ADDRESS', brand_name: S.artistName.slice(0, 127), user_action: 'PAY_NOW' } });
        },
        onApprove: (d, actions) => actions.order.capture().then(details => {
          const cap = details && details.purchase_units && details.purchase_units[0] && details.purchase_units[0].payments && details.purchase_units[0].payments.captures && details.purchase_units[0].payments.captures[0];
          const o = currentOrder('paypal'); o.status = 'PAID'; o.paymentRef = (cap && cap.id) || details.id; o.payer = details.payer && details.payer.email_address;
          finalize(o, true);
        }),
        onCancel: () => Site.toast('Payment cancelled — your cart is saved whenever you’re ready.'),
        onError: err => { console.error(err); Site.toast('PayPal couldn’t start. Please double-check your address, or choose another payment method.', { color: 'var(--red)', ms: 7000 }); },
      }).render('#paypal-buttons').then(() => { paypalRendered = true; }).catch(ppFail);
    };
    if (window.paypal) return go();
    Site.loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cid)}&currency=${encodeURIComponent(S.currency)}&intent=capture&components=buttons,messages&enable-funding=venmo,paylater`).then(go, ppFail);
  }
  function ppFail() { const h = $('#paypal-buttons'); if (h) h.innerHTML = `<div class="pp-loading">PayPal couldn’t load right now (an ad-blocker can cause this). Please pick another payment method above, or refresh the page.</div>`; }
  function stateCode(s, c) { if (!s) return ''; if (c !== 'US') return s.slice(0, 300); const up = s.trim().toUpperCase(); if (US_STATES[up]) return up; const f = Object.entries(US_STATES).find(([, v]) => v.toUpperCase() === up); return f ? f[0] : s; }

  /* ------------------------------------------------------------ orders */
  let orderId = null;
  function newId() { const ini = (S.artistName || 'A').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'AR'; const r = Math.random().toString(36).slice(2, 6).toUpperCase(); const d = new Date(); return `${ini}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${r}`; }
  function currentOrder(mid) {
    if (!orderId) orderId = newId();
    const t = totals(), c = data(), m = methods().find(x => x.id === mid) || { title: mid };
    return {
      id: orderId, date: new Date().toISOString(), method: mid, methodName: m.title, status: 'AWAITING PAYMENT', currency: S.currency,
      items: t.items.map(i => ({ id: i.art.id, title: i.art.title, option: i.opt.label, optId: i.opt.id, qty: i.qty, price: i.price, image: i.art.thumb || i.art.image })),
      subtotal: t.subtotal, discount: t.discount, code: t.codeValid ? t.codeInfo.code : '', shipping: t.shipping, express, tax: t.tax, total: t.total,
      customer: c,
    };
  }
  function orderText(o) {
    const c = o.customer, cur = v => Site.money(v, { cents: true });
    return {
      'Order': o.id, 'Status': o.status + (o.paymentRef ? ` · ref ${o.paymentRef}` : ''), 'Payment method': o.methodName, 'Total': `${cur(o.total)} ${o.currency}`,
      'Items': o.items.map(i => `• ${i.title} — ${i.option} × ${i.qty} @ ${cur(i.price)}`).join('\n'),
      'Breakdown': `Subtotal ${cur(o.subtotal)}${o.discount ? ` · Discounts −${cur(o.discount)}${o.code ? ' (' + o.code + ')' : ''}` : ''} · Shipping ${cur(o.shipping)}${o.express ? ' (EXPRESS)' : ''}${o.tax ? ` · Tax ${cur(o.tax)}` : ''}`,
      'Ship to': [c.name, c.address1, c.address2, [c.city, c.state, c.zip].filter(Boolean).join(', '), c.countryName].filter(Boolean).join('\n'),
      'Email': c.email, 'Phone': c.tel, 'Gift': c.gift ? `YES — hide prices. Note: ${c.giftNote || '(none)'}` : '', 'Notes': c.notes, 'Newsletter opt-in': c.optin ? 'Yes' : '', 'Placed': new Date(o.date).toLocaleString(),
    };
  }
  async function notify(o, extra) {
    const f = orderText(o); if (extra) Object.assign(f, extra);
    const subject = `🎨 ${o.status === 'PAID' ? 'PAID' : 'New'} order ${o.id} — ${Site.money(o.total, { cents: true })} via ${o.methodName}`;
    return Site.sendForm(subject, { ...f, email: o.customer.email }, { replyTo: o.customer.email });
  }
  async function placeOrder() {
    const m = methods().find(x => x.id === method); if (m.kind === 'sdk') return;
    if (!validateAll()) return;
    const btn = $('#place-btn'); btn && btn.classList.add('is-loading');
    const o = currentOrder(method);
    const r = await notify(o);
    o.notified = r.ok;
    if (m.id === 'stripe') {
      finalizeStore(o);
      const u = new URL(S.payments.stripeLink);
      u.searchParams.set('prefilled_email', o.customer.email); u.searchParams.set('client_reference_id', o.id);
      location.href = u.toString(); return;
    }
    btn && btn.classList.remove('is-loading');
    finalize(o, false);
  }
  function finalizeStore(o) {
    finalized = true;
    LS.set('lastOrder', o); const h = LS.get('orders', []); h.unshift(o); LS.set('orders', h.slice(0, 20));
    Site.Cart.clear(); LS.del('checkoutCode'); try { sessionStorage.removeItem('checkoutForm'); } catch (e) { }
    if (o.customer.optin) Site.LS.set('subscribed', o.customer.email);
    Site.track('purchase', { transaction_id: o.id, value: o.total, currency: o.currency, shipping: o.shipping, tax: o.tax, coupon: o.code || undefined, items: o.items.map(i => ({ item_id: i.id, item_name: i.title, item_variant: i.option, price: i.price, quantity: i.qty })) });
  }
  async function finalize(o, paid) {
    finalizeStore(o);
    history.replaceState(null, '', 'checkout.html?order=' + encodeURIComponent(o.id));
    if (paid) { notify(o); return showThanks(o); }
    showPayment(o);
  }

  /* ------------------------------------------------------------ after placing: how to pay */
  function payLink(o) {
    const P = S.payments, amt = o.total.toFixed(2), memo = `Order ${o.id} — ${S.artistName} art`;
    if (o.method === 'venmo') return `https://venmo.com/${encodeURIComponent(String(P.venmo).replace(/^@/, ''))}?txn=pay&amount=${amt}&note=${encodeURIComponent(memo)}`;
    if (o.method === 'cashapp') return `https://cash.app/$${encodeURIComponent(String(P.cashapp).replace(/^\$/, ''))}/${amt}`;
    if (o.method === 'paypalme') return `https://paypal.me/${encodeURIComponent(String(P.paypalMe).replace(/^.*paypal\.me\//i, '').replace(/\/$/, ''))}/${amt}${S.currency}`;
    return '';
  }
  function showPayment(o) {
    form.hidden = true; setStep(3); summaryFromOrder(o);
    const P = S.payments, link = payLink(o), amt = Site.money(o.total, { cents: true });
    const m = methods().find(x => x.id === o.method) || { title: o.methodName };
    let how = '';
    if (o.method === 'venmo' || o.method === 'cashapp' || o.method === 'paypalme') {
      const handle = o.method === 'venmo' ? '@' + String(P.venmo).replace(/^@/, '') : o.method === 'cashapp' ? '$' + String(P.cashapp).replace(/^\$/, '') : 'paypal.me/' + String(P.paypalMe).replace(/^.*paypal\.me\//i, '');
      how = `<div class="pay-how">
        <div class="ph-left">
          <ol class="ph-steps"><li>Tap the button (or scan the code with your phone)</li><li>Check the amount is <b>${amt}</b>${o.method === 'venmo' ? ' and keep the note' : ''}</li><li>${o.method === 'paypalme' ? 'Choose <b>“Paying for an item or service”</b> for buyer protection' : `Add <b>${esc(o.id)}</b> as the note so I can match your order`}</li></ol>
          <a class="btn btn-buy btn-lg" href="${esc(link)}" target="_blank" rel="noopener" data-magnetic>Open ${esc(m.title)} · ${amt}</a>
          <div class="copy-row"><span>Send to</span><b>${esc(handle)}</b><button type="button" class="chip" data-copy="${esc(handle)}">${I.copy} Copy</button></div>
          <div class="copy-row"><span>Note</span><b>${esc(o.id)}</b><button type="button" class="chip" data-copy="${esc(o.id)}">${I.copy} Copy</button></div>
        </div>
        <div class="ph-qr"><div class="qr" id="qr"></div><span class="muted small">Scan with your phone camera</span></div>
      </div>`;
    } else if (o.method === 'zelle') {
      how = `<div class="pay-how single"><ol class="ph-steps"><li>Open your bank's app and choose <b>Zelle</b></li><li>Send <b>${amt}</b> to the recipient below</li><li>Put <b>${esc(o.id)}</b> in the memo</li></ol>
        <div class="copy-row"><span>Send to</span><b>${esc(P.zelle)}</b><button type="button" class="chip" data-copy="${esc(P.zelle)}">${I.copy} Copy</button></div>
        ${P.zelleName ? `<div class="copy-row"><span>Name shown</span><b>${esc(P.zelleName)}</b></div>` : ''}
        <div class="copy-row"><span>Amount</span><b>${amt}</b><button type="button" class="chip" data-copy="${o.total.toFixed(2)}">${I.copy} Copy</button></div>
        <div class="copy-row"><span>Memo</span><b>${esc(o.id)}</b><button type="button" class="chip" data-copy="${esc(o.id)}">${I.copy} Copy</button></div>
        <p class="muted small">Zelle payments arrive in minutes. Only send money to the exact contact shown above.</p></div>`;
    } else if (m.custom) {
      how = `<div class="pay-how single"><p style="white-space:pre-line">${esc(String(m.custom.instructions || '').replace(/\{amount\}/g, amt).replace(/\{order\}/g, o.id))}</p><div class="copy-row"><span>Amount</span><b>${amt}</b></div><div class="copy-row"><span>Reference</span><b>${esc(o.id)}</b><button type="button" class="chip" data-copy="${esc(o.id)}">${I.copy} Copy</button></div></div>`;
    } else {
      how = `<div class="pay-how single"><p class="lead" style="margin:0">Your order is reserved. I’ll email a secure payment link for <b>${amt}</b> to <b>${esc(o.customer.email)}</b> within 24 hours. Nothing has been charged yet.</p></div>`;
    }
    const fallback = !o.notified ? `<div class="notice"><b>One more tap:</b> please send me your order details so I know where to ship. <a class="btn btn-accent btn-sm" href="${esc(Site.mailto('Art order ' + o.id, Object.entries(orderText(o)).filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n')))}">${I.mail} Email my order</a></div>` : '';
    const after = $('#co-after'); after.hidden = false;
    after.innerHTML = `<section class="co-pay-now" data-reveal>
      <div class="eyebrow no-line" style="color:var(--accent)">Order ${esc(o.id)} · reserved for you</div>
      <h2 class="h2" style="margin:12px 0 10px">${o.method === 'invoice' ? 'You’re all set' : `Complete your payment`}</h2>
      <p class="lead" style="margin-bottom:24px">${o.method === 'invoice' ? '' : `Send <b>${amt}</b> with ${esc(m.title)} to finish. `}A confirmation ${o.notified ? 'has been sent to the artist' : 'is ready below'} — ${o.method === 'invoice' ? 'watch your inbox.' : 'your piece ships as soon as payment arrives.'}</p>
      ${how}${fallback}
      <div class="ph-actions">${o.method === 'invoice' ? `<button class="btn btn-ghost" id="done-btn">Continue</button>` : `<button class="btn btn-accent btn-lg" id="sent-btn">${I.check} I’ve sent the payment</button><button class="link-u muted" id="later-btn" type="button">I’ll pay a little later</button>`}</div>
    </section>`;
    Site.enhance(after);
    after.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('[data-copy]', after).forEach(b => b.onclick = () => Site.copy(b.dataset.copy, b));
    if (link && $('#qr')) qr($('#qr'), link);
    const sent = $('#sent-btn'); if (sent) sent.onclick = async () => { sent.classList.add('is-loading'); o.status = 'BUYER MARKED AS SENT'; await Site.sendForm(`💸 Payment sent for ${o.id} — ${Site.money(o.total, { cents: true })} via ${o.methodName}`, { Order: o.id, Buyer: o.customer.name, Email: o.customer.email, Method: o.methodName, Amount: Site.money(o.total, { cents: true }), Note: 'The buyer says they have sent payment. Please confirm it arrived before shipping.' }, { replyTo: o.customer.email }); LS.set('lastOrder', o); showThanks(o); };
    const later = $('#later-btn'); if (later) later.onclick = () => { Site.toast(`No problem — your order ${o.id} is reserved. The payment details are saved on this page.`, { ms: 6000 }); };
    const done = $('#done-btn'); if (done) done.onclick = () => showThanks(o);
  }
  function qr(el, text) {
    const draw = () => { try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } catch (e) { img(); } };
    const img = () => { el.innerHTML = `<img alt="QR code" width="180" height="180" src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(text)}">`; el.querySelector('img').onerror = () => { const w = el.closest('.ph-qr'); if (w) w.style.display = 'none'; }; };
    if (window.qrcode) return draw();
    Site.loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js').then(draw, img);
  }
  function setStep(n) { $$('#co-steps li').forEach((li, i) => { li.classList.toggle('done', i < n - 1); li.classList.toggle('now', i === n - 1); }); }

  function summaryFromOrder(o) {
    $('.co-summary').style.display = '';
    $('#sum-items').innerHTML = o.items.map(i => `<div class="sum-item"><span class="si-img"><img src="${esc(Site.img(i.image))}" alt=""><i>${i.qty}</i></span><div><b>${esc(i.title)}</b><span>${esc(i.option)}</span></div><span class="si-price">${Site.money(i.price * i.qty)}</span></div>`).join('');
    $('#code-row').hidden = true; $('#code-msg').innerHTML = ''; $('#sum-meter').innerHTML = '';
    $('#sum-totals').innerHTML = `<div class="totals-row"><span>Subtotal</span><span>${Site.money(o.subtotal)}</span></div>${o.discount ? `<div class="totals-row"><span>Discounts${o.code ? ' (' + esc(o.code) + ')' : ''}</span><span class="save">−${Site.money(o.discount)}</span></div>` : ''}<div class="totals-row"><span>Shipping${o.express ? ' (express)' : ''}</span><span>${o.shipping ? Site.money(o.shipping) : 'Free'}</span></div>${o.tax ? `<div class="totals-row"><span>Tax</span><span>${Site.money(o.tax)}</span></div>` : ''}<div class="totals-row big"><span>Total</span><span>${Site.money(o.total, { cents: true })}</span></div><p class="small muted" style="margin-top:12px">Payment: ${esc(o.methodName)}<br>Ship to: ${esc([o.customer.name, o.customer.address1, o.customer.address2, o.customer.city, o.customer.state, o.customer.zip, o.customer.countryName].filter(Boolean).join(', '))}</p>`;
    $('#sum-toggle-total').textContent = Site.money(o.total, { cents: true });
  }

  /* ------------------------------------------------------------ thank you */
  function showThanks(o) {
    form.hidden = true; setStep(4); $('#co-empty').hidden = true; $('#co-steps').hidden = false;
    $('.co-summary').style.display = '';
    $('.co-title').textContent = 'Thank you!';
    const first = (o.customer.name || '').split(' ')[0];
    const paid = o.status === 'PAID';
    const after = $('#co-after'); after.hidden = false;
    after.innerHTML = `<section class="thanks">
      <div class="thanks-burst" aria-hidden="true">${I.spark}</div>
      <h2 class="display" style="font-size:clamp(46px,6vw,84px);font-style:italic">Thank you${first ? ', ' + esc(first) : ''}!</h2>
      <p class="lead">${paid ? `Your payment was received${o.paymentRef ? ` (ref <b>${esc(o.paymentRef)}</b>)` : ''}.` : 'Your order is in.'} Order <b>${esc(o.id)}</b> · confirmation for <b>${esc(o.customer.email)}</b>.</p>
      <ol class="timeline">
        <li class="done"><b>Order placed</b><span>${new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></li>
        <li class="${paid ? 'done' : 'now'}"><b>Payment ${paid ? 'confirmed' : 'being confirmed'}</b><span>${paid ? 'Done' : 'Usually within a few hours'}</span></li>
        <li><b>Carefully packed</b><span>${esc(S.shipping.processing)}</span></li>
        <li><b>On its way to you</b><span>Tracking number by email</span></li>
      </ol>
      <div class="thanks-note"><p>I read every order myself — thank you for supporting independent art. I can't wait for this piece to find its place on your wall.</p><span class="sig">${esc(S.artistName)}</span></div>
      <div class="ph-actions"><a class="btn btn-accent" href="gallery.html">Keep exploring</a><button class="btn btn-ghost" onclick="window.print()">Print receipt</button>${(S.social && S.social.instagram) ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="${/^https?:/.test(S.social.instagram) ? esc(S.social.instagram) : 'https://instagram.com/' + esc(String(S.social.instagram).replace(/^@/, ''))}">Follow the studio</a>` : ''}</div>
    </section>`;
    summaryFromOrder(o);
    Site.enhance(after); scrollTo({ top: 0, behavior: 'smooth' });
    if (window.FX) setTimeout(FX.confetti, 300);
  }
})();
