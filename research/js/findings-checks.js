/*
 * findings-checks.js - this bench's checks in Findings (bench-kit's kit/findings.js), run
 * afresh each time the Bench side is shown: the witness tapes compared word by word with
 * the builds, and the titles punched into the tapes, read.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, F = SW.findings;
  var live = { witness: null, titles: null };
  function vLabel(id) { return F.vLabel(id); }
  function go(ev) { F.go(ev); }

  function checkWitnesses(box) {
    box.innerHTML = '<p class="hint">Assembling every version with a witness tape and comparing it word by word…</p>';
    var vs = V.VERSIONS.filter(function (v) { return (v.witnesses || []).length && v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var rows = [];
    return vs.reduce(function (pr, v) {
      return pr.then(function () {
        return SW.build(v.id).then(function (b) {
          if (!b.asm) return;
          return SW.tape.witnesses(b).then(function (rs) {
            rs.forEach(function (r) {
              var same = r.differ === 0 && r.missing === 0 && r.extra === 0;
              rows.push([vLabel(v.id), { html: SW.sourceLink(r.tape, r.tape.split('/').pop()), text: r.tape, sort: r.tape },
                         r.words, r.differ, r.missing, r.extra,
                         { html: same ? '<span class="badge ok">identical</span>' : '<span class="badge">' + r.differ + ' differ</span>', text: same ? 'identical' : r.differ + ' words differ', sort: same ? 0 : 1 }, v.id]);
            });
          });
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      live.witness = rows;
      box.innerHTML = '<p class="hint">' + rows.filter(function (r) { return r[6].sort === 0; }).length + ' of ' + rows.length + ' comparisons are identical. Checked ' + SW.fmtDate(SW.today()) + '. Click a row for the word-by-word differences.</p>';
      box.appendChild(SW.table(['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        rows.map(function (r) { return r.slice(0, 7); }),
        { cls: ['', 'mono', 'num', 'num', 'num', 'num', ''], onRow: function (r) {
          var hit = rows.filter(function (x) { return x[1] === r[1] && x[0] === r[0]; })[0];
          if (hit) go({ v: hit[7], tab: 'tape' });
        } }));
    });
  }

  function checkTitles(box) {
    box.innerHTML = '<p class="hint">Reading every tape…</p>';
    var tapes = SW.tape.allTapes(), rows = [];
    return Promise.all(tapes.map(function (t) {
      return SW.fetchBytes(t.path).then(function (bytes) {
        SW.tape.titles(bytes).forEach(function (ti) {
          rows.push({ tape: t, t: ti, svg: SW.tape.titleSVG(bytes, ti) });
        });
        return bytes.length;
      }).catch(function () { return 0; });
    })).then(function () {
      live.titles = rows;
      box.innerHTML = '<p class="hint">' + tapes.length + ' tape images read; ' + rows.length + ' punched title' + (rows.length === 1 ? '' : 's') + ' found. The reading matches each five-column letter against the shapes seen on these tapes; “?” marks one not yet known.</p>';
      rows.forEach(function (r) {
        var d = SW.el('div', { class: 'tape-title' });
        d.innerHTML = '<div class="tape-title-img">' + r.svg + '</div><div><b class="mono">“' + SW.esc(r.t.text) + '”</b><br><span class="hint mono">' +
          SW.sourceLink(r.tape.path) + ', frames ' + r.t.from + '–' + r.t.to + (r.tape.versions.length ? ' · ' + r.tape.versions.map(vLabel).join(', ') : '') + '</span></div>';
        var b = SW.el('button', { class: 'btn ghost' }, 'Show on tape');
        b.onclick = function () { go({ tape: r.tape.path, from: r.t.from, v: r.tape.versions[0] }); };
        d.appendChild(b);
        box.appendChild(d);
      });
    });
  }

  F.addCheck({ title: 'Witness tapes, checked now', run: checkWitnesses, doc: function () {
      var blocks = [];
      if (!live.witness) return blocks;

      blocks.push({ type: 'h2', text: 'Witness tapes' });
      blocks.push(SW.tableBlock('Builds compared with surviving object tapes, ' + SW.fmtDate(SW.today()), ['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        live.witness.map(function (r) { return r.slice(0, 7); })));
      return blocks;
    } });
  F.addCheck({ title: 'Punched titles, read now', run: checkTitles, doc: function () {
      var blocks = [];
      if (!live.titles) return blocks;

      blocks.push({ type: 'h2', text: 'Punched titles' });
      blocks.push(SW.tableBlock('Titles punched into the tapes, as read by the bench', ['Tape', 'Frames', 'Reading', 'Versions'],
        live.titles.map(function (r) { return [r.tape.path, r.t.from + '–' + r.t.to, r.t.text, r.tape.versions.map(function (id) { var v = V.byId(id); return vLabel(id) + (v && v.build ? ' ' + SW.refText(id) : ''); }).join(', ')]; })));
      return blocks;
    } });
})(typeof window !== 'undefined' ? window : globalThis);
