// Mock-up: gegevens staan in localStorage. In de echte versie komt hier een cloud-backend (bijv. Supabase).
const KEY = 'stempelkaart-demo-v2';
const OWNER_KEY = 'stempelkaart-eigenaresse'; // testversie: inloggen zonder wachtwoord
const MY_CARD_KEY = 'stempelkaart-mijn-kaart';
// Huisstijl-assets van de eigen website (voor de mock-up rechtstreeks gelinkt)
const LOGO = 'https://pureperfection.nl/wp-content/uploads/2021/05/Logo-pure-perfection.svg';
const BOOKING = 'https://pureperfection.nl/afspraak-maken';

const seed = () => {
  const day = 86400000, now = Date.now();
  // Vaste id's, zodat demo-links ook op een ander toestel dezelfde kaart openen
  const mk = (name, phone, stamps, rewards, daysAgo) => ({
    id: name.split(' ')[0].toLowerCase(),
    name, phone, stamps, rewardsOpen: rewards,
    history: Array.from({ length: stamps }, (_, i) => ({ type: 'stamp', at: now - (daysAgo + i * 14) * day })),
  });
  return {
    settings: { salon: 'Pure Perfection', needed: 10, reward: 'Gratis behandeling naar keuze' },
    customers: [
      mk('Sanne de Vries', '06 12345678', 7, 0, 2),
      mk('Fatima El Amrani', '06 23456789', 9, 0, 5),
      mk('Lisa Bakker', '06 34567890', 3, 1, 1),
      mk('Emma Jansen', '06 45678901', 1, 0, 12),
      mk('Noor Visser', '06 56789012', 5, 0, 20),
    ],
  };
};

let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
save();

// Klantweergave in een ander tabblad direct bijwerken
window.addEventListener('storage', e => {
  if (e.key === KEY && e.newValue) { db = JSON.parse(e.newValue); render(); }
});

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
const isOwner = () => store.get(OWNER_KEY) === '1';
const digits = p => String(p).replace(/\D/g, '');
// 06 12345678 → 31612345678 (formaat voor wa.me)
const intl = p => { const d = digits(p); return d.startsWith('0') ? '31' + d.slice(1) : d; };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => n.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmt = t => new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
const find = id => db.customers.find(c => c.id === id);
const go = h => { location.hash = h; };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

function stampGrid(c, popIndex = -1) {
  const n = db.settings.needed;
  return `<div class="stamps">${Array.from({ length: n }, (_, i) => {
    const last = i === n - 1;
    const on = i < c.stamps;
    return `<div class="stamp ${on ? 'on' : ''} ${last ? 'reward' : ''} ${i === popIndex ? 'pop' : ''}">${last ? '🎁' : on ? '✦' : i + 1}</div>`;
  }).join('')}</div>`;
}

function progressText(c) {
  const left = db.settings.needed - c.stamps;
  return left === 1 ? 'Nog 1 stempel tot je beloning!' : `Nog ${left} stempels tot je beloning`;
}

// ---------- Startscherm: inloggen ----------
function viewLogin() {
  const mine = find(store.get(MY_CARD_KEY));
  $('#app').innerHTML = `
    <div class="login-head">
      <img src="${LOGO}" alt="">
      <div class="wordmark">${esc(db.settings.salon)}</div>
      <div class="eyebrow">Stempelkaart</div>
    </div>
    <div class="card">
      <div class="eyebrow">Voor klanten</div>
      <h2 style="margin:4px 0 12px">Bekijk je stempelkaart</h2>
      ${mine ? `<a class="btn" style="text-align:center;margin-bottom:12px" href="#/kaart/${mine.id}">Verder als ${esc(mine.name.split(' ')[0])}</a>` : ''}
      <form id="f">
        <label class="field"><span>Je telefoonnummer</span><input name="phone" type="tel" inputmode="tel" placeholder="06 …" required autocomplete="tel"></label>
        <button class="btn ${mine ? 'secondary' : ''}">Toon mijn kaart</button>
      </form>
      <p class="hint">Demo: probeer <b>06 12345678</b>. In de echte versie krijg je eerst een sms-code.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Voor de salon</div>
      <button class="btn secondary" id="owner" style="margin-top:10px">Inloggen als eigenaresse</button>
      <p class="hint">Testversie: zonder wachtwoord.</p>
    </div>`;

  $('#f').onsubmit = e => {
    e.preventDefault();
    const q = digits(new FormData(e.target).get('phone'));
    const c = q.length >= 8 && db.customers.find(c => digits(c.phone) === q);
    if (!c) return toast('Geen kaart gevonden. Vraag het even in de salon.');
    go(`#/kaart/${c.id}`);
  };
  $('#owner').onclick = () => { store.set(OWNER_KEY, '1'); go('#/beheer'); };
}

