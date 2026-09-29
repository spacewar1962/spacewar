/*
 * annotations.test.js - checks of the annotation system's pure parts, run in the
 * browser by annotations.html. Nothing here touches Hypothesis or settings.
 */
(function () {
  'use strict';
  var SW = window.SW, N = SW.notes, results = [], group = '';
  function eq(name, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    results.push({ name: (group ? group + ': ' : '') + name, ok: ok, got: got, want: want });
  }
  function yes(name, cond) { eq(name, !!cond, true); }
  function html(md) { var d = document.createElement('div'); d.innerHTML = SW.md(md); return d; }

  group = 'Markdown';
  eq('bold, italic, code, struck', SW.md('**b** *i* `c` ~~s~~'), '<p><b>b</b> <i>i</i> <code>c</code> <s>s</s></p>');
  eq('a line break inside a paragraph', SW.md('a\nb'), '<p>a<br>b</p>');
  eq('paragraphs', SW.md('a\n\nb'), '<p>a</p><p>b</p>');
  eq('a list under a sentence', SW.md('Intro:\n- one\n- two'), '<p>Intro:</p><ul><li>one</li><li>two</li></ul>');
  eq('numbered list', SW.md('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  eq('quotation', SW.md('> q'), '<blockquote><p>q</p></blockquote>');
  eq('code block keeps its lines', SW.md('```\nlac nx1\n\tdac ny1\n```'), '<pre class="md-pre"><code>lac nx1\n\tdac ny1</code></pre>');
  eq('heading', SW.md('# Title'), '<p><b class="md-h">Title</b></p>');
  eq('HTML is text', SW.md('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  eq('javascript: is not a link', SW.md('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
  yes('a link opens in a new tab', /target="_blank"/.test(SW.md('[F-36](https://bitsavers.org/x.pdf)')));
  yes('a bare address is a link', /<a href="https:\/\/example.com\/a_b"/.test(SW.md('see https://example.com/a_b.')));
  eq('snake_case is not italic', SW.md('snake_case_name'), '<p>snake_case_name</p>');
  eq('\\* is a plain star', SW.md('2\\*3\\*4'), '<p>2*3*4</p>');
  yes('an escaped underscore in an address is dropped', /a=ab_-cd"/.test(SW.md('https://x.org/?a=ab\\_-cd')));
  eq('a mention', SW.md('ask @DMB'), '<p>ask <span class="mention" title="A mention of DMB">@DMB</span></p>');
  eq('an email address is not a mention', SW.md('me@x.org'), '<p>me@x.org</p>');
  eq('hidden lines stay hidden', SW.md('text\n\n<!-- sw:was 2026-09-30T10:00:00Z dGV4dA== -->'), '<p>text</p>');

  group = 'Rich text to Markdown';
  ['Plain **bold** and *italic* and `lac nx1` and ~~gone~~.\nNext line.',
   'See [Graetz](https://example.com/g) and snake_case and 2\\*3\\*4.',
   'Intro:\n\n- one\n- two',
   '> quoted *text*\n> more\n\nafter',
   '```\nlac nx1\ndac ny1\n```',
   '# Heading\n\nbody\n\n1. a\n2. b',
   'see https://x.org/?a=ab_-cd here'].forEach(function (md, i) {
    var back = SW.htmlToMd(html(md));
    eq('round trip ' + (i + 1) + ' renders the same', SW.md(back), SW.md(md));
  });
  eq('an address typed as text is left whole', SW.htmlToMd(html('see https://x.org/?a=ab_-cd')), 'see https://x.org/?a=ab_-cd');
  eq('a bench link written bare stays bare', SW.htmlToMd(html('see ' + SW.BASE_URI + '?v=4.1&a=Xy')), 'see ' + SW.BASE_URI + '?v=4.1&a=Xy');
  eq('marks typed as text are escaped', SW.htmlToMd((function () { var d = document.createElement('div'); d.textContent = 'a*b*c'; return d; })()), 'a\\*b\\*c');

  group = 'Plain text';
  eq('marks out, links as text (url)', SW.mdPlain('**b** [F](https://x.org) `c`'), 'b F (https://x.org) c');
  eq('hidden lines out', SW.mdPlain('t\n\n<!-- sw:was 2026 dA== -->'), 't');

  group = 'Earlier wordings';
  var H = SW.noteHistory, fig = '\n\n<!-- sw:fig:gz H4sIAAAA -->';
  var v2 = H.compose('second', 'first', '2026-09-30T10:00:00Z');
  eq('the replaced wording is kept', H.list(v2).map(function (h) { return h.text; }), ['first']);
  eq('the visible text is the new one', H.visible(v2), 'second');
  var v3 = H.compose('third', v2 + fig, '2026-09-30T11:00:00Z');
  eq('wordings build up, oldest first', H.list(v3).map(function (h) { return h.text; }), ['first', 'second']);
  yes('a figure stays last', /<!-- sw:fig:gz H4sIAAAA -->$/.test(v3));
  eq('the figure is still found', SW.figpack.split(v3).b64, 'H4sIAAAA');
  eq('no change, no new wording', H.list(H.compose('second', v2, 'x')).length, 1);
  eq('non-ASCII survives', H.list(H.compose('b', 'Graetz’s “Spacewar!” — café', 'x'))[0].text, 'Graetz’s “Spacewar!” — café');

  group = 'Bench links';
  var u = SW.BASE_URI + '?v=4.1&l=0:120-134&a=AbC-12_x';
  eq('a bench link is read', N.parseLink(u), { v: '4.1', l: '0:120-134', a: 'AbC-12_x' });
  eq('another site is not', N.parseLink('https://example.com/?v=4.1'), null);
  eq('an escaped underscore is read through', N.parseLink(SW.BASE_URI + '?v=4.1&a=ab\\_-cd').a, 'ab_-cd');
  yes('a bench link is drawn in place, not in a new tab', /class="swlink"/.test(SW.md(u)) && !/_blank/.test(SW.md(u)));
  yes('for print, a bench link becomes its name', /^see annotation, SW4\.1L/.test(N.linksAsNames('see ' + u)));

  group = 'Ghosts';
  function keys(lines) { return lines.map(function (t) { return { k: SW.lineKey(t) }; }); }
  function indexOf(h) { var ix = {}; h.forEach(function (x, j) { if (x.k) (ix[x.k] = ix[x.k] || []).push(j); }); return ix; }
  var src = keys(['define listen', '\tcla+cli+clf 1-opr-opr', '\tszf i 1', '\tjmp .-1', '\ttyi', '\tterm', '', 'define swap', '\trcl 9s', '\trcl 9s', '\tterm']);
  var shifted = keys(['/ five lines', 'a', 'b', 'c', 'd'].concat(['define listen', '\tcla+cli+clf 1-opr-opr', '\tszf i 1', '\tjmp .-1', '\ttyi', '\tterm', '', 'define swap', '\trcl 9s', '\trcl 9s', '\tterm']));
  eq('a block moved down five lines is found there', SW.ghostMatch(src, 0, 5, shifted, indexOf(shifted)), 5);
  var edited = keys(['define listen', '\tcla+cli+clf 1-opr-opr', '\tszf i 2', '\tjmp .-1', '\ttyi', '\tterm']);
  eq('one line of six changed: still found', SW.ghostMatch(src, 0, 5, edited, indexOf(edited)), 0);
  var other = keys(['define other', 'lac a', 'dac b', 'term']);
  eq('nothing alike: no ghost', SW.ghostMatch(src, 0, 5, other, indexOf(other)), -1);
  var common = keys(['x', '\tterm', 'y', '\tterm', 'z']), one = keys(['q', '\tterm', 'r']);
  eq('a single common line with no context: no ghost', SW.ghostMatch(one, 1, 1, common, indexOf(common)), -1);
  eq('comments and spacing set aside', SW.lineKey('\tLAC  nx1   / the x'), 'lac nx1');

  group = 'Open and resolved';
  eq('none', N.statusOf([]).state, '');
  eq('🔓 opens', N.statusOf([{ text: '🔓', date: '2026-09-30T10:00' }]).state, 'open');
  eq('a later ✅ resolves', N.statusOf([{ text: '🔓', date: '2026-09-30T10:00' }, { text: '✅', date: '2026-09-30T11:00' }, { text: '👍', date: '2026-09-30T12:00' }]).state, 'resolved');
  eq('a later 🔓 opens again', N.statusOf([{ text: '✅', date: '2026-09-30T10:00' }, { text: '🔓', date: '2026-09-30T11:00' }]).state, 'open');
  eq('💡 asks for help', N.statusOf([{ text: '🔓', date: '2026-09-30T10:00' }, { text: '💡', date: '2026-09-30T11:00' }]).state, 'help');
  yes('help counts as open in filters', N.isOpen('help') && N.isOpen('open') && !N.isOpen('resolved'));
  eq('the old status marks are ignored', N.statusOf([{ text: 'status:open', date: '2026-09-30T10:00' }]).state, '');

  group = 'Mentions';
  yes('a mention of CL', N.mentions({ text: 'ask @CL here' }, 'CL'));
  yes('@CLX is not CL', !N.mentions({ text: 'ask @CLX here' }, 'CL'));
  yes('a mention in an earlier wording does not count', !N.mentions({ text: 'now\n\n' + H.was('ask @CL', 'x').trim() }, 'CL'));

  // report
  var bad = results.filter(function (r) { return !r.ok; });
  document.getElementById('sum').innerHTML = bad.length ? '<span class="bad">' + bad.length + ' of ' + results.length + ' failed</span>' : '<span class="ok">All ' + results.length + ' passed</span>';
  document.getElementById('out').innerHTML = results.map(function (r) {
    return '<li class="' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓ ' : '✗ ') + SW.esc(r.name) +
      (r.ok ? '' : '<pre>got:  ' + SW.esc(JSON.stringify(r.got)) + '\nwant: ' + SW.esc(JSON.stringify(r.want)) + '</pre>') + '</li>';
  }).join('');
  window.__results = { passed: results.length - bad.length, failed: bad.length, failures: bad };
})();
