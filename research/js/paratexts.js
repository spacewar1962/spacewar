/*
 * paratexts.js - the project's paratexts: scans, clippings, photographs, documents.
 *
 * They are kept in a private repository of their own (spacewar1962/sw_paratexts),
 * shared with the crew: a catalogue (catalogue.json, one record per item) and the
 * files (files/, each named by its code, P-XXXXX). The bench reads and writes it
 * through GitHub's API with each member's own token, limited to that repository
 * (⚙ Settings), as annotations use each member's Hypothesis token.
 */
(function (root) {
  'use strict';
  var SW = root.SW, P = SW.paratexts = {};
  var REPO = 'spacewar1962/sw_paratexts', API = 'https://api.github.com/repos/' + REPO;
  var cat = null, catSha = null, urls = {}, view = null, done = false;
  var F = SW.store.get('px.filt', {}) || {};
  function token() { return String(SW.store.get('gh.token', '') || '').trim(); }
  P.configured = function () { return !!token(); };

  // ---------- GitHub ----------
  function gh(method, path, body, accept) {
    var h = { Authorization: 'Bearer ' + token(), Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }).then(function (r) {
      if (r.ok) return accept === 'application/vnd.github.raw' ? r.blob() : r.status === 204 ? null : r.json();
      var why = r.status === 401 ? 'The GitHub token was refused: check it in ⚙ Settings.' :
        r.status === 403 ? 'GitHub refused: the token may lack write access to ' + REPO + ', or the rate limit is reached.' :
        r.status === 404 ? 'Not found: the token may not reach ' + REPO + ' (ask to be added to the crew).' :
        r.status === 409 || r.status === 422 ? 'conflict' : 'GitHub: ' + r.status;
      var e = new Error(why); e.status = r.status; throw e;
    });
  }
  function b64utf8(s) { var b = new TextEncoder().encode(s), t = ''; for (var i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t); }
  function utf8b64(s) { var bin = atob(String(s).replace(/\s/g, '')), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
  function fileB64(file) {
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, '')); }; r.onerror = no; r.readAsDataURL(file); });
  }
  P.load = function (force) {
    if (cat && !force) return Promise.resolve(cat);
    return gh('GET', '/contents/catalogue.json').then(function (r) { catSha = r.sha; cat = JSON.parse(utf8b64(r.content)); cat.items = cat.items || []; return cat; });
  };
  // A change to the catalogue: made on the newest copy, and made again if someone saved in between
  function save(message, change, tries) {
    tries = tries || 0;
    return P.load(true).then(function () {
      change(cat);
      return gh('PUT', '/contents/catalogue.json', { message: message, content: b64utf8(JSON.stringify(cat, null, 1) + '\n'), sha: catSha });
    }).then(function (r) { catSha = r.content.sha; return cat; }, function (e) {
      if (e.message === 'conflict' && tries < 3) return save(message, change, tries + 1);
      throw e;
    });
  }
  function blobOf(it) {
    if (urls[it.code]) return Promise.resolve(urls[it.code]);
    return gh('GET', '/contents/' + it.file.split('/').map(encodeURIComponent).join('/'), null, 'application/vnd.github.raw').then(function (b) {
      if (it.mime && b.type !== it.mime) b = b.slice(0, b.size, it.mime);
      return (urls[it.code] = URL.createObjectURL(b));
    });
  }
  function newCode() {
    var have = {}; (cat ? cat.items : []).forEach(function (it) { have[it.code] = 1; });
    var A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', c;
    do { c = 'P-'; for (var i = 0; i < 5; i++) c += A[Math.floor(Math.random() * 36)]; } while (have[c]);
    return c;
  }
  function me() { return SW.me().initials || '?'; }
  function now() { return new Date().toISOString().replace(/\.\d+Z$/, 'Z'); }

  // ---------- the view ----------
  var V = root.SWVersions;
  function vShort(id) { var v = V.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : id; }
  function shown() {
    return (cat ? cat.items : []).filter(function (it) {
      if (it.withdrawn) return false;
      if (F.tag && (it.tags || []).indexOf(F.tag) < 0) return false;
      if (F.v && (it.versions || []).indexOf(F.v) < 0) return false;
      if (F.kind && it.kind !== F.kind) return false;
      if (F.q) { var t = [it.code, it.title, it.date, it.creator, it.source, it.description, (it.tags || []).join(' '), it.name].join(' ').toLowerCase(); if (t.indexOf(F.q.toLowerCase()) < 0) return false; }
      return true;
    }).sort(function (a, b) { return String(a.date || '9999') < String(b.date || '9999') ? -1 : String(a.date || '9999') > String(b.date || '9999') ? 1 : a.title < b.title ? -1 : 1; });
  }
  var ICON = { pdf: '📄', image: '🖼', text: '📝', file: '📎' };
  function render() {
    view = SW.$('#view-paratexts'); if (!view) return;
    done = true;
    var esc = SW.esc;
    view.innerHTML = '<div class="pad px"><h2>Paratexts</h2><p class="lede">The scans, clippings, photographs and documents around the program, kept for the crew in a private repository (' + esc(REPO) + '). Click one to read it; add with ＋.</p><div class="px-body"></div></div>';
    var body = SW.$('.px-body', view);
    if (!P.configured()) {
      body.innerHTML = '<div class="px-howto"><p>To see the paratexts, add a GitHub token in ⚙ Settings (Paratexts). The repository is private to the crew: ask to be added if you are not.</p><ol>' +
        '<li>On GitHub, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">a new fine-grained token</a>.</li>' +
        '<li>Resource owner: <b>spacewar1962</b>. Repository access: <b>Only select repositories</b>, then <b>sw_paratexts</b>.</li>' +
        '<li>Permissions, Repository: <b>Contents</b>, Read and write (Read-only, to look without adding).</li>' +
        '<li>Generate it, copy it, and paste it into ⚙ Settings, Paratexts. It is kept in this browser only.</li></ol>' +
        '<p><button class="btn" data-px="settings">Open ⚙ Settings</button></p></div>';
      body.onclick = function (e) { if (e.target.closest('[data-px="settings"]')) SW.$('#btn-settings') ? SW.$('#btn-settings').click() : null; };
      return;
    }
    body.innerHTML = '<p class="hint">Opening the catalogue…</p>';
    P.load().then(function () { paint(body); }, function (e) { body.innerHTML = '<p class="badge err">' + esc(e.message) + '</p>'; });
  }
  function paint(body) {
    var esc = SW.esc, items = cat.items.filter(function (it) { return !it.withdrawn; });
    var tags = [], vids = [], kinds = [];
    items.forEach(function (it) { (it.tags || []).forEach(function (g) { if (tags.indexOf(g) < 0) tags.push(g); }); (it.versions || []).forEach(function (v) { if (vids.indexOf(v) < 0) vids.push(v); }); if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); });
    tags.sort(); vids.sort(function (a, b) { return ((V.byId(a) || {}).sort || 0) - ((V.byId(b) || {}).sort || 0); });
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>'; }
    var list = shown();
    body.innerHTML = '<div class="toolbar px-bar" style="position:static;padding-left:0">' +
      '<input type="search" data-f="q" placeholder="Find (code, title, words)" value="' + esc(F.q || '') + '">' +
      '<label class="check">Tag <select data-f="tag">' + opt('', 'All', F.tag || '') + tags.map(function (g) { return opt(g, g, F.tag); }).join('') + '</select></label>' +
      '<label class="check">Version <select data-f="v">' + opt('', 'All', F.v || '') + vids.map(function (v) { return opt(v, vShort(v), F.v); }).join('') + '</select></label>' +
      '<label class="check">Kind <select data-f="kind">' + opt('', 'All', F.kind || '') + kinds.map(function (k) { return opt(k, k, F.kind); }).join('') + '</select></label>' +
      '<span class="hint">' + list.length + ' of ' + items.length + '</span>' +
      '<button class="btn" data-px="add" title="Upload a file with its details, to the crew’s repository">＋ Add a paratext</button>' +
      '<button class="btn ghost" data-px="reload" title="Read the catalogue again (others may have added)">↻</button></div>' +
      (list.length ? '<ul class="px-grid">' + list.map(function (it) {
        return '<li class="px-card" data-code="' + esc(it.code) + '" tabindex="0" title="Open: ' + esc(it.title) + '"><div class="px-thumb" data-kind="' + esc(it.kind) + '">' + (ICON[it.kind] || ICON.file) + '</div>' +
          '<div class="px-meta"><span class="px-code mono">' + esc(it.code) + '</span> <b>' + esc(it.title) + '</b>' + (it.date ? ' <span class="faint">' + esc(it.date) + '</span>' : '') +
          '<div class="px-tags">' + summary(it) + (it.tags || []).map(function (g) { return '<span class="fd-tag">' + esc(g) + '</span>'; }).join(' ') + (it.versions || []).map(function (v) { return ' <span class="fd-tag px-v">' + esc(vShort(v)) + '</span>'; }).join('') + '</div></div></li>';
      }).join('') + '</ul>' : '<p class="hint">None with these filters.</p>');
    function set(e) { var f = e.target.dataset.f; if (!f) return; F[f] = e.target.value; SW.store.set('px.filt', F); paint(body); var q = SW.$('[data-f="q"]', body); if (f === 'q' && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    var bar = SW.$('.px-bar', body);
    bar.addEventListener('change', set);
    var qt = null; bar.addEventListener('input', function (e) { if (e.target.dataset.f === 'q') { clearTimeout(qt); qt = setTimeout(function () { set(e); }, 300); } });
    body.onclick = function (e) {
      var b = e.target.closest('[data-px]');
      if (b && b.dataset.px === 'add') { addBox(); return; }
      if (b && b.dataset.px === 'reload') { body.innerHTML = '<p class="hint">Reading the catalogue again…</p>'; P.load(true).then(function () { paint(body); }); return; }
      var c = e.target.closest('.px-card'); if (c) openItem(c.dataset.code);
    };
    body.onkeydown = function (e) { var c = e.target.closest && e.target.closest('.px-card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(c.dataset.code); } };
    // the pictures, as they come into view (small ones only: a large scan stays an icon here)
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var it = byCode(en.target.closest('.px-card').dataset.code);
        if (it && it.kind === 'image' && (it.size || 0) < 6e6) blobOf(it).then(function (u) { en.target.innerHTML = '<img alt="" src="' + u + '">'; }, function () {});
      });
    }, { rootMargin: '200px' });
    SW.$$('.px-thumb', body).forEach(function (t) { io.observe(t); });
  }
  function byCode(c) { return (cat ? cat.items : []).filter(function (it) { return it.code === c; })[0] || null; }

  // ---------- one paratext ----------
  var FIELDS = [['title', 'Title'], ['date', 'Date'], ['creator', 'Creator'], ['source', 'Source'], ['rights', 'Rights'], ['description', 'Description', 'area'], ['tags', 'Tags', 'list'], ['versions', 'Versions', 'list'], ['refs', 'References', 'list']];
  function fieldsHTML(it) {
    return '<div class="px-fields">' + FIELDS.map(function (f) {
      var v = it[f[0]], val = f[2] === 'list' ? (v || []).join(', ') : (v || '');
      var ph = f[0] === 'versions' ? 'e.g. 4.3, 4.4' : f[0] === 'refs' ? 'e.g. [REF: SW4.3L, 2.10–20]' : f[0] === 'tags' ? 'comma separated' : f[0] === 'date' ? 'e.g. 1963-05-17, or 1963' : '';
      return '<label><span>' + f[1] + '</span>' + (f[2] === 'area' ? '<textarea data-k="' + f[0] + '" rows="3">' + SW.esc(val) + '</textarea>' : '<input data-k="' + f[0] + '" value="' + SW.esc(val) + '" placeholder="' + SW.esc(ph) + '">') + '</label>';
    }).join('') + '</div>';
  }
  function readFields(box) {
    var o = {};
    SW.$$('[data-k]', box).forEach(function (el) {
      var k = el.dataset.k, f = FIELDS.filter(function (x) { return x[0] === k; })[0];
      o[k] = f && f[2] === 'list' ? el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : el.value.trim();
    });
    return o;
  }
  function openItem(code) {
    var it = byCode(code); if (!it) { SW.toast(code + ' is not in the catalogue.', 4000); return; }
    var esc = SW.esc, d = SW.el('dialog', { class: 'tray-big px-dlg' });
    var gh0 = 'https://github.com/' + REPO + '/blob/main/' + it.file.split('/').map(encodeURIComponent).join('/');
    d.innerHTML = '<div class="tray-bighead"><span class="px-code mono" data-copy="' + esc(it.code) + '" title="Its code: click to copy">' + esc(it.code) + '</span> <b>' + esc(it.title) + '</b>' +
      '<span class="refhelp-acts"><button class="btn ghost" data-a="keep" title="This paratext, with its details, in My notes (private)">＋ My notes</button><a class="btn ghost" data-a="dl" download="' + esc(it.name || it.code) + '">⤓ Download</a><a class="btn ghost" href="' + esc(gh0) + '" target="_blank" rel="noopener" title="On GitHub, with its history">GitHub ↗</a><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<div class="px-cols"><div class="px-view"><p class="hint">Opening…</p></div><div class="px-side">' + fieldsHTML(it) +
      '<p class="hint">Added ' + esc(SW.fmtDate(it.added)) + ' by ' + esc(it.addedBy || '?') + (it.updated && it.updated !== it.added ? '; changed ' + esc(SW.fmtDate(it.updated)) + ' by ' + esc(it.updatedBy || '?') : '') + (it.origin ? '. ' + esc(it.origin) : '') + '.</p>' +
      '<div class="px-acts"><button class="btn" data-a="save">Save the details</button> <span class="hint px-msg"></span><button class="btn ghost px-wd" data-a="withdraw" title="Take it out of the list (the file stays in the repository and its history)">Withdraw</button></div>' +
      '<div class="px-talk">' + talkHTML(it) + '</div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    var pv = SW.$('.px-view', d);
    blobOf(it).then(function (u) {
      SW.$('[data-a="dl"]', d).href = u;
      if (it.kind === 'image') pv.innerHTML = '<img class="px-img" alt="' + esc(it.title) + '" src="' + u + '">';
      else if (it.kind === 'pdf') pv.innerHTML = '<iframe class="px-pdf" title="' + esc(it.title) + '" src="' + u + '"></iframe>';
      else if (/^text\//.test(it.mime || '')) fetch(u).then(function (r) { return r.text(); }).then(function (t) { pv.innerHTML = '<pre class="px-text">' + esc(t) + '</pre>'; });
      else pv.innerHTML = '<p class="hint">No preview for this kind of file: ⤓ Download to open it.</p>';
    }, function (e) { pv.innerHTML = '<p class="badge err">' + esc(e.message) + '</p>'; });
    function talk(label, change) {   // a rating, emoji or comment: saved, then the talk redrawn
      var who = me();
      if (who === '?') { SW.toast('Please set your initials first (⚙).', 4000); return Promise.resolve(); }
      return save('Paratext ' + it.code + ': ' + label + ', by ' + who, function (c) { c.items.forEach(function (x) { if (x.code === it.code) change(x, who); }); })
        .then(function () { it = byCode(code); var t = SW.$('.px-talk', d); t.innerHTML = talkHTML(it); SW.mdTools(SW.$('.px-cbox textarea', t)); refresh(); }, function (err) { SW.toast(err.message, 5000); });
    }
    SW.mdTools(SW.$('.px-cbox textarea', d));
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
      var rb = e.target.closest('[data-rate]');
      if (rb) { var k = +rb.dataset.rate; rb.disabled = true; talk('rated', function (x, who) { x.rates = x.rates || {}; if (x.rates[who] === k) delete x.rates[who]; else x.rates[who] = k; }); return; }
      var eb = e.target.closest('[data-emoji]');
      if (eb) { var em = eb.dataset.emoji; eb.disabled = true; talk(em, function (x, who) { x.rx = x.rx || {}; var l = x.rx[em] = x.rx[em] || [], i = l.indexOf(who); if (i >= 0) l.splice(i, 1); else l.push(who); if (!l.length) delete x.rx[em]; }); return; }
      var a = e.target.closest('[data-a]'); if (!a) return;
      var msg = SW.$('.px-msg', d);
      if (a.dataset.a === 'comment') {
        var ta = SW.$('.px-cbox textarea', d), text = ta.value.trim(); if (!text) return;
        a.disabled = true;
        talk('comment', function (x, who) { x.comments = x.comments || []; x.comments.push({ id: Math.random().toString(36).slice(2, 9), by: who, date: now(), text: text }); });
        return;
      }
      if (a.dataset.a === 'save') {
        var o = readFields(d); a.disabled = true; msg.textContent = 'Saving…';
        save('Paratext ' + it.code + ': details, by ' + me(), function (c) { c.items.forEach(function (x) { if (x.code === it.code) { Object.assign(x, o); x.updated = now(); x.updatedBy = me(); } }); })
          .then(function () { a.disabled = false; msg.textContent = 'Saved'; it = byCode(code); SW.$('.tray-bighead b', d).textContent = it.title; refresh(); }, function (err) { a.disabled = false; msg.textContent = err.message; });
      } else if (a.dataset.a === 'withdraw') {
        if (!confirm('Withdraw ' + it.code + ' from the list? Its file stays in the repository, with its history, and it can be brought back there.')) return;
        save('Paratext ' + it.code + ': withdrawn, by ' + me(), function (c) { c.items.forEach(function (x) { if (x.code === it.code) { x.withdrawn = now(); x.updatedBy = me(); } }); })
          .then(function () { d.close(); refresh(); SW.toast(it.code + ' withdrawn'); }, function (err) { msg.textContent = err.message; });
      } else if (a.dataset.a === 'keep') {
        if (!SW.tray) return;
        var rows = FIELDS.map(function (f) { var v = it[f[0]]; return [f[1], Array.isArray(v) ? v.join(', ') : v || '']; }).filter(function (r) { return r[1]; });
        SW.tray.addDoc({ title: 'Paratext ' + it.code + ': ' + it.title, subtitle: REPO + ', ' + it.file, blocks: [SW.tableBlock('The paratext', ['', ''], rows)] }, { tags: ['paratext'], vid: (it.versions || [])[0] || SW.state.v });
      }
    });
  }
  // Ratings, emojis and comments, in the item's record: rates {initials: 1-3}, rx {emoji: [initials]},
  // comments [{id, by, date, text}]
  function avg(it) { var r = it.rates || {}, k = Object.keys(r); return k.length ? { avg: k.reduce(function (t, x) { return t + r[x]; }, 0) / k.length, n: k.length, who: k.map(function (x) { return x + ' ' + '★'.repeat(r[x]); }) } : null; }
  function summary(it) {
    var a = avg(it), rx = it.rx || {}, em = Object.keys(rx).filter(function (e) { return (rx[e] || []).length; }), nc = (it.comments || []).length;
    return (a ? '<span class="px-s" title="' + SW.esc(a.who.join('; ')) + '">★ ' + (Math.round(a.avg * 10) / 10) + '</span>' : '') +
      (em.length ? '<span class="px-s">' + em.map(function (e) { return e + (rx[e].length > 1 ? '<sup>' + rx[e].length + '</sup>' : ''); }).join('') + '</span>' : '') +
      (nc ? '<span class="px-s">💬 ' + nc + '</span>' : '');
  }
  function talkHTML(it) {
    var esc = SW.esc, mine = me(), r = it.rates || {}, a = avg(it), rx = it.rx || {};
    var EM = (SW.notes && SW.notes.EMOJI) || ['👍', '👎', '✅', '❓', '💡', '❗', '👀'];
    return '<div class="fd-rxbar px-rx"><span class="fd-rate" title="Your rating, one to three stars (again to take it back); the crew’s average beside it">' +
      [1, 2, 3].map(function (k) { return '<button data-rate="' + k + '" class="' + ((r[mine] || 0) >= k ? 'on' : '') + '">★</button>'; }).join('') +
      (a ? ' <span class="hint" title="' + esc(a.who.join('; ')) + '">' + (Math.round(a.avg * 10) / 10) + ' from ' + a.n + '</span>' : '') + '</span>' +
      EM.map(function (e) { var by = rx[e] || []; return '<button class="fd-emo' + (by.indexOf(mine) >= 0 ? ' on' : '') + '" data-emoji="' + e + '" title="' + esc(by.join(', ') || 'React') + '">' + e + (by.length ? '<sup>' + by.length + '</sup>' : '') + '</button>'; }).join('') + '</div>' +
      '<h4 class="fd-rh">Comments' + ((it.comments || []).length ? ' <span class="faint">' + it.comments.length + '</span>' : '') + '</h4>' +
      ((it.comments || []).length ? it.comments.map(function (c) { return '<div class="fd-reply"><div class="fd-rhead"><b>' + esc(c.by) + '</b> <span class="faint">' + esc(SW.fmtDate(c.date)) + '</span></div><div class="note-md">' + SW.md(c.text) + '</div></div>'; }).join('') : '<p class="hint">None yet.</p>') +
      '<div class="fd-replybox px-cbox"><textarea rows="2" placeholder="A comment, signed ' + esc(mine) + '"></textarea><button class="btn" data-a="comment">Comment</button></div>';
  }
  function refresh() { var body = view && SW.$('.px-body', view); if (body && cat) paint(body); }

  // ---------- adding ----------
  function addBox() {
    var esc = SW.esc, d = SW.el('dialog', { class: 'tray-big px-dlg px-add' });
    var blank = { title: '', date: '', creator: '', source: '', rights: '', description: '', tags: [], versions: SW.state.v ? [SW.state.v] : [], refs: [] };
    d.innerHTML = '<div class="tray-bighead"><b>Add a paratext</b><span class="refhelp-acts"><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<label class="px-drop"><input type="file" class="px-file"><span>Choose a file, or drop one here: a scan, photograph, PDF or text (up to 50 MB).</span></label>' +
      fieldsHTML(blank) + '<div class="px-acts"><button class="btn" data-a="up">Upload</button> <span class="hint px-msg"></span></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    var inp = SW.$('.px-file', d), drop = SW.$('.px-drop', d), file = null;
    function pick(f) {
      file = f; if (!f) return;
      SW.$('.px-drop span', d).textContent = f.name + ' (' + Math.round(f.size / 1024).toLocaleString('en-GB') + ' KB)';
      var t = SW.$('[data-k="title"]', d); if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    }
    inp.addEventListener('change', function () { pick(inp.files[0]); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('on'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('on'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('on'); pick(e.dataTransfer.files[0]); });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
      var a = e.target.closest('[data-a="up"]'); if (!a) return;
      var msg = SW.$('.px-msg', d), o = readFields(d);
      if (!file) { msg.textContent = 'Choose a file first.'; return; }
      if (file.size > 50e6) { msg.textContent = 'Too large for the repository (50 MB at most).'; return; }
      if (!o.title) { msg.textContent = 'Give it a title.'; return; }
      a.disabled = true; msg.textContent = 'Uploading…';
      P.load(true).then(function () {
        var code = newCode(), ext = (file.name.match(/\.[A-Za-z0-9]+$/) || [''])[0].toLowerCase(), path = 'files/' + code + ext;
        var mime = file.type || '', kind = mime === 'application/pdf' ? 'pdf' : /^image\//.test(mime) ? 'image' : /^text\//.test(mime) ? 'text' : 'file';
        return fileB64(file).then(function (b64) {
          return gh('PUT', '/contents/' + path, { message: 'Paratext ' + code + ': ' + o.title + ', added by ' + me(), content: b64 });
        }).then(function () {
          msg.textContent = 'Recording it in the catalogue…';
          return save('Paratext ' + code + ': catalogued, by ' + me(), function (c) {
            c.items.push(Object.assign({ code: code, file: path, name: file.name, kind: kind, mime: mime, size: file.size }, o, { origin: '', added: now(), addedBy: me(), updated: now(), updatedBy: me() }));
          }).then(function () { return code; });
        });
      }).then(function (code) { d.close(); refresh(); SW.toast(code + ' added'); openItem(code); }, function (err) { a.disabled = false; msg.textContent = err.message; });
    });
  }

  // To a paratext by its code (P-XXXXX): Paratexts opened, the item shown
  P.reveal = function (code) {
    SW.setTab('paratexts');
    if (!P.configured()) return;
    P.load().then(function () { openItem(code); }, function (e) { SW.toast(e.message, 5000); });
  };
  SW.views.paratexts = { show: function () { if (!done) render(); }, enter: function () { if (!done) render(); }, reset: function () { done = false; } };
  P.reset = function () { done = false; cat = null; if (SW.state.tab === 'paratexts') render(); };
})(typeof window !== 'undefined' ? window : globalThis);
