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

  // Who the token belongs to (acct:name@hypothes.is), so a person can delete
  // their own notes and no one else's. Cached for the session.
  var whoP = null;
  N.whoami = function () {
    if (!N.configured()) return Promise.resolve(null);
    if (!whoP) whoP = hx('GET', '/profile').then(function (p) { N.me = p.userid || null; return N.me; }, function () { whoP = null; return null; });
    return whoP;
  };
  N.forget = function () { whoP = null; N.me = null; cache = {}; };
  N.mine = function (n) { return n.source === 'draft' || (n.source === 'hypothesis' && !!N.me && n.user === N.me); };
  // Notes deleted this session, hidden even if the group's search still returns them for a moment.
  var deleted = {};
  // Notes edited this session, shown as edited until the group's search agrees.
  var edits = {};
  // The bin. Deleting a note tags it sw:deleted (and sw:deleted-at:<date>)
  // rather than removing it, since Hypothesis cannot undelete; binned notes
  // are hidden everywhere and can be restored until the bin is emptied.
  // These record this session's moves, while the group's search catches up.
  var binnedNow = {}, restoredNow = {};
  function isBinTag(t) { return t === 'sw:deleted' || t.indexOf('sw:deleted-at:') === 0; }
  function isBinned(n) {
    if (n.source === 'draft') return !!n.deleted;
    return !!binnedNow[n.id] || (!!n.binned && !restoredNow[n.id]);
  }
  // A note's tags with the bin marks taken off (user tags as last edited).
  function keptTags(note) {
    return (note.rawTags || []).filter(function (t) { return t.indexOf('sw:') === 0 && !isBinTag(t); }).concat(note.tags || []);
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
      tags: tags.filter(function (t) { return t.indexOf('sw:') !== 0; }), source: 'hypothesis', user: a.user || '', rawTags: tags,
      binned: tags.indexOf('sw:deleted') >= 0, binnedAt: tagVal(tags, 'sw:deleted-at:'),
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
    var local = drafts().filter(function (d) { return d.vid === vid && !isBinned(d); });
    var remote = N.configured()
      ? N.whoami().then(function () {
          return hx('GET', '/search?limit=200&sort=created&order=asc&group=' + encodeURIComponent(cfg().group) +
                    '&uri=' + encodeURIComponent(SW.versionURI(vid)));
        })
          .then(function (r) {
            var rows = (r.rows || []).map(fromH).filter(function (n) { return !deleted[n.id]; }).map(function (n) {
              var e = edits[n.id];
              if (!e) return n;
              if (n.text === e.text) { delete edits[n.id]; return n; }
              n.text = e.text; n.tags = e.tags; n.updated = e.updated;
              return n;
            });
            // Binned notes still count as present here, so their reactions are
            // not taken for orphans and return if the note is restored.
            if ((r.rows || []).length < 200) sweepOrphans(rows.concat(pending[vid] || []));
            return rows.filter(function (n) { return !isBinned(n); });
          })
          .catch(function (e) { SW.toast(e.message, 5000); return []; })
      : Promise.resolve([]);
    cache[vid] = remote.then(function (rows) {
      var have = {};
      rows.forEach(function (r) { have[r.id] = 1; });
      pending[vid] = (pending[vid] || []).filter(function (p) { return !have[p.id] && !isBinned(p); });
      return log.concat(rows, pending[vid], local);
    });
    return cache[vid];
  };

  // Your own reactions left on notes that no longer exist (deleted outright,
  // by you or before this was added) are deleted. Each is checked against
  // Hypothesis first: only a note that answers 404 counts as gone. Everyone's
  // browser clears their own, since no one can delete another's annotation.
  var swept = {};
  function sweepOrphans(rows) {
    if (!N.me) return;
    var ids = {};
    rows.forEach(function (n) { ids[n.id] = 1; });
    rows.filter(function (n) {
      return N.isReaction(n) && n.parent && !ids[n.parent] && !swept[n.id] && myReaction(n);
    }).forEach(function (r) {
      swept[r.id] = 1;
      hx('GET', '/annotations/' + r.parent).then(null, function (e) {
        if (!/^Hypothesis 404/.test(e.message)) return;
        return hx('DELETE', '/annotations/' + r.id).then(function () { deleted[r.id] = true; });
      }).catch(function () {});
    });
  }

  // ---------- My notes kept on Hypothesis ----------
  // Each note of My notes is a private annotation ("Only me": read permission
  // for its owner alone) in the group, at an address of its own, so it never
  // shows among a version's annotations, in Findings or in what's new. The
  // note travels whole, gzipped, on a closing line of the text; the first line
  // says what it is, for anyone looking in Hypothesis's own sidebar.
  var MYNOTES_URI = SW.BASE_URI + '?mynotes';
  var NOTE_RE = /<!-- sw:note:gz ([A-Za-z0-9+\/=]+) -->\s*$/;
  N.mynotes = {
    ready: function () { return N.configured() ? N.whoami().then(function (me) { return !!me; }) : Promise.resolve(false); },
    push: function (item) {
      var body0 = Object.assign({}, item); delete body0.hid; delete body0.shash; delete body0.syncErr;
      return SW.gz.pack(JSON.stringify(body0)).then(function (b64) {
        var head = 'My notes (private) · ' + (item.ref || '') + ' · ' + String(item.caption || item.text || item.kind || '').split('\n')[0].slice(0, 120);
        var body = { uri: MYNOTES_URI, group: cfg().group, text: head + '\n\n<!-- sw:note:gz ' + b64 + ' -->',
          tags: ['sw:mynote', 'sw:ref:' + (item.ref || '')], permissions: { read: [N.me] }, document: { title: ['Spacewar! research bench: My notes'] }, target: [{ source: MYNOTES_URI }] };
        var send = item.hid ? hx('PATCH', '/annotations/' + item.hid, { text: body.text, tags: body.tags })
          .catch(function (e) { if (/^Hypothesis 404/.test(e.message)) return hx('POST', '/annotations', body); throw e; })
          : hx('POST', '/annotations', body);
        return send.then(function (r) { return r && r.id ? r.id : item.hid; });
      });
    },
    remove: function (hid) { return hx('DELETE', '/annotations/' + hid).catch(function (e) { if (!/^Hypothesis 404/.test(e.message)) throw e; }); },
    pull: function () {
      function page(offset, acc) {
        return hx('GET', '/search?limit=200&offset=' + offset + '&group=' + encodeURIComponent(cfg().group) + '&uri=' + encodeURIComponent(MYNOTES_URI) + '&user=' + encodeURIComponent(N.me))
          .then(function (r) { acc = acc.concat(r.rows || []); return (r.rows || []).length === 200 && offset < 20000 ? page(offset + 200, acc) : acc; });
      }
      return page(0, []).then(function (rows) {
        return Promise.all(rows.map(function (a) {
          var m = NOTE_RE.exec(a.text || ''); if (!m) return null;
          return SW.gz.unpack(m[1]).then(function (js) { var it = JSON.parse(js); it.hid = a.id; return it; }, function () { return null; });
        })).then(function (xs) { return xs.filter(Boolean); });
      });
    }
  };

  // Every note in the group, every draft, and every build log, all versions.
  N.listAll = function (opts) {
    opts = opts || {};
    var V = root.SWVersions;
    var logs = [];
    V.VERSIONS.forEach(function (v) {
      (v.buildNotes || []).forEach(function (bn, i) {
        logs.push({ id: 'log-' + v.id + '-' + i, vid: v.id, kind: 'version', anchor: null, text: bn.text, by: bn.by,
                    name: bn.who, date: bn.date, parent: null, tags: ['build log'], source: 'buildlog' });
      });
    });
    var local = drafts().filter(function (d) { return !isBinned(d); });
    function page(offset, acc) {
      return hx('GET', '/search?limit=200&sort=created&order=asc&offset=' + offset + '&group=' + encodeURIComponent(cfg().group))
        .then(function (r) {
          var rows = (r.rows || []).map(fromH).filter(function (n) { return n.vid && !deleted[n.id] && !isBinned(n); });
          acc = acc.concat(rows);
          return (r.rows || []).length === 200 && offset < 5000 ? page(offset + 200, acc) : acc;
        });
    }
    var remote = N.configured() ? page(0, []).catch(function (e) { SW.toast(e.message, 5000); return []; }) : Promise.resolve([]);
    return remote.then(function (rows) { return logs.concat(rows, local).filter(function (n) { return opts.reactions || !N.isReaction(n); }); });
  };

  // ---------- what's new: notes, replies and reactions by others since you last looked ----------
  var newsItems = [], newsAll = [];
  function newsSince() {
    var s = SW.store.get('notes.seen', '');
    return s || new Date(Date.now() - 7 * 864e5).toISOString();   // first visit: the last week
  }
  function isMine(n) { var me = SW.me(); return N.mine(n) || (!!me.initials && n.by === me.initials); }
  N.news = function () {
    if (!N.configured()) { newsItems = []; paintNews(); return Promise.resolve([]); }
    var since = newsSince();
    return N.whoami().catch(function () {}).then(function () { return N.listAll({ reactions: true }); }).then(function (all) {
      newsAll = all;
      newsItems = all.filter(function (n) { return n.source === 'hypothesis' && String(n.date) > since && !isMine(n); })
        .sort(function (a, b) { return String(b.date) < String(a.date) ? -1 : 1; });
      paintNews();
      return newsItems;
    }).catch(function () { return []; });
  };
  function paintNews() {
    var n = SW.$('#news-n'), btn = SW.$('#btn-news');
    if (!n || !btn) return;
    n.textContent = newsItems.length ? (newsItems.length > 99 ? '99+' : String(newsItems.length)) : '';
    btn.classList.toggle('has-news', !!newsItems.length);
    btn.title = newsItems.length ? newsItems.length + ' new in the group’s annotations since ' + SW.fmtDate(newsSince()) : 'What’s new in the group’s annotations';
  }
  function newsLine(n, byId) {
    var V = root.SWVersions, v = V.byId(n.vid), par = n.parent && byId[n.parent];
    var what = N.isReaction(n) ? n.text + ' on ' + (par ? par.by + '’s annotation' : 'an annotation') : n.parent ? 'reply to ' + (par ? par.by : 'an annotation') : n.anchor ? 'annotation' : 'annotation on the version';
    var root0 = par; while (root0 && root0.parent && byId[root0.parent]) root0 = byId[root0.parent];
    var anchor = n.anchor || (root0 && root0.anchor) || (par && par.anchor);
    var where = (v ? v.label.replace(/^Spacewar! /, '') : n.vid) + ' ' + (anchor ? SW.refText(n.vid, anchor.p, anchor.n0, anchor.n1, SW.nparts(n.vid)) : SW.refText(n.vid));
    return { n: n, anchor: anchor, html: '<div class="news-item" data-id="' + SW.esc(n.id) + '"><div class="news-meta"><b>' + SW.esc(n.by) + '</b> · ' + SW.esc(what) +
      ' · <span class="mono">' + SW.esc(where) + '</span> · <span class="faint">' + SW.esc(SW.fmtDate(n.date)) + '</span></div>' +
      (N.isReaction(n) ? '' : '<div class="news-text">' + SW.esc(SW.mdPlain(SW.figpack.split(n.text).text).slice(0, 280)) + (SW.mdPlain(SW.figpack.split(n.text).text).length > 280 ? '…' : '') + '</div>') + '</div>' };
  }
  N.showNews = function () {
    var body = SW.drawer('What’s new', '<p class="hint">Looking…</p>');
    N.news().then(function (items) {
      if (!N.configured()) { body.innerHTML = '<p class="hint">Set the Hypothesis group and token in ⚙ to see what others have added.</p>'; return; }
      var byId = {};
      newsAll.forEach(function (n) { byId[n.id] = n; });
      var lines = items.map(function (n) { return newsLine(n, byId); });
      body.innerHTML = '<p class="hint">Annotations, replies and reactions by others since ' + SW.esc(SW.fmtDate(newsSince())) + (SW.store.get('notes.seen', '') ? ', when you last marked them read' : ' (the last week; nothing has been marked read yet)') + '.</p>';
      var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
      bar.appendChild(SW.el('button', { class: 'btn', title: 'Everything up to now counts as read; the count starts again from zero', onclick: function () {
        SW.store.set('notes.seen', new Date().toISOString());
        newsItems = []; paintNews();
        SW.toast('Marked as read');
        N.showNews();
      } }, '✓ Mark all as read'));
      body.appendChild(bar);
      if (!lines.length) { body.insertAdjacentHTML('beforeend', '<p>Nothing new.</p>'); return; }
      var list = SW.el('div', { class: 'news-list' }, lines.map(function (l) { return l.html; }).join(''));
      list.addEventListener('click', function (e) {
        var it = e.target.closest('.news-item');
        if (!it) return;
        var l = lines.filter(function (x) { return x.n.id === it.dataset.id; })[0];
        if (!l) return;
        SW.openAt(l.n.vid, l.anchor);
      });
      body.appendChild(list);
    });
  };
  N.initNews = function () {
    var btn = SW.$('#btn-news');
    if (!btn) return;
    btn.onclick = N.showNews;
    setTimeout(N.news, 1500);
    setInterval(N.news, 5 * 60 * 1000);
  };

  N.invalidate = function (vid) { delete cache[vid]; SW.emit('notes', vid); };

  // note: {vid, kind, anchor, quote, text, tags, parent}
  N.create = function (note) {
    var me = SW.me(), by = note.by || me.initials;   // a note from My notes keeps the initials it was signed with
    if (!by) {
      SW.toast('Please set your initials first (⚙).', 4000);
      return Promise.reject(new Error('no initials'));
    }
    var tags = ['sw:v:' + note.vid, 'sw:kind:' + (note.kind || 'line'), 'sw:by:' + by]
      .concat(note.anchor ? ['sw:lines:' + note.anchor.p + ':' + note.anchor.n0 +
                             (note.anchor.n1 !== note.anchor.n0 ? '-' + note.anchor.n1 : ''),
                             'sw:src:' + (note.anchor.src || '')] : [])
      .concat(note.tags || []);
    if (!N.configured()) {
      var d = drafts();
      d.push({ id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), vid: note.vid, kind: note.kind || 'line', anchor: note.anchor,
               quote: note.quote || '', text: note.text, by: by, name: me.name,
               date: new Date().toISOString(), parent: note.parent || null, tags: note.tags || [],
               source: 'draft', hTags: tags });
      saveDrafts(d);
      N.invalidate(note.vid);
      if (!note.quiet) SW.toast('Saved as a draft in this browser (no Hypothesis group set).');
      return Promise.resolve(d[d.length - 1]);
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
      if (!note.quiet) SW.toast('Annotation saved to the group.');
      return n;
    });
  };

  // Permanent deletion: emptying the bin, or taking back a reaction.
  N.remove = function (note, quiet) {
    if (note.source === 'draft') {
      saveDrafts(drafts().filter(function (d) { return d.id !== note.id && !(d.kind === 'reaction' && d.parent === note.id); }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    if (note.source === 'hypothesis') {
      return hx('DELETE', '/annotations/' + note.id).then(function () {
        deleted[note.id] = true;
        pending[note.vid] = (pending[note.vid] || []).filter(function (p) { return p.id !== note.id; });
        N.invalidate(note.vid);
        if (!quiet) SW.toast('Annotation deleted from the group.');
      });
    }
    return Promise.resolve();
  };

  // Move a note of one's own to the bin (hidden, restorable).
  N.bin = function (note) {
    var now = new Date().toISOString();
    if (note.source === 'draft') {
      saveDrafts(drafts().map(function (d) { if (d.id === note.id) d.deleted = now; return d; }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    if (note.source !== 'hypothesis') return Promise.resolve();
    return hx('PATCH', '/annotations/' + note.id, { tags: keptTags(note).concat(['sw:deleted', 'sw:deleted-at:' + now]) }).then(function (r) {
      var n = r ? fromH(r) : note;
      n.binnedAt = n.binnedAt || now;
      binnedNow[note.id] = n;
      delete restoredNow[note.id];
      N.invalidate(note.vid);
    });
  };

  N.restore = function (note) {
    if (note.source === 'draft') {
      saveDrafts(drafts().map(function (d) { if (d.id === note.id) delete d.deleted; return d; }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    return hx('PATCH', '/annotations/' + note.id, { tags: keptTags(note) }).then(function () {
      restoredNow[note.id] = true;
      delete binnedNow[note.id];
      N.invalidate(note.vid);
    });
  };

  // Your binned notes, every version, most recently binned first.
  N.binList = function () {
    var local = drafts().filter(function (d) { return d.deleted; }).map(function (d) { d.binnedAt = d.deleted; return d; });
    var remote = N.configured()
      ? N.whoami().then(function (me) {
          if (!me) return [];
          return hx('GET', '/search?limit=200&sort=updated&order=desc&group=' + encodeURIComponent(cfg().group) +
                    '&tag=sw:deleted&user=' + encodeURIComponent(me)).then(function (r) {
            var rows = (r.rows || []).map(fromH).filter(function (n) { return !deleted[n.id] && !restoredNow[n.id]; });
            var have = {};
            rows.forEach(function (n) { have[n.id] = 1; });
            Object.keys(binnedNow).forEach(function (id) { if (!have[id]) rows.push(binnedNow[id]); });
            return rows;
          });
        }).catch(function (e) { SW.toast(e.message, 5000); return []; })
      : Promise.resolve([]);
    return remote.then(function (rows) {
      return local.concat(rows).sort(function (a, b) { return String(b.binnedAt) < String(a.binnedAt) ? -1 : 1; });
    });
  };

  // Empty the bin: delete each note for good, with your own reactions on it.
  N.emptyBin = function (notes) {
    var vids = {};
    return notes.reduce(function (p, n) {
      vids[n.vid] = 1;
      if (n.source === 'draft') return p.then(function () { return N.remove(n, true); });
      return p.then(function () { return N.list(n.vid, true); }).then(function (all) {
        var mine = all.filter(function (r) { return N.isReaction(r) && r.parent === n.id && myReaction(r); });
        return mine.reduce(function (q, r) { return q.then(function () { return N.remove(r, true); }); }, Promise.resolve());
      }).then(function () {
        return N.remove(n, true).then(function () { delete binnedNow[n.id]; });
      });
    }, Promise.resolve()).then(function () {
      Object.keys(vids).forEach(N.invalidate);
    });
  };

  // The bin, drawn into a holder: this version's deleted notes by default, or
  // every version's with the box ticked. Restoring or emptying redraws it.
  // opts: {vid, all}; the choice is kept on the holder for redraws.
  N.showBin = function (holder, opts) {
    opts = opts || {};
    if (opts.vid) holder.dataset.vid = opts.vid;
    if (opts.all != null) holder.dataset.all = opts.all ? '1' : '';
    var vid = holder.dataset.vid, all = !vid || holder.dataset.all === '1';
    holder.classList.add('bin');
    holder.innerHTML = '<p class="hint">Opening the bin…</p>';
    N.binList().then(function (every) {
      var list = all ? every : every.filter(function (n) { return n.vid === vid; });
      if (holder.binFilter) list = list.filter(holder.binFilter);
      var V = root.SWVersions, cur = vid && V.byId(vid);
      var h = (vid ? '<label class="check bin-scope"><input type="checkbox"' + (all ? ' checked' : '') + '> all versions' +
               (all ? '' : ' <span class="faint">(showing ' + SW.esc(cur ? cur.label.replace(/^Spacewar! /, '') : vid) + ' only; ' + every.length + ' in all)</span>') + '</label>' : '');
      if (!list.length) { holder.innerHTML = h + '<p class="hint">Nothing in the bin' + (all ? '' : ' for this version') + '.</p>'; wireScope(); return; }
      holder.innerHTML = h + list.map(function (n, i) {
        var v = V.byId(n.vid);
        return '<div class="note binned" data-i="' + i + '"><div class="by"><b>' + SW.esc(n.by) + '</b> · ' + SW.esc(SW.fmtDate(n.date)) +
          (all ? ' · ' + SW.esc(v ? v.label.replace(/^Spacewar! /, '') : n.vid) : '') + (n.anchor ? ' · l. ' + n.anchor.n0 : ' · on the version') +
          (n.parent ? ' · reply' : '') + (n.source === 'draft' ? ' · <i>draft</i>' : '') + ' · deleted ' + SW.esc(SW.fmtDate(n.binnedAt)) + '</div>' +
          '<div class="body note-md">' + SW.md(SW.figpack.split(n.text).text) + '</div>' +
          '<div class="acts"><button data-r="restore">Restore</button></div></div>';
      }).join('') +
        '<p style="margin-top:10px"><button class="btn" data-r="empty">' + (all ? 'Empty the bin' : 'Delete these for good') + ' (' + list.length + ')</button></p>';
      wireScope();
      holder.onclick = function (e) {
        var btn = e.target.closest('[data-r]');
        if (!btn) return;
        e.stopPropagation();
        btn.disabled = true;
        if (btn.dataset.r === 'restore') {
          N.restore(list[+btn.closest('.note').dataset.i]).then(function () { SW.toast('Restored.'); N.showBin(holder); },
            function (err) { btn.disabled = false; SW.toast(err.message, 5000); });
        } else if (btn.dataset.r === 'empty') {
          if (!window.confirm('Delete ' + (list.length > 1 ? 'these ' + list.length + ' annotations' : 'this annotation') + ' for good?\n\nThis cannot be undone.')) { btn.disabled = false; return; }
          N.emptyBin(list).then(function () { SW.toast('Deleted for good.'); N.showBin(holder); },
            function (err) { SW.toast(err.message, 5000); N.showBin(holder); });
        }
      };
    });
    function wireScope() {
      var box = holder.querySelector('.bin-scope input');
      if (box) box.onchange = function () { N.showBin(holder, { all: box.checked }); };
    }
  };

  // Edit a note of one's own: its text, and for a note (not a reply) its tags.
  N.update = function (note, text, tags) {
    var now = new Date().toISOString();
    if (note.source === 'draft') {
      saveDrafts(drafts().map(function (d) {
        if (d.id !== note.id) return d;
        d.text = text; d.updated = now;
        if (tags) { d.tags = tags; d.hTags = (d.hTags || []).filter(function (t) { return t.indexOf('sw:') === 0; }).concat(tags); }
        return d;
      }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    if (note.source !== 'hypothesis') return Promise.resolve();
    var body = { text: text };
    if (tags) body.tags = (note.rawTags || []).filter(function (t) { return t.indexOf('sw:') === 0; }).concat(tags);
    return hx('PATCH', '/annotations/' + note.id, body).then(function (r) {
      edits[note.id] = { text: text, tags: tags || note.tags, updated: (r && r.updated) || now };
      (pending[note.vid] || []).forEach(function (p) { if (p.id === note.id) { p.text = text; if (tags) p.tags = tags; p.updated = now; } });
      N.invalidate(note.vid);
      SW.toast('Annotation updated.');
    });
  };

  // Publish drafts to the group, oldest first, keeping reply links.
  N.publishDrafts = function () {
    if (!N.configured()) { SW.toast('Set the Hypothesis group and token first.'); return Promise.resolve(); }
    var ds = drafts().filter(function (d) { return !d.deleted; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
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
      SW.toast('Published ' + done + ' draft annotation' + (done === 1 ? '' : 's') + '.');
    });
  };

  // Group notes into threads (roots with replies), in date order.
  // Reactions: an emoji left on a note, stored as a tiny reply marked
  // sw:kind:reaction, so it is shared, signed and dated like any note.
  N.EMOJI = ['👍', '👎', '✅', '😊', '❓', '💡', '❗', '👀'];
  N.isReaction = function (n) { return n.kind === 'reaction'; };
  N.threads = function (notes) {
    var byId = {}, roots = [];
    notes.forEach(function (n) { if (!N.isReaction(n)) byId[n.id] = { note: n, replies: [], reactions: [] }; });
    notes.forEach(function (n) {
      if (N.isReaction(n)) { if (n.parent && byId[n.parent]) byId[n.parent].reactions.push(n); return; }
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
      if (N.isReaction(n)) return;
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
    return '<span class="note-dot' + (c.draft ? ' draft' : '') + '" data-k="' + k + '" title="' + c.n + ' annotation' + (c.n > 1 ? 's' : '') +
      (c.replies ? ', ' + c.replies + ' repl' + (c.replies > 1 ? 'ies' : 'y') : '') + ' by ' + SW.esc(c.by.join(', ')) + (c.draft ? ' (includes drafts)' : '') + '. Click to read and reply.">' +
      SW.esc(who || '•') + (c.replies ? ' <b>+' + c.replies + '</b>' : '') + '</span>';
  };

  N.myReaction = function (r) { return myReaction(r); };
  function myReaction(r) {
    if (r.source === 'draft') return r.by === SW.me().initials;
    return r.source === 'hypothesis' && !!N.me && r.user === N.me;
  }
  function renderReactions(n, reactions) {
    if (n.source === 'buildlog') return '';
    var by = {};
    (reactions || []).forEach(function (r) { (by[r.text] = by[r.text] || []).push(r); });
    var h = '<span class="reacts">';
    N.EMOJI.concat(Object.keys(by).filter(function (e) { return N.EMOJI.indexOf(e) < 0; })).forEach(function (e) {
      var rs = by[e];
      if (!rs) return;
      var mine = rs.some(myReaction);
      var who = rs.map(function (r) { return r.by; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      h += '<button class="react' + (mine ? ' mine' : '') + '" data-act="react" data-emoji="' + SW.esc(e) + '" title="' +
        SW.esc(who.join(', ') + (mine ? ' (click to take yours back)' : ' (click to add yours)')) + '">' + SW.esc(e) + '<small>' + SW.esc(who.join(' ')) + '</small></button>';
    });
    h += '<button class="react add" data-act="react-pick" title="Add a reaction">☺<small>+</small></button>' +
      '<span class="react-pick" hidden>' + N.EMOJI.map(function (e) { return '<button class="react" data-act="react" data-emoji="' + e + '">' + e + '</button>'; }).join('') + '</span></span>';
    return h;
  }

  N.renderNote = function (n, isReply, reactions) {
    var who = n.source === 'buildlog' ? 'build log' : (n.name || '');
    return '<div class="note' + (isReply ? ' reply' : '') + (n.source === 'buildlog' ? ' buildlog' : '') + '" data-id="' + SW.esc(n.id) + '">' +
      '<div class="by"><b>' + SW.esc(n.by) + '</b> · ' + SW.esc(SW.fmtDate(n.date)) +
      (who ? ' · ' + SW.esc(who) : '') + (n.source === 'draft' ? ' · <i>draft</i>' : '') +
      (n.updated && String(n.updated).slice(0, 16) !== String(n.date).slice(0, 16) ? ' · <i title="' + SW.esc(new Date(n.updated).toLocaleString('en-GB')) + '">edited ' + SW.esc(SW.fmtDate(n.updated)) + '</i>' : '') + '</div>' +
      (n.source === 'buildlog' ? '<div class="body">' + SW.esc(n.text) + '</div>' : '<div class="body note-md">' + SW.md(SW.figpack.split(n.text).text) + '</div>') +
      (n.tags && n.tags.length ? '<div class="tagl">' + n.tags.map(SW.esc).join(' · ') + '</div>' : '') +
      (N.backlinks(n.id).length ? '<div class="backl"><span class="faint">Linked from</span> ' + N.backlinks(n.id).map(function (b) {
        return '<a href="' + SW.esc(N.linkOf(b)) + '" class="swlink" title="' + SW.esc('Go to ' + N.labelOf(b)) + '">' + SW.esc(N.labelOf(b)) + '</a>';
      }).join(' · ') + '</div>' : '') +
      // one row: Reply | reactions | copy, download, edit, delete
      '<div class="acts">' + (n.source !== 'buildlog' ? '<button data-act="reply">Reply</button><span class="acts-sep"></span>' + renderReactions(n, reactions) + '<span class="acts-sep"></span>' : '') +
      '<button data-act="copy" class="ico" title="Copy the annotation, with its citation and replies">⧉</button>' +
      (n.source !== 'draft' ? '<button data-act="link" class="ico" title="Copy a link to this annotation, to paste into another (or use ↪ in the editor)">↪</button>' : '') +
      '<button data-act="dl" class="ico" title="Download the annotation with its code and replies (Markdown)">⤓</button>' +
      (N.mine(n) ? '<button data-act="edit">Edit</button>' : '') +
      (N.mine(n) ? '<button data-act="delete" class="del-note">' + (n.source === 'draft' ? 'Delete draft' : 'Delete') + '</button>' : '') +
      '</div></div>';
  };

  N.renderThread = function (t, b) {
    var n = t.note, h = '<div class="thread">';
    if (n.anchor && b) {
      h += '<div class="anchor" data-p="' + n.anchor.p + '" data-n="' + n.anchor.n0 + '">' +
        SW.esc(SW.cite(b, n.anchor.p, n.anchor.n0, n.anchor.n1)) + '</div>';
    }
    h += N.renderNote(n, false, t.reactions);
    (function walk(rs) { rs.forEach(function (r) { h += N.renderNote(r.note, true, r.reactions); walk(r.replies); }); })(t.replies);
    return h + '</div>';
  };

  // Wire reply/delete/anchor clicks inside a container.
  N.wire = function (el, vid, all) {
    // One handler per panel: the panel is re-rendered in place when notes
    // change, and stale handlers holding an old list would answer too.
    if (el._swNotes) el.removeEventListener('click', el._swNotes);
    el.addEventListener('click', el._swNotes = function (e) {
      var btn = e.target.closest('button[data-act]');
      var anc = e.target.closest('.anchor');
      if (anc) { SW.emit('goto', { p: +anc.dataset.p, n: +anc.dataset.n, tab: 'read' }); return; }
      if (!btn || !btn.closest('.note')) return;   // panel buttons (add, bin) handle themselves
      var id = btn.closest('.note').dataset.id;
      var note = all.filter(function (x) { return x.id === id; })[0];
      if (!note) return;
      if (btn.dataset.act === 'edit') { inlineEdit(btn.closest('.note'), note); return; }
      if (btn.dataset.act === 'copy') { copyNote(note, all); return; }
      if (btn.dataset.act === 'link') {
        var url = N.linkOf(note);
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
          .then(function () { SW.toast('Link copied: paste it into another annotation, or over selected words'); }, function () { window.prompt('Copy:', url); });
        return;
      }
      if (btn.dataset.act === 'dl') { downloadNote(note, all, 'md'); return; }
      if (btn.dataset.act === 'react-pick') {
        var pk = btn.parentNode.querySelector('.react-pick');
        pk.hidden = !pk.hidden;
        return;
      }
      if (btn.dataset.act === 'react') {
        var emoji = btn.dataset.emoji;
        var mineR = all.filter(function (x) { return N.isReaction(x) && x.parent === note.id && x.text === emoji && myReaction(x); })[0];
        btn.disabled = true;
        (mineR ? N.remove(mineR, true) : N.create({ vid: vid, parent: note.id, kind: 'reaction', anchor: note.anchor, text: emoji, tags: [], quiet: true }))
          .catch(function (err) { btn.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); });
        return;
      }
      if (btn.dataset.act === 'reply') {
        inlineReply(btn.closest('.note'), vid, note);
      } else if (btn.dataset.act === 'delete') {
        // Into the bin, so no confirmation: it can be restored.
        N.bin(note).then(function () {
          SW.toast('Moved to the bin. Restore it under Deleted annotations on the Versions page.', 5000);
        }, function (e) { SW.toast(e.message, 5000); });
      }
    });
  };

  // ---------- links between annotations ----------
  // A link to an annotation is the bench's permalink with a= its id (and v=, l=
  // for its version and lines), kept in the note's Markdown like any link, so it
  // also works from Hypothesis or an email. On the bench it does not open a new
  // tab: it switches to the version and lines, opens the annotation (its thread,
  // if a reply) and flashes it. Each note lists the notes that link to it.
  var idx = { byId: {}, back: {}, sig: null };
  function reindex(ns) {
    (ns || []).forEach(function (n) { if (n && n.id && !N.isReaction(n)) idx.byId[n.id] = n; });
    var back = {};
    Object.keys(idx.byId).forEach(function (id) {
      var re = /[?&]a=([A-Za-z0-9_-]+)/g, m, seen = {};
      while ((m = re.exec(idx.byId[id].text || ''))) if (m[1] !== id && !seen[m[1]]) { seen[m[1]] = 1; (back[m[1]] = back[m[1]] || []).push(id); }
    });
    idx.back = back;
    var sig = JSON.stringify(back);
    if (idx.sig !== null && sig !== idx.sig) setTimeout(function () { SW.emit('notes', SW.state.v); }, 0);
    idx.sig = sig;
    return ns;
  }
  var list0 = N.list, listAll0 = N.listAll;
  N.list = function (vid, force) { return list0(vid, force).then(reindex); };
  N.listAll = function (opts) { return listAll0(opts).then(reindex); };
  N.byId = function (id) { return idx.byId[id] || null; };
  N.backlinks = function (id) { return (idx.back[id] || []).map(function (x) { return idx.byId[x]; }).filter(Boolean); };

  function lineParam(a) { return a ? a.p + ':' + a.n0 + (a.n1 !== a.n0 ? '-' + a.n1 : '') : null; }
  N.linkOf = function (n) { return SW.permalink({ v: n.vid, l: lineParam(n.anchor), a: n.id }); };
  N.labelOf = function (n) {
    var a = n.anchor;
    return (n.by || '?') + (n.parent ? ' (reply)' : '') + ', ' +
      (a ? SW.refOf(n.vid, a.p, a.n0, a.n1, SW.nparts(n.vid)) : SW.refOf(n.vid) + ', the version');
  };
  // A bench link's parameters, or null for a link elsewhere.
  N.parseLink = function (href) {
    var h = String(href || '').replace(/&amp;/g, '&');
    var ok = h.charAt(0) === '?' || [SW.BASE_URI, location.origin + location.pathname].some(function (b) {
      return h.indexOf(b) === 0 && (h.length === b.length || h.charAt(b.length) === '?');
    });
    if (!ok) return null;
    var q = {};
    (h.split('?')[1] || '').split('#')[0].split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* malformed */ } }
    });
    return q.v ? q : null;
  };
  // How SW.md draws a bench link: in place, marked ↪, a bare one named for what it points to.
  SW.internalLink = function (href, label, bare) {
    var q = N.parseLink(href);
    if (!q) return null;
    var n = q.a && idx.byId[q.a], name;
    if (n) name = N.labelOf(n);
    else if (q.l) { var m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(q.l); name = m ? SW.refOf(q.v, +m[1], +m[2], +(m[3] || m[2]), SW.nparts(q.v)) : SW.refOf(q.v); }
    else name = SW.refOf(q.v);
    if (q.a && !n) name = 'annotation, ' + name;
    return '<a href="' + href + '" class="swlink" title="' + SW.esc('Go to ' + name) + '">' + (bare ? SW.esc(name) : label) + '</a>';
  };

  // Following a link: to the version and lines, then the annotation itself.
  N.follow = function (q) {
    var m = q.l && /^(\d+):(\d+)(?:-(\d+))?$/.exec(q.l), at = m ? { p: +m[1], n0: +m[2], n1: +(m[3] || m[2]) } : null;
    if (!q.a) { SW.openAt(q.v, at); return; }
    N.list(q.v).then(function (ns) {
      var n = ns.filter(function (x) { return x.id === q.a; })[0];
      if (!n) { SW.openAt(q.v, at); SW.toast('That annotation is not here: deleted, or not in your group.', 5000); return; }
      var r = n, byId = {}, guard = 0;
      ns.forEach(function (x) { byId[x.id] = x; });
      while (r.parent && byId[r.parent] && guard++ < 50) r = byId[r.parent];
      SW.openAt(n.vid, r.anchor || n.anchor || at);
      SW.emit('reveal', { id: n.id, root: r.id, vid: n.vid });
      var t0 = Date.now(), panel = false;
      (function look() {
        var el = SW.$$('.note[data-id="' + n.id + '"]').filter(function (x) { return x.offsetParent; })[0];
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.remove('note-flash'); void el.offsetWidth; el.classList.add('note-flash');
          return;
        }
        if (Date.now() - t0 < 2500) { setTimeout(look, 150); return; }
        // not shown where it is (notes hidden or filtered on Read): the version's panel
        if (!panel) { panel = true; t0 = Date.now(); N.openPanel(n.vid).then(function () { setTimeout(look, 150); }); }
      })();
    }, function () { SW.openAt(q.v, at); });
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.swlink');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a modified click: a new tab, as usual
    if (a.closest('[contenteditable="true"]')) { e.preventDefault(); return; }
    var q = N.parseLink(a.getAttribute('href'));
    if (!q) return;
    e.preventDefault();
    var dlg = a.closest('dialog');
    if (dlg && dlg.open && !dlg.hasAttribute('data-keep')) { dlg.close(); if (dlg.classList.contains('tray-big')) dlg.remove(); }
    N.follow(q);
  });

  // Choosing an annotation to link to: every note in the group, any version.
  N.pick = function (cb) {
    var d = SW.el('dialog', { class: 'tray-big link-pick' });
    var V = root.SWVersions, order = {};
    V.VERSIONS.forEach(function (v, i) { order[v.id] = i; });
    d.innerHTML = '<div class="tray-bighead"><b>Link to an annotation</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
      '<div class="lp-bar"><input type="search" placeholder="Search: words, initials, a reference" spellcheck="false">' +
      '<select><option value="">All versions</option>' + V.VERSIONS.map(function (v) { return '<option value="' + SW.esc(v.id) + '"' + (v.id === SW.state.v ? ' selected' : '') + '>' + SW.esc(SW.refOf(v.id) + ' ' + v.label.replace(/^Spacewar! /, '')) + '</option>'; }).join('') + '</select></div>' +
      '<div class="lp-list"><p class="hint">Loading the annotations…</p></div>';
    document.body.appendChild(d);
    d.showModal();
    var qIn = SW.$('input', d), vSel = SW.$('select', d), list = SW.$('.lp-list', d), all = [];
    function close() { d.close(); d.remove(); }
    function paint() {
      var q = qIn.value.trim().toLowerCase(), v = vSel.value;
      var rows = all.filter(function (n) {
        return (!v || n.vid === v) && (!q || [n.by, n.name, SW.mdPlain(n.text), N.labelOf(n), (n.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0);
      }).slice(0, 300);
      list.innerHTML = rows.length ? rows.map(function (n) {
        return '<button type="button" class="lp-item" data-id="' + SW.esc(n.id) + '"><span class="lp-where mono">' + SW.esc(N.labelOf(n)) + '</span>' +
          '<span class="lp-text">' + SW.esc(SW.mdPlain(SW.figpack.split(n.text).text).slice(0, 160)) + '</span></button>';
      }).join('') : '<p class="hint">No annotation matches.' + (v ? ' Try All versions.' : '') + '</p>';
    }
    N.listAll().then(function (ns) {
      all = ns.filter(function (n) { return n.source !== 'draft' && !N.isReaction(n); }).sort(function (a, b) {
        return (order[a.vid] - order[b.vid]) || ((a.anchor ? a.anchor.p * 1e5 + a.anchor.n0 : -1) - (b.anchor ? b.anchor.p * 1e5 + b.anchor.n0 : -1)) || String(a.date).localeCompare(String(b.date));
      });
      if (!N.configured()) list.innerHTML = '<p class="hint">Links need the shared group (⚙): drafts in this browser cannot be linked to.</p>';
      else paint();
    });
    qIn.addEventListener('input', paint);
    vSel.addEventListener('change', paint);
    qIn.focus();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { close(); return; }
      var it = e.target.closest('.lp-item');
      if (!it) return;
      var n = all.filter(function (x) { return x.id === it.dataset.id; })[0];
      close();
      if (n) cb(N.linkOf(n), N.labelOf(n));
    });
    d.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  };

  // ---------- copying and downloading a single note ----------
  function rootOf(note, all) {
    var byId = {}, n = note, guard = 0;
    all.forEach(function (x) { byId[x.id] = x; });
    while (n.parent && byId[n.parent] && guard++ < 50) n = byId[n.parent];
    return n;
  }
  function threadOf(note, all) {
    var r = rootOf(note, all);
    return N.threads(all).filter(function (t) { return t.note.id === r.id; })[0] || { note: note, replies: [], reactions: [] };
  }
  function citeOf(note) {
    var b = SW.views.read && SW.views.read.build;
    if (note.anchor && b && b.v.id === note.vid) return SW.cite(b, note.anchor.p, note.anchor.n0, note.anchor.n1);
    var v = root.SWVersions.byId(note.vid);
    return (v ? v.label + ' (' + v.date + ')' : note.vid) + (note.anchor ? ', ' + (note.anchor.src || '') + ', ll. ' + note.anchor.n0 + '–' + note.anchor.n1 : '') +
      ' ' + (note.anchor ? SW.refText(note.vid, note.anchor.p, note.anchor.n0, note.anchor.n1, SW.nparts(note.vid)) : SW.refText(note.vid));
  }
  function copyNote(note, all) {
    var t = threadOf(note, all), lines = [];
    var head = note.id === t.note.id ? t : null;
    lines.push('“' + note.text + '” (' + note.by + ', ' + SW.fmtDate(note.date) + '; ' + citeOf(t.note) + ')');
    if (head) (function walk(rs, d) { rs.forEach(function (r) {
      lines.push(new Array(d + 1).join('  ') + '↳ ' + r.note.by + ', ' + SW.fmtDate(r.note.date) + ': ' + r.note.text); walk(r.replies, d + 1);
    }); })(t.replies, 1);
    var text = lines.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { SW.toast('Annotation copied'); }, function () { window.prompt('Copy:', text); });
  }
  function downloadNote(note, all, fmt) {
    var t = threadOf(note, all), a = t.note.anchor;
    SW.build(t.note.vid).then(function (b) {
      var blocks = [];
      if (a && b.lines[a.p]) {
        blocks.push({ type: 'code', caption: SW.cite(b, a.p, a.n0, a.n1), lines: b.lines[a.p].slice(a.n0 - 1, a.n1).map(function (L) {
          var ws = b.asm && (b.asm.byLine[L.p] || [])[L.n];
          return { n: L.n, addr: ws && ws.length ? SW.oct(ws[0].loc, 4) : '', word: ws && ws.length ? SW.oct(ws[0].val) : '', text: L.raw };
        }) });
      }
      blocks = blocks.concat(N.blocks([t], b));
      var doc = { title: 'Annotation by ' + t.note.by + ', ' + SW.fmtDate(t.note.date), subtitle: citeOf(t.note),
                  meta: [['Version', b.v.label + ' ' + SW.refText(b.v.id) + ' (' + b.v.date + ')'], ['Where', a ? SW.cite(b, a.p, a.n0, a.n1) : 'the version as a whole'],
                         ['Link', SW.permalink({ v: b.v.id, l: a ? a.p + ':' + a.n0 + (a.n1 !== a.n0 ? '-' + a.n1 : '') : null })]],
                  blocks: blocks };
      SW.exportDoc(doc, 'spacewar-' + b.v.id + '-note-' + t.note.by + '-' + String(t.note.date).slice(0, 10), fmt);
    });
  }

  // Editing in place: the note's text (and tags, for a note rather than a reply).
  function inlineEdit(noteEl, note) {
    if (noteEl.querySelector('.edit-box')) return;
    var body = noteEl.querySelector('.body');
    var box = SW.el('div', { class: 'reply-box edit-box' });
    box.innerHTML = '<textarea rows="4"></textarea>' +
      (note.parent ? '' : '<input class="edit-tags" placeholder="Tags, separated by commas">') +
      '<div class="reply-foot"><span class="hint">Editing your ' + (note.parent ? 'reply' : 'annotation') + '</span>' +
      '<span><button class="btn ghost" data-r="cancel">Cancel</button> <button class="btn" data-r="save">Save</button></span></div>';
    var ta = box.querySelector('textarea'), tg = box.querySelector('.edit-tags');
    ta.value = note.text;
    SW.mdTools(ta);
    if (tg) tg.value = (note.tags || []).join(', ');
    body.hidden = true;
    body.insertAdjacentElement('afterend', box);
    ta.focus();
    function close() { box.remove(); body.hidden = false; }
    function save() {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      var tags = tg ? tg.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : null;
      box.querySelector('[data-r="save"]').disabled = true;
      N.update(note, text, tags).then(close, function (e) { box.querySelector('[data-r="save"]').disabled = false; SW.toast(e.message, 5000); });
    }
    box.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-r]');
      if (b) (b.dataset.r === 'cancel' ? close : save)();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
  }

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
    SW.mdTools(ta);
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
    SW.mdTools(SW.$('#note-text'));
    SW.$('#note-text')._mdReset();
    SW.$('#note-tags').value = (opts.tags || []).join(', ');
    SW.$('#note-who').innerHTML = me.initials
      ? 'Signed <b>' + SW.esc(me.initials) + '</b> · ' + SW.fmtDate(SW.today()) +
        (N.configured() ? ' · shared with the group' : ' · kept as a draft (no group set)')
      : '<span style="color:var(--red)">Set your initials first (⚙).</span>';
    dlg.returnValue = '';
    SW.$('.keep-hint', dlg).hidden = true;
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
      var rx = {};
      (t.reactions || []).forEach(function (r) { (rx[r.text] = rx[r.text] || []).push(r.by); });
      var rtext = Object.keys(rx).map(function (e) { return e + ' ' + rx[e].join(', '); }).join('  ');
      return { type: 'note', by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text + (rtext ? '\n[' + rtext + ']' : ''),
               anchor: t.note.anchor && b ? SW.cite(b, t.note.anchor.p, t.note.anchor.n0, t.note.anchor.n1) : (t.note.source === 'buildlog' ? 'build log' : 'annotation on the version'),
               replies: flat };
    });
  };

  // ---------- the Notes tab and the version's notes panel ----------
  // A tab at the foot of the window, there whenever the side panel is closed:
  // it reopens the notes last open, or else every note on this version.
  var binInVersionPanel = false;
  N.openPanel = function (vid) {
    return Promise.all([N.list(vid), SW.build(vid)]).then(function (r) {
      var all = r[0], b = r[1];
      var ts = N.threads(all).filter(function (t) { return t.note.source !== 'buildlog'; });
      function where(a) {
        return a ? '<div class="anchor" data-p="' + a.p + '" data-n="' + a.n0 + '">' + (b.parts.length > 1 ? 'tape ' + (a.p + 1) + ', ' : '') +
          (a.n1 !== a.n0 ? 'll. ' + a.n0 + '–' + a.n1 : 'l. ' + a.n0) + ' ' + SW.refTag(b.v.id, a.p, a.n0, a.n1, b.parts.length) + '</div>' : '<div class="anchor-none">on the version ' + SW.refTag(b.v.id) + '</div>';
      }
      var html = '<p class="hint" style="margin-top:0">Every annotation on ' + SW.esc(b.v.label) + '. Click a line reference to go to it.</p>' +
        '<p><button class="btn" data-act="vnote">✎ Annotate the version</button> ' +
        '<button class="btn' + (binInVersionPanel ? ' on' : '') + '" data-act="bin" title="Deleted annotations on this version: restore them, or delete them for good">🗑 Bin</button></p>' +
        (ts.map(function (t) { return where(t.note.anchor) + N.renderThread(t, null); }).join('') || '<p class="hint">No annotations on this version yet.</p>') +
        '<div class="panel-bin"' + (binInVersionPanel ? '' : ' hidden') + '><h4>Deleted annotations</h4><div></div></div>';
      var body = SW.drawer('Annotations', html);
      body.dataset.panel = 'version';
      body.dataset.vid = vid;
      N.wire(body, vid, all);
      var pb = body.querySelector('.panel-bin'), binBtn = body.querySelector('[data-act="bin"]');
      if (binInVersionPanel) N.showBin(pb.lastChild, { vid: vid });
      binBtn.onclick = function (e) {
        e.stopPropagation();
        binInVersionPanel = pb.hidden;
        pb.hidden = !binInVersionPanel;
        binBtn.classList.toggle('on', binInVersionPanel);
        if (binInVersionPanel) { N.showBin(pb.lastChild, { vid: vid }); pb.scrollIntoView({ block: 'nearest' }); }
      };
      body.querySelector('[data-act="vnote"]').onclick = function (e) {
        e.stopPropagation();
        N.dialog({ vid: vid, kind: 'version', anchor: null, heading: 'Annotate ' + b.v.label, anchorText: 'An annotation on the version as a whole.' });
      };
    });
  };
  // Keep the version panel current as notes change.
  SW.on('notes', function (vid) {
    var body = SW.$('#drawer-body');
    if (body && body.dataset.panel === 'version' && body.dataset.vid === vid && document.body.classList.contains('drawer-open')) N.openPanel(vid);
  });

  var tab = SW.el('button', { id: 'notes-tab', class: 'notes-tab', title: 'Annotations on this version; on Read, also how they show there' }, '▴ Annotations');
  document.body.appendChild(tab);
  tab.onclick = function () {
    // On Read the button also chooses how notes show there (inline, cards, initials).
    if (SW.state.tab === 'read' && SW.views.read && SW.views.read.notesMenu && SW.views.read.build) {
      var r = tab.getBoundingClientRect();
      SW.views.read.notesMenu(r.left, r.top - 4);
      return;
    }
    var body = SW.$('#drawer-body');
    var lastWasNotes = SW.$('#drawer-title').textContent === 'Annotations' && body && body.innerHTML &&
      (body.dataset.notes || (body.dataset.panel === 'version' && body.dataset.vid === SW.state.v));
    if (lastWasNotes) document.body.classList.add('drawer-open');
    else if (SW.state.v) N.openPanel(SW.state.v);
  };
})(this);
