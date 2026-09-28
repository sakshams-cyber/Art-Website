/* pages.js — About, Commissions, Thank-you */
(function () {
  'use strict';
  const { $, $$, esc } = Site;
  const page = document.body.dataset.page;

  Site.ready.then(() => {
    const S = Site.S;
    if (page === 'about') about(S);
    if (page === 'commissions') commissions(S);
    if (page === 'thanks') thanks(S);
  });

  function paras(t) { return String(t || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join(''); }

  function about(S) {
    Site.setTitle('About the artist');
    $('#ab-name').textContent = S.artistName;
    $('#ab-bio').innerHTML = paras(S.bio || S.intro);
    $('#ab-sig').textContent = S.artistName;
    if (S.portrait) $('#ab-portrait').src = Site.img(S.portrait);
    $('#ab-portrait').alt = `${S.artistName} — the studio`;
    if (S.location) $('#ab-cap').textContent = `painting in ${S.location} ✺`;
    if (S.statement) $('#ab-statement').textContent = `“${S.statement}”`; else $('#statement-sec').remove();
    const recent = Site.visibleArts().slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 4);
    $('#ab-strip').innerHTML = recent.map((a, i) => `<a class="strip-item" href="${Site.artUrl(a)}" data-accent="${esc(Site.accentOf(a))}" data-reveal style="--d:${i * .08}s;--r:${[-2, 1.5, -1, 2][i]}deg"><span class="frame white" style="--fw:8px"><img src="${esc(Site.img(a.thumb || a.image))}" alt="${esc(a.title)}" loading="lazy"></span><b>${esc(a.title)}</b><span>${Site.artAvail(a) ? Site.money(Site.minPrice(a)) : 'Sold'}</span></a>`).join('');
    $('#ab-ship').innerHTML = `<p>${esc(S.shipping.processing)}. ${esc(S.shipping.note || '')}</p>${S.shipping.freeOver ? `<p><b>Free shipping</b> on orders over ${Site.money(S.shipping.freeOver)} to ${esc(S.shipping.homeCountry)} addresses. Otherwise ${Site.money(S.shipping.domestic)} domestic${S.shipping.international ? `, ${Site.money(S.shipping.international)} international` : ''}.</p>` : ''}`;
    $('#ab-returns').innerHTML = S.policies.returns ? paras(S.policies.returns) : '<p>If anything arrives damaged, email me a photo within 7 days and I’ll make it right.</p>';
    $('#ab-coa').innerHTML = paras([S.policies.coa, S.policies.care].filter(Boolean).join('\n\n'));
    $('#ab-faq').innerHTML = (S.faq || []).map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(f.q)}</summary><div class="acc-body">${paras(f.a)}</div></details>`).join('');
    $('#ab-contact').innerHTML = S.contactEmail ? `Email me at <a class="link-u" style="font-weight:700" href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a> — I answer every message myself.` : 'Send me a message through the commission form — I answer every message myself.';
    Site.enhance(document.querySelector('main'));
    if ((S.faq || []).length) Site.jsonld({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: S.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
    Site.jsonld({ '@context': 'https://schema.org', '@type': 'Person', name: S.artistName, jobTitle: 'Artist', description: S.bio, image: Site.absUrl(S.portrait || '') });
    if (location.hash) setTimeout(() => { const t = document.querySelector(location.hash); if (t) { t.scrollIntoView({ block: 'start' }); if (t.tagName === 'DETAILS') t.open = true; } }, 300);
  }

  function commissions(S) {
    Site.setTitle('Commissions');
    const C = S.commissions;
    $('#cm-text').textContent = C.text || '';
    $('#cm-facts').innerHTML = [C.startingAt ? `<span class="pill light">From ${Site.money(C.startingAt)}</span>` : '', C.leadTime ? `<span class="pill light">Typical timeline · ${esc(C.leadTime)}</span>` : '', `<span class="pill ${C.open ? 'ok' : 'accent'}">${C.open ? '● Booking now' : 'Currently closed'}</span>`].join('');
    if (!C.open) {
      $('#cm-wrap').innerHTML = `<div class="co-sec"><h2 class="h3" style="font-style:italic">Commissions are closed for now</h2><p>I'm focused on finishing current pieces. Join the Collector's List and you'll be first to know when spots open.</p><form class="inline-form light" data-newsletter novalidate><label class="sr-only" for="cm-news">Email</label><input id="cm-news" type="email" autocomplete="email" placeholder="you@email.com" required><button class="btn btn-accent btn-sm">Notify me</button></form></div>`;
      Site.enhance($('#cm-wrap')); return;
    }
    const base = Math.max(50, Number(C.startingAt) || 150);
    const tiers = [[base, base * 2], [base * 2, base * 4], [base * 4, base * 8], [base * 8, 0]];
    $('#c-budget').innerHTML = tiers.map(([lo, hi]) => `<option>${Site.money(lo)}${hi ? '–' + Site.money(hi) : '+'}</option>`).join('') + '<option>Not sure yet</option>';
    const moods = ['Warm', 'Cool', 'Bright & bold', 'Soft & calm', 'Moody & dark', 'Earthy', 'Monochrome', 'Pastel'];
    $('#c-moods').innerHTML = moods.map(m => `<button type="button" class="chip" aria-pressed="false" data-mood="${esc(m)}">${esc(m)}</button>`).join('');
    $('#c-moods').onclick = e => { const b = e.target.closest('[data-mood]'); if (!b) return; const on = b.classList.toggle('is-active'); b.setAttribute('aria-pressed', on); };
    const ref = Site.art(Site.qs.get('ref'));
    if (ref) { $('#c-ref').value = ref.title; $('#c-desc').value = `I love “${ref.title}” — I'd like something in a similar spirit.`; }
    const f = $('#commission-form');
    const check = el => { const fl = el.closest('.field'); const ok = !el.required || (el.type === 'email' ? Site.validEmail(el.value) : el.value.trim().length > 1); fl.classList.toggle('invalid', !ok); return ok; };
    $$('input[required], textarea[required]', f).forEach(el => el.addEventListener('blur', () => el.value && check(el)));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const bad = $$('input[required], textarea[required]', f).filter(el => !check(el));
      if (bad.length) { bad[0].focus(); return; }
      const btn = f.querySelector('button[type=submit]'); btn.classList.add('is-loading');
      const d = Object.fromEntries(new FormData(f).entries());
      d.moods = $$('#c-moods .is-active').map(b => b.dataset.mood).join(', ');
      const r = await Site.sendForm(`🖌️ Commission request from ${d.name}`, { 'Type': d.type, 'Size': d.size, 'Budget': d.budget, 'Needed by': d.deadline, 'Colors & mood': d.moods, 'Idea': d.description, 'References': d.links, 'Inspired by': d.ref, name: d.name, email: d.email }, { replyTo: d.email });
      btn.classList.remove('is-loading');
      Site.track('generate_lead', { lead_type: 'commission' });
      const body = Object.entries({ Name: d.name, Email: d.email, Type: d.type, Size: d.size, Budget: d.budget, 'Needed by': d.deadline, Mood: d.moods, Idea: d.description, References: d.links, 'Inspired by': d.ref }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      $('#cm-wrap').innerHTML = `<div class="co-sec center" style="padding:48px 30px"><div class="thanks-burst" style="margin:0 auto 10px">${Site.icons.spark}</div><h2 class="h2" style="font-style:italic">Thank you, ${esc((d.name || '').split(' ')[0])}!</h2><p class="lead">${r.ok ? `Your idea is on its way to my studio. I'll reply to <b>${esc(d.email)}</b> within 2–3 days with thoughts, a sketch plan and a quote.` : `One last step — tap below to send your request by email so it reaches me.`}</p>${r.ok ? '' : `<a class="btn btn-accent btn-lg" href="${esc(Site.mailto('Commission request — ' + d.name, body))}">Email my request</a>`}<p style="margin-top:18px"><a class="text-link" href="gallery.html">Browse available work meanwhile →</a></p></div>`;
      Site.enhance($('#cm-wrap')); if (window.FX) FX.confetti();
      $('#cm-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function thanks() {
    const o = Site.LS.get('lastOrder');
    if (o) { if (o.method === 'stripe' && o.status !== 'PAID') { o.status = 'PAID'; o.paymentRef = 'Stripe'; Site.LS.set('lastOrder', o); } location.replace('checkout.html?order=' + encodeURIComponent(o.id)); }
    else { const h = $('#thx-msg'); if (h) h.hidden = false; }
  }
})();