// ---------- Eigenaresse: overzicht ----------
function viewHome(query = '') {
  const q = query.toLowerCase();
  const list = db.customers
    .filter(c => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    .sort((a, b) => a.name.localeCompare(b.name));
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = db.customers.reduce((s, c) => s + c.history.filter(h => h.type === 'stamp' && h.at >= monthStart).length, 0);
  const open = db.customers.reduce((s, c) => s + c.rewardsOpen, 0);

  $('#app').innerHTML = `
    <div class="topbar">
      <div class="brand">
        <img src="${LOGO}" alt="">
        <div><div class="wordmark">${esc(db.settings.salon)}</div><div class="eyebrow">Stempelkaart</div></div>
      </div>
      <a class="icon-btn" href="#/instellingen" aria-label="Instellingen">⚙︎</a>
    </div>
    <div class="stats">
      <div class="stat"><b>${db.customers.length}</b><span>klanten</span></div>
      <div class="stat"><b>${thisMonth}</b><span>stempels deze maand</span></div>
      <div class="stat"><b>${open}</b><span>beloningen open</span></div>
    </div>
    <input class="search" id="q" placeholder="Zoek op naam of telefoon…" value="${esc(query)}" autocomplete="off">
    <div class="list">
      ${list.map(c => `
        <a class="row" href="#/klant/${c.id}">
          <div class="avatar">${initials(c.name)}</div>
          <div class="info">
            <div class="name">${esc(c.name)}</div>
            <div class="sub">${c.stamps} / ${db.settings.needed} stempels</div>
            <div class="bar"><i style="width:${c.stamps / db.settings.needed * 100}%"></i></div>
          </div>
          ${c.rewardsOpen ? `<span class="badge">🎁 ${c.rewardsOpen}</span>` : ''}
        </a>`).join('') || `<div class="empty">Geen klanten gevonden</div>`}
    </div>
    <a class="fab" href="#/nieuw">+ Klant</a>`;

  const input = $('#q');
  input.addEventListener('input', () => {
    viewHome(input.value);
    const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
}

// ---------- Eigenaresse: klantdetail ----------
function viewCustomer(id, popIndex = -1) {
  const c = find(id);
  if (!c) return go('#/beheer');
  $('#app').innerHTML = `
    <div class="topbar">
      <a class="icon-btn" href="#/beheer" aria-label="Terug">←</a>
      <a class="icon-btn" href="#/delen/${c.id}" aria-label="Kaart delen">⤴︎</a>
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
      <div class="avatar" style="width:54px;height:54px;font-size:18px">${initials(c.name)}</div>
      <div><h2>${esc(c.name)}</h2><div class="sub" style="color:var(--muted)">${esc(c.phone)}</div></div>
    </div>
    ${c.rewardsOpen ? `
      <div class="reward-banner">
        <div style="font-size:28px">🎁</div>
        <div class="txt"><b>${c.rewardsOpen} beloning${c.rewardsOpen > 1 ? 'en' : ''} te besteden</b><span style="font-size:13px">${esc(db.settings.reward)}</span></div>
        <button class="btn gold" id="redeem">Inwisselen</button>
      </div>` : ''}
    <div class="card">
      <div class="eyebrow">Huidige kaart</div>
      ${stampGrid(c, popIndex)}
      <div class="progress-text">${progressText(c)}</div>
    </div>
    <button class="btn" id="add">+ Stempel geven</button>
    <div class="btn-row">
      <button class="btn secondary small" id="undo" ${c.stamps ? '' : 'disabled style="opacity:.4"'}>− Stempel eraf</button>
      <a class="btn secondary small" style="text-align:center" href="#/delen/${c.id}">Link opnieuw sturen</a>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="eyebrow">Geschiedenis</div>
      <ul class="history">
        ${[...c.history].sort((a, b) => b.at - a.at).slice(0, 12).map(h => `
          <li><span>${{ stamp: '✦ Stempel', reward: '🎁 Kaart vol, beloning verdiend', redeem: '✓ Beloning ingewisseld' }[h.type]}</span><span class="when">${fmt(h.at)}</span></li>
        `).join('') || '<li><span class="when">Nog geen bezoeken</span></li>'}
      </ul>
    </div>`;

  $('#add').onclick = () => {
    c.history.push({ type: 'stamp', at: Date.now() });
    c.stamps++;
    let pop = c.stamps - 1;
    if (c.stamps >= db.settings.needed) {
      c.stamps = 0; c.rewardsOpen++;
      c.history.push({ type: 'reward', at: Date.now() + 1 });
      pop = -1;
      toast('🎉 Kaart vol! Beloning verdiend');
    } else toast('Stempel toegevoegd');
    save(); viewCustomer(id, pop);
  };
  $('#undo').onclick = () => {
    if (!c.stamps) return;
    c.stamps--;
    const i = c.history.map(h => h.type).lastIndexOf('stamp');
    if (i > -1) c.history.splice(i, 1);
    save(); viewCustomer(id); toast('Stempel verwijderd');
  };
  const r = $('#redeem');
  if (r) r.onclick = () => {
    c.rewardsOpen--;
    c.history.push({ type: 'redeem', at: Date.now() });
    save(); viewCustomer(id); toast('Beloning ingewisseld ✓');
  };
}

// ---------- Eigenaresse: kaart delen ----------
function viewShare(id) {
  const c = find(id);
  if (!c) return go('#/beheer');
  const url = `${location.origin}${location.pathname}#/kaart/${c.id}`;
  const msg = encodeURIComponent(`Hoi ${c.name.split(' ')[0]}! Hier is je stempelkaart van ${db.settings.salon}: ${url}`);
  const phone = digits(c.phone);
  $('#app').innerHTML = `
    <div class="topbar"><a class="icon-btn" href="#/klant/${c.id}" aria-label="Terug">←</a><span></span></div>
    <div class="card share">
      <h2>Kaart van ${esc(c.name.split(' ')[0])}</h2>
      <p style="color:var(--muted);margin:6px 0 0">Laat de klant deze QR-code scannen, of stuur de link (opnieuw) naar ${phone ? esc(c.phone) : 'de klant'}.</p>
      <div id="qr"></div>
      <code>${esc(url)}</code>
      <a class="btn" href="https://wa.me/${phone ? intl(c.phone) : ''}?text=${msg}" target="_blank" rel="noopener">Versturen via WhatsApp</a>
      ${phone ? `<a class="btn secondary" style="margin-top:10px" href="sms:${esc(c.phone.replace(/\s/g, ''))}?&body=${msg}">Versturen via sms</a>` : ''}
      <div class="btn-row">
        <button class="btn secondary small" id="copy">Link kopiëren</button>
        <a class="btn secondary small" style="text-align:center" href="#/kaart/${c.id}" target="_blank">Bekijk als klant</a>
      </div>
    </div>`;
  if (window.QRCode) new QRCode($('#qr'), { text: url, width: 180, height: 180, colorDark: '#2f2422' });
  else $('#qr').textContent = 'QR-code niet beschikbaar (offline)';
  $('#copy').onclick = () => navigator.clipboard?.writeText(url).then(() => toast('Link gekopieerd'), () => toast('Kopiëren mislukt'));
}

// ---------- Eigenaresse: nieuwe klant ----------
function viewNew() {
  $('#app').innerHTML = `
    <div class="topbar"><a class="icon-btn" href="#/beheer" aria-label="Terug">←</a><span></span></div>
    <h2 style="margin-bottom:14px">Nieuwe klant</h2>
    <form class="card" id="f">
      <label class="field"><span>Naam</span><input name="name" required autofocus></label>
      <label class="field"><span>Telefoonnummer</span><input name="phone" type="tel" placeholder="06 …"></label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 14px;font-size:14px">
        <input type="checkbox" name="first" checked> Direct eerste stempel geven
      </label>
      <button class="btn">Opslaan</button>
    </form>`;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const first = f.get('first') === 'on';
    const c = {
      id: Math.random().toString(36).slice(2, 10),
      name: f.get('name').trim(), phone: (f.get('phone') || '').trim(),
      stamps: first ? 1 : 0, rewardsOpen: 0,
      history: first ? [{ type: 'stamp', at: Date.now() }] : [],
    };
    db.customers.push(c); save();
    toast('Klant toegevoegd'); go(`#/klant/${c.id}`);
  };
}

// ---------- Eigenaresse: instellingen ----------
function viewSettings() {
  const s = db.settings;
  $('#app').innerHTML = `
    <div class="topbar"><a class="icon-btn" href="#/beheer" aria-label="Terug">←</a><span></span></div>
    <h2 style="margin-bottom:14px">Instellingen</h2>
    <form class="card" id="f">
      <label class="field"><span>Naam salon</span><input name="salon" value="${esc(s.salon)}" required></label>
      <label class="field"><span>Aantal stempels voor een beloning</span><input name="needed" type="number" min="3" max="20" value="${s.needed}" required></label>
      <label class="field"><span>Beloning</span><input name="reward" value="${esc(s.reward)}" required></label>
      <button class="btn">Opslaan</button>
    </form>
    <button class="btn secondary" id="reset">Demo-gegevens herstellen</button>
    <button class="btn secondary" id="logout" style="margin-top:10px">Uitloggen</button>`;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    s.salon = f.get('salon').trim();
    s.needed = Math.max(3, Math.min(20, +f.get('needed')));
    s.reward = f.get('reward').trim();
    db.customers.forEach(c => { c.stamps = Math.min(c.stamps, s.needed - 1); });
    save(); toast('Opgeslagen'); go('#/beheer');
  };
  $('#reset').onclick = () => { db = seed(); save(); toast('Demo hersteld'); go('#/beheer'); };
  $('#logout').onclick = () => { store.set(OWNER_KEY, null); go('#/'); };
}

// ---------- Klant: eigen stempelkaart ----------
function viewClientCard(id) {
  const c = find(id);
  if (!c) {
    $('#app').innerHTML = `<div class="empty">Deze kaart bestaat niet (meer).<br><a href="#/" style="color:var(--gold)">Naar inloggen</a></div>`;
    return;
  }
  store.set(MY_CARD_KEY, c.id);
  $('#app').innerHTML = `
    <div style="text-align:center"><span class="demo-tag">Klantweergave</span></div>
    <div class="loyalty">
      <img class="mandala" src="${LOGO}" alt="">
      <div class="wordmark">${esc(db.settings.salon)}</div>
      <div class="tagline">Aandacht voor jezelf</div>
      <h1>Hoi ${esc(c.name.split(' ')[0])} ✨</h1>
      ${stampGrid(c)}
      <div class="progress-text">${progressText(c)}</div>
      <div class="reward-line">🎁 Bij ${db.settings.needed} stempels: <b>${esc(db.settings.reward)}</b></div>
      ${c.rewardsOpen ? `<div class="reward-line" style="color:var(--gold)"><b>Je hebt ${c.rewardsOpen} beloning${c.rewardsOpen > 1 ? 'en' : ''} klaarstaan!</b> Meld het bij je volgende afspraak.</div>` : ''}
    </div>
    <a class="btn cta" style="margin-top:16px;text-align:center" href="${BOOKING}" target="_blank" rel="noopener">Afspraak maken</a>
    <p class="client-note">Zet deze pagina op je beginscherm om je kaart altijd bij de hand te hebben.</p>
    <p class="client-note"><a href="#/" id="notme" style="text-decoration:underline">Niet jouw kaart? Uitloggen</a></p>`;
  $('#notme').onclick = () => store.set(MY_CARD_KEY, null);
}

// ---------- Router ----------
function render() {
  const [, page, id] = (location.hash || '#/').split('/');
  window.scrollTo(0, 0);
  if (page === 'kaart') return viewClientCard(id);
  const ownerPages = { beheer: viewHome, klant: viewCustomer, delen: viewShare, nieuw: viewNew, instellingen: viewSettings };
  if (ownerPages[page] && isOwner()) return ownerPages[page](id);
  if (page) return go('#/');
  viewLogin();
}
window.addEventListener('hashchange', render);
render();
