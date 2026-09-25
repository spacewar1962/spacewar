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
      return '<div class="v' + (v.id === cur ? ' on' : '') + (v.status === 'lost' ? ' lost' : '') + '" data-v="' + SW.esc(v.id) + '" title="' + SW.esc(v.summary) + '">' +
        '<b>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</b>' + SW.esc(v.date) + '<br><span class="faint">' + SW.esc(v.fork) + ' · ' + SW.esc(v.status) + '</span></div>';
    }).join('') + '</div>';
  }

  function render(b) {
    var v = b.v, a = b.asm;
    var pad = SW.el('div', { class: 'pad' });
    var dl = [
      ['Date', v.date], ['Authors', v.authors], ['Fork', v.fork], ['Status', v.status], ['Survives as', v.medium || 'none'],
      ['Sources', b.parts.map(function (p) {
        return '<a href="../sources/' + SW.esc(p.src) + '" target="_blank" rel="noopener">' + SW.esc(p.src) + '</a>' +
          (p.role !== 'program' ? ' <span class="faint">(supplied: ' + SW.esc(p.role) + ')</span>' : '') +
          (p.title > 1 || p.end ? ' <span class="faint">lines ' + p.title + (p.end ? '–' + p.end : '–') + '</span>' : '');
      }).join('<br>') || 'none'],
      ['Scans', (v.scans || []).map(function (s) { return '<a href="../sources/' + SW.esc(s) + '" target="_blank" rel="noopener">' + SW.esc(s) + '</a>'; }).join('<br>') || 'none'],
      ['Witness tapes', (v.witnesses || []).map(SW.esc).join('<br>') || 'none'],
      ['Source tapes', (v.sourceTapes || []).map(SW.esc).join('<br>') || 'none'],
      ['Normalisations', (v.transforms || []).map(function (k) { return SW.esc(V.TRANSFORMS[k].label); }).join('<br>') || 'none'],
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
    notes(b);
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
  SW.on('notes', function (vid) { if (build && build.v.id === vid && SW.state.tab === 'about') notes(build); });
})(this);
