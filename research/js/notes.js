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
    return remote.then(function (rows) { return logs.concat(rows, local).filter(function (n) { return !N.isReaction(n); }); });
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
      d.push({ id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), vid: note.vid, kind: note.kind || 'line', anchor: note.anchor,
               quote: note.quote || '', text: note.text, by: me.initials, name: me.name,
               date: new Date().toISOString(), parent: note.parent || null, tags: note.tags || [],
               source: 'draft', hTags: tags });
      saveDrafts(d);
      N.invalidate(note.vid);
      if (!note.quiet) SW.toast('Saved as a draft in this browser (no Hypothesis group set).');
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
      if (!note.quiet) SW.toast('Note saved to the group.');
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
        if (!quiet) SW.toast('Note deleted from the group.');
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
      SW.toast('Note updated.');
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
      SW.toast('Published ' + done + ' draft note' + (done === 1 ? '' : 's') + '.');
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
    return '<span class="note-dot' + (c.draft ? ' draft' : '') + '" data-k="' + k + '" title="' + c.n + ' note' + (c.n > 1 ? 's' : '') +
      (c.replies ? ', ' + c.replies + ' repl' + (c.replies > 1 ? 'ies' : 'y') : '') + ' by ' + SW.esc(c.by.join(', ')) + (c.draft ? ' (includes drafts)' : '') + '. Click to read and reply.">' +
      SW.esc(who || '•') + (c.replies ? ' <b>+' + c.replies + '</b>' : '') + '</span>';
  };

  function myReaction(r) {
    if (r.source === 'draft') return r.by === SW.me().initials;
    return r.source === 'hypothesis' && !!N.me && r.user === N.me;
  }
  function renderReactions(n, reactions) {
    if (n.source === 'buildlog') return '';
    var by = {};
    (reactions || []).forEach(function (r) { (by[r.text] = by[r.text] || []).push(r); });
    var h = '<div class="reacts">';
    N.EMOJI.concat(Object.keys(by).filter(function (e) { return N.EMOJI.indexOf(e) < 0; })).forEach(function (e) {
      var rs = by[e];
      if (!rs) return;
      var mine = rs.some(myReaction);
      var who = rs.map(function (r) { return r.by; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      h += '<button class="react' + (mine ? ' mine' : '') + '" data-act="react" data-emoji="' + SW.esc(e) + '" title="' +
        SW.esc(who.join(', ') + (mine ? ' (click to take yours back)' : ' (click to add yours)')) + '">' + SW.esc(e) + '<small>' + SW.esc(who.join(' ')) + '</small></button>';
    });
    h += '<button class="react add" data-act="react-pick" title="Add a reaction">☺<small>+</small></button>' +
      '<span class="react-pick" hidden>' + N.EMOJI.map(function (e) { return '<button class="react" data-act="react" data-emoji="' + e + '">' + e + '</button>'; }).join('') + '</span></div>';
    return h;
  }

  N.renderNote = function (n, isReply, reactions) {
    var who = n.source === 'buildlog' ? 'build log' : (n.name || '');
    return '<div class="note' + (isReply ? ' reply' : '') + (n.source === 'buildlog' ? ' buildlog' : '') + '" data-id="' + SW.esc(n.id) + '">' +
      '<div class="by"><b>' + SW.esc(n.by) + '</b> · ' + SW.esc(SW.fmtDate(n.date)) +
      (who ? ' · ' + SW.esc(who) : '') + (n.source === 'draft' ? ' · <i>draft</i>' : '') +
      (n.updated && String(n.updated).slice(0, 16) !== String(n.date).slice(0, 16) ? ' · <i title="' + SW.esc(new Date(n.updated).toLocaleString('en-GB')) + '">edited ' + SW.esc(SW.fmtDate(n.updated)) + '</i>' : '') + '</div>' +
      '<div class="body">' + SW.esc(n.text) + '</div>' +
      (n.tags && n.tags.length ? '<div class="tagl">' + n.tags.map(SW.esc).join(' · ') + '</div>' : '') +
      renderReactions(n, reactions) +
      '<div class="acts">' + (n.source !== 'buildlog' ? '<button data-act="reply">Reply</button>' : '') +
      '<button data-act="copy" class="ico" title="Copy the note, with its citation and replies">⧉</button>' +
      '<button data-act="dl" class="ico" title="Download the note with its code and replies (Markdown)">⤓</button>' +
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
      if (!btn) return;
      var id = btn.closest('.note').dataset.id;
      var note = all.filter(function (x) { return x.id === id; })[0];
      if (!note) return;
      if (btn.dataset.act === 'edit') { inlineEdit(btn.closest('.note'), note); return; }
      if (btn.dataset.act === 'copy') { copyNote(note, all); return; }
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
          SW.toast('Moved to the bin. Restore it under Deleted notes on the Version & notes page.', 5000);
        }, function (e) { SW.toast(e.message, 5000); });
      }
    });
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
    return (v ? v.label + ' (' + v.date + ')' : note.vid) + (note.anchor ? ', ' + (note.anchor.src || '') + ', ll. ' + note.anchor.n0 + '–' + note.anchor.n1 : '');
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
      .then(function () { SW.toast('Note copied'); }, function () { window.prompt('Copy:', text); });
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
      var doc = { title: 'Note by ' + t.note.by + ', ' + SW.fmtDate(t.note.date), subtitle: citeOf(t.note),
                  meta: [['Version', b.v.label + ' (' + b.v.date + ')'], ['Where', a ? SW.cite(b, a.p, a.n0, a.n1) : 'the version as a whole'],
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
      '<div class="reply-foot"><span class="hint">Editing your ' + (note.parent ? 'reply' : 'note') + '</span>' +
      '<span><button class="btn ghost" data-r="cancel">Cancel</button> <button class="btn" data-r="save">Save</button></span></div>';
    var ta = box.querySelector('textarea'), tg = box.querySelector('.edit-tags');
    ta.value = note.text;
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
      var rx = {};
      (t.reactions || []).forEach(function (r) { (rx[r.text] = rx[r.text] || []).push(r.by); });
      var rtext = Object.keys(rx).map(function (e) { return e + ' ' + rx[e].join(', '); }).join('  ');
      return { type: 'note', by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text + (rtext ? '\n[' + rtext + ']' : ''),
               anchor: t.note.anchor && b ? SW.cite(b, t.note.anchor.p, t.note.anchor.n0, t.note.anchor.n1) : (t.note.source === 'buildlog' ? 'build log' : 'version note'),
               replies: flat };
    });
  };
})(this);
