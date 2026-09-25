/*
 * notes.js - shared annotation for the research bench.
 *
 * Notes live in a private Hypothesis group, written and read through the
 * Hypothesis API, so the group's members see one another's readings. Each
 * note carries the author's initials and a date (the Hypothesis creation
 * time), and replies thread beneath it, so a discussion can be followed
 * line by line. Structured tags record the version, source file and lines:
 *   sw:v:3.1  sw:kind:line  sw:src:spacewar-3.1-24sep1962.txt  sw:lines:0:120-134  sw:by:DMB
 * Until a group and token are configured, notes are kept as drafts in this
 * browser and can be published later. The automatic build log for each
 * version (versions.js) is shown alongside, marked as such.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var API = 'https://api.hypothes.is/api';
  var N = SW.notes = {};
  var cache = {};
  // Notes just saved to the group, shown until the group's search returns them
  // (Hypothesis takes a moment to index a new annotation).
  var pending = {};

  // Accepts a group's URL (https://hypothes.is/groups/ID/name) or its bare ID.
  N.groupId = function (s) {
    s = String(s || '').trim();
    var m = /\/groups\/([A-Za-z0-9]+)/.exec(s);
    return m ? m[1] : s;
  };
  function cfg() {
    return { group: N.groupId(SW.store.get('group', '')), token: SW.store.get('token', '') };
  }
  N.configured = function () { var c = cfg(); return !!(c.group && c.token); };

  function hx(method, path, body) {
    var c = cfg();
    return fetch(API + path, {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.hypothesis.v1+json',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Hypothesis ' + r.status + ': ' + t.slice(0, 160)); });
      return r.status === 204 ? null : r.json();
    });
  }

  N.test = function () {
    return hx('GET', '/profile').then(function (p) {
      var g = cfg().group, found = (p.groups || []).filter(function (x) { return x.id === g; })[0];
      if (!p.userid) throw new Error('The token was not accepted.');
      return { user: p.userid, group: found ? found.name : null };
    });
  };

  function tagVal(tags, key) {
    for (var i = 0; i < (tags || []).length; i++) if (tags[i].indexOf(key) === 0) return tags[i].slice(key.length);
    return null;
  }

  // Hypothesis row -> note
  function fromH(a) {
    var tags = a.tags || [];
    var lines = tagVal(tags, 'sw:lines:');
    var anchor = null;
    if (lines) {
      var m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(lines);
      if (m) anchor = { p: +m[1], n0: +m[2], n1: +(m[3] || m[2]), src: tagVal(tags, 'sw:src:') };
    }
    var by = tagVal(tags, 'sw:by:') || (a.user_info && a.user_info.display_name) ||
             String(a.user || '').replace(/^acct:|@.*$/g, '');
    return {
      id: a.id, vid: tagVal(tags, 'sw:v:'), kind: tagVal(tags, 'sw:kind:') || (anchor ? 'line' : 'version'),
      anchor: anchor, text: a.text || '', by: by, name: (a.user_info && a.user_info.display_name) || '',
      date: a.created, updated: a.updated, parent: (a.references || []).slice(-1)[0] || null,
      tags: tags.filter(function (t) { return t.indexOf('sw:') !== 0; }), source: 'hypothesis',
      link: a.links && (a.links.incontext || a.links.html)
    };
  }

  function drafts() { return SW.store.get('drafts', []); }
  function saveDrafts(d) { SW.store.set('drafts', d); }

  N.list = function (vid, force) {
    if (cache[vid] && !force) return cache[vid];
    var v = root.SWVersions.byId(vid);
    var log = (v && v.buildNotes || []).map(function (bn, i) {
      return { id: 'log-' + vid + '-' + i, vid: vid, kind: 'version', anchor: null, text: bn.text,
               by: bn.by, name: bn.who, date: bn.date, parent: null, tags: ['build log'], source: 'buildlog' };
    });
    var local = drafts().filter(function (d) { return d.vid === vid; });
    var remote = N.configured()
      ? hx('GET', '/search?limit=200&sort=created&order=asc&group=' + encodeURIComponent(cfg().group) +
           '&uri=' + encodeURIComponent(SW.versionURI(vid)))
          .then(function (r) { return (r.rows || []).map(fromH); })
          .catch(function (e) { SW.toast(e.message, 5000); return []; })
      : Promise.resolve([]);
    cache[vid] = remote.then(function (rows) {
      var have = {};
      rows.forEach(function (r) { have[r.id] = 1; });
      pending[vid] = (pending[vid] || []).filter(function (p) { return !have[p.id]; });
      return log.concat(rows, pending[vid], local);
    });
    return cache[vid];
  };

  // Every note in the group, every draft, and every build log, all versions.
  N.listAll = function () {
    var V = root.SWVersions;
    var logs = [];
    V.VERSIONS.forEach(function (v) {
      (v.buildNotes || []).forEach(function (bn, i) {
        logs.push({ id: 'log-' + v.id + '-' + i, vid: v.id, kind: 'version', anchor: null, text: bn.text, by: bn.by,
                    name: bn.who, date: bn.date, parent: null, tags: ['build log'], source: 'buildlog' });
      });
    });
    var local = drafts();
    function page(offset, acc) {
      return hx('GET', '/search?limit=200&sort=created&order=asc&offset=' + offset + '&group=' + encodeURIComponent(cfg().group))
        .then(function (r) {
          var rows = (r.rows || []).map(fromH).filter(function (n) { return n.vid; });
          acc = acc.concat(rows);
          return (r.rows || []).length === 200 && offset < 5000 ? page(offset + 200, acc) : acc;
        });
    }
    var remote = N.configured() ? page(0, []).catch(function (e) { SW.toast(e.message, 5000); return []; }) : Promise.resolve([]);
    return remote.then(function (rows) { return logs.concat(rows, local); });
  };

  N.invalidate = function (vid) { delete cache[vid]; SW.emit('notes', vid); };

  // note: {vid, kind, anchor, quote, text, tags, parent}
  N.create = function (note) {
    var me = SW.me();
    if (!me.initials) {
      SW.toast('Please set your initials first (⚙).', 4000);
      return Promise.reject(new Error('no initials'));
    }
    var tags = ['sw:v:' + note.vid, 'sw:kind:' + (note.kind || 'line'), 'sw:by:' + me.initials]
      .concat(note.anchor ? ['sw:lines:' + note.anchor.p + ':' + note.anchor.n0 +
                             (note.anchor.n1 !== note.anchor.n0 ? '-' + note.anchor.n1 : ''),
                             'sw:src:' + (note.anchor.src || '')] : [])
      .concat(note.tags || []);
    if (!N.configured()) {
      var d = drafts();
      d.push({ id: 'draft-' + Date.now(), vid: note.vid, kind: note.kind || 'line', anchor: note.anchor,
               quote: note.quote || '', text: note.text, by: me.initials, name: me.name,
               date: new Date().toISOString(), parent: note.parent || null, tags: note.tags || [],
               source: 'draft', hTags: tags });
      saveDrafts(d);
      N.invalidate(note.vid);
      SW.toast('Saved as a draft in this browser (no Hypothesis group set).');
      return Promise.resolve();
    }
    var uri = SW.versionURI(note.vid);
    var body = {
      uri: uri, group: cfg().group, text: note.text, tags: tags,
      permissions: { read: ['group:' + cfg().group] },
      document: { title: ['Spacewar! research bench: ' + note.vid] },
      target: [{ source: uri }]
    };
    if (note.quote && !note.parent) {
      body.target[0].selector = [{ type: 'TextQuoteSelector', exact: note.quote.slice(0, 1200) }];
    }
    if (note.parent) body.references = [note.parent];
    return hx('POST', '/annotations', body).then(function (r) {
      var n = fromH(r);
      if (!n.anchor && note.anchor) n.anchor = note.anchor;
      (pending[note.vid] = pending[note.vid] || []).push(n);
      N.invalidate(note.vid);
      setTimeout(function () { N.invalidate(note.vid); }, 4000);
      SW.toast('Note saved to the group.');
    });
  };

  N.remove = function (note) {
    if (note.source === 'draft') {
      saveDrafts(drafts().filter(function (d) { return d.id !== note.id; }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    if (note.source === 'hypothesis') {
      return hx('DELETE', '/annotations/' + note.id).then(function () { N.invalidate(note.vid); });
    }
    return Promise.resolve();
  };

  // Publish drafts to the group, oldest first, keeping reply links.
  N.publishDrafts = function () {
    if (!N.configured()) { SW.toast('Set the Hypothesis group and token first.'); return Promise.resolve(); }
    var ds = drafts().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var idMap = {}, done = 0;
    return ds.reduce(function (p, d) {
      return p.then(function () {
        var uri = SW.versionURI(d.vid);
        var body = { uri: uri, group: cfg().group, text: d.text + '\n\n(drafted ' + SW.fmtDate(d.date) + ')',
                     tags: d.hTags, permissions: { read: ['group:' + cfg().group] },
                     document: { title: ['Spacewar! research bench: ' + d.vid] }, target: [{ source: uri }] };
        if (d.quote && !d.parent) body.target[0].selector = [{ type: 'TextQuoteSelector', exact: d.quote.slice(0, 1200) }];
        if (d.parent) {
          var pid = idMap[d.parent] || d.parent;
          if (/^draft-/.test(pid)) return;
          body.references = [pid];
        }
        return hx('POST', '/annotations', body).then(function (r) {
          idMap[d.id] = r.id; done++;
          saveDrafts(drafts().filter(function (x) { return x.id !== d.id; }));
        });
      });
    }, Promise.resolve()).then(function () {
      cache = {};
      SW.emit('notes', SW.state.v);
      SW.toast('Published ' + done + ' draft note' + (done === 1 ? '' : 's') + '.');
    });
  };

  // Group notes into threads (roots with replies), in date order.
  N.threads = function (notes) {
    var byId = {}, roots = [];
    notes.forEach(function (n) { byId[n.id] = { note: n, replies: [] }; });
    notes.forEach(function (n) {
      if (n.parent && byId[n.parent]) byId[n.parent].replies.push(byId[n.id]);
      else roots.push(byId[n.id]);
    });
    function sort(a) { a.sort(function (x, y) { return String(x.note.date) < String(y.note.date) ? -1 : 1; }); a.forEach(function (t) { sort(t.replies); }); }
    sort(roots);
    return roots;
  };

  // "p:n" (first line of a note's range) -> { n threads, replies, by: [initials], draft, n1 }
  N.countsByLine = function (notes) {
    var c = {}, byId = {};
    notes.forEach(function (n) { byId[n.id] = n; });
    function root(n) { var guard = 0; while (n.parent && byId[n.parent] && guard++ < 50) n = byId[n.parent]; return n; }
    notes.forEach(function (n) {
      var r = root(n);
      if (!r.anchor) return;
      var k = r.anchor.p + ':' + r.anchor.n0;
      var e = c[k] = c[k] || { n: 0, replies: 0, by: [], draft: false, p: r.anchor.p, n0: r.anchor.n0, n1: r.anchor.n1 };
      if (n === r) e.n++; else e.replies++;
      e.n1 = Math.max(e.n1, r.anchor.n1);
      if (n.by && e.by.indexOf(n.by) < 0) e.by.push(n.by);
      if (n.source === 'draft') e.draft = true;
    });
    return c;
  };
  // The margin mark: initials, and the number of replies.
  N.marginMark = function (k, c) {
    if (!c) return '';
    var who = c.by.slice(0, 3).join(' ') + (c.by.length > 3 ? '…' : '');
    return '<span class="note-dot' + (c.draft ? ' draft' : '') + '" data-k="' + k + '" title="' + c.n + ' note' + (c.n > 1 ? 's' : '') +
      (c.replies ? ', ' + c.replies + ' repl' + (c.replies > 1 ? 'ies' : 'y') : '') + ' by ' + SW.esc(c.by.join(', ')) + (c.draft ? ' (includes drafts)' : '') + '. Click to read and reply.">' +
      SW.esc(who || '•') + (c.replies ? ' <b>+' + c.replies + '</b>' : '') + '</span>';
  };

  N.renderNote = function (n, isReply) {
    var who = n.source === 'buildlog' ? 'build log' : (n.name || '');
    return '<div class="note' + (isReply ? ' reply' : '') + (n.source === 'buildlog' ? ' buildlog' : '') + '" data-id="' + SW.esc(n.id) + '">' +
      '<div class="by"><b>' + SW.esc(n.by) + '</b> · ' + SW.esc(SW.fmtDate(n.date)) +
      (who ? ' · ' + SW.esc(who) : '') + (n.source === 'draft' ? ' · <i>draft</i>' : '') + '</div>' +
      '<div class="body">' + SW.esc(n.text) + '</div>' +
      (n.tags && n.tags.length ? '<div class="tagl">' + n.tags.map(SW.esc).join(' · ') + '</div>' : '') +
      '<div class="acts">' + (n.source !== 'buildlog' ? '<button data-act="reply">Reply</button>' : '') +
      (n.source === 'draft' ? '<button data-act="delete">Delete draft</button>' : '') +
      (n.link ? '<a href="' + SW.esc(n.link) + '" target="_blank" rel="noopener">Hypothesis ↗</a>' : '') + '</div></div>';
  };

  N.renderThread = function (t, b) {
    var n = t.note, h = '<div class="thread">';
    if (n.anchor && b) {
      h += '<div class="anchor" data-p="' + n.anchor.p + '" data-n="' + n.anchor.n0 + '">' +
        SW.esc(SW.cite(b, n.anchor.p, n.anchor.n0, n.anchor.n1)) + '</div>';
    }
    h += N.renderNote(n, false);
    (function walk(rs) { rs.forEach(function (r) { h += N.renderNote(r.note, true); walk(r.replies); }); })(t.replies);
    return h + '</div>';
  };

  // Wire reply/delete/anchor clicks inside a container.
  N.wire = function (el, vid, all) {
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      var anc = e.target.closest('.anchor');
      if (anc) { SW.emit('goto', { p: +anc.dataset.p, n: +anc.dataset.n, tab: 'read' }); return; }
      if (!btn) return;
      var id = btn.closest('.note').dataset.id;
      var note = all.filter(function (x) { return x.id === id; })[0];
      if (!note) return;
      if (btn.dataset.act === 'reply') {
        inlineReply(btn.closest('.note'), vid, note);
      } else if (btn.dataset.act === 'delete') {
        N.remove(note);
      }
    });
  };

  // A reply box opened in place, under the note being answered (no tags).
  function inlineReply(noteEl, vid, note) {
    var open = noteEl.parentNode.querySelector('.reply-box');
    if (open) { open.querySelector('textarea').focus(); return; }
    var me = SW.me();
    var box = SW.el('div', { class: 'reply-box' });
    box.innerHTML = '<textarea rows="3" placeholder="Reply to ' + SW.esc(note.by) + '…"></textarea>' +
      '<div class="reply-foot"><span class="hint">' + (me.initials ? 'Signed <b>' + SW.esc(me.initials) + '</b> · ' + SW.fmtDate(SW.today()) +
      (N.configured() ? '' : ' · draft') : '<span style="color:var(--red)">Set your initials first (⚙).</span>') + '</span>' +
      '<span><button class="btn ghost" data-r="cancel">Cancel</button> <button class="btn" data-r="save">Reply</button></span></div>';
    noteEl.insertAdjacentElement('afterend', box);
    var ta = box.querySelector('textarea');
    ta.focus();
    function save() {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      box.querySelector('[data-r="save"]').disabled = true;
      N.create({ vid: vid, parent: note.id, kind: note.kind, anchor: note.anchor, text: text, tags: [] })
        .then(function () { box.remove(); }, function (e) {
          box.querySelector('[data-r="save"]').disabled = false;
          if (e.message !== 'no initials') SW.toast(e.message, 5000);
        });
    }
    box.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-r]');
      if (!b) return;
      if (b.dataset.r === 'cancel') box.remove(); else save();
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); box.remove(); }
    });
  }

  // The note dialog. opts: {vid, kind, anchor, quote, parent, heading, anchorText}
  N.dialog = function (opts) {
    var dlg = SW.$('#dlg-note'), me = SW.me();
    SW.$('#note-title').textContent = opts.heading || 'Annotate';
    SW.$('#note-anchor').textContent = opts.anchorText || '';
    SW.$('#note-text').value = '';
    SW.$('#note-tags').value = '';
    SW.$('#note-who').innerHTML = me.initials
      ? 'Signed <b>' + SW.esc(me.initials) + '</b> · ' + SW.fmtDate(SW.today()) +
        (N.configured() ? ' · shared with the group' : ' · kept as a draft (no group set)')
      : '<span style="color:var(--red)">Set your initials first (⚙).</span>';
    dlg.returnValue = '';
    dlg.showModal();
    SW.$('#note-text').focus();
    dlg.onclose = function () {
      if (dlg.returnValue !== 'save') return;
      var text = SW.$('#note-text').value.trim();
      if (!text) return;
      var tags = SW.$('#note-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      N.create({ vid: opts.vid, kind: opts.kind || (opts.anchor ? 'line' : 'version'), anchor: opts.anchor,
                 quote: opts.quote, text: text, tags: tags, parent: opts.parent })
        .catch(function (e) { if (e.message !== 'no initials') SW.toast(e.message, 5000); });
    };
  };

  // Export helpers: notes as document blocks
  N.blocks = function (threads, b) {
    return threads.map(function (t) {
      var flat = [];
      (function walk(rs) { rs.forEach(function (r) { flat.push({ by: r.note.by, date: r.note.date.slice(0, 10), text: r.note.text }); walk(r.replies); }); })(t.replies);
      return { type: 'note', by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text,
               anchor: t.note.anchor && b ? SW.cite(b, t.note.anchor.p, t.note.anchor.n0, t.note.anchor.n1) : (t.note.source === 'buildlog' ? 'build log' : 'version note'),
               replies: flat };
    });
  };
})(this);
