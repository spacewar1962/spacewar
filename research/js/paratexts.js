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
  // A token form with everything filled in but the repository (GitHub's links cannot choose that)
  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=Spacewar+research+bench&description=Paratexts+in+the+Spacewar!+research+bench+(sw_paratexts)&target_name=spacewar1962&expires_in=366&contents=write';
  var STEPS = 'Paratexts in the Spacewar! research bench: setting up\n\n1. Accept the invitation to the spacewar1962 organisation on GitHub (sent by email).\n2. Open ' + TOKEN_URL + '\n   The name, owner, expiry and permission are filled in.\n3. Under Repository access choose Only select repositories, then sw_paratexts.\n4. Generate token, copy it, and paste it into the bench: ⚙ Settings, Paratexts (https://spacewar1962.github.io/spacewar/research/?tab=paratexts).\n\nThe token stays in your browser; keep it to yourself.';

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

  // ---------- collections ----------
  // In the catalogue: collections [{id, name, parent, created, by}], nested by parent ('' at the
  // top); an item's collections [ids]. An item can be in several collections, or in none.
  function colls() { return (cat && cat.collections) || []; }
  function coll(id) { return id ? colls().filter(function (c) { return c.id === id; })[0] || null : null; }
  function parentOf(c) { return c.parent && coll(c.parent) ? c.parent : ''; }
  function kidsOf(pid) { return colls().filter(function (c) { return parentOf(c) === (pid || ''); }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }); }
  function treeOrder() {
    var out = [], seen = {};
    (function walk(pid, d) { kidsOf(pid).forEach(function (c) { if (seen[c.id]) return; seen[c.id] = 1; out.push({ c: c, depth: d }); walk(c.id, d + 1); }); })('', 0);
    colls().forEach(function (c) { if (!seen[c.id]) out.push({ c: c, depth: 0 }); });   // a loop left by two people at once
    return out;
  }
  function isUnder(a, b) { for (var c = coll(a), k = 0; c && k < 50; c = coll(c.parent), k++) if (c.id === b) return true; return false; }
  function pathOf(id) { var p = []; for (var c = coll(id), k = 0; c && k < 50; c = coll(parentOf(c)), k++) p.unshift(c); return p; }
  function pathName(id) { return pathOf(id).map(function (c) { return c.name; }).join(' › '); }
  function inColl(it) { return (it.collections || []).filter(function (id) { return coll(id); }); }
  function inC() { return !!coll(F.c); }
  function collId() { var c; do { c = 'c' + Math.random().toString(36).slice(2, 8); } while (coll(c)); return c; }
  function treeOpts(excl) {
    excl = excl || [];
    return treeOrder().filter(function (o) { return excl.indexOf(o.c.id) < 0; }).map(function (o) { return '<option value="' + SW.esc(o.c.id) + '">' + '   '.repeat(o.depth) + SW.esc(o.c.name) + '</option>'; }).join('');
  }

  // A change to the catalogue, shown at once and then saved (made again on the newest copy)
  var busyN = 0;
  function busy(d) { busyN += d; var el = view && SW.$('.px-busy', view); if (el) el.textContent = busyN ? 'Saving…' : ''; }
  function prep(c) { c.items = c.items || []; c.collections = c.collections || []; }
  function change(label, fn) {
    if (me() === '?') { SW.toast('Please set your initials first (⚙).', 4000); return Promise.resolve(false); }
    try { prep(cat); fn(cat); } catch (e) { /* shown again after the save */ }
    refresh(); busy(1);
    return save(label + ', by ' + me(), function (c) { prep(c); fn(c); }).then(function () { busy(-1); refresh(); return true; }, function (e) {
      busy(-1); SW.toast(e.message, 6000);
      return P.load(true).then(function () { refresh(); return false; }, function () { return false; });
    });
  }
  function who(codes) { return codes.length === 1 ? 'Paratext ' + codes[0] : 'Paratexts ' + (codes.length <= 3 ? codes.join(', ') : codes[0] + ' and ' + (codes.length - 1) + ' more'); }
  function each(codes, fn) { return function (c) { c.items.forEach(function (x) { if (codes.indexOf(x.code) >= 0) fn(x); }); }; }
  function put(x, id) { var l = (x.collections || []).slice(); if (l.indexOf(id) < 0) l.push(id); x.collections = l; }
  function take(x, id) { if (!x.collections) return; x.collections = x.collections.filter(function (k) { return k !== id; }); if (!x.collections.length) delete x.collections; }
  function addTo(codes, id) { var c0 = coll(id); if (!c0 || !codes.length) return Promise.resolve(false); return change(who(codes) + ': into “' + c0.name + '”', each(codes, function (x) { put(x, id); })); }
  function outOf(codes, id) { var c0 = coll(id); if (!c0 || !codes.length) return Promise.resolve(false); return change(who(codes) + ': out of “' + c0.name + '”', each(codes, function (x) { take(x, id); })); }
  function moveTo(codes, from, to) { var a = coll(from), b = coll(to); if (!a || !b) return addTo(codes, to); return change(who(codes) + ': moved from “' + a.name + '” to “' + b.name + '”', each(codes, function (x) { take(x, from); put(x, to); })); }
  function newColl(name, parent, codes) {
    var id = collId(); codes = codes || [];
    return change('Paratexts: collection “' + name + '” made' + (codes.length ? ', with ' + codes.length : ''), function (c) {
      if (!c.collections.some(function (x) { return x.id === id; })) c.collections.push({ id: id, name: name, parent: parent || '', created: now(), by: me() });
      c.items.forEach(function (x) { if (codes.indexOf(x.code) >= 0) put(x, id); });
    }).then(function () { return id; });
  }
  function renameColl(id, name) { var c0 = coll(id); if (!c0 || c0.name === name) return; change('Paratexts: collection “' + c0.name + '” renamed “' + name + '”', function (c) { c.collections.forEach(function (x) { if (x.id === id) x.name = name; }); }); }
  function nest(id, parent) {
    var c0 = coll(id); if (!c0 || (c0.parent || '') === parent) return;
    if (parent === id || isUnder(parent, id)) { SW.toast('A collection cannot go inside itself.', 3000); return; }
    var p = coll(parent);
    change('Paratexts: collection “' + c0.name + '” ' + (p ? 'moved into “' + p.name + '”' : 'moved to the top'), function (c) { c.collections.forEach(function (x) { if (x.id === id) x.parent = parent; }); });
  }
  function delColl(id) {
    var c0 = coll(id); if (!c0) return;
    var n = cat.items.filter(function (it) { return inColl(it).indexOf(id) >= 0; }).length, sub = kidsOf(id).length;
    if (!confirm('Delete the collection “' + c0.name + '”?' + (n ? ' Its ' + n + ' item' + (n > 1 ? 's stay' : ' stays') + ' in the catalogue.' : '') + (sub ? ' The collections inside it move up a level.' : ''))) return;
    if (F.c === id) setF('c', parentOf(c0));
    change('Paratexts: collection “' + c0.name + '” deleted', function (c) {
      var me0 = c.collections.filter(function (x) { return x.id === id; })[0], p = me0 ? me0.parent || '' : '';
      c.collections = c.collections.filter(function (x) { return x.id !== id; });
      c.collections.forEach(function (x) { if (x.parent === id) x.parent = p; });
      c.items.forEach(function (x) { take(x, id); });
    });
  }

  // Withdrawing: behind ⋯, with a reason (kept in the record) and the code, or the number, typed to
  // confirm. The file stays in the repository; Withdrawn lists them, to bring back.
  function moreMenu(inner) { return '<details class="px-more"><summary class="btn ghost" title="More">⋯</summary><div class="px-menu">' + inner + '</div></details>'; }
  function unwithdraw(x) { delete x.withdrawn; delete x.withdrawnBy; delete x.withdrawnWhy; x.updated = now(); x.updatedBy = me(); }
  function withdrawBox(codes, after) {
    if (!codes.length) return;
    var esc = SW.esc, one = codes.length === 1, key = one ? codes[0] : String(codes.length), d = SW.el('dialog', { class: 'tray-big px-dlg px-wdbox' });
    d.innerHTML = '<div class="tray-bighead"><b>Withdraw ' + (one ? esc(codes[0]) : codes.length + ' paratexts') + ' from the list</b><span class="refhelp-acts"><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<ul class="px-wdlist">' + codes.map(function (c) { var it = byCode(c); return '<li><span class="mono">' + esc(c) + '</span> ' + esc(it ? it.title : '') + '</li>'; }).join('') + '</ul>' +
      '<p>' + (one ? 'It leaves' : 'They leave') + ' the list for the whole crew. ' + (one ? 'Its file stays' : 'Their files stay') + ' in the repository, with ' + (one ? 'its' : 'their') + ' history, and ' + (one ? 'it' : 'they') + ' can be brought back from Withdrawn.</p>' +
      '<label class="px-wdf"><span>Why</span><input class="px-why" placeholder="A reason, kept with the record"></label>' +
      '<label class="px-wdf"><span>To confirm, type ' + (one ? 'its code' : 'the number') + ', <b class="mono">' + esc(key) + '</b></span><input class="px-key" autocomplete="off"></label>' +
      '<div class="px-acts"><button class="btn ghost" data-x>Cancel</button><button class="btn px-danger" data-a="go" disabled>Withdraw</button> <span class="hint px-msg"></span></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    var why = SW.$('.px-why', d), k = SW.$('.px-key', d), go = SW.$('[data-a="go"]', d);
    why.focus();
    function ok() { return why.value.trim() && k.value.trim().toUpperCase() === key.toUpperCase(); }
    d.addEventListener('input', function () { go.disabled = !ok(); });
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) { d.close(); return; }
      if (!e.target.closest('[data-a="go"]') || !ok()) return;
      var r = why.value.trim(); go.disabled = true;
      d.close(); if (after) after();
      change(who(codes) + ': withdrawn (' + r + ')', each(codes, function (x) { x.withdrawn = now(); x.withdrawnBy = me(); x.withdrawnWhy = r; x.updatedBy = me(); }))
        .then(function (done0) { if (done0) SW.toast((one ? codes[0] : codes.length + ' paratexts') + ' withdrawn: Withdrawn, on the left, lists ' + (one ? 'it' : 'them'), 5000); });
    });
  }

  // ---------- the view ----------
  var V = root.SWVersions;
  var VW = Object.assign({ mode: 'grid', size: 'm', sort: 'date', dir: 1 }, SW.store.get('px.view', {}) || {});
  var sel = {}, lastPick = null, cur = [], editing = null, dragI = null, dragC = null;
  function setView(o) { Object.assign(VW, o); SW.store.set('px.view', VW); }
  function setF(k, v) { F[k] = v; SW.store.set('px.filt', F); }
  function vShort(id) { var v = V.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : id; }
  function live(it) { return !it.withdrawn; }
  function base() {
    var all = cat ? cat.items : [];
    if (F.c === '_wd') return all.filter(function (it) { return it.withdrawn; });
    all = all.filter(live);
    if (F.c === '_none') return all.filter(function (it) { return !inColl(it).length; });
    if (inC()) return all.filter(function (it) { return inColl(it).indexOf(F.c) >= 0; });
    return all;
  }
  var SORTS = [['date', 'Date', 1], ['title', 'Title', 1], ['added', 'Recently added', -1], ['rating', 'Rating', -1], ['code', 'Code', 1], ['size', 'Size', -1], ['creator', 'Creator', 1], ['kind', 'Kind', 1]];
  function defDir(k) { var s = SORTS.filter(function (x) { return x[0] === k; })[0]; return s ? s[2] : 1; }
  function sortKey(it, k) {
    if (k === 'date') return String(it.date || '9999');
    if (k === 'rating') { var a = avg(it); return a ? a.avg : -1; }
    if (k === 'size') return it.size || 0;
    return String(it[k] || '').toLowerCase();
  }
  function shown() {
    var k = VW.sort, d = VW.dir || 1;
    return base().filter(function (it) {
      if (F.tag && (it.tags || []).indexOf(F.tag) < 0) return false;
      if (F.v && (it.versions || []).indexOf(F.v) < 0) return false;
      if (F.kind && it.kind !== F.kind) return false;
      if (F.q) { var t = [it.code, it.title, it.date, it.creator, it.source, it.description, (it.tags || []).join(' '), it.name, inColl(it).map(pathName).join(' ')].join(' ').toLowerCase(); if (t.indexOf(F.q.toLowerCase()) < 0) return false; }
      return true;
    }).sort(function (a, b) {
      var x = sortKey(a, k), y = sortKey(b, k); if (x < y) return -d; if (x > y) return d;
      var t = String(a.title).toLowerCase(), u = String(b.title).toLowerCase(); return t < u ? -1 : t > u ? 1 : 0;
    });
  }
  var ICON = { pdf: '📄', image: '🖼', text: '📝', file: '📎' };
  function thumb(it) { return it.kind === 'image' && urls[it.code] ? '<img alt="" src="' + urls[it.code] + '">' : ICON[it.kind] || ICON.file; }
  function fmtSize(n) { return !n ? '' : n < 1e6 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function render() {
    view = SW.$('#view-paratexts'); if (!view) return;
    done = true;
    var esc = SW.esc;
    view.innerHTML = '<div class="pad px"><h2>Paratexts</h2><p class="lede">The scans, clippings, photographs and documents around the program, kept for the crew in a private repository (' + esc(REPO) + '). Click one to read it; add with ＋. To link to one from an annotation, note or finding, write its code (P-XXXXX).</p><div class="px-body"></div></div>';
    var body = SW.$('.px-body', view);
    if (!P.configured()) {
      body.innerHTML = '<div class="px-howto"><p>The paratexts are in a private repository for the crew. To open them here, the bench needs a GitHub token of your own, limited to that repository. Four steps, once:</p><ol>' +
        '<li>Be a member of the <b>spacewar1962</b> organisation on GitHub: ask to be added if you are not, and accept the invitation GitHub emails you. (A token cannot reach the repository for someone added to it alone, as an outside collaborator.)</li>' +
        '<li><a class="btn" href="' + SW.esc(TOKEN_URL) + '" target="_blank" rel="noopener">Open the token form ↗</a> Its name, owner (spacewar1962), a year’s expiry and the permission it needs (Contents, read and write) are filled in.</li>' +
        '<li>Under <b>Repository access</b>, choose <b>Only select repositories</b>, then <b>sw_paratexts</b>: the one choice the link cannot make. If GitHub asks for a reason, “the Spacewar! research bench” will do.</li>' +
        '<li><b>Generate token</b>, copy it, and paste it into ⚙ Settings, Paratexts. It stays in this browser only; on another computer, paste it there too.</li></ol>' +
        '<p><button class="btn" data-px="settings">Open ⚙ Settings</button> <button class="btn ghost" data-copy="' + SW.esc(STEPS) + '" title="These steps as text, to send to someone joining the crew">Copy the steps</button></p></div>';
      body.onclick = function (e) { if (e.target.closest('[data-px="settings"]')) SW.$('#btn-settings') ? SW.$('#btn-settings').click() : null; };
      return;
    }
    body.innerHTML = '<p class="hint">Opening the catalogue…</p>';
    P.load().then(function () { paint(body); }, function (e) { body.innerHTML = '<p class="badge err">' + esc(e.message) + '</p>'; });
  }
  function paint(body) {
    var esc = SW.esc, items = cat.items.filter(live);
    if (F.c && F.c.charAt(0) !== '_' && !coll(F.c)) setF('c', '');
    var tags = [], vids = [], kinds = [];
    items.forEach(function (it) { (it.tags || []).forEach(function (g) { if (tags.indexOf(g) < 0) tags.push(g); }); (it.versions || []).forEach(function (v) { if (vids.indexOf(v) < 0) vids.push(v); }); if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); });
    tags.sort(); vids.sort(function (a, b) { return ((V.byId(a) || {}).sort || 0) - ((V.byId(b) || {}).sort || 0); });
    function opt(v, l, cur0) { return '<option value="' + esc(v) + '"' + (v === cur0 ? ' selected' : '') + '>' + esc(l) + '</option>'; }
    function seg(act, v, label, on, tip) { return '<button class="' + (on ? 'on' : '') + '" data-px="' + act + '" data-v="' + v + '" title="' + tip + '">' + label + '</button>'; }
    body.innerHTML = '<div class="px-shell"><nav class="px-nav" aria-label="Collections"></nav><div class="px-main">' +
      '<div class="toolbar px-bar" style="position:static;padding-left:0">' +
      '<input type="search" data-f="q" placeholder="Find (code, title, words)" value="' + esc(F.q || '') + '">' +
      '<label class="check">Tag <select data-f="tag">' + opt('', 'All', F.tag || '') + tags.map(function (g) { return opt(g, g, F.tag); }).join('') + '</select></label>' +
      '<label class="check">Version <select data-f="v">' + opt('', 'All', F.v || '') + vids.map(function (v) { return opt(v, vShort(v), F.v); }).join('') + '</select></label>' +
      '<label class="check">Kind <select data-f="kind">' + opt('', 'All', F.kind || '') + kinds.map(function (k) { return opt(k, k, F.kind); }).join('') + '</select></label>' +
      '<label class="check">Sort <select data-px="sort">' + SORTS.map(function (s) { return opt(s[0], s[1], VW.sort); }).join('') + '</select></label>' +
      '<span class="px-seg">' + seg('view', 'grid', '▦', VW.mode !== 'list', 'Grid') + seg('view', 'list', '☰', VW.mode === 'list', 'List') + '</span>' +
      (VW.mode !== 'list' ? '<span class="px-seg">' + seg('size', 's', 'S', VW.size === 's', 'Small') + seg('size', 'm', 'M', VW.size === 'm', 'Medium') + seg('size', 'l', 'L', VW.size === 'l', 'Large') + '</span>' : '') +
      '<span class="hint px-count"></span><span class="hint px-busy">' + (busyN ? 'Saving…' : '') + '</span>' +
      '<button class="btn" data-px="add" title="Upload a file with its details, to the crew’s repository">＋ Add a paratext</button>' +
      '<button class="btn ghost" data-px="reload" title="Read the catalogue again (others may have added)">↻</button></div>' +
      '<div class="px-list"></div></div></div>';
    paintNav(body); paintList(body); wire(body);
  }
  function paintNav(body) {
    var nav = SW.$('.px-nav', body); if (!nav) return;
    var esc = SW.esc, lv = cat.items.filter(live), wd = cat.items.length - lv.length;
    function row(id, icon, label, n, extra, depth, cls) {
      var isC = !!coll(id);
      return '<div class="px-coll' + ((F.c || '') === id ? ' on' : '') + (cls ? ' ' + cls : '') + '" data-c="' + esc(id) + '"' + (isC ? ' draggable="true"' : '') + ' style="--d:' + (depth || 0) + '" tabindex="0" title="' + esc(isC ? pathName(id) + ': drag items here to put them in it, or drag the collection onto another' : label) + '">' +
        '<span class="px-cn">' + icon + ' ' + esc(label) + '</span><span class="px-cnt">' + n + '</span>' + (extra || '') + '</div>';
    }
    function editRow(depth, val) { return '<div class="px-coll px-cedit" style="--d:' + depth + '"><input class="px-cin" value="' + esc(val) + '" placeholder="Its name, then Enter"></div>'; }
    var tree = treeOrder().map(function (o) {
      var c = o.c, n = lv.filter(function (it) { return inColl(it).indexOf(c.id) >= 0; }).length;
      if (editing && editing.mode === 'ren' && editing.id === c.id) return editRow(o.depth, c.name);
      var r = row(c.id, '📁', c.name, n, '<span class="px-cact"><button class="icon-btn" data-px="subc" title="A collection inside “' + esc(c.name) + '”">＋</button><button class="icon-btn" data-px="ren" title="Rename">✎</button><button class="icon-btn" data-px="delc" title="Delete the collection (its items stay in the catalogue)">✕</button></span>', o.depth);
      if (editing && editing.mode === 'new' && editing.parent === c.id) r += editRow(o.depth + 1, '');
      return r;
    }).join('');
    nav.innerHTML = row('', '▤', 'All', lv.length) + row('_none', '◌', 'Not in a collection', lv.filter(function (it) { return !inColl(it).length; }).length) +
      '<div class="px-ch"><span>Collections</span><button class="icon-btn" data-px="newc" title="A new collection">＋</button></div>' +
      tree + (editing && editing.mode === 'new' && !editing.parent ? editRow(0, '') : '') +
      (!colls().length && !editing ? '<p class="hint px-navfoot">None yet: ＋ makes one; then drag items onto it, or tick them and Add to.</p>' : '') +
      (wd || F.c === '_wd' ? row('_wd', '⊘', 'Withdrawn', wd, '', 0, 'px-wdrow') : '') +
      (colls().length ? '<p class="hint px-navfoot">Drag items onto a collection to put them in it. From inside a collection a drag moves them; hold ⌥ to add them instead.</p>' : '');
    var inp = SW.$('.px-cin', nav); if (inp) { inp.focus(); inp.select(); }
  }
  function paintList(body) {
    var main = SW.$('.px-list', body); if (!main) return;
    var esc = SW.esc, b = base(); cur = shown();
    Object.keys(sel).forEach(function (k) { if (!cur.some(function (it) { return it.code === k; })) delete sel[k]; });
    var cnt = SW.$('.px-count', body); if (cnt) cnt.textContent = cur.length + ' of ' + b.length;
    var head = '';
    if (inC()) head = '<div class="px-crumbs"><a data-c="" title="All the paratexts">All</a>' + pathOf(F.c).map(function (c) { return ' › ' + (c.id === F.c ? '<b>' + esc(c.name) + '</b>' : '<a data-c="' + esc(c.id) + '">' + esc(c.name) + '</a>'); }).join('') + '</div>';
    else if (F.c === '_none') head = '<div class="px-crumbs"><b>Not in a collection</b></div>';
    else if (F.c === '_wd') head = '<div class="px-crumbs"><b>Withdrawn</b>: out of the list, their files kept. Tick them and Bring back to restore them.</div>';
    var sub = inC() ? kidsOf(F.c) : [];
    if (sub.length) head += '<ul class="px-folders">' + sub.map(function (c) { var n = cat.items.filter(function (it) { return live(it) && inColl(it).indexOf(c.id) >= 0; }).length; return '<li class="px-folder" data-c="' + esc(c.id) + '" tabindex="0">📁 ' + esc(c.name) + ' <span class="faint">' + n + '</span></li>'; }).join('') + '</ul>';
    main.innerHTML = head + '<div class="px-selbar" hidden></div>' + (cur.length ? (VW.mode === 'list' ? listHTML(cur) : gridHTML(cur)) :
      '<p class="hint">' + (b.length ? 'None with these filters.' : F.c === '_wd' ? 'Nothing withdrawn.' : inC() ? 'Nothing in this collection yet: drag items onto it on the left, or tick them and Add to.' : 'Nothing here.') + '</p>');
    selUpdate(body);
    // the pictures, as they come into view (small ones only: a large scan stays an icon here)
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var it = byCode(en.target.closest('[data-code]').dataset.code);
        if (it && it.kind === 'image' && (it.size || 0) < 6e6 && !SW.$('img', en.target)) blobOf(it).then(function (u) { en.target.innerHTML = '<img alt="" src="' + u + '">'; }, function () {});
      });
    }, { rootMargin: '200px' });
    SW.$$('.px-thumb', main).forEach(function (t) { io.observe(t); });
  }
  function collChips(it) { return inColl(it).filter(function (id) { return id !== F.c; }).map(function (id) { return '<span class="px-cl" title="' + SW.esc(pathName(id)) + '">📁 ' + SW.esc(coll(id).name) + '</span>'; }).join(''); }
  function gridHTML(l) {
    var esc = SW.esc;
    return '<ul class="px-grid px-' + esc(VW.size || 'm') + '">' + l.map(function (it) {
      return '<li class="px-card" data-code="' + esc(it.code) + '" tabindex="0" draggable="true" title="Open: ' + esc(it.title) + '"><button class="px-pick" data-pick aria-pressed="false" title="Select (or ⌘-click; ⇧-click for a run)"></button><div class="px-thumb" data-kind="' + esc(it.kind) + '">' + thumb(it) + '</div>' +
        '<div class="px-meta"><span class="px-code mono">' + esc(it.code) + '</span> <b>' + esc(it.title) + '</b>' + (it.date ? ' <span class="faint">' + esc(it.date) + '</span>' : '') +
        '<div class="px-tags">' + summary(it) + (it.tags || []).map(function (g) { return '<span class="fd-tag">' + esc(g) + '</span>'; }).join(' ') + (it.versions || []).map(function (v) { return ' <span class="fd-tag px-v">' + esc(vShort(v)) + '</span>'; }).join('') + collChips(it) + '</div></div></li>';
    }).join('') + '</ul>';
  }
  var COLS = [['code', 'Code'], ['title', 'Title'], ['date', 'Date'], ['creator', 'Creator'], ['kind', 'Kind'], ['size', 'Size'], ['rating', '★'], [null, 'Collections'], ['added', 'Added']];
  function listHTML(l) {
    var esc = SW.esc;
    return '<div class="px-tablewrap"><table class="px-table"><thead><tr><th><button class="px-pick" data-px="pickall" aria-pressed="' + l.every(function (it) { return sel[it.code]; }) + '" title="Select all shown"></button></th><th></th>' +
      COLS.map(function (c) { return c[0] ? '<th data-sort="' + c[0] + '" class="' + (VW.sort === c[0] ? 'on' : '') + '" title="Sort by ' + (c[0] === 'rating' ? 'rating' : c[1].toLowerCase()) + '">' + c[1] + (VW.sort === c[0] ? (VW.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>' : '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      l.map(function (it) {
        var a = avg(it);
        return '<tr class="px-row" data-code="' + esc(it.code) + '" tabindex="0" draggable="true"><td><button class="px-pick" data-pick aria-pressed="false" title="Select"></button></td><td><div class="px-thumb px-mini" data-kind="' + esc(it.kind) + '">' + thumb(it) + '</div></td>' +
          '<td class="mono px-code-c">' + esc(it.code) + '</td><td><b>' + esc(it.title) + '</b>' + ((it.tags || []).length ? ' ' + it.tags.map(function (g) { return '<span class="fd-tag">' + esc(g) + '</span>'; }).join(' ') : '') + '</td>' +
          '<td class="num">' + esc(it.date || '') + '</td><td>' + esc(it.creator || '') + '</td><td>' + esc(it.kind || '') + '</td><td class="num">' + fmtSize(it.size) + '</td>' +
          '<td>' + (a ? '<span class="px-s px-star" title="' + esc(a.who.join('; ')) + '">★ ' + (Math.round(a.avg * 10) / 10) + '</span>' : '') + '</td>' +
          '<td>' + inColl(it).map(function (id) { return '<span class="px-cl" title="' + esc(pathName(id)) + '">📁 ' + esc(coll(id).name) + '</span>'; }).join('') + '</td>' +
          '<td class="num">' + esc(SW.fmtDate(it.added) || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function selCodes() { return cur.filter(function (it) { return sel[it.code]; }).map(function (it) { return it.code; }); }
  function pick(code, range) {
    var at = function (c) { for (var i = 0; i < cur.length; i++) if (cur[i].code === c) return i; return -1; };
    if (range && lastPick && sel[lastPick]) { var i = at(lastPick), j = at(code); if (i >= 0 && j >= 0) { for (var k = Math.min(i, j); k <= Math.max(i, j); k++) sel[cur[k].code] = 1; lastPick = code; return; } }
    if (sel[code]) delete sel[code]; else sel[code] = 1;
    lastPick = code;
  }
  function selUpdate(body) {
    var esc = SW.esc, n = selCodes().length;
    SW.$$('[data-code]', body).forEach(function (el) { var on = !!sel[el.dataset.code]; el.classList.toggle('sel', on); var p = SW.$('[data-pick]', el); if (p) p.setAttribute('aria-pressed', on); });
    var pa = SW.$('[data-px="pickall"]', body); if (pa) pa.setAttribute('aria-pressed', n > 0 && n === cur.length);
    body.classList.toggle('px-has-sel', n > 0);
    var bar = SW.$('.px-selbar', body); if (!bar) return;
    if (!n) { bar.innerHTML = ''; bar.hidden = true; return; }
    bar.hidden = false;
    var c0 = coll(F.c);
    bar.innerHTML = '<b>' + n + ' selected</b>' + (n < cur.length ? '<button class="btn ghost" data-px="selall">All ' + cur.length + '</button>' : '') +
      (F.c === '_wd' ? '' : '<select data-px="to" title="Put the selected items in a collection"><option value="">Add to a collection…</option>' + treeOpts(c0 ? [c0.id] : []) + '<option value="_new">＋ A new collection…</option></select>') +
      (c0 ? '<button class="btn ghost" data-px="out" title="Take them out of this collection (they stay in the catalogue)">Out of “' + esc(c0.name) + '”</button>' : '') +
      '<span class="px-tagadd"><input class="px-tagin" placeholder="A tag"><button class="btn ghost" data-px="tag" title="Add this tag to each">Tag</button></span>' +
      '<button class="btn ghost" data-px="codes" title="Their codes, to paste into an annotation, note or finding, where each becomes a link">Copy the codes</button>' +
      (F.c === '_wd' ? '<button class="btn" data-px="restore">Bring back</button>' : moreMenu('<button data-px="wd">Withdraw from the list…</button>')) +
      '<button class="icon-btn" data-px="clear" title="Clear the selection">✕</button>';
  }
  function commitEdit(body, val) {
    var ed = editing; editing = null; val = String(val || '').trim();
    if (!ed || !val) { paintNav(body); return; }
    if (ed.mode === 'ren') renameColl(ed.id, val);
    else newColl(val, ed.parent || '');
    paintNav(body);
  }
  function wire(body) {
    var qt = null;
    body.oninput = function (e) { if (e.target.dataset.f === 'q') { clearTimeout(qt); qt = setTimeout(function () { setF('q', e.target.value); paintList(body); }, 300); } };
    body.onchange = function (e) {
      var t = e.target;
      if (t.dataset.f) { setF(t.dataset.f, t.value); paintList(body); return; }
      if (t.dataset.px === 'sort') { setView({ sort: t.value, dir: defDir(t.value) }); paintList(body); return; }
      if (t.dataset.px === 'to') {
        var v = t.value, codes = selCodes(); t.value = ''; if (!v || !codes.length) return;
        if (v === '_new') { var nm = prompt('A name for the new collection'); if (nm && nm.trim()) newColl(nm.trim(), '', codes); }
        else addTo(codes, v);
      }
    };
    body.onclick = function (e) {
      var t = e.target, b = t.closest('[data-px]'), act = b && b.dataset.px, crow = t.closest('[data-c]');
      if (act === 'add') { addBox(); return; }
      if (act === 'reload') { body.innerHTML = '<p class="hint">Reading the catalogue again…</p>'; P.load(true).then(function () { paint(body); }, function (err) { body.innerHTML = '<p class="badge err">' + SW.esc(err.message) + '</p>'; }); return; }
      if (act === 'newc') { editing = { mode: 'new', parent: '' }; paintNav(body); return; }
      if (act === 'subc' && crow) { editing = { mode: 'new', parent: crow.dataset.c }; paintNav(body); return; }
      if (act === 'ren' && crow) { editing = { mode: 'ren', id: crow.dataset.c }; paintNav(body); return; }
      if (act === 'delc' && crow) { delColl(crow.dataset.c); return; }
      if (act === 'view') { setView({ mode: b.dataset.v }); paint(body); return; }
      if (act === 'size') { setView({ size: b.dataset.v }); paintList(body); SW.$$('[data-px="size"]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
      if (act === 'selall') { cur.forEach(function (it) { sel[it.code] = 1; }); selUpdate(body); return; }
      if (act === 'pickall') { var all = cur.length && cur.every(function (it) { return sel[it.code]; }); cur.forEach(function (it) { if (all) delete sel[it.code]; else sel[it.code] = 1; }); selUpdate(body); return; }
      if (act === 'clear') { sel = {}; selUpdate(body); return; }
      if (act === 'out') { outOf(selCodes(), F.c); return; }
      if (act === 'tag') { var ti = SW.$('.px-tagin', body), tg = ti && ti.value.trim(); if (!tg) return; var cs = selCodes(); change(who(cs) + ': tagged “' + tg + '”', each(cs, function (x) { x.tags = (x.tags || []).slice(); if (x.tags.indexOf(tg) < 0) x.tags.push(tg); })); return; }
      if (act === 'codes') { SW.copyText(selCodes().join(' '), 'the codes'); return; }
      if (act === 'wd') { var mm = b.closest('details'); if (mm) mm.open = false; withdrawBox(selCodes(), function () { sel = {}; }); return; }
      if (act === 'restore') { var cr = selCodes(); sel = {}; change(who(cr) + ': brought back', each(cr, unwithdraw)); return; }
      var th = t.closest('th[data-sort]');
      if (th) { var k = th.dataset.sort; setView(VW.sort === k ? { dir: -(VW.dir || 1) } : { sort: k, dir: defDir(k) }); var ss = SW.$('[data-px="sort"]', body); if (ss) ss.value = VW.sort; paintList(body); return; }
      if (crow && !t.closest('.px-cedit')) { setF('c', crow.dataset.c); sel = {}; editing = null; paintNav(body); paintList(body); return; }
      var card = t.closest('[data-code]'); if (!card) return;
      if (t.closest('[data-pick]') || e.metaKey || e.ctrlKey || e.shiftKey) { pick(card.dataset.code, e.shiftKey); selUpdate(body); return; }
      openItem(card.dataset.code);
    };
    body.onkeydown = function (e) {
      var t = e.target, cl = t.classList;
      if (cl && cl.contains('px-cin')) {
        if (e.key === 'Enter') { e.preventDefault(); t.dataset.done = 1; commitEdit(body, t.value); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); t.dataset.done = 1; editing = null; paintNav(body); }
        return;
      }
      if (cl && cl.contains('px-tagin') && e.key === 'Enter') { e.preventDefault(); var tb = SW.$('[data-px="tag"]', body); if (tb) tb.click(); return; }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (t.matches && t.matches('[data-c]')) { e.preventDefault(); t.click(); return; }
      if (t.matches && t.matches('[data-code]')) { e.preventDefault(); if (e.key === ' ') { pick(t.dataset.code, e.shiftKey); selUpdate(body); } else openItem(t.dataset.code); }
    };
    body.onfocusout = function (e) { var t = e.target; if (t.classList && t.classList.contains('px-cin') && !t.dataset.done) { t.dataset.done = 1; commitEdit(body, t.value); } };
    // Dragging: items onto a collection (moved from the one shown, or added with ⌥); a collection
    // onto another, or onto All for the top. An item dropped into a text box gives its code.
    function okDrop(el) {
      var id = el.dataset.c;
      if (dragI) return !!coll(id);
      if (dragC) return id === '' || (!!coll(id) && id !== dragC && !isUnder(id, dragC));
      return false;
    }
    function unmark() { SW.$$('.px-drop-on', body).forEach(function (x) { x.classList.remove('px-drop-on'); }); }
    body.ondragstart = function (e) {
      var t = e.target, crow = t.closest && t.closest('.px-coll[data-c]');
      if (crow) { dragC = crow.dataset.c; dragI = null; e.dataTransfer.setData('text/plain', coll(dragC).name); e.dataTransfer.effectAllowed = 'move'; return; }
      var card = t.closest && t.closest('[data-code]'); if (!card) return;
      var code = card.dataset.code; dragI = sel[code] ? selCodes() : [code]; dragC = null;
      e.dataTransfer.setData('text/plain', dragI.join(' ')); e.dataTransfer.effectAllowed = 'copyMove';
      body.classList.add('px-dragging');
    };
    body.ondragend = function () { dragI = dragC = null; body.classList.remove('px-dragging'); unmark(); };
    body.ondragover = function (e) {
      var el = e.target.closest && e.target.closest('[data-c]'); if (!el || !okDrop(el)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = dragI && !(inC() && !e.altKey) ? 'copy' : 'move';
      if (!el.classList.contains('px-drop-on')) { unmark(); el.classList.add('px-drop-on'); }
    };
    body.ondragleave = function (e) { var el = e.target.closest && e.target.closest('[data-c]'); if (el && !el.contains(e.relatedTarget)) el.classList.remove('px-drop-on'); };
    body.ondrop = function (e) {
      var el = e.target.closest && e.target.closest('[data-c]'); if (!el || !okDrop(el)) return;
      e.preventDefault(); unmark();
      var to = el.dataset.c, codes = dragI, cid = dragC; dragI = dragC = null; body.classList.remove('px-dragging');
      if (codes) { sel = {}; (inC() && F.c !== to && !e.altKey ? moveTo(codes, F.c, to) : addTo(codes, to)).then(function (ok) { if (ok) SW.toast(codes.length + (inC() && F.c !== to && !e.altKey ? ' moved to “' : ' put in “') + coll(to).name + '”'); }); }
      else if (cid) nest(cid, to);
    };
  }
  function byCode(c) { return (cat ? cat.items : []).filter(function (it) { return it.code === c; })[0] || null; }

  // ---------- one paratext ----------
  var FIELDS = [['title', 'Title'], ['date', 'Date'], ['creator', 'Creator'], ['source', 'Source'], ['rights', 'Rights'], ['accessioned', 'Accession date'], ['description', 'Description', 'area'], ['tags', 'Tags', 'list'], ['versions', 'Versions', 'list'], ['refs', 'References', 'list']];
  function fieldsHTML(it) {
    return '<div class="px-fields">' + FIELDS.map(function (f) {
      var v = it[f[0]], val = f[2] === 'list' ? (v || []).join(', ') : (v || '');
      var ph = f[0] === 'versions' ? 'e.g. 4.3, 4.4' : f[0] === 'refs' ? 'e.g. [REF: SW4.3L, 2.10–20]' : f[0] === 'tags' ? 'comma separated' : f[0] === 'date' ? 'e.g. 1963-05-17, or 1963' : f[0] === 'accessioned' ? 'the day it came into the collection' : '';
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
  function showFile(it, pv, dl) {
    var esc = SW.esc;
    blobOf(it).then(function (u) {
      if (dl) dl.href = u;
      if (it.kind === 'image') pv.innerHTML = '<img class="px-img" alt="' + esc(it.title) + '" src="' + u + '">';
      else if (it.kind === 'pdf') pv.innerHTML = '<iframe class="px-pdf" title="' + esc(it.title) + '" src="' + u + '"></iframe>';
      else if (/^text\//.test(it.mime || '')) fetch(u).then(function (r) { return r.text(); }).then(function (t) { pv.innerHTML = '<pre class="px-text">' + esc(t) + '</pre>'; });
      else pv.innerHTML = '<p class="hint">No preview for this kind of file: ⤓ Download to open it.</p>';
    }, function (e) { pv.innerHTML = '<p class="badge err">' + esc(e.message) + '</p>'; });
  }
  function openItem(code) {
    var it = byCode(code); if (!it) { SW.toast(code + ' is not in the catalogue.', 4000); return; }
    var esc = SW.esc, d = SW.el('dialog', { class: 'tray-big px-dlg' });
    var gh0 = 'https://github.com/' + REPO + '/blob/main/' + it.file.split('/').map(encodeURIComponent).join('/');
    d.innerHTML = '<div class="tray-bighead"><span class="px-code mono" data-copy="' + esc(it.code) + '" title="Its code: click to copy">' + esc(it.code) + '</span> <b>' + esc(it.title) + '</b>' +
      '<span class="refhelp-acts"><button class="btn ghost" data-a="keep" title="This paratext, with its details, in My notes (private)">＋ My notes</button><a class="btn ghost" data-a="dl" download="' + esc(it.name || it.code) + '">⤓ Download</a><a class="btn ghost" href="' + esc(gh0) + '" target="_blank" rel="noopener" title="On GitHub, with its history">GitHub ↗</a><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<div class="px-cols"><div class="px-view"><p class="hint">Opening…</p></div><div class="px-side">' + fieldsHTML(it) +
      '<div class="px-colls">' + collsHTML(it) + '</div>' +
      '<p class="hint">Catalogued by ' + esc(it.addedBy || '?') + (it.updated && it.updated !== it.added ? '; changed ' + esc(SW.fmtDate(it.updated)) + ' by ' + esc(it.updatedBy || '?') : '') + '.</p>' +
      '<div class="px-acts"><button class="btn" data-a="save">Save the details</button> <span class="hint px-msg"></span>' + (it.withdrawn ? '<button class="btn ghost px-wd" data-a="restore" title="Back into the list">Bring back</button>' : moreMenu('<button data-a="withdraw">Withdraw from the list…</button>')) + '</div>' +
      (it.withdrawn ? '<p class="badge px-wdnote">Withdrawn ' + esc(SW.fmtDate(it.withdrawn)) + (it.withdrawnBy ? ' by ' + esc(it.withdrawnBy) : '') + (it.withdrawnWhy ? ': ' + esc(it.withdrawnWhy) : '') + '</p>' : '') +
      '<div class="px-linkline"><b>Link</b> Write its code, <span class="mono">' + esc(it.code) + '</span>, in an annotation, note or finding: it becomes a link to this box. <button class="btn ghost" data-copy="' + esc(it.code) + '">Copy the code</button> <button class="btn ghost" data-copy="' + esc(SW.BASE_URI + '?code=' + it.code) + '" title="A web address that opens the bench at this paratext, for email or elsewhere">Copy a web link</button></div>' +
      '<div class="px-talk">' + talkHTML(it) + '</div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    showFile(it, SW.$('.px-view', d), SW.$('[data-a="dl"]', d));
    function talk(label, change) {   // a rating, emoji or comment: saved, then the talk redrawn
      var who = me();
      if (who === '?') { SW.toast('Please set your initials first (⚙).', 4000); return Promise.resolve(); }
      return save('Paratext ' + it.code + ': ' + label + ', by ' + who, function (c) { c.items.forEach(function (x) { if (x.code === it.code) change(x, who); }); })
        .then(function () { it = byCode(code); var t = SW.$('.px-talk', d), op = SW.$('.px-cfold', t) && SW.$('.px-cfold', t).open; t.innerHTML = talkHTML(it); if (op) SW.$('.px-cfold', t).open = true; SW.mdTools(SW.$('.px-cbox textarea', t)); refresh(); }, function (err) { SW.toast(err.message, 5000); });
    }
    SW.mdTools(SW.$('.px-cbox textarea', d));
    function colls0() { it = byCode(code); var b = SW.$('.px-colls', d); if (b) b.innerHTML = collsHTML(it); }
    d.addEventListener('change', function (e) {
      if (!e.target.classList.contains('px-addc')) return;
      var v = e.target.value; e.target.value = ''; if (!v) return;
      var p = v === '_new' ? (function () { var nm = prompt('A name for the new collection'); return nm && nm.trim() ? newColl(nm.trim(), '', [code]) : Promise.resolve(); })() : addTo([code], v);
      colls0(); p.then(colls0);
    });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
      var uc = e.target.closest('[data-uncoll]');
      if (uc) { var pr = outOf([code], uc.dataset.uncoll); colls0(); pr.then(colls0); return; }
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
        var mm = a.closest('details'); if (mm) mm.open = false;
        withdrawBox([it.code], function () { d.close(); });
      } else if (a.dataset.a === 'restore') {
        change('Paratext ' + it.code + ': brought back', each([it.code], unwithdraw))
          .then(function (ok) { if (ok) { d.close(); SW.toast(it.code + ' brought back'); } });
      } else if (a.dataset.a === 'keep') {
        if (!SW.tray) return;
        var rows = FIELDS.map(function (f) { var v = it[f[0]]; return [f[1], Array.isArray(v) ? v.join(', ') : v || '']; }).filter(function (r) { return r[1]; });
        SW.tray.addDoc({ title: 'Paratext ' + it.code + ': ' + it.title, subtitle: REPO + ', ' + it.file, blocks: [SW.tableBlock('The paratext', ['', ''], rows)] }, { tags: ['paratext'], vid: (it.versions || [])[0] || SW.state.v });
      }
    });
  }
  // Ratings, emojis and comments, in the item's record: rates {initials: 1-3}, rx {emoji: [initials]},
  // comments [{id, by, date, text}]
  function collsHTML(it) {
    var esc = SW.esc, mine = inColl(it);
    return '<span class="px-lab">Collections</span><span>' + (mine.length ? mine.map(function (id) { return '<span class="fd-tag px-cchip" title="' + esc(pathName(id)) + '">📁 ' + esc(coll(id).name) + '<button data-uncoll="' + esc(id) + '" title="Take it out of this collection">×</button></span>'; }).join(' ') : '<span class="faint">none</span>') +
      ' <select class="px-addc" title="Put it in a collection"><option value="">＋ Add to…</option>' + treeOpts(mine) + '<option value="_new">＋ A new collection…</option></select></span>';
  }
  function avg(it) { var r = it.rates || {}, k = Object.keys(r); return k.length ? { avg: k.reduce(function (t, x) { return t + r[x]; }, 0) / k.length, n: k.length, who: k.map(function (x) { return x + ' ' + '★'.repeat(r[x]); }) } : null; }
  function summary(it) {
    var a = avg(it), rx = it.rx || {}, em = Object.keys(rx).filter(function (e) { return (rx[e] || []).length; }), nc = (it.comments || []).length;
    return (a ? '<span class="px-s px-star" title="' + SW.esc(a.who.join('; ')) + '">★ ' + (Math.round(a.avg * 10) / 10) + '</span>' : '') +
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
      '<details class="px-cfold"><summary class="fd-rh">Comments' + ((it.comments || []).length ? ' <span class="faint">' + it.comments.length + '</span>' : ' <span class="faint">none yet</span>') + '</summary>' +
      ((it.comments || []).length ? it.comments.map(function (c) { return '<div class="fd-reply"><div class="fd-rhead"><b>' + esc(c.by) + '</b> <span class="faint">' + esc(SW.fmtDate(c.date)) + '</span></div><div class="note-md">' + SW.md(c.text) + '</div></div>'; }).join('') : '') +
      '<div class="fd-replybox px-cbox"><textarea rows="2" placeholder="A comment, signed ' + esc(mine) + '"></textarea><button class="btn" data-a="comment">Comment</button></div></details>';
  }
  function refresh() { var body = view && SW.$('.px-body', view); if (body && cat) paint(body); }

  // ---------- adding ----------
  function addBox() {
    var esc = SW.esc, d = SW.el('dialog', { class: 'tray-big px-dlg px-add' });
    var blank = { title: '', date: '', creator: '', source: '', rights: '', accessioned: now().slice(0, 10), description: '', tags: [], versions: SW.state.v ? [SW.state.v] : [], refs: [] };
    var into = coll(F.c);
    d.innerHTML = '<div class="tray-bighead"><b>Add a paratext</b><span class="refhelp-acts"><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<label class="px-drop"><input type="file" class="px-file"><span>Choose a file, or drop one here: a scan, photograph, PDF or text (up to 50 MB).</span></label>' +
      fieldsHTML(blank) + (into ? '<label class="check px-into"><input type="checkbox" class="px-intoc" checked> Into the collection “' + esc(into.name) + '”</label>' : '') + '<div class="px-acts"><button class="btn" data-a="up">Upload</button> <span class="hint px-msg"></span></div>';
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
      var msg = SW.$('.px-msg', d), o = readFields(d), ic = SW.$('.px-intoc', d);
      if (ic && ic.checked) o.collections = [into.id];
      if (!o.accessioned) o.accessioned = now().slice(0, 10);
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
            c.items.push(Object.assign({ code: code, file: path, name: file.name, kind: kind, mime: mime, size: file.size }, o, { added: now(), addedBy: me(), updated: now(), updatedBy: me() }));
          }).then(function () { return code; });
        });
      }).then(function (code) { d.close(); refresh(); SW.toast(code + ' added'); openItem(code); }, function (err) { a.disabled = false; msg.textContent = err.message; });
    });
  }

  // A paratext read where you are (a link in an annotation, note or finding, a code, ?code=): the file
  // and its record, read-only, in a box that closes back to what you were doing. Paratexts has the rest.
  P.peek = function (code) {
    if (SW.state.tab === 'paratexts' && cat) { openItem(code); return; }
    var esc = SW.esc, d = SW.el('dialog', { class: 'tray-big px-dlg px-peek' });
    function head(title, acts) { return '<div class="tray-bighead"><span class="px-code mono" data-copy="' + esc(code) + '" title="Its code: click to copy">' + esc(code) + '</span> <b>' + esc(title) + '</b><span class="refhelp-acts">' + (acts || '') + '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>'; }
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); return; }
      if (e.target.closest('[data-px="full"]')) { e.preventDefault(); d.close(); d.remove(); P.reveal(code); return; }
      if (e.target.closest('[data-px="join"]')) { d.close(); d.remove(); if (SW.notes) SW.notes.joinHelp(); }
    });
    if (!P.configured()) {
      d.innerHTML = head('A paratext') + '<p>' + esc(code) + ' is one of the paratexts, kept for the crew in a private repository. To read it here, the bench needs a GitHub token of your own.</p><p><button class="btn" data-px="join">How to get access</button></p>';
      d.showModal(); return;
    }
    d.innerHTML = head('Opening…'); d.showModal();
    P.load().then(function () {
      var it = byCode(code);
      if (!it) { d.innerHTML = head('Not found') + '<p>' + esc(code) + ' is not in the catalogue.</p>'; return; }
      var rows = FIELDS.filter(function (f) { return f[0] !== 'title'; }).map(function (f) { var v = it[f[0]]; return [f[1], Array.isArray(v) ? v.join(', ') : v || '']; });
      var cs = inColl(it); if (cs.length) rows.push(['Collections', cs.map(pathName).join('; ')]);
      rows = rows.filter(function (r) { return r[1]; });
      var nc = (it.comments || []).length;
      d.innerHTML = head(it.title, '<a class="btn ghost" data-a="dl" download="' + esc(it.name || it.code) + '">⤓ Download</a>') +
        '<div class="px-cols"><div class="px-view"><p class="hint">Opening…</p></div><div class="px-side">' +
        (it.withdrawn ? '<p class="badge">Withdrawn from the list' + (it.withdrawnWhy ? ': ' + esc(it.withdrawnWhy) : '') + '</p>' : '') +
        '<dl class="px-ro">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + (r[0] === 'Description' ? SW.md(r[1]) : esc(r[1])) + '</dd>'; }).join('') + '</dl>' +
        '<div class="px-tags">' + summary(it) + '</div>' +
        (nc ? '<details class="px-cfold"><summary class="fd-rh">Comments <span class="faint">' + nc + '</span></summary>' + it.comments.map(function (c) { return '<div class="fd-reply"><div class="fd-rhead"><b>' + esc(c.by) + '</b> <span class="faint">' + esc(SW.fmtDate(c.date)) + '</span></div><div class="note-md">' + SW.md(c.text) + '</div></div>'; }).join('') + '</details>' : '') +
        '</div></div>' +
        '<div class="px-peekfoot"><a href="?tab=paratexts&code=' + esc(code) + '" data-px="full" title="In Paratexts, where it can be edited, rated and commented on">Go to ' + esc(code) + ' in Paratexts →</a></div>';
      showFile(it, SW.$('.px-view', d), SW.$('[data-a="dl"]', d));
    }, function (e) { d.innerHTML = head('Could not open') + '<p class="badge err">' + esc(e.message) + '</p>'; });
  };
  // To a paratext by its code (P-XXXXX): Paratexts opened, the item shown
  P.reveal = function (code) {
    SW.setTab('paratexts');
    if (!P.configured()) return;
    P.load().then(function () { openItem(code); }, function (e) { SW.toast(e.message, 5000); });
  };
  SW.views.paratexts = { show: function () { if (!done) render(); }, enter: function () { if (!done) render(); }, reset: function () { done = false; } };
  P.TOKEN_URL = TOKEN_URL;
  // The token in Settings, tried: the number in the catalogue, or why not
  P.test = function () { cat = null; return P.load(true).then(function (c) { return c.items.filter(function (it) { return !it.withdrawn; }).length; }); };
  P.reset = function () { done = false; cat = null; if (SW.state.tab === 'paratexts') render(); };
})(typeof window !== 'undefined' ? window : globalThis);
