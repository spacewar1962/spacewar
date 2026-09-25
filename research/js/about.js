/*
 * about.js - a version's metadata, provenance, build log and shared notes.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var view = SW.$('#view-about');
  var build = null;

  function timeline(cur) {
    return '<div class="timeline">' + V.VERSIONS.slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (v) {
      return '<div class="v' + (v.id === cur ? ' on' : '') + (v.status === 'lost' ? ' lost' : '') + '" data-v="' + SW.esc(v.id) + '" title="' + SW.esc(v.label + ' · ' + v.date + '\n' + v.summary) + '">' +
        '<b>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</b><span>' + SW.esc(v.date) + '</span><span class="faint">' + SW.esc(v.fork) + ' · ' + SW.esc(v.status) + '</span></div>';
    }).join('') + '</div>';
  }

  // Where the version sits in the lines of descent (versions.js).
  function descent(v) {
    var name = function (id) { var x = V.byId(id); return x ? SW.esc(x.label.replace(/^Spacewar! /, '')) : SW.esc(id); };
    if (v.witnessOf) return 'another reading of ' + name(v.witnessOf) + ', not a version of its own';
    if (!v.parent) return v.id === '1' ? 'none: the first version' : 'not placed in a line of descent';
    return name(v.parent) +
      (v.also.length ? '; also draws on ' + v.also.map(name).join(', ') : '') +
      (v.influence.length ? '; with ' + v.influence.map(name).join(', ') + ' as influence, not parent' : '') +
      ' <span class="faint">(line: ' + SW.esc(V.ancestry(v.id).map(function (id) { return V.byId(id).label.replace(/^Spacewar! /, ''); }).join(' → ')) + ')</span>';
  }

  function render(b) {
    var v = b.v, a = b.asm;
    var pad = SW.el('div', { class: 'pad' });
    var dl = [
      ['Date', v.date], ['Authors', v.authors], ['Fork', v.fork], ['Descends from', descent(v)], ['Status', v.status], ['Survives as', v.medium || 'none'],
      ['Sources', b.parts.map(function (p) {
        return '<a href="../sources/' + SW.esc(p.src) + '" target="_blank" rel="noopener">' + SW.esc(p.src) + '</a>' +
          (p.role !== 'program' ? ' <span class="faint">(supplied: ' + SW.esc(p.role) + ')</span>' : '') +
          (p.title > 1 || p.end ? ' <span class="faint">lines ' + p.title + (p.end ? '–' + p.end : '–') + '</span>' : '');
      }).join('<br>') || 'none'],
      ['Scans', (v.scans || []).map(function (s) { return '<a href="../sources/' + SW.esc(s) + '" target="_blank" rel="noopener">' + SW.esc(s) + '</a>'; }).join('<br>') || 'none'],
      ['Witness tapes', (v.witnesses || []).map(function (t) { return SW.sourceLink(t); }).join('<br>') || 'none'],
      ['Source tapes', (v.sourceTapes || []).map(function (t) { return SW.sourceLink(t); }).join('<br>') || 'none'],
      ['Normalisations', (v.transforms || []).map(function (k) { return SW.esc(V.TRANSFORMS[k].label); }).join('<br>') || 'none'],
      ['Patches to supplied tapes', b.parts.filter(function (p) { return p.patch; }).map(function (p) {
        return SW.esc(p.src) + ': ' + p.patch.map(function (x) { return '<span class="mono">' + SW.esc(x[0]) + '</span> → <span class="mono">' + SW.esc(x[1]) + '</span>'; }).join(', ');
      }).join('<br>') || 'none'],
      ['Read from source tape', b.parts.filter(function (p) { return p.tape; }).map(function (p) { return SW.sourceLink(p.src) + ' (FIO-DEC, decoded in the browser)'; }).join('<br>') || 'no'],
      ['Assembler', SW.esc(V.DIALECTS[b.dialect].label)],
      ['Machine', v.runnable ? (v.mdv ? 'PDP-1 with automatic multiply/divide (mul, div)' : 'PDP-1 without multiply/divide (mus, dis steps)') : 'not runnable'],
      ['Assembly', a ? a.words.length + ' words; ' + (a.errorCount ? a.errorCount + ' errors' : 'no errors') + '; start ' + SW.oct(a.start, 4) +
        '; constants ' + a.constants.map(function (c) { return SW.oct(c.start, 4) + ' (' + c.count + ')'; }).join(', ') +
        (a.variables ? '; variables ' + SW.oct(a.variables.start, 4) + '–' + SW.oct(a.variables.end - 1, 4) : '') +
        '; ' + a.symbols.length + ' symbols; ' + a.macros.length + ' macros' : 'none'],
      ['Tape titles', a ? a.titles.map(function (t) { return '<span class="mono">' + SW.esc(t.text.trim()) + '</span>'; }).join('<br>') : 'none'],
      ['Cite this version', SW.esc(v.label + ' (' + v.date + '). ' + (v.authors || '') + '. Spacewar! research bench, ' + SW.versionURI(v.id))]
    ];
    pad.innerHTML = '<h2 style="margin-top:0">' + SW.esc(v.label) + '</h2><p class="prose">' + SW.esc(v.summary) + '</p>' +
      '<dl class="meta">' + dl.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + (/</.test(r[1]) ? r[1] : r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<h3>The variorum</h3>' + timeline(v.id) +
      '<h3 style="margin-top:22px">Notes on this version</h3>' +
      '<p class="hint">A shared space for provenance, corrections and general discussion of the version as a whole. The build log records every correction, supplied tape and gap met in rebuilding it. Line notes are made in the Read view.</p>' +
      '<div class="toolbar" style="position:static;padding-left:0" id="ab-tools"></div><div id="ab-notes" class="hint">Loading notes…</div>';
    view.innerHTML = '';
    view.appendChild(pad);
    SW.$('.timeline', pad).addEventListener('click', function (e) {
      var t = e.target.closest('.v');
      if (t && !t.classList.contains('lost')) SW.select(t.dataset.v);
      else if (t) SW.select(t.dataset.v);
    });
    var tools = SW.$('#ab-tools', pad);
    tools.appendChild(SW.el('button', { class: 'btn', onclick: function () {
      N.dialog({ vid: v.id, kind: 'version', anchor: null, heading: 'Note on ' + v.label, anchorText: 'A note on the version as a whole (provenance, correction, discussion).' });
    } }, '✎ Add a version note'));
    tools.appendChild(SW.el('button', { class: 'btn', onclick: function () { N.publishDrafts(); } }, '⇪ Publish drafts to the group'));
    tools.appendChild(SW.el('span', { class: 'sep' }));
    tools.appendChild(SW.exportButtons(function () { return doc(b); }, 'spacewar-' + v.id + '-notes'));
    var binBox = SW.el('div', { style: 'margin-top:26px' });
    binBox.innerHTML = '<h3>Deleted notes</h3><p class="hint">Notes you delete go to the bin. It shows this version’s by default; tick “all versions” for the rest. Restore them one at a time, or delete them for good.</p>';
    var bb = SW.el('button', { class: 'btn' }, '🗑 Show the bin');
    binBox.appendChild(bb);
    pad.appendChild(binBox);
    bb.onclick = function () { bb.remove(); N.showBin(binBox.appendChild(SW.el('div')), { vid: v.id }); };
    var logBox = SW.el('div', { style: 'margin-top:26px' });
    logBox.innerHTML = '<h3>All notes, every version</h3><p class="hint">The whole discussion in one place: the group’s notes, your drafts and the build logs for every version, newest first. Search by word, initials or version.</p>';
    var lb = SW.el('button', { class: 'btn' }, 'Show the log');
    logBox.appendChild(lb);
    pad.appendChild(logBox);
    lb.onclick = function () { lb.remove(); allLog(logBox); };
    notes(b);
  }

  function allLog(box) {
    var wait = SW.el('p', { class: 'hint' }, 'Gathering notes…');
    box.appendChild(wait);
    N.listAll().then(function (all) {
      wait.remove();
      var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
      var q = SW.el('input', { type: 'search', placeholder: 'Search notes, initials, versions…' });
      tb.appendChild(q);
      var src = SW.el('select', { class: 'btn' }, '<option value="">all sources</option><option value="hypothesis">group notes</option><option value="draft">my drafts</option><option value="buildlog">build logs</option>');
      tb.appendChild(src);
      var holder = SW.el('div');
      var rowsNow = [];
      function run() {
        var t = q.value.trim().toLowerCase(), sv = src.value;
        var list = all.filter(function (n) {
          if (sv && n.source !== sv) return false;
          if (!t) return true;
          return (n.text + ' ' + n.by + ' ' + n.vid + ' ' + (n.tags || []).join(' ')).toLowerCase().indexOf(t) >= 0;
        }).sort(function (a, b2) { return String(b2.date) < String(a.date) ? -1 : 1; });
        var noteOf = new Map();
        rowsNow = list.map(function (n) {
          var v = V.byId(n.vid);
          var row = [{ html: SW.esc(SW.fmtDate(n.date)), sort: String(n.date), text: SW.fmtDate(n.date) }, n.by, v ? v.label.replace(/^Spacewar! /, '') : n.vid,
                  n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : (n.source === 'buildlog' ? 'build log' : 'version'),
                  n.parent ? '↳ reply' : '', n.text];
          noteOf.set(row, n);
          return row;
        });
        holder.innerHTML = '<p class="hint">' + list.length + ' notes</p>';
        holder.appendChild(SW.table(['Date', 'By', 'Version', 'Where', '', 'Note'], rowsNow, { cls: ['mono', 'mono', 'mono', 'mono', '', ''], onRow: function (r) {
          var n = noteOf.get(r);
          if (!n) return;
          if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
          if (n.vid !== SW.state.v) SW.select(n.vid);
          SW.setTab(n.anchor ? 'read' : 'about');
        } }));
      }
      tb.appendChild(SW.el('span', { class: 'sep' }));
      tb.appendChild(SW.exportButtons(function () {
        return { title: 'Spacewar! research notes, all versions', subtitle: 'Notes, drafts and build logs' + (q.value ? ' matching “' + q.value + '”' : ''),
                 blocks: [SW.tableBlock('Notes', ['Date', 'By', 'Version', 'Where', '', 'Note'], rowsNow)] };
      }, 'spacewar-notes-log'));
      q.addEventListener('input', run);
      src.addEventListener('change', run);
      box.appendChild(tb);
      box.appendChild(holder);
      run();
    });
  }

  function notes(b) {
    N.list(b.v.id).then(function (all) {
      if (build !== b) return;
      var ts = N.threads(all);
      var el = SW.$('#ab-notes', view);
      var ver = ts.filter(function (t) { return !t.note.anchor; }), lines = ts.filter(function (t) { return t.note.anchor; });
      el.innerHTML = (ver.length ? ver.map(function (t) { return N.renderThread(t, b); }).join('') : '<p>No version notes yet.</p>') +
        (lines.length ? '<h3>Line notes (' + lines.length + ')</h3>' + lines.map(function (t) { return N.renderThread(t, b); }).join('') : '');
      el.classList.remove('hint');
      N.wire(el, b.v.id, all);
    });
  }

  function doc(b) {
    return N.list(b.v.id).then(function (all) {
      var ts = N.threads(all);
      return { title: b.v.label + ': version notes', subtitle: b.v.summary, meta: SW.docMeta(b),
               blocks: [{ type: 'h2', text: 'Version notes and build log' }].concat(N.blocks(ts.filter(function (t) { return !t.note.anchor; }), b),
                 [{ type: 'h2', text: 'Line notes' }], N.blocks(ts.filter(function (t) { return t.note.anchor; }), b)) };
    });
  }

  SW.views.about = { show: function (b) { build = b; render(b); } };
  SW.on('notes', function (vid) {
    if (build && build.v.id === vid && SW.state.tab === 'about') notes(build);
    var open = SW.$('.bin', view);
    if (open && SW.state.tab === 'about') N.showBin(open);
  });
})(this);
