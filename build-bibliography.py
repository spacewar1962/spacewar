#!/usr/bin/env python3
"""Generate bibliography.html from bibliography.source.md, in the site's style.

Usage:  python3 build-bibliography.py
Edit bibliography.source.md, then run this to regenerate bibliography.html.
References are verified against the project's Zotero library before being added.
"""
import re, html, os

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'bibliography.source.md'), encoding='utf-8').read().splitlines()

def fmt(line):
    s = html.escape(line, quote=False)
    s = re.sub(r'\*(.+?)\*', r'<i>\1</i>', s)
    def link(m):
        url = m.group(0); tail = ''
        while url and url[-1] in '.,':
            tail = url[-1] + tail; url = url[:-1]
        return f'<a href="{url}">{url}</a>{tail}'
    return re.sub(r'https?://[^\s)]+', link, s)

refs, online, mode = [], [], 'refs'
for ln in src:
    t = ln.strip()
    if not t or t.startswith('# ') or t.startswith('**For use') or t == '---':
        continue
    if t.startswith('## Online'):
        mode = 'online'; continue
    (refs if mode == 'refs' else online).append(fmt(t))

refs_html = '\n'.join(f'      <p class="ref">{r}</p>' for r in refs)
online_html = '\n'.join(f'      <p class="ref">{r}</p>' for r in online)

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bibliography — Spacewar! Critical Code Studies</title>
  <meta name="description" content="Critical Code Studies bibliography for the Spacewar! reading.">
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <meta property="og:title" content="Bibliography — Spacewar! Critical Code Studies">
  <meta property="og:description" content="Critical Code Studies bibliography for the Spacewar! reading.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://spacewar1962.github.io/spacewar/bibliography.html">
  <meta property="og:image" content="https://spacewar1962.github.io/spacewar/assets/og-card.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://spacewar1962.github.io/spacewar/assets/og-card.png">
  <link rel="stylesheet" href="assets/css/site.css">
</head>
<body>

  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="./" aria-label="Spacewar! home">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4 L23 27 L16 22 L9 27 Z" fill="none" stroke="#6cf2ff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="16" r="1.4" fill="#ffce7a"/></svg>
        <span class="brand-block">
          <span class="brand-text">SPACEWAR!</span>
          <span class="brand-tagline">Critical Code Studies · PDP-1 · 1962</span>
        </span>
      </a>
      <nav class="site-nav">
        <a href="./#ccs">CCS</a>
        <a href="./#history">History</a>
        <a href="./#object">Object</a>
        <a href="./#reading">Reading</a>
        <a href="play.html">Play</a>
        <a href="./#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="wrap content">
    <section class="block">
      <span class="kicker">Reference</span>
      <h2>Bibliography</h2>
      <p>The working bibliography for the Critical Code Studies programme, shared with the <a href="https://github.com/dmberry/CCS-WB">CCS Workbench</a>. References enter project drafts only after verification against Zotero.</p>
    </section>

    <div class="rule"><span>works cited</span></div>

    <section class="block bib">
{refs_html}
    </section>

    <div class="rule"><span>online resources</span></div>

    <section class="block bib">
{online_html}
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p class="micro">A Critical Code Studies project initiated by David M. Berry and Mark C. Marino.</p>
      <p class="micro">Source: github.com/spacewar1962 · Bibliography from <a href="https://github.com/dmberry/CCS-WB">CCS-WB</a> · <a href="https://github.com/spacewar1962/spacewar/releases">v1.1</a></p>
    </div>
  </footer>

</body>
</html>
'''
open(os.path.join(HERE, 'bibliography.html'), 'w', encoding='utf-8').write(page)
print('wrote bibliography.html with', len(refs), 'refs and', len(online), 'online resources')
