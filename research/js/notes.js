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
  // a note binned or deleted this session (the group's search may not know yet)
  N.isGone = function (id) { return !!binnedNow[id] || !!deleted[id] || drafts().some(function (d) { return d.id === id && d.deleted; }); };
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
      var ch = anchor && /^(\d+)-(\d+)$/.exec(tagVal(tags, 'sw:chars:') || '');
      if (ch) { anchor.c0 = +ch[1]; anchor.c1 = +ch[2]; }
    }
    var qsel = ((a.target && a.target[0] && a.target[0].selector) || []).filter(function (x) { return x.type === 'TextQuoteSelector'; })[0];
    var by = tagVal(tags, 'sw:by:') || (a.user_info && a.user_info.display_name) ||
             String(a.user || '').replace(/^acct:|@.*$/g, '');
    return {
      id: a.id, vid: tagVal(tags, 'sw:v:'), kind: tagVal(tags, 'sw:kind:') || (anchor ? 'line' : 'version'),
      anchor: anchor, text: a.text || '', by: by, name: (a.user_info && a.user_info.display_name) || '',
      date: a.created, updated: a.updated, parent: (a.references || []).slice(-1)[0] || null,
      tags: tags.filter(function (t) { return t.indexOf('sw:') !== 0; }), source: 'hypothesis', user: a.user || '', rawTags: tags,
      binned: tags.indexOf('sw:deleted') >= 0, dev: tags.indexOf('sw:dev') >= 0, binnedAt: tagVal(tags, 'sw:deleted-at:'), from: tagVal(tags, 'sw:from:') || null,
      link: a.links && (a.links.incontext || a.links.html), quote: qsel ? qsel.exact : ''
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
  // yours, for news: by your initials where set (two people may share one Hypothesis account), else by account
  function isMine(n) { var me = SW.me(); return me.initials ? n.by === me.initials : N.mine(n); }
  N.news = function () {
    if (!N.configured()) { newsItems = []; paintNews(); return Promise.resolve([]); }
    var since = newsSince();
    return N.whoami().catch(function () {}).then(function () { return N.listAll({ reactions: true }); }).then(function (all) {
      newsAll = all;
      var me = SW.me().initials;
      var byId = {}; all.forEach(function (n) { byId[n.id] = n; });
      newsItems = all.filter(function (n) { return n.source === 'hypothesis' && (String(n.date) > since || String(n.updated || '') > since) && !isMine(n); })
        .sort(function (a, b) { return (N.mentions(b, me) - N.mentions(a, me)) || (!!toMine(b, byId) - !!toMine(a, byId)) || (String(b.date) < String(a.date) ? -1 : 1); });
      newsMine = newsItems.filter(function (n) { return toMine(n, byId); }).length;
      paintNews();
      return newsItems;
    }).catch(function () { return []; });
  };
  // a reply or reaction under an annotation or finding of one's own: what it answers
  var newsMine = 0;
  function rootOf(n, byId) { var r = n, g = 0; while (r && r.parent && byId[r.parent] && g++ < 50) r = byId[r.parent]; return r; }
  function isFinding(n) { return !n.parent && (n.tags || []).some(function (g) { return /^findings?$/i.test(g); }); }
  function toMine(n, byId) { if (!n.parent) return null; var r = rootOf(n, byId); return r && r !== n && isMine(r) ? r : null; }
  function paintNews() {
    var n = SW.$('#news-n'), btn = SW.$('#btn-news');
    if (!n || !btn) return;
    n.textContent = newsItems.length ? (newsItems.length > 99 ? '99+' : String(newsItems.length)) : '';
    btn.classList.toggle('has-news', !!newsItems.length);
    btn.classList.toggle('has-mine', !!newsMine);
    btn.title = newsItems.length ? newsItems.length + ' new in the group’s annotations since ' + SW.fmtDate(newsSince()) + (newsMine ? '; ' + newsMine + ' answer' + (newsMine === 1 ? 's' : '') + ' you' : '') : 'What’s new in the group’s annotations';
  }
  function newsLine(n, byId) {
    var V = root.SWVersions, v = V.byId(n.vid), par = n.parent && byId[n.parent];
    var what = N.isReaction(n) && (OPEN[n.text] || DONE[n.text]) ? (DONE[n.text] ? 'resolved ' : OPEN[n.text] === 'help' ? 'asked for help on ' : 'marked open ') + (par ? par.by + '’s annotation' : 'an annotation') : N.isReaction(n) ? n.text + ' on ' + (par ? par.by + '’s annotation' : 'an annotation') : n.parent ? 'reply to ' + (par ? par.by : 'an annotation') : n.anchor ? 'annotation' : 'annotation on the version';
    var toYou = !N.isReaction(n) && N.mentions(n, SW.me().initials), mine = toMine(n, byId);
    if (mine) what = (N.isReaction(n) ? n.text + ' on' : n.parent === mine.id ? 'replies to' : 'replies under') + ' your ' + (isFinding(mine) ? 'finding' : 'annotation') + ' ' + N.code(mine).replace(/^A-/, isFinding(mine) ? 'C-' : 'A-');
    var root0 = par; while (root0 && root0.parent && byId[root0.parent]) root0 = byId[root0.parent];
    var anchor = n.anchor || (root0 && root0.anchor) || (par && par.anchor);
    var where = (v ? v.label.replace(/^Spacewar! /, '') : n.vid) + ' ' + (anchor ? SW.refText(n.vid, anchor.p, anchor.n0, anchor.n1, SW.nparts(n.vid)) : SW.refText(n.vid));
    return { n: n, anchor: anchor, mine: mine, html: '<div class="news-item' + (mine ? ' news-mine' : '') + '" data-id="' + SW.esc(n.id) + '"><div class="news-meta"><b>' + SW.esc(n.by) + '</b> · ' + (toYou ? '<b class="mention-you">mentions you</b> in ' : '') + (mine ? '<b class="mention-you">' + SW.esc(what) + '</b>' : SW.esc(what)) +
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
        if (l.mine && isFinding(l.mine)) { SW.findings.openRef('C-' + N.code(l.mine).slice(2)); return; }   // a reply to one's finding: the finding, with its replies
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
      // a span within the lines: from character c0 of the first to c1 of the last
      .concat(note.anchor && note.anchor.c0 != null ? ['sw:chars:' + note.anchor.c0 + '-' + note.anchor.c1] : [])
      .concat(note.dev ? ['sw:dev'] : [])
      .concat(note.from ? ['sw:from:' + note.from] : [])   // kept from a ghost: the original's id
      .concat(note.tags || []);
    if (!N.configured()) {
      var d = drafts();
      d.push({ id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), vid: note.vid, kind: note.kind || 'line', anchor: note.anchor,
               quote: note.quote || '', text: note.text, by: by, name: me.name,
               date: new Date().toISOString(), parent: note.parent || null, tags: note.tags || [],
               source: 'draft', hTags: tags, dev: !!note.dev, from: note.from || null });
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
  // dev (true or false, or undefined to leave it): Developer only, the sw:dev tag
  N.update = function (note, text, tags, dev) {
    text = SW.noteHistory.compose(text, note.text, note.updated || note.date);   // the wording replaced is kept
    function withDev(ts) { ts = ts.filter(function (t) { return t !== 'sw:dev'; }); return dev ? ts.concat(['sw:dev']) : ts; }
    var now = new Date().toISOString();
    if (note.source === 'draft') {
      saveDrafts(drafts().map(function (d) {
        if (d.id !== note.id) return d;
        d.text = text; d.updated = now;
        if (tags) { d.tags = tags; d.hTags = (d.hTags || []).filter(function (t) { return t.indexOf('sw:') === 0; }).concat(tags); }
        if (dev !== undefined) { d.dev = !!dev; d.hTags = withDev((d.hTags || []).filter(function (t) { return t.indexOf('sw:') === 0; })).concat(d.tags || []); }
        return d;
      }));
      N.invalidate(note.vid);
      return Promise.resolve();
    }
    if (note.source !== 'hypothesis') return Promise.resolve();
    var body = { text: text };
    if (tags || dev !== undefined) {
      var sw = (note.rawTags || []).filter(function (t) { return t.indexOf('sw:') === 0; });
      body.tags = (dev !== undefined ? withDev(sw) : sw).concat(tags || note.tags || []);
    }
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
    var idMap = {}, done = 0, relinkLater = [];
    // a link to a draft names its draft id; once shared, the id Hypothesis gave it
    function relink(t) { return String(t).replace(/([?&]a=)(draft-[A-Za-z0-9-]+)/g, function (m, pre, id) { return idMap[id] ? pre + idMap[id] : m; }); }
    return ds.reduce(function (p, d) {
      return p.then(function () {
        var uri = SW.versionURI(d.vid);
        var body = { uri: uri, group: cfg().group, text: relink(d.text) + '\n\n(drafted ' + SW.fmtDate(d.date) + ')',
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
          if (/[?&]a=draft-/.test(body.text)) relinkLater.push({ id: r.id, text: body.text });   // a draft shared after this one
          saveDrafts(drafts().filter(function (x) { return x.id !== d.id; }));
        });
      });
    }, Promise.resolve()).then(function () {
      // links to the drafts just shared: in those shared before their targets, and in your notes already in the group
      return N.listAll().then(function (all) {
        var ids = Object.keys(idMap);
        all.forEach(function (n) {
          if (n.source !== 'hypothesis' || !N.mine(n) || relinkLater.some(function (x) { return x.id === n.id; })) return;
          if (ids.some(function (id) { return String(n.text).indexOf(id) >= 0; })) relinkLater.push({ id: n.id, text: n.text });
        });
        return relinkLater.reduce(function (p, x) {
          return p.then(function () { var t = relink(x.text); return t === x.text ? null : hx('PATCH', '/annotations/' + x.id, { text: t }).catch(function () {}); });
        }, Promise.resolve());
      });
    }).then(function () {
      cache = {};
      SW.emit('notes', SW.state.v);
      SW.toast('Published ' + done + ' draft annotation' + (done === 1 ? '' : 's') + (relinkLater.length ? '; links to them updated' : '') + '.');
    });
  };

  // Group notes into threads (roots with replies), in date order.
  // Reactions: an emoji left on a note, stored as a tiny reply marked
  // sw:kind:reaction, so it is shared, signed and dated like any note.
  N.EMOJI = ['👍', '👎', '✅', '🔓', '😊', '❓', '💡', '❗', '👀'];
  N.isReaction = function (n) { return n.kind === 'reaction'; };
  // Open, help wanted or resolved, from the reactions: 🔓 open, 💡 help wanted, ✅
  // resolved (anyone in the group can react; only an annotation's author can change
  // its tags); the latest of them counts. 'Open' in filters takes in help wanted.
  // (The 'status:open' / 'status:resolved' marks left by 1.16.65's buttons are ignored.)
  var OPEN = { '🔓': 'open', '💡': 'help' }, DONE = { '✅': 1 };
  N.statusOf = function (reactions) {
    var s = (reactions || []).filter(function (r) { return OPEN[r.text] || DONE[r.text]; }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }).pop();
    return s ? { state: OPEN[s.text] || 'resolved', by: s.by, date: s.date } : { state: '' };
  };
  N.isOpen = function (state) { return state === 'open' || state === 'help'; };
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
    (reactions || []).forEach(function (r) { if (!/^status:/.test(r.text)) (by[r.text] = by[r.text] || []).push(r); });
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

  // The code a note is attached to, at its head, folded until asked for: from
  // '▸ Code' in the card's corner in Read (read.js), or its own '▸ Code'
  // elsewhere; what is opened stays open while the page is open.
  var codeOpen = {};
  function codeQuote(n) {
    var shut = !codeOpen[n.id];
    return '<div class="frag-q' + (shut ? ' folded' : '') + '" data-id="' + SW.esc(n.id) + '"><button type="button" class="cf-tog cf-own" aria-expanded="' + !shut + '" title="Show or hide the code">' + (shut ? '▸' : '▾') + ' Code</button><pre>' + SW.esc(n.quote) + '</pre></div>';
  }
  N.hasCode = function (n) { return !!(n && n.anchor && n.anchor.c0 != null && n.quote && !n.parent); };
  N.codeFolded = function (id) { return !codeOpen[id]; };
  N.toggleCode = function (id) {
    codeOpen[id] = !codeOpen[id];
    var shut = !codeOpen[id];
    SW.$$('.frag-q[data-id="' + id + '"]').forEach(function (el) { el.classList.toggle('folded', shut); var t = el.querySelector('.cf-own'); if (t) { t.textContent = (shut ? '▸' : '▾') + ' Code'; t.setAttribute('aria-expanded', String(!shut)); } });
    return shut;
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.cf-own');
    if (!t) return;
    e.stopPropagation();
    N.toggleCode(t.closest('.frag-q').dataset.id);
  });
  // the chip for a status, for a finding's card too (resolved shown as well)
  N.statusChip = function (s) { return !s || !s.state ? '' : s.state === 'resolved' ? '<span class="st st-res" title="Resolved (✅ from ' + SW.esc(s.by) + ', ' + SW.esc(SW.fmtDate(s.date)) + ')">RESOLVED</span>' : statusChip(s); };
  function statusChip(s) {
    return s.state === 'help'
      ? '<span class="st st-help" title="Help wanted (💡 from ' + SW.esc(s.by) + ', ' + SW.esc(SW.fmtDate(s.date)) + '; ✅ resolves it)">HELP!</span>'
      : '<span class="st st-open" title="Open: a question still to be answered (🔓 from ' + SW.esc(s.by) + ', ' + SW.esc(SW.fmtDate(s.date)) + '; ✅ resolves it)">OPEN</span>';
  }
  // Each annotation's code: from its id, so it is the same for everyone and never changes
  // (A- for an annotation, R- for a reply; the group's findings are C-, My notes initials-N)
  N.code = function (n) {
    if (!n || !n.id || n.source === 'buildlog') return '';
    var h = 5381, id = String(n.id); for (var k = 0; k < id.length; k++) h = ((h * 33) ^ id.charCodeAt(k)) >>> 0;
    return (n.parent ? 'R-' : 'A-') + h.toString(36).toUpperCase().slice(-5).padStart(5, '0');
  };
  // A code to what it names: an annotation or reply (A-, R-), a finding of the group's (C-),
  // one of the bench's (F12), a note in My notes (initials-N3). Typed in the top bar (#), or ?code= in a link.
  N.goCode = function (code) {
    code = String(code || '').trim().toUpperCase().replace(/^\[|\]$/g, '');
    var m;
    if ((m = /^F(\d+)$/.exec(code))) { SW.findings.openBench('F' + m[1]); return; }
    if (/^[A-Z]{1,4}-N\d+$/.test(code)) { SW.tray.reveal(code); return; }
    if (/^P-[0-9A-Z]{5}$/.test(code)) { SW.paratexts.peek(code); return; }
    if (!(m = /^([ARC])-([0-9A-Z]{5})$/.exec(code))) { SW.toast('Not a code: A-, R-, C- or P- and five letters or figures, F and a number, or initials-N and a number.', 6000); return; }
    if (m[1] === 'C') { SW.findings.openRef(code); return; }
    N.listAll().then(function (all) {
      var n = all.filter(function (x) { return x.id && x.source !== 'buildlog' && N.code(x).slice(2) === m[2]; })[0];
      if (!n) { SW.toast(code + ' is not here: deleted, or not in your group.', 5000); return; }
      if (!n.parent && (n.tags || []).some(function (g) { return /^findings?$/i.test(g); })) { SW.findings.openRef('C-' + m[2]); return; }
      N.follow({ v: n.vid, a: n.id });
    });
  };
  N.renderNote = function (n, isReply, reactions) {
    var who = n.source === 'buildlog' ? 'build log' : (n.name || '');
    return '<div class="note' + (isReply ? ' reply' : '') + (n.source === 'buildlog' ? ' buildlog' : '') + '" data-id="' + SW.esc(n.id) + '">' +
      '<div class="by">' + (!isReply && N.isOpen(N.statusOf(reactions).state) ? statusChip(N.statusOf(reactions)) + ' ' : '') + (N.code(n) ? '<span class="ncode mono" data-copy="' + N.code(n) + '" title="Its code, which does not change: click to copy">' + N.code(n) + '</span> ' : '') + '<b>' + SW.esc(n.by) + '</b> · ' + SW.esc(SW.fmtDate(n.date)) +
      (who ? ' · ' + SW.esc(who) : '') + (n.source === 'draft' ? ' · <i>draft</i>' : '') + (n.dev ? ' · <span class="dev-badge" title="Developer only: hidden on the bench unless Developer mode is on (⚙)">dev</span>' : '') +
      ((n.updated && String(n.updated).slice(0, 16) !== String(n.date).slice(0, 16)) || SW.noteHistory.list(n.text).length ? ' · ' + (SW.noteHistory.list(n.text).length
        ? '<button type="button" class="hist" data-act="history" title="See the earlier wordings">edited ' + SW.esc(SW.fmtDate(n.updated || n.date)) + ' · ' + SW.noteHistory.list(n.text).length + ' earlier</button>'
        : '<i title="' + SW.esc(new Date(n.updated).toLocaleString('en-GB')) + '">edited ' + SW.esc(SW.fmtDate(n.updated)) + '</i>') : '') + '</div>' +
      '<div class="nbody">' +   // what the annotation holds, set on its own ground
      (n.anchor && n.anchor.c0 != null && n.quote && !n.parent ? codeQuote(n) : '') +
      (n.source === 'buildlog' ? '<div class="body">' + SW.esc(n.text) + '</div>' : '<div class="body note-md">' + SW.md(SW.figpack.split(n.text).text) + '</div>') +
      (n.tags && n.tags.length ? '<div class="tagl">' + n.tags.map(function (g) { return SW.esc(SW.tagLabel(g)); }).join(' · ') + '</div>' : '') +
      (N.backlinks(n.id).length ? '<div class="backl"><span class="faint">Linked from</span> ' + N.backlinks(n.id).map(function (b) {
        return '<a href="' + SW.esc(N.linkOf(b)) + '" class="swlink" title="' + SW.esc('Go to ' + N.labelOf(b)) + '">' + SW.esc(N.labelOf(b)) + '</a>';
      }).join(' · ') + '</div>' : '') +
      // one row: Reply | reactions | copy, download, edit, delete
      '</div>' +
      '<div class="acts">' + (n.source !== 'buildlog' ? '<button data-act="reply">Reply</button><span class="acts-sep"></span>' + renderReactions(n, reactions) + '<span class="acts-sep"></span>' : '') +
      '<button data-act="copy" class="ico" title="Copy the annotation as a quotation with its code and reference, ready for a book or chapter; with its replies">⧉</button>' +
      '<button data-act="dl" class="ico" title="Download the annotation as a text file: the same as Copy">⤓</button>' +
      // on the right: link, keep, edit, delete
      '<span class="acts-right">' +
      (n.source !== 'buildlog' ? '<button data-act="link" class="ico" title="Copy a link to this annotation, to paste into another (or use ↪ in the editor)' + (n.source === 'draft' ? '. A draft: the link is updated when it is shared' : '') + '">↪</button>' : '') +
      (n.source !== 'buildlog' ? '<button data-act="keep" title="Save to My notes: the annotation with its code, citation and replies, kept privately">＋ My notes</button>' : '') +
      (N.mine(n) ? '<button data-act="edit">Edit</button>' : '') +
      (N.mine(n) ? '<button data-act="delete" class="del-note">' + (n.source === 'draft' ? 'Delete draft' : 'Delete') + '</button>' : '') +
      '</span></div></div>';
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
      if (btn.dataset.act === 'keep') { keepNote(note, all); return; }
      if (btn.dataset.act === 'history') {
        var hs = SW.noteHistory.list(note.text).reverse(), r = btn.getBoundingClientRect();
        SW.pop(r.left, r.bottom + 4, '<h4>Earlier wordings</h4><div class="hist-list">' + hs.map(function (h) {
          return '<div class="hist-item"><div class="faint">Written ' + SW.esc(SW.fmtDate(h.date)) + ' ' + SW.esc(new Date(h.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + '</div><div class="note-md">' + SW.md(h.text) + '</div></div>';
        }).join('') + '</div>');
        return;
      }
      if (btn.dataset.act === 'status') {
        btn.disabled = true;
        N.create({ vid: vid, parent: note.id, kind: 'reaction', anchor: note.anchor, text: 'status:' + btn.dataset.to, tags: [], quiet: true, dev: note.dev })
          .then(function () { SW.toast(btn.dataset.to === 'resolved' ? 'Marked resolved' : 'Marked open'); }, function (err) { btn.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); });
        return;
      }
      if (btn.dataset.act === 'react-pick') {
        var pk = btn.parentNode.querySelector('.react-pick');
        pk.hidden = !pk.hidden;
        return;
      }
      if (btn.dataset.act === 'react') {
        var emoji = btn.dataset.emoji;
        var mineR = all.filter(function (x) { return N.isReaction(x) && x.parent === note.id && x.text === emoji && myReaction(x); })[0];
        btn.disabled = true;
        (mineR ? N.remove(mineR, true) : N.create({ vid: vid, parent: note.id, kind: 'reaction', anchor: note.anchor, text: emoji, tags: [], quiet: true, dev: note.dev }))
          .catch(function (err) { btn.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); });
        return;
      }
      if (btn.dataset.act === 'reply') {
        inlineReply(btn.closest('.note'), vid, note);
      } else if (btn.dataset.act === 'delete') {
        // Into the bin, so no confirmation: it can be restored.
        N.bin(note).then(function () {
          SW.toast('Moved to the bin. ↶ Undo (⌘Z) brings it back.', 5000);
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
      var re = /[?&]a=([A-Za-z0-9_-]+)/g, m, seen = {}, tx = (idx.byId[id].text || '').replace(/\\([_\-])/g, '$1');   // \_ from an editor's escaping
      while ((m = re.exec(tx))) if (m[1] !== id && !seen[m[1]]) { seen[m[1]] = 1; (back[m[1]] = back[m[1]] || []).push(id); }
    });
    idx.back = back;
    var sig = JSON.stringify(back);
    if (idx.sig !== null && sig !== idx.sig) setTimeout(function () { SW.emit('notes', SW.state.v); }, 0);
    idx.sig = sig;
    return ns;
  }
  // Developer only notes (sw:dev), and anything under one, are left out unless
  // Developer mode is on (⚙). Hypothesis's own site still shows them to the group.
  function devFilter(ns) {
    if (SW.dev()) return ns;
    var byId = {};
    ns.forEach(function (n) { byId[n.id] = n; });
    function dev(n, g) { return !!n && (n.dev || (g < 50 && !!n.parent && dev(byId[n.parent], g + 1))); }
    return ns.filter(function (n) { return !dev(n, 0); });
  }
  var list0 = N.list, listAll0 = N.listAll;
  // Your own notes marked Developer only (for the warning when the mode goes off).
  N.myDevCount = function () {
    var me = SW.me().initials;
    return listAll0().then(function (ns) { return ns.filter(function (n) { return n.dev && !n.parent && (n.source === 'draft' || (me && n.by === me)); }).length; }, function () { return 0; });
  };
  N.list = function (vid, force) { return list0(vid, force).then(function (ns) { return applyMoves(ns); }).then(devFilter).then(reindex); };
  N.listAll = function (opts) { return listAll0(opts).then(function (ns) { return applyMoves(ns); }).then(devFilter).then(reindex); };
  N.byId = function (id) { return idx.byId[id] || null; };
  // Everyone who has annotated (initials, and a name where known), for @mentions
  N.people = function () {
    var seen = {}, out = [], me = SW.me();
    if (me.initials) { seen[me.initials] = 1; out.push({ by: me.initials, name: me.name || '' }); }
    Object.keys(idx.byId).forEach(function (id) { var n = idx.byId[id]; if (n.by && !seen[n.by] && n.source !== 'buildlog') { seen[n.by] = 1; out.push({ by: n.by, name: n.name || '' }); } });
    return out.sort(function (a, b) { return a.by.localeCompare(b.by); });
  };
  N.mentions = function (n, who) { return !!who && new RegExp('(^|[\\s(>])@' + who + '\\b').test(SW.noteHistory.visible(n.text)); };
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
    var h = String(href || '').replace(/&amp;/g, '&').replace(/\\([_\-])/g, '$1');
    var ok = h.charAt(0) === '?' || [SW.BASE_URI, location.origin + location.pathname].some(function (b) {
      return h.indexOf(b) === 0 && (h.length === b.length || h.charAt(b.length) === '?');
    });
    if (!ok) return null;
    var q = {};
    (h.split('?')[1] || '').split('#')[0].split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* malformed */ } }
    });
    return q.v || q.code ? q : null;
  };
  // How SW.md draws a bench link: in place, marked ↪, a bare one named for what it points to.
  function nameOfLink(q) {
    if (q.code && !q.v) return q.code;   // a code: named by itself
    var n = q.a && idx.byId[q.a], name;
    if (n) name = N.labelOf(n);
    else if (q.l) { var m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(q.l); name = m ? SW.refOf(q.v, +m[1], +m[2], +(m[3] || m[2]), SW.nparts(q.v)) : SW.refOf(q.v); }
    else name = SW.refOf(q.v);
    return q.a && !n ? 'annotation, ' + name : name;
  }
  // A note's text with its bench links as names, for print (Copy).
  N.linksAsNames = function (text) {
    return String(text || '').replace(/\[([^\]\n]+)\]\((\S+?)\)/g, function (m, t, u) { return N.parseLink(u) ? t : m; })
      .replace(/https?:\/\/[^\s<>]+/g, function (u) {
        var tail = /[.,;:!?)]+$/.exec(u), core = tail ? u.slice(0, -tail[0].length) : u, q = N.parseLink(core);
        return q ? nameOfLink(q) + (tail ? tail[0] : '') : u;
      });
  };
  SW.internalLink = function (href, label, bare) {
    var q = N.parseLink(href);
    if (!q) return null;
    var name = nameOfLink(q);
    return '<a href="' + href + '" class="swlink"' + (bare ? ' data-bare="1"' : '') + ' title="' + SW.esc('Go to ' + name) + '">' + (bare ? SW.esc(name) : label) + '</a>';
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
    if (q.code) { N.goCode(q.code); return; }   // a code written in the text
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
      all = ns.filter(function (n) { return !N.isReaction(n) && n.source !== 'buildlog'; }).sort(function (a, b) {
        return (order[a.vid] - order[b.vid]) || ((a.anchor ? a.anchor.p * 1e5 + a.anchor.n0 : -1) - (b.anchor ? b.anchor.p * 1e5 + b.anchor.n0 : -1)) || String(a.date).localeCompare(String(b.date));
      });
      paint();
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

  // ---------- Help ▸ Joining the annotation group ----------
  // A Hypothesis account, the group, the API token, and the bench's Settings, step by
  // step; every Hypothesis page named opens in a new tab.
  // Joining: a guide that is also the form. An invitation link (join.html#ID, which the project sends
  // privately: the group's ID is its invitation, so it is never in the bench's public source) arrives
  // as ?join=ID, sets the group, and opens this.
  N.join = function (id) {
    id = N.groupId(id); if (!/^[A-Za-z0-9]{4,}$/.test(id)) return;
    var had = N.groupId(SW.store.get('group', ''));
    if (had && had !== id && !confirm('This invitation is to another annotation group (' + id + ') than the one set here (' + had + '). Use the new one?')) return;
    SW.store.set('group', id); N.forget && N.forget();
  };
  N.joinHelp = function () {
    function ext(url, text) { return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + ' ↗</a>'; }
    var esc = SW.esc, grp = N.groupId(SW.store.get('group', '')), P = SW.paratexts;
    var d = SW.el('dialog', { class: 'tray-big annohelp joinhelp' });
    function ok(t) { return '<p class="js-ok" data-ok="' + t + '"></p>'; }
    d.innerHTML = '<div class="tray-bighead"><b>Joining the annotation group</b><span class="refhelp-acts"><button class="btn ghost" data-share title="' + (grp ? 'A link that opens this guide with your group filled in, to send privately to someone joining: anyone with it can join the group' : 'A link that opens this guide, to send to someone joining') + '">' + SW.SHARE_ICON + ' Share ' + (grp ? 'an invitation' : 'this guide') + '</button><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div><div class="ah">' +
      '<p>Annotations on the bench are shared through a private group on <b>Hypothesis</b>, the open annotation service. To read and write them you need a Hypothesis account, membership of the group, and a personal key (an API token) that lets the bench write as you. About five minutes.</p>' +

      '<div class="js-steps"><section class="js-step"><div class="js-num" aria-hidden="true">1</div><div class="js-body"><h3><span class="vh">Step 1: </span>Create a Hypothesis account</h3>' +
      '<ol class="ah-steps"><li>Open ' + ext('https://hypothes.is/signup', 'hypothes.is/signup') + '.</li>' +
      '<li>Choose a username, and give your email address and a password.</li>' +
      '<li>Confirm the address from the email Hypothesis sends you.</li></ol>' +
      '<p class="hint">Already have an account? ' + ext('https://hypothes.is/login', 'Log in') + ' and go on to step 2.</p>' +

      '</div></section><section class="js-step"><div class="js-num" aria-hidden="true">2</div><div class="js-body"><h3><span class="vh">Step 2: </span>Join the group</h3>' +
      (grp ? '<p>Your invitation has set the group here. Open it while logged in to Hypothesis, and click <b>Join</b>:</p><p><a class="btn" href="https://hypothes.is/groups/' + esc(grp) + '" target="_blank" rel="noopener noreferrer">Open the group on Hypothesis ↗</a></p>'
        : '<ol class="ah-steps"><li>Ask the project leads for an invitation link if you do not have one. Opening it fills in the group here.</li>' +
          '<li>Or paste the group’s link (<span class="mono">https://hypothes.is/groups/Ab12Cd34/name</span>) into step 4, open it while logged in to Hypothesis, and click <b>Join</b>.</li></ol>') +

      '</div></section><section class="js-step"><div class="js-num" aria-hidden="true">3</div><div class="js-body"><h3><span class="vh">Step 3: </span>Get your API token</h3>' +
      '<ol class="ah-steps"><li>Open ' + ext('https://hypothes.is/account/developer', 'hypothes.is/account/developer') + ' (logged in).</li>' +
      '<li>Click <b>Generate your API token</b>, then copy the token it shows (a long string beginning <span class="mono">6879-</span>).</li></ol>' +
      '<p class="hint">The token lets the bench write annotations in your name: keep it to yourself, like a password. If it is ever seen by someone else, generate a new one on the same page; the old one stops working.</p>' +

      '</div></section><section class="js-step"><div class="js-num" aria-hidden="true">4</div><div class="js-body"><h3><span class="vh">Step 4: </span>Your details and the token, here</h3>' +
      '<div class="js-form">' +
      '<label><span>Initials</span><input data-j="initials" maxlength="4" value="' + esc(SW.store.get('initials', '')) + '" placeholder="e.g. AB" autocomplete="off"></label>' +
      '<label><span>Name</span><input data-j="name" value="' + esc(SW.store.get('name', '')) + '" autocomplete="name"></label>' +
      '<label><span>Group</span><input data-j="group" value="' + esc(grp) + '" placeholder="the group’s link, or its ID" autocomplete="off"></label>' +
      '<label><span>API token</span><span class="js-pw"><input data-j="token" type="password" value="' + esc(SW.store.get('token', '')) + '" placeholder="6879-…" autocomplete="off"><button class="btn ghost" data-show="token">Show</button></span></label>' +
      '</div><p><button class="btn" data-a="hyp">Save and test</button></p>' + ok('hyp') +
      '<p class="hint">Every annotation you write is signed with your initials. These are kept in this browser only (⚙ Settings has them too); on another computer, enter them again.</p>' +

      (P ? '</div></section><section class="js-step"><div class="js-num" aria-hidden="true">5</div><div class="js-body"><h3><span class="vh">Step 5: </span>The paratexts (if you were invited to them)</h3>' +
        '<p>The scans, clippings and documents are in a private GitHub repository. If GitHub has emailed you an invitation to the <b>spacewar1962</b> organisation, accept it, then:</p>' +
        '<ol class="ah-steps"><li><a class="btn ghost" href="' + esc(P.TOKEN_URL) + '" target="_blank" rel="noopener noreferrer">Open the token form ↗</a> (its name, owner, expiry and permission are filled in).</li>' +
        '<li>Under <b>Repository access</b>, choose <b>Only select repositories</b>, then <b>sw_paratexts</b>; then <b>Generate token</b> and copy it.</li></ol>' +
        '<div class="js-form"><label><span>GitHub token</span><span class="js-pw"><input data-j="gh" type="password" value="' + esc(SW.store.get('gh.token', '')) + '" placeholder="github_pat_…" autocomplete="off"><button class="btn ghost" data-show="gh">Show</button></span></label></div>' +
        '<p><button class="btn" data-a="gh">Save and test</button></p>' + ok('gh') : '') +

      '</div></section><section class="js-step js-then"><div class="js-num" aria-hidden="true">✓</div><div class="js-body"><h3>Then</h3><ul class="ah-steps">' +
      '<li>Annotate: select lines in Read and click <b>✎ Annotate</b>, or hover a line number and click <b>+A</b>. Help ▸ Advanced annotation covers formatting, links between annotations, searching and the rest.</li>' +
      '<li>Without a group and token, annotations are kept as drafts in this browser; once connected, share them with <b>⇪ Publish drafts to the group</b> on Versions ▸ This version.</li>' +
      '<li>Annotations in the group are seen only by its members, on the bench and on Hypothesis’s own site (' + ext('https://hypothes.is/login', 'hypothes.is') + ').</li></ul>' +
      '</div></section></div></div>';
    document.body.appendChild(d);
    d.showModal();
    function val(k) { var el = d.querySelector('[data-j="' + k + '"]'); return el ? el.value.trim() : ''; }
    function say(k, cls, t) { var el = d.querySelector('[data-ok="' + k + '"]'); el.className = 'js-ok ' + cls; el.textContent = t; }
    d.addEventListener('click', function (e) {
      var sh = e.target.closest('[data-show]');
      if (sh) { var inp = d.querySelector('[data-j="' + sh.dataset.show + '"]'), hid = inp.type === 'password'; inp.type = hid ? 'text' : 'password'; sh.textContent = hid ? 'Hide' : 'Show'; return; }
      var a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'hyp') {
        var ini = val('initials').toUpperCase();
        if (!ini) { say('hyp', 'err', 'Give your initials first.'); return; }
        SW.store.set('initials', ini); SW.store.set('name', val('name'));
        SW.store.set('group', N.groupId(val('group'))); SW.store.set('token', val('token'));
        N.forget(); if (SW.state.v) N.invalidate(SW.state.v);
        if (!val('group') || !val('token')) { say('hyp', 'warn', 'Saved. Without ' + (!val('group') ? 'the group' : 'a token') + ', annotations are kept as drafts here.'); return; }
        say('hyp', '', 'Checking…');
        N.test().then(function (r) {
          if (r.group) say('hyp', 'good', '✓ Connected as ' + r.user.replace(/^acct:|@hypothes\.is$/g, '') + ', a member of “' + r.group + '”. You can annotate.');
          else say('hyp', 'warn', 'Connected as ' + r.user.replace(/^acct:|@hypothes\.is$/g, '') + ', but not yet a member of the group: join it (step 2) with this account, then test again.');
        }, function (err) { say('hyp', 'err', err.message); });
        return;
      }
      if (a && a.dataset.a === 'gh' && P) {
        SW.store.set('gh.token', val('gh')); P.reset();
        if (!val('gh')) { say('gh', 'warn', 'No token: Paratexts will show how to get one.'); return; }
        say('gh', '', 'Checking…');
        P.test().then(function (n) { say('gh', 'good', '✓ The paratexts are open to you (' + n + ' in the catalogue).'); }, function (err) { say('gh', 'err', err.message); });
        return;
      }
      if (e.target.closest('[data-share]')) {
        var g = N.groupId(SW.store.get('group', ''));
        SW.share({ title: g ? 'Join the Spacewar! annotation group' : 'Joining the Spacewar! annotation group', text: g ? 'An invitation to read and annotate the Spacewar! source code together on the Research Bench. Keep it to the crew: anyone with the link can join.' : '', url: SW.BASE_URI + 'join.html' + (g ? '#' + g : '') });
        return;
      }
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); }
    });
    d.addEventListener('close', function () { d.remove(); });
  };

  // ---------- Help ▸ Advanced annotation ----------
  // How to format annotations and link them, with figures drawn from the
  // bench's own parts (so they follow the theme) and an editor to try.
  N.help = function () {
    var d = SW.el('dialog', { class: 'tray-big annohelp' });
    function call(n) { return '<span class="ah-call" aria-hidden="true">' + n + '</span>'; }
    function kbd(k) { return '<kbd>' + k + '</kbd>'; }
    var ex = 'https://bitsavers.org/pdf/dec/pdp1/F36_MACRO_Nov62.pdf';
    var card = '<div class="note ah-card"><div class="by"><b>AB</b> · 30 Sep 2026' + call(0) + '</div>' +
      '<div class="body note-md"><p>The gravity calculation starts here; compare ' +
      '<a class="swlink" href="#">CD, SW3.1L, 2.141–146</a>' + call(2) + ' and the <a href="#">MACRO manual</a>.</p></div>' +
      '<div class="backl"><span class="faint">Linked from</span> <a class="swlink" href="#">EF, SW4.1L, 1.120–134</a>' + call(3) + '</div>' +
      '<div class="acts"><button>Reply</button><span class="acts-sep"></span><button class="ico">⧉</button><button class="ico ah-hot">↪</button>' + call(1) + '<button class="ico">⤓</button><button>Edit</button></div></div>';
    card = card.replace(call(0), '');
    var picker = '<div class="ah-pick"><div class="tray-bighead"><b>Link to an annotation</b><span class="icon-btn">✕</span></div>' +
      '<div class="lp-bar"><input type="search" value="gravity" tabindex="-1"><select tabindex="-1"><option>All versions</option></select></div>' +
      '<div class="lp-list"><span class="lp-item"><span class="lp-where mono">CD, SW3.1L, 2.141–146</span><span class="lp-text">A note on the gravity calculation…</span></span>' +
      '<span class="lp-item on"><span class="lp-where mono">EF, SW4.1L, 1.120–134</span><span class="lp-text">The same calculation in 4.1…</span></span></div></div>';
    var diagram = '<svg class="ah-svg" viewBox="0 0 560 140" role="img" aria-label="An annotation on 4.1 links to one on 3.1; the 3.1 annotation lists it under Linked from">' +
      '<defs><marker id="ah-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah-arrhead"/></marker></defs>' +
      '<rect x="10" y="20" width="220" height="100" rx="6" class="ah-box"/><text x="24" y="44" class="ah-t ah-b">Version 4.1, lines 120–134</text>' +
      '<text x="24" y="68" class="ah-t">EF: “…compare this with</text><text x="24" y="88" class="ah-t"><tspan class="ah-l">↪ CD, SW3.1L, 2.141–146</tspan>”</text>' +
      '<rect x="330" y="20" width="220" height="100" rx="6" class="ah-box"/><text x="344" y="44" class="ah-t ah-b">Version 3.1, lines 141–146</text>' +
      '<text x="344" y="68" class="ah-t">CD: “A note on the gravity…”</text><text x="344" y="98" class="ah-t ah-f">Linked from</text><text x="344" y="114" class="ah-t ah-l">↪ EF, SW4.1L, 1.120–134</text>' +
      '<path d="M232,70 C280,70 280,62 328,62" class="ah-line" marker-end="url(#ah-arr)"/><text x="280" y="54" class="ah-t ah-s" text-anchor="middle">the link</text>' +
      '<path d="M328,110 C290,110 270,106 232,106" class="ah-line ah-dash" marker-end="url(#ah-arr)"/><text x="280" y="132" class="ah-t ah-s" text-anchor="middle">shown back</text></svg>';
    d.innerHTML = '<div class="tray-bighead"><b>Advanced annotation</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div><div class="ah">' +
      '<p>Annotations can carry formatting and links: to other sites, to lines of code, and to other annotations, in this version or any other. A link between two annotations shows at both ends.</p>' +

      '<h3>1. Writing: rich text or Markdown</h3>' +
      '<p>Every annotation editor has a toolbar. The switch at its right chooses how you write: <b>Rich text</b> shows the formatting as you type; <b>Markdown</b> shows the marks themselves, with a Preview. The bench remembers the choice. Either way the annotation is saved as Markdown, which is what Hypothesis stores, so it reads the same in Hypothesis and in exports.</p>' +
      '<figure class="ah-fig"><textarea class="ah-try" rows="4">The **sun** is placed from `nx1` and `ny1`; see [the MACRO manual](' + ex + ').</textarea>' +
      '<div class="ah-store"><span class="faint">Saved as</span> <code class="ah-md"></code></div>' +
      '<figcaption>Try it: switch between Rich text and Markdown, or format some words. Nothing here is saved.</figcaption></figure>' +
      '<table class="ov-sub ah-marks"><thead><tr><th>For</th><th>Button</th><th>Keys</th><th>In Markdown</th></tr></thead><tbody>' +
      [['Bold', '<b>B</b>', kbd('⌘B'), '**words**'], ['Italic', '<i>I</i>', kbd('⌘I'), '*words*'], ['Code', '`', '', '`lac nx1`'],
       ['Code block', '` (over several lines)', '', '``` on the lines above and below'], ['Quotation', '❝', '', '&gt; at the start of the line'],
       ['List', '•', '', '- at the start of each line'], ['Link to a site', '🔗', kbd('⌘K'), '[words](https://…)'], ['Link to an annotation', '↪', '', 'a bench link (below)']]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="mono">' + r[3] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="hint">' + kbd('⌘') + ' is ' + kbd('Ctrl') + ' on Windows and Linux. ' + kbd('⌘Enter') + ' saves; ' + kbd('Esc') + ' cancels.</p>' +

      '<h3>2. Links to other sites</h3>' +
      '<p>Select the words, click 🔗 (or ' + kbd('⌘K') + ') and give the address. Or paste an address over the selected words. A link to another site opens in a new tab.</p>' +

      '<h3>3. Linking one annotation to another</h3>' +
      '<figure class="ah-fig">' + diagram + '<figcaption>A link from an annotation on 4.1 to one on 3.1. The 3.1 annotation lists it under Linked from.</figcaption></figure>' +
      '<ol class="ah-steps"><li>In the editor, select the words to be the link, or leave the cursor where the link should go.</li>' +
      '<li>Click ↪ in the toolbar. A search opens over every annotation in the group, in every version.</li>' +
      '<li>Type words, initials or a reference to narrow it, and choose All versions or one version.</li>' +
      '<li>Click the annotation. The link goes in over the selected words, or under the annotation’s name if nothing was selected.</li></ol>' +
      '<figure class="ah-fig ah-static">' + picker + '<figcaption>The search that ↪ opens.</figcaption></figure>' +
      '<p>Or start from the annotation to be linked to: ↪ on its row of buttons copies its link. Paste it into the other annotation, over selected words or on its own. On its own it is shown by author and reference, such as <span class="mono">CD, SW3.1L, 2.141–146</span>.</p>' +
      '<figure class="ah-fig ah-static">' + card + '<figcaption>' + call(1) + ' copies a link to this annotation. ' + call(2) + ' a link to another annotation, marked ↪. ' + call(3) + ' Linked from: the annotations that link to this one.</figcaption></figure>' +

      '<h3>4. Following a link</h3>' +
      '<p>Click a link marked ↪. The bench goes to that version and those lines, opens the annotation (with its thread, if it is a reply) and flashes it. Its Linked from leads back. ' + kbd('⌘') + '-click opens it in a new tab.</p>' +
      '<p>The link is a web address for the bench, so it also works from Hypothesis, an email or a draft chapter: it opens the bench at that annotation.</p>' +

      '<h3>5. Links to lines of code</h3>' +
      '<p>Select lines in Read and click 🔗 Copy link at the foot of the window. Pasted into an annotation, the link is marked ↪ and goes to those lines.</p>' +

      '<h3>6. More</h3><ul class="ah-steps">' +
      '<li><b>Search</b>: the box at the top of the Annotations panel (▴ Annotations) searches every annotation and reply, all versions, by words, initials, tags or reference; tick Open questions only for what still needs answering.</li>' +
      '<li><b>Open and resolved</b>: react 🔓 to mark an annotation a question still to be answered (a small OPEN shows before its initials); react 💡 to ask for help (HELP!); react ✅ to mark it answered. Anyone in the group can; the latest of these counts. The chevron on Read’s Annotations heading cycles All, Mine, Open, None.</li>' +
      '<li><b>@mentions</b>: type @ and initials to mention someone; they are offered as you type. What’s new lists a mention of you first.</li>' +
      '<li><b>Earlier wordings</b>: editing an annotation keeps what it said before; <i>edited … · 2 earlier</i> on the annotation shows them, with when each was written.</li>' +
      '<li><b>Ghosts</b>: annotations made on other versions, shown faintly on the lines here whose code matches theirs (the Ghosts switch on the Annotations heading). <i>Open in …</i> goes to the original; <i>＋ Keep here</i> copies it into this version, with a link back: the copy is your own to edit or delete, and the original is not changed. While the copy stands the ghost is not shown; delete the copy and the ghost returns. The chevron at a ghost’s top left folds it away; the Ghosts switch hides them all.</li>' +
      '<li><b>Moving</b>: drag the ⠿ at a card’s bottom left onto another line, or change Lines in Edit. ↶ Undo (⌘Z) takes back a move, an edit, an addition or a deletion.</li>' +
      '<li><b>Folding</b>: the chevron at a card’s top left folds it to one line (for you, kept in this browser); ▸ Code in its corner shows the code it is attached to.</li></ul>' +
      '<h3>Good to know</h3><ul class="ah-steps">' +
      '<li>A draft can be linked to: when it is shared with the group it is given a new identifier, and links to it (in your drafts and your shared annotations) are updated then.</li>' +
      '<li>A link to an annotation that has been deleted, or is not in your group, goes to its lines and says the annotation is not there.</li>' +
      '<li>Links from other versions appear under Linked from once the group’s annotations have loaded, a moment after the bench opens.</li></ul></div>';
    document.body.appendChild(d);
    d.showModal();
    var ta = SW.$('.ah-try', d), md = SW.$('.ah-md', d);
    SW.mdTools(ta);
    function show() { md.textContent = ta.value; }
    ta.addEventListener('input', show); show();
    SW.$$('.ah-static a, .ah-static button, .ah-static input, .ah-static select', d).forEach(function (x) { x.setAttribute('tabindex', '-1'); });
    d.addEventListener('click', function (e) {
      if (e.target.closest('.ah-static')) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); }
    }, true);
    d.addEventListener('close', function () { d.remove(); });
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
  // Copy: the annotation as a quotation with its reference, ready for a book or
  // chapter: 'Code:' and the code as it stands, then “Text of the annotation”
  // (DMB, annotation on SW3.1L, 1.32–34, 30 Sep 2026); replies after.
  function refOfNote(n) { var a = n.anchor; return a ? SW.refOf(n.vid, a.p, a.n0, a.n1, SW.nparts(n.vid)) : SW.refOf(n.vid); }
  function plainOf(n) { return SW.mdPlain(N.linksAsNames(SW.figpack.split(n.text).text)).replace(/\s*\n\s*/g, ' ').trim(); }
  // the code as it stands: its lines kept, tabs as spaces (to eight-column stops) so
  // the layout survives pasting
  function codeOf(r) {
    var c = r.quote || '', b = SW.views.read && SW.views.read.build, a = r.anchor;
    if (!c && a && b && b.v.id === r.vid && b.lines[a.p]) c = b.lines[a.p].slice(a.n0 - 1, a.n1).map(function (L) { return L.raw; }).join('\n');
    return c.split('\n').slice(0, 60).map(function (l) {
      var o = '';
      for (var k = 0; k < l.length; k++) o += l[k] === '\t' ? new Array(9 - o.length % 8).join(' ') : l[k];
      return o.replace(/\s+$/, '');
    }).join('\n').replace(/^\n+|\n+$/g, '');
  }
  function copyText(note, all) {
    var t = threadOf(note, all), r = t.note, lines = [], code = codeOf(r);
    function who(n) { return n.by || n.name; }   // initials
    function one(n, what) { return '“' + plainOf(n) + '” (' + who(n) + ', ' + what + ' on ' + refOfNote(r) + ', ' + SW.fmtDate(n.date) + ')'; }
    if (code) lines.push('Code:', code);
    lines.push(one(note, note.parent ? 'reply' : 'annotation'));
    if (note.id === r.id) (function walk(rs) { rs.forEach(function (x) { lines.push('Reply: ' + one(x.note, 'reply')); walk(x.replies); }); })(t.replies);
    return lines.join('\n');
  }
  function copyNote(note, all) {
    var text = copyText(note, all);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { SW.toast('Annotation copied, with its reference'); }, function () { window.prompt('Copy:', text); });
  }
  // The annotation as a document: its code, the thread, and where it is (Download, My notes)
  function noteDoc(note, all) {
    var t = threadOf(note, all), a = t.note.anchor;
    return SW.build(t.note.vid).then(function (b) {
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
      return { doc: doc, b: b, t: t };
    });
  }
  // Download: the same text as Copy, as a plain text file
  function downloadNote(note, all) {
    var r = threadOf(note, all).note;
    root.SWExport.download('spacewar-' + r.vid + '-note-' + (note.by || 'x') + '-' + String(note.date).slice(0, 10) + '.txt', copyText(note, all) + '\n', 'text/plain;charset=utf-8');
  }
  function keepNote(note, all) {
    if (!SW.tray || !SW.tray.addDoc) return;
    noteDoc(note, all).then(function (r) {
      var n = r.t.note;
      SW.tray.addDoc(r.doc, { vid: n.vid, by: n.by, anchor: n.anchor || null, quote: n.quote || '' });   // My notes says so itself
    });
  }

  // Editing in place: the note's text (and tags, for a note rather than a reply).
  function inlineEdit(noteEl, note) {
    if (noteEl.querySelector('.edit-box')) return;
    var body = noteEl.querySelector('.body');
    var box = SW.el('div', { class: 'reply-box edit-box' });
    box.innerHTML = '<textarea rows="4"></textarea>' +
      (note.parent ? '' : '<input class="edit-tags" placeholder="Tags, separated by commas">') +
      (note.parent || !note.anchor ? '' : '<label class="edit-lines">Lines <input type="number" class="el-n0" min="1" value="' + note.anchor.n0 + '"> – <input type="number" class="el-n1" min="1" value="' + note.anchor.n1 + '"><span class="hint"> or drag the card’s ⠿ onto a line</span></label>') +
      (note.parent || !SW.dev() ? '' : '<label class="check dev-check"><input type="checkbox" class="edit-dev"' + (note.dev ? ' checked' : '') + '> Developer only</label>') +
      '<div class="reply-foot"><span class="hint">Editing your ' + (note.parent ? 'reply' : 'annotation') + '</span>' +
      '<span><button class="btn ghost" data-r="cancel">Cancel</button> <button class="btn" data-r="save">Save</button></span></div>';
    var ta = box.querySelector('textarea'), tg = box.querySelector('.edit-tags');
    ta.value = SW.noteHistory.visible(note.text);
    var was = ta.value.trim(), wasTags = tg ? null : '';
    SW.mdTools(ta);
    // the bench's own marks (level:, note:, cat:, chapter:) are kept out of the box and kept on saving
    var own = /^(level|note|cat|chapter):/;
    var marks = (note.tags || []).filter(function (g) { return own.test(g); });
    if (tg) tg.value = (note.tags || []).filter(function (g) { return !own.test(g); }).join(', ');
    if (tg) wasTags = tg.value;
    body.hidden = true;
    body.insertAdjacentElement('afterend', box);
    ta.focus();
    function close() { box.remove(); body.hidden = false; }
    function leave() { if (discardOK(ta.value.trim() !== was || (tg && tg.value !== wasTags), 'your changes')) close(); else ta.focus(); }
    function save() {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      var tags = tg ? tg.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).concat(marks) : null;
      box.querySelector('[data-r="save"]').disabled = true;
      var dv = box.querySelector('.edit-dev'), e0 = box.querySelector('.el-n0'), e1 = box.querySelector('.el-n1');
      var ln0 = e0 ? parseInt(e0.value, 10) : 0, ln1 = e1 ? parseInt(e1.value, 10) : 0;
      if (e0 && (!(ln0 >= 1) || !(ln1 >= ln0))) { SW.toast('Lines: the first must be 1 or more, the last no less than the first.', 4000); box.querySelector('[data-r="save"]').disabled = false; e0.focus(); return; }
      var move = e0 && (ln0 !== note.anchor.n0 || ln1 !== note.anchor.n1);
      N.update(note, text, tags, dv && dv.checked !== !!note.dev ? dv.checked : undefined)
        .then(function () { return move ? N.reanchor(note, { p: note.anchor.p, n0: ln0, n1: ln1 }) : null; })
        .then(close, function (e) { box.querySelector('[data-r="save"]').disabled = false; SW.toast(e.message, 5000); });
    }
    box.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-r]');
      if (b) (b.dataset.r === 'cancel' ? leave : save)();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); leave(); }
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
      N.create({ vid: vid, parent: note.id, kind: note.kind, anchor: note.anchor, text: text, tags: [], dev: note.dev })
        .then(function () { box.remove(); }, function (e) {
          box.querySelector('[data-r="save"]').disabled = false;
          if (e.message !== 'no initials') SW.toast(e.message, 5000);
        });
    }
    box.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-r]');
      if (!b) return;
      if (b.dataset.r === 'cancel') leave(); else save();
    });
    function leave() { if (discardOK(!!ta.value.trim(), 'this reply')) box.remove(); else ta.focus(); }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); leave(); }
    });
  }

  // Unsaved writing is not thrown away by a slip. Cancel, or Esc, in a box that holds new text asks
  // first; leaving the page asks too; and the note dialog's text is kept in this browser as it is
  // typed, until it is saved or discarded, so it comes back if the window closes another way.
  function discardOK(changed, what) { return !changed || confirm('Discard ' + what + '? What you have written will be lost.'); }
  window.addEventListener('beforeunload', function (e) {
    var d = SW.$('#dlg-note'), held = d && d.open && SW.$('#note-text').value.trim();
    if (!held) held = SW.$$('.reply-box textarea').some(function (t) { return t.value.trim(); });
    if (held) { e.preventDefault(); e.returnValue = ''; }
  });
  function unsavedKey(o) { var a = o.anchor; return [o.vid, o.parent || '', o.kind || '', a ? a.p + ':' + a.n0 + '-' + a.n1 : ''].join('|'); }
  // The note dialog. opts: {vid, kind, anchor, quote, parent, heading, anchorText}
  N.dialog = function (opts) {
    var dlg = SW.$('#dlg-note'), me = SW.me(), key = unsavedKey(opts), kept = SW.store.get('note.unsaved', null);
    SW.$('#note-title').textContent = opts.heading || 'Annotate';
    SW.$('#note-anchor').textContent = opts.anchorText || '';
    SW.$('#note-text').value = '';
    SW.mdTools(SW.$('#note-text'));
    SW.$('#note-text')._mdReset();
    SW.$('#note-tags').value = (opts.tags || []).join(', ');
    var devBox = SW.$('#note-dev');
    devBox.hidden = !SW.dev() || !!opts.parent;
    SW.$('input', devBox).checked = false;   // shared unless ticked, each time
    SW.$('#note-who').innerHTML = me.initials
      ? 'Signed <b>' + SW.esc(me.initials) + '</b> · ' + SW.fmtDate(SW.today()) +
        (N.configured() ? ' · shared with the group' : ' · kept as a draft (no group set)')
      : '<span style="color:var(--red)">Set your initials first (⚙).</span>';
    dlg.returnValue = '';
    var hint = SW.$('.keep-hint', dlg), ta = SW.$('#note-text'), tgs = SW.$('#note-tags');
    hint.textContent = 'Unsaved annotation. Save it, or Cancel to discard it.'; hint.hidden = true;
    if (kept && kept.key === key && kept.text) {   // what was being written here before, not saved
      ta.value = kept.text; if (kept.tags) tgs.value = kept.tags;
      hint.textContent = 'Your unsaved text from ' + kept.at + ' is back. Save it, or Cancel to discard it.'; hint.hidden = false;
    }
    function keep() { var t = ta.value.trim(); SW.store.set('note.unsaved', t ? { key: key, text: ta.value, tags: tgs.value, at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) } : null); }
    function forget() { var k0 = SW.store.get('note.unsaved', null); if (k0 && k0.key === key) SW.store.set('note.unsaved', null); }
    ta.oninput = keep; tgs.oninput = keep;
    dlg.oncancel = function (e) {   // Esc: not while it holds text
      if (!ta.value.trim()) return;
      e.preventDefault();
      dlg.classList.remove('nudge'); void dlg.offsetWidth; dlg.classList.add('nudge');
      hint.hidden = false; ta.focus();
    };
    SW.$('button[value="cancel"]', dlg).onclick = function (e) {
      if (!discardOK(!!ta.value.trim(), 'this annotation')) { e.preventDefault(); ta.focus(); return; }
      forget();
    };
    dlg.showModal();
    ta.focus();
    dlg.onclose = function () {
      if (dlg.returnValue !== 'save') return;   // closed another way, its text kept to come back
      var text = ta.value.trim();
      if (!text) { forget(); return; }
      var tags = tgs.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var dev = !devBox.hidden && SW.$('input', devBox).checked;
      N.create({ vid: opts.vid, kind: opts.kind || (opts.anchor ? 'line' : 'version'), anchor: opts.anchor,
                 quote: opts.quote, text: text, tags: tags, parent: opts.parent, dev: dev })
        .then(forget, function (e) { if (e.message !== 'no initials') SW.toast(e.message + ' Your text is kept: annotate the same lines again to get it back.', 7000); });
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
  // Search: every annotation and reply in the group, all versions, by its words
  // (Markdown taken out), initials, name, tags or reference; each term must match.
  function wireSearch(body) {
    var qIn = body.querySelector('.ann-search input'), openOnly = body.querySelector('.as-open'), out = body.querySelector('.ann-results'), here = body.querySelector('.ann-here');
    var pool = null, timer = null, order = {};
    root.SWVersions.VERSIONS.forEach(function (v, i) { order[v.id] = i; });
    function load() { return pool || (pool = N.listAll({ reactions: true })); }
    function snippet(t, terms) {
      var i = -1; terms.forEach(function (w) { var k = t.toLowerCase().indexOf(w); if (k >= 0 && (i < 0 || k < i)) i = k; });
      var s = Math.max(0, i - 50), piece = (s ? '…' : '') + t.slice(s, s + 180) + (t.length > s + 180 ? '…' : '');
      var h = SW.esc(piece);
      terms.forEach(function (w) { if (w) h = h.replace(new RegExp('(' + SW.esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
      return h;
    }
    function run() {
      var q = qIn.value.trim().toLowerCase(), only = openOnly.checked;
      if (!q && !only) { out.hidden = true; here.hidden = false; return; }
      out.hidden = false; here.hidden = true; out.innerHTML = '<p class="hint">Searching…</p>';
      load().then(function (all) {
        var threads = N.threads(all), status = {};
        (function walk(ts) { ts.forEach(function (t) { status[t.note.id] = N.statusOf(t.reactions).state; walk(t.replies); }); })(threads);
        var rootOf = {}; (function walk(ts, r) { ts.forEach(function (t) { rootOf[t.note.id] = r || t.note; walk(t.replies, r || t.note); }); })(threads, null);
        var terms = q.split(/\s+/).filter(Boolean);
        var hits = all.filter(function (n) {
          if (N.isReaction(n) || n.source === 'buildlog') return false;
          var r = rootOf[n.id] || n;
          if (only && !N.isOpen(status[r.id])) return false;
          var hay = [SW.mdPlain(N.linksAsNames(n.text)), n.by, n.name, (n.tags || []).join(' '), N.labelOf(n), SW.refOf(n.vid)].join(' ').toLowerCase();
          return terms.every(function (w) { return hay.indexOf(w) >= 0; });
        }).sort(function (x, y) { return (order[x.vid] - order[y.vid]) || ((x.anchor ? x.anchor.n0 : 0) - (y.anchor ? y.anchor.n0 : 0)) || String(x.date).localeCompare(String(y.date)); });
        out.innerHTML = '<p class="hint">' + hits.length + ' found' + (hits.length > 150 ? ', the first 150 shown' : '') + '</p>' + hits.slice(0, 150).map(function (n) {
          var r = rootOf[n.id] || n, st = status[r.id];
          return '<button type="button" class="as-hit" data-id="' + SW.esc(n.id) + '"><span class="as-where">' + SW.esc(N.labelOf(n)) + (st === 'open' ? ' <span class="st st-open">OPEN</span>' : st === 'help' ? ' <span class="st st-help">HELP!</span>' : st === 'resolved' ? ' ✅' : '') + '</span>' +
            '<span class="as-text">' + snippet(SW.mdPlain(N.linksAsNames(n.text)), terms) + '</span></button>';
        }).join('');
        out.onclick = function (e) {
          var h = e.target.closest('.as-hit'); if (!h) return;
          var n = all.filter(function (x) { return x.id === h.dataset.id; })[0]; if (!n) return;
          var a = n.anchor || (rootOf[n.id] || {}).anchor;
          N.follow({ v: n.vid, l: a ? a.p + ':' + a.n0 + (a.n1 !== a.n0 ? '-' + a.n1 : '') : '', a: n.id });
        };
      });
    }
    qIn.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 200); });
    openOnly.addEventListener('change', run);
  }
  N.openPanel = function (vid) {
    return Promise.all([N.list(vid), SW.build(vid)]).then(function (r) {
      var all = r[0], b = r[1];
      var ts = N.threads(all).filter(function (t) { return t.note.source !== 'buildlog'; });
      function where(a) {
        return a ? '<div class="anchor" data-p="' + a.p + '" data-n="' + a.n0 + '">' + (b.parts.length > 1 ? 'tape ' + (a.p + 1) + ', ' : '') +
          (a.n1 !== a.n0 ? 'll. ' + a.n0 + '–' + a.n1 : 'l. ' + a.n0) + ' ' + SW.refTag(b.v.id, a.p, a.n0, a.n1, b.parts.length) + '</div>' : '<div class="anchor-none">on the version ' + SW.refTag(b.v.id) + '</div>';
      }
      var html = '<div class="ann-search"><input type="search" placeholder="Search every annotation, all versions: words, initials, tags" spellcheck="false">' +
        '<label class="check"><input type="checkbox" class="as-open"> Open questions only</label></div><div class="ann-results" hidden></div><div class="ann-here">' +
        '<p class="hint" style="margin-top:0">Every annotation on ' + SW.esc(b.v.label) + '. Click a line reference to go to it.</p>' +
        '<p class="hint join-hint">' + (N.configured() ? 'Bringing someone in? ' : '<b>Not connected to the group:</b> your annotations are kept as drafts in this browser. ') +
        '<button type="button" class="linkbtn" data-act="join">How to join the annotation group</button></p>' +
        '<p><button class="btn" data-act="vnote">✎ Annotate the version</button> ' +
        '<button class="btn' + (binInVersionPanel ? ' on' : '') + '" data-act="bin" title="Deleted annotations on this version: restore them, or delete them for good">🗑 Bin</button></p>' +
        (ts.map(function (t) { return where(t.note.anchor) + N.renderThread(t, null); }).join('') || '<p class="hint">No annotations on this version yet.</p>') +
        '<div class="panel-bin"' + (binInVersionPanel ? '' : ' hidden') + '><h4>Deleted annotations</h4><div></div></div></div>';
      var body = SW.drawer('Annotations', html);
      wireSearch(body);
      body.querySelector('[data-act="join"]').onclick = function (e) { e.stopPropagation(); N.joinHelp(); };
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
  // ---------- moving an annotation to other lines ----------
  // Its lines (and tape) changed: dragged in Read, or set in Edit. A span within
  // the lines is dropped (the new lines are taken whole) and the quoted code is
  // the new lines'. Hypothesis is sent the new tags and quote; until its search
  // returns them, the new place is kept here.
  var moved = {};
  function sameAnchor(x, y) { return !!x && !!y && x.p === y.p && x.n0 === y.n0 && x.n1 === y.n1 && x.c0 == y.c0; }
  N.reanchor = function (note, a) {
    return SW.build(note.vid).then(function (b) {
      var lines = b.lines[a.p] || [], n0 = Math.max(1, Math.min(a.n0, lines.length)), n1 = Math.max(n0, Math.min(a.n1, lines.length));
      var an = { p: a.p, n0: n0, n1: n1, src: (b.parts[a.p] || {}).src || a.src || '' };
      if (a.c0 != null && a.n0 === n0 && a.n1 === n1) { an.c0 = a.c0; an.c1 = a.c1; }
      var quote = a.quote != null ? a.quote : lines.slice(n0 - 1, n1).map(function (L) { return L.raw; }).join('\n');
      var place = ['sw:lines:' + an.p + ':' + n0 + (n1 !== n0 ? '-' + n1 : ''), 'sw:src:' + an.src].concat(an.c0 != null ? ['sw:chars:' + an.c0 + '-' + an.c1] : []);
      function swOf(ts) { return (ts || []).filter(function (t) { return t.indexOf('sw:') === 0 && !/^sw:(lines|src|chars):/.test(t); }); }
      if (note.source === 'draft') {
        saveDrafts(drafts().map(function (d) {
          if (d.id !== note.id) return d;
          d.anchor = an; d.quote = quote; d.hTags = swOf(d.hTags).concat(place, d.tags || []);
          return d;
        }));
        N.invalidate(note.vid);
        return an;
      }
      if (note.source !== 'hypothesis') return an;
      var tags = swOf(note.rawTags).concat(place, note.tags || []);
      var uri = SW.versionURI(note.vid);
      var withTarget = { tags: tags, target: [{ source: uri, selector: [{ type: 'TextQuoteSelector', exact: quote.slice(0, 1200) }] }] };
      return hx('PATCH', '/annotations/' + note.id, withTarget).catch(function () { return hx('PATCH', '/annotations/' + note.id, { tags: tags }); }).then(function () {
        note.rawTags = tags; note.anchor = an; note.quote = quote;
        moved[note.id] = { anchor: an, quote: quote };
        N.invalidate(note.vid);
        setTimeout(function () { N.invalidate(note.vid); }, 4000);
        return an;
      });
    });
  };
  function applyMoves(ns) {
    ns.forEach(function (n) {
      var m = moved[n.id]; if (!m) return;
      if (sameAnchor(n.anchor, m.anchor)) { delete moved[n.id]; return; }
      n.anchor = m.anchor; n.quote = m.quote;
    });
    return ns;
  }

  // ---------- undo and redo ----------
  // What you did to annotations in this session, to take back: adding one,
  // editing it, deleting it (to the bin). Up to fifty steps; a new action
  // clears the redo list. Replaying an undo or redo is not itself recorded.
  var H = { undo: [], redo: [] }, replaying = false;
  function what(n) {
    var a = n.anchor;
    return (n.by || '?') + '’s ' + (n.parent ? 'reply' : 'annotation') + ' (' + (a ? (a.n1 !== a.n0 ? 'll. ' + a.n0 + '–' + a.n1 : 'l. ' + a.n0) + ', ' : '') + SW.refOf(n.vid) + ')';
  }
  function record(op) {
    if (replaying) return;
    H.undo.push(op); if (H.undo.length > 50) H.undo.shift();
    H.redo = [];
    SW.emit('notes-history');
  }
  var bin1 = N.bin, restore1 = N.restore, create1 = N.create, update1 = N.update;
  N.bin = function (note) {
    return bin1(note).then(function (r) { record({ what: 'deleting ' + what(note), undo: function () { return restore1(note); }, redo: function () { return bin1(note); } }); return r; });
  };
  N.create = function (note) {
    return create1(note).then(function (n) {
      if (n && note.kind !== 'reaction') record({ what: 'adding ' + what(n), undo: function () { return bin1(n); }, redo: function () { return restore1(n); } });
      return n;
    });
  };
  var reanchor1 = N.reanchor;
  N.reanchor = function (note, a) {
    var was = note.anchor ? Object.assign({ quote: note.quote }, note.anchor) : null;
    return reanchor1(note, a).then(function (an) {
      if (was) record({ what: 'moving ' + what(Object.assign({}, note, { anchor: was })) + ' to ' + (an.n1 !== an.n0 ? 'll. ' + an.n0 + '–' + an.n1 : 'l. ' + an.n0),
                        undo: function () { return reanchor1(note, was); }, redo: function () { return reanchor1(note, an); } });
      return an;
    });
  };
  N.update = function (note, text, tags, dev) {
    var before = { text: note.text, tags: (note.tags || []).slice(), dev: !!note.dev };
    var after = { text: text, tags: tags || before.tags, dev: dev === undefined ? before.dev : !!dev };
    if (after.text === before.text && after.dev === before.dev && after.tags.join('\u0001') === before.tags.join('\u0001')) return Promise.resolve();   // nothing changed
    return update1(note, text, tags, dev).then(function (r) {
      record({ what: 'editing ' + what(note),
               undo: function () { return update1(note, before.text, before.tags, before.dev); },
               redo: function () { return update1(note, after.text, after.tags, after.dev); } });
      return r;
    });
  };
  function step(from, to, word) {
    var op = from.pop();
    if (!op) { SW.toast('Nothing to ' + word.toLowerCase()); return Promise.resolve(); }
    replaying = true;
    SW.emit('notes-history');
    return op[word === 'Undo' ? 'undo' : 'redo']().then(function () {
      to.push(op); SW.toast((word === 'Undo' ? 'Undone: ' : 'Redone: ') + op.what);
    }, function (e) { from.push(op); SW.toast(e.message, 5000); }).then(function () { replaying = false; SW.emit('notes-history'); });
  }
  N.undo = function () { return step(H.undo, H.redo, 'Undo'); };
  N.redo = function () { return step(H.redo, H.undo, 'Redo'); };
  N.history = function () {
    return { undo: H.undo.length ? H.undo[H.undo.length - 1].what : '', redo: H.redo.length ? H.redo[H.redo.length - 1].what : '', busy: replaying };
  };
  // ⌘Z and ⇧⌘Z (Ctrl on Windows), when not typing
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open]')) return;
    var h = N.history();
    if (e.shiftKey ? !h.redo : !h.undo) return;
    e.preventDefault();
    (e.shiftKey ? N.redo : N.undo)();
  });

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
