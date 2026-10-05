/*
 * compare.test.js - checks of the gizmo's comparison (structure.js) on pairs whose
 * changes are known, run in the bench itself (a hidden frame). Each pair: both
 * versions built and sample-run, then compared as ⇄ Compare does.
 */
(function () {
  'use strict';
  var out = document.getElementById('out'), sum = document.getElementById('sum'), results = { passed: 0, failed: 0, failures: [] };
  function ok(name, cond, detail) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="' + (cond ? 'ok' : 'bad') + '">' + (cond ? '✓' : '✗') + '</span> ' + name.replace(/</g, '&lt;') + (cond || !detail ? '' : '<pre>' + String(detail).replace(/</g, '&lt;') + '</pre>');
    out.appendChild(li);
    if (cond) results.passed++; else { results.failed++; results.failures.push(name + (detail ? ': ' + detail : '')); }
  }
  function ready(win) {
    return new Promise(function (res) {
      (function look() { if (win.SW && win.SW.structure && win.SW.gzSample && win.SW.build) res(win.SW); else setTimeout(look, 200); })();
    });
  }
  var frame = document.getElementById('bench');
  frame.addEventListener('load', function () {
    ready(frame.contentWindow).then(function (SW) {
      var ST = SW.structure, graphs = {};
      function graph(v) {
        if (graphs[v]) return Promise.resolve(graphs[v]);
        return SW.build(v).then(function (b) { return SW.gzSample(b).then(function (d) { return (graphs[v] = ST.graph(b, d)); }); });
      }
      function pair(a, b) {
        return graph(a).then(function (GA) { return graph(b).then(function (GB) { var C = ST.compare(GA, GB); return { C: C, R: ST.compareRoutines(C), GA: GA, GB: GB }; }); });
      }
      function routine(R, name) { return R.rows.filter(function (r) { return (r.a && r.a.name === name) || (r.b && r.b.name === name); })[0]; }
      function blockPair(P, nameA) {
        var x = P.GA.blocks.filter(function (z) { return z.name === nameA; })[0];
        if (!x) return { kind: 'no such block in ' + nameA };
        var yi = P.C.mA[x.i];
        return { kind: yi == null ? 'removed' : P.C.kind[x.i], to: yi == null ? null : P.GB.blocks[yi].name };
      }
      var steps = [
        ['3.1', '4.0', function (P) {
          ['imp', 'mpy', 'idv'].forEach(function (n) { var r = routine(P.R, n); ok('3.1→4.0: ' + n + ' (software arithmetic) removed', r && r.kind === 'removed', r ? r.kind : 'not found'); });
          var a3 = routine(P.R, 'a3+16'); ok('3.1→4.0: a3+16 moved (its code in another routine in 3.1)', a3 && a3.kind === 'moved', a3 ? a3.kind : 'not found');
          var q = blockPair(P, 'sqx+8'); ok('3.1→4.0: sqx+8 altered, paired with its namesake', q.kind === 'altered' && q.to === 'sqx+8', JSON.stringify(q));
          var s15 = blockPair(P, 'sqx+15'); ok('3.1→4.0: sqx+15 the same, not paired with a lookalike', s15.kind === 'same' && s15.to === 'sqx+15', JSON.stringify(s15));
          var sq = routine(P.R, 'sqt'); ok('3.1→4.0: sqt altered (one block)', sq && sq.kind === 'altered' && sq.t.altered === 1 && !sq.t.inserted && !sq.t.removed, sq ? JSON.stringify(sq.t) : 'not found');
        }],
        ['4.3', '4.4', function (P) {
          var r = routine(P.R, '8a'); ok('4.3→4.4: 8a (the control-box decoder) removed', r && r.kind === 'removed', r ? r.kind : 'not found');
          var q = blockPair(P, 'bsg+41'); ok('4.3→4.4: bsg+41 (19 lines) paired with bsg+45 (18), by like code', q.to === 'bsg+45', JSON.stringify(q));
        }],
        ['4.1', '4.2', function (P) {
          ['1m', '2m', '3m', '4m'].forEach(function (n) { var r = routine(P.R, n); ok('4.1→4.2: ' + n + ' moved (out of bck again)', r && r.kind === 'moved', r ? r.kind : 'not found'); });
          var bk = routine(P.R, 'bck'); ok('4.1→4.2: bck’s star display counted as moved out, not altered', bk && bk.t.out > 40 && bk.t.altered < 20, bk ? JSON.stringify(bk.t) : 'not found');
          var a8 = routine(P.R, '8a'); ok('4.1→4.2: 8a (the control-box decoder) inserted', a8 && a8.kind === 'inserted', a8 ? a8.kind : 'not found');
        }],
        ['2b', '3.1', function (P) {
          ['1m', '2m', '3m', '4m'].forEach(function (n) { var r = routine(P.R, n); ok('2B→3.1: ' + n + ' moved (written into bck)', r && r.kind === 'moved', r ? r.kind : 'not found'); });
          var c = routine(P.R, 'cwr'); ok('2B→3.1: cwr inserted', c && c.kind === 'inserted', c ? c.kind : 'not found');
        }]
      ];
      return steps.reduce(function (p, st) {
        return p.then(function () { sum.textContent = 'Comparing ' + st[0] + ' with ' + st[1] + '…'; return pair(st[0], st[1]).then(st[2], function (e) { ok(st[0] + '→' + st[1] + ': built and compared', false, e && e.message); }); });
      }, Promise.resolve());
    }).then(function () {
      sum.innerHTML = results.failed ? '<span class="bad">' + results.failed + ' failed</span>, ' + results.passed + ' passed' : '<span class="ok">All ' + results.passed + ' passed</span>';
      window.__results = results;
    });
  });
})();
