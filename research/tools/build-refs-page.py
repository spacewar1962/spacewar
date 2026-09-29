#!/usr/bin/env python3
"""build-refs-page.py - writes the public 'Citing the source code' section of
code.html (between <!-- references:start --> and <!-- references:end -->) and
the Reference column of its version table, from the list below and the SWHIDs
git gives for each file under sources/. Nothing on the public page points to the
research folder. Run from the repository root: python3 research/tools/build-refs-page.py
Keep VERSIONS and PORTS in step with js/versions.js and SW.REF / SW.PORTS in js/core.js."""
import subprocess, html, re, sys

GH = 'https://github.com/spacewar1962/spacewar/blob/main/sources/'
def esc(s): return html.escape(s, quote=True)
def blob(path):
    out = subprocess.run(['git', 'ls-files', '-s', 'sources/' + path], capture_output=True, text=True).stdout.split()
    return out[1] if len(out) > 1 else None

# [reference, version, authors, version dated, this text, files under sources/]
VERSIONS = [
 ['SW1R', 'Spacewar! 1', 'Russell, with the Hingham Institute group', '1961 / early 1962', 'reconstructed by Norbert Landsteiner, April 2016 (revised 2021); not an authentic program', ['spacewar-1-1962-reconstructed.txt']],
 ['SWEPL', 'Expensive Planetarium', 'Peter Samson ("prs")', '13 Mar 1962', 'source listing', ['spacewar-2b-stars-prs-13mar1962.txt']],
 ['SW2B-preL', 'Spacewar! 2B (25 March listing)', 'Russell, Samson, Graetz, et al.', '25 Mar 1962', 'a transcription of the 25 March 1962 listing (masswerk, 2014)', ['spacewar-2b-25mar1962.txt']],
 ['SW2BR', 'Spacewar! 2B', 'Russell, Samson, Graetz, et al.', '2 Apr 1962', 'reconstructed from the disassembled binary by Norbert Landsteiner, 2014', ['spacewar-2b-2apr1962.txt']],
 ['SW3.1L', 'Spacewar! 3.1', 'Russell', '24 Sep 1962', 'a text from bitsavers (SteveRussell_box1/_text), as compiled by masswerk', ['spacewar-3.1-24sep1962.txt']],
 ['SW3.1T', 'Spacewar! 3.1 (source tapes)', 'Russell', '24 Sep 1962; tapes 29 Sep 1962', 'read by the project from Russell’s source tapes of 29 September 1962', ['SteveRussell_box1/spacewar3.1pt1_29sep62.bin', 'SteveRussell_box1/spacewar3.1pt2_29sep62.bin', 'SteveRussell_box1/spacewar3.1pt3_29sep62.bin']],
 ['SW4.0L', 'Spacewar! 4.0', 'Monty Preonas ("ddp")', '2 Feb 1963', 'source listing', ['spacewar-4.0-2feb1963-(Morris).txt']],
 ['SW4.1L', 'Spacewar! 4.1 / 4.2a (dfw)', '"dfw"', '20 / 22 Feb 1963', 'listing and tape', ['spacewar-4.1-4.2a-feb1963-dfw-(Russell).txt']],
 ['SW4.1T', 'Spacewar! 4.1 / 4.2a (dfw, source tape)', '"dfw"', '20 / 22 Feb 1963', 'read by the project from the dfw source tape', ['SteveRussell_box1/spacewar4.1pt1and2.bin']],
 ['SW4.0TSL', 'Spacewar! 4.0TS', 'Monty Preonas ("ddp")', '4 May 1963', 'source listing', ['spacewar-4.0ts-4may1963.txt']],
 ['SW4.2L', 'Spacewar! 4.2 (ddp)', 'Monty Preonas ("ddp")', '11 May 1963', 'source listing', ['spacewar-4.2-11may1963-(Morris).txt']],
 ['SW4.3L', 'Spacewar! 4.3 (ddp, Morris listing)', 'Monty Preonas ("ddp")', '17 May 1963', 'source listing', ['spacewar-4.3-17may1963-(Morris).txt']],
 ['SW4.3M', 'Spacewar! 4.3f (masswerk, fixed)', 'Monty Preonas ("ddp"); fixed by Landsteiner', '17 May 1963; fixed 28 Feb 2015', 'fixed by Norbert Landsteiner, 28 February 2015; not an authentic program', ['spacewar-4.3-17may1963.txt']],
 ['SW4.4L', 'Spacewar! 4.4 (ddp, Morris listing)', 'Monty Preonas ("ddp") &amp; Joe Morris', '17 / 21 May 1963', 'source listing', ['spacewar-4.4-21may1963-(Morris).txt']],
 ['SW4.4M', 'Spacewar! 4.4 (masswerk)', 'Preonas &amp; Morris; reassembled by Landsteiner', '21 May 1963', 'reassembled by Norbert Landsteiner', ['spacewar-4.4-21may1963.txt']],
 ['SW4.4Mf', 'Spacewar! 4.4f (masswerk, fixed)', 'Preonas &amp; Morris; fixed by Landsteiner', '21 May 1963; fixed 12 May 2015', 'fixed by Norbert Landsteiner, 2015', ['spacewar-4.4f-21may1963.txt']],
 ['SW4.8L', 'Spacewar! 4.8', '"dfw"; scorer by Samson', '24 Jul 1963', 'source listing', ['spacewar-4.8-pt1-24jul1963.txt', 'spacewar-4.8-pt2-24jul1963.txt', 'spacewar-4.8-scorer-24jul1963.txt']],
 ['SW4.1Md', 'Spacewar! 4.1 CHM rev. d', '"dfw"; reconstructed by Peter Samson', 'base 20 Feb 1963; mod. Jun 2005', 'reconstructed by Peter Samson, June 2005', ['spacewar-4.1-chm-2005d.txt']],
 ['SW4.1Mf', 'Spacewar! 4.1f (CHM)', '"dfw"; reconstructed by Peter Samson', 'base 20 Feb 1963; mod. 2005 to 2008', 'reconstructed by Peter Samson, 2005 to 2008', ['spacewar-4.1-chm-2008f.txt']],
 ['SW2015M', 'Spacewar! 2015', 'Norbert Landsteiner', '2015', 'written by Norbert Landsteiner, 2015', ['spacewar-2015-landsteiner.txt']],
]
# [reference, program, machine, where and by whom, date, files under sources/]
PORTS = [
 ['SWP-PDP4-SPACEWAR63', 'Spacewar', 'PDP-4', 'University of Michigan', '1963', []],
 ['SWP-DDP224-SPACEWAR64', 'Spacewar', 'DDP-224', 'University of Michigan', '1964', []],
 ['SWP-PDP6-SPACEWAR64', 'Spacewar', 'PDP-6', 'Stanford (Steve Russell)', '1964', []],
 ['SWP-S360-SPACEWAR65', 'Spacewar', 'IBM System/360-65', 'MIT Computation Center (Edson Hendricks)', '1965', []],
 ['SWP-PDP7-SPACEWAR65', 'Spacewar', 'PDP-7', 'University of Pittsburgh (Russell Randshaw)', '1965', []],
 ['SWP-CDC3100-SPACEWAR66R', 'Spacewar, reconstructed', 'CDC 3100', 'University of Minnesota (A. W. Kuhfeld); reconstruction by Norbert Landsteiner, 2014', '1966–69', ['reference/minnesota-spacewar-landsteiner-2014.js']],
 ['SWP-PDP8-SPACEWAR71', 'Space War', 'LAB-8 (PDP-8)', 'Evan Suits (DECUS)', '1965–68; listing 1971', ['ports/spacewar-pdp8-labx8-suits-1971.txt']],
 ['SWP-PDP10-SW71', 'Space War (SW; part 1 SW.MAC, part 2 SHIPS.SAI)', 'PDP-10', 'Stanford AI Lab: Steve Russell, 1967; Ralph E. Gorin’s version with R. Taylor', '1971–72', ['ports/spacewar-pdp10-sail-gorin-1971.txt', 'ports/spacewar-pdp10-sail-gorin-1971-ships.txt']],
 ['SWP-PDP6-WAR44', 'WAR 44', 'PDP-6', 'MIT (Samson’s DECtape)', 'c. 1968', ['ports/spacewar-pdp6-mit-war44-1968.txt']],
 ['SWP-PDP7-DUEL68', 'Duel', 'PDP-7', 'Cambridge Univ. Maths Lab (M. S. Peterson, J. C. Viner; DECUS 7-40)', 'June 1968', []],
 ['SWP-LINC8-SPCWAR68', 'SPCWAR', 'LINC-8', 'University of Pennsylvania (E. Duffin; DECUS L-39)', '12 Aug 1968', []],
 ['SWP-NOVA-SPACEWAR68', 'Spacewar', 'Data General NOVA', 'Fall Joint Computer Conference', '1968', []],
 ['SWP-PLATO-SPACEWAR69', 'Spacewar', 'PLATO / ILLIAC', 'University of Illinois (Richard W. Blomme)', '1969', []],
 ['SWP-IBM1620-SPACEWAR69', 'Spacewar', 'IBM 1620', 'Jim Burroughs', 'c. 1969', []],
 ['SWP-PDS1-SPACEWAR70', 'Spacewar', 'Imlac PDS-1', '', '1970', []],
 ['SWP-GT40-SPCWAR73', 'SPCWAR', 'GT40 (PDP-11)', 'Stanford AI Lab (Botond G. Eross)', '1973', ['ports/spacewar-gt40-pdp11-stanford-eross-1973.txt']],
 ['SWP-GT40-DECUS11-192', 'SPCWAR (DECUS 11-192)', 'GT40 (PDP-11)', 'Larry Bryant and Bill Seiler', '1974', ['ports/spacewar-gt40-pdp11-bryant-seiler-1974.pdf']],
 ['SWP-PDP12-SPCWAR3', 'SPCWAR, version 3', 'LINC-8 / PDP-12', 'Georgia Tech (D. E. Wrege)', '1974', ['ports/spacewar-linc8-pdp12-gtech-wrege-1974.txt']],
 ['SWP-ITS-SPCWAR76', 'SPCWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', ['ports/spacewar-pdp6-10-mit-its-spcwar.txt']],
 ['SWP-ITS-NEWWAR76', 'NEWWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', ['ports/spacewar-pdp6-10-mit-its-newwar.txt']],
 ['SWP-ITS-TVWAR', 'TVWAR', 'Knight TV, ITS', 'MIT AI Lab', '', ['ports/spacewar-knighttv-mit-its-tvwar.txt']],
 ['SWP-GT40-MIT76', 'Spacewar (object tape)', 'GT40 (PDP-11)', 'MIT AI Lab (Richard C. Waters, Meyer A. Billmers)', 'c. 1976', ['ports/spacewar-gt40-pdp11-1976.pt']],
]
# the version table's rows (by the Version cell) and the references of the texts held for each
ROWREFS = {'1': ['SW1R'], '2A': [], '2B': ['SW2BR', 'SW2B-preL'], '3.1': ['SW3.1L', 'SW3.1T'], '4.0': ['SW4.0L'], '4.0TS': ['SW4.0TSL'],
           '4.2': ['SW4.2L'], '4.3': ['SW4.3L', 'SW4.3M'], '4.4': ['SW4.4L', 'SW4.4M', 'SW4.4Mf'], '4.1': ['SW4.1L', 'SW4.1T'],
           '4.2a': ['SW4.1L', 'SW4.1T'], '4.5 / 4.6 / 4.7': [], '4.8': ['SW4.8L'], '4.1f': ['SW4.1Mf', 'SW4.1Md']}

def link(f, text):
    url = (GH + f) if not f.endswith(('.txt', '.pdf')) else 'sources/' + f   # binary tapes open on GitHub (size, history); text in the browser
    return '<a target="_blank" rel="noopener noreferrer" href="' + esc(url) + '" title="' + esc(f.split('/')[-1]) + '">' + text + '</a>'
def swhids(files):
    out = []
    for f in files:
        h = blob(f)
        if h: out.append('<span class="swhid" data-copy="swh:1:cnt:' + h + '" title="' + esc(f.split('/')[-1]) + ': swh:1:cnt:' + h + ' (click to copy)">' + h[:7] + '</span>')
    return ' '.join(out)
def chip(r): return '<span class="refchip" data-copy="[REF: ' + r + ']" title="Click to copy [REF: ' + r + ']">' + r + '</span>'

rows = ''.join('<tr><td class="num">' + str(i + 1) + '</td><td>' + chip(v[0]) + '</td><td>' +
               ' '.join(link(f, esc(v[1]) if k == 0 else 'part ' + str(k + 1)) for k, f in enumerate(v[5])) + '</td><td>' + v[2] + '</td><td>' + esc(v[3]) + '</td><td>' + esc(v[4]) + '</td><td>' + swhids(v[5]) + '</td></tr>'
               for i, v in enumerate(VERSIONS))
prow = ''.join('<tr><td class="num">' + str(i + 1) + '</td><td>' + chip(p[0]) + '</td><td>' +
               (' '.join(link(f, esc(p[1]) if k == 0 else 'part ' + str(k + 1)) for k, f in enumerate(p[5])) if p[5] else esc(p[1]) + ' <span class="faint">no text held</span>') +
               '</td><td>' + esc(p[2]) + '</td><td>' + esc(p[3]) + '</td><td>' + esc(p[4]) + '</td><td>' + swhids(p[5]) + '</td></tr>'
               for i, p in enumerate(PORTS))

SECTION = '''<!-- references:start (generated; edit the generator, not this) -->
    <div class="rule"><span>citing the code</span></div>

    <section class="block" id="referencing">
      <span class="kicker">Referencing</span>
      <h2>Citing the source code</h2>
      <p>Because <i>Spacewar!</i> survives as many texts rather than one, a reading needs to say which text, and where in it. The project names each surviving text in one form, used in its citations and in the Reference column above:</p>
      <p class="refex">[REF: SW3.1T, 2.141–146]</p>
      <p><b>SW</b>, then the version (<b>3.1</b>), then a letter for the <i>witness</i>, the particular surviving text of that version (<b>T</b>); then the tape (<b>2</b>, in the order the assembler read the tapes) and the lines (<b>141–146</b>).</p>
      <div class="vtable-wrap"><table class="vtable reftable-letters">
        <thead><tr><th>Letter</th><th>The witness</th></tr></thead>
        <tbody>
          <tr><td class="mono">T</td><td>machine-read from the punched source tape</td></tr>
          <tr><td class="mono">L</td><td>a transcription: typed text of a listing or a tape</td></tr>
          <tr><td class="mono">M</td><td>a modern reassembly or edited source</td></tr>
          <tr><td class="mono">R</td><td>a reconstruction</td></tr>
          <tr><td class="mono">B</td><td>an object tape (binary), cited by address only</td></tr>
        </tbody>
      </table></div>
      <p>Shorter forms: the version and witness alone, <span class="mono">[REF: SW3.1T]</span>; a whole tape, <span class="mono">[REF: SW3.1T, 2]</span>. The tape is left out when a text has only one: <span class="mono">[REF: SW4.3M, 141]</span>. By core address, <span class="mono">[REF: SW3.1L, @0402–0407]</span>: an address holds across texts of a version that assemble to the same words, and is the only way to cite an object tape. Two texts of one version with the same letter take a lower-case qualifier: <span class="mono">SW4.4Mf</span>. A newly found text takes its version and the next letter or qualifier; a new version, its own number.</p>
      <p>A port, a program for another machine, is not a text of any PDP-1 version and has a namespace of its own: <b>SWP</b>, the machine, the program, and its own version number, or its year when it has none: <span class="mono">[REF: SWP-PDP6-WAR44, 76]</span>. Several files of one program are its parts: <span class="mono">[REF: SWP-PDP10-SW71, 2.14]</span> is line 14 of SHIPS.SAI. A port has no witness letter unless it survives in more than one text.</p>
      <p>For the exact bytes of a file, cite its <a target="_blank" rel="noopener noreferrer" href="https://www.swhid.org/">SWHID</a> (<a target="_blank" rel="noopener noreferrer" href="https://www.softwareheritage.org/software-hash-identifier-swhid/">Software Heritage</a>, <a target="_blank" rel="noopener noreferrer" href="https://www.iso.org/standard/89985.html">ISO/IEC 18670:2025</a>) alongside. A SWHID opens through Software Heritage’s resolver, <span class="mono">archive.softwareheritage.org/swh:1:cnt:…</span>, once the repository is archived there; the part after the first semicolon (origin, path, lines) qualifies it and is not a web address. For a link that works meanwhile, cite the file on GitHub at a given commit, to the lines.</p>

      <h3 style="margin-top:1.6rem;">Source code versions</h3>
      <p class="micro" style="font-size:0.6rem;">The version’s date is the program’s; the text held may be later: a transcription, a reassembly, a reconstruction. Each name opens the text (a text in several files has a link for each further part; tapes open on GitHub). A reference or a SWHID copies on a click.</p>
      <div class="vtable-wrap"><table class="vtable reftable">
        <thead><tr><th>No.</th><th>Reference</th><th>Version</th><th>Author</th><th>Version dated</th><th>This text</th><th>SWHID</th></tr></thead>
        <tbody>''' + rows + '''</tbody>
      </table></div>

      <h3 style="margin-top:1.6rem;">Ports</h3>
      <p class="micro" style="font-size:0.6rem;">Named whether or not a text is held, so that a port can be cited as a program. A port takes a witness letter only when it survives in more than one text, or when the text held is not its own (SWP-CDC3100-SPACEWAR66R, a reconstruction).</p>
      <div class="vtable-wrap"><table class="vtable reftable">
        <thead><tr><th>No.</th><th>Reference</th><th>Program</th><th>Machine</th><th>Where and by whom</th><th>Date</th><th>SWHID</th></tr></thead>
        <tbody>''' + prow + '''</tbody>
      </table></div>
    </section>
    <script>
      // a reference or SWHID copies on a click
      document.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('#referencing [data-copy], .vtable [data-copy]');
        if (!c) return;
        var t = c.getAttribute('data-copy'), done = function () { var o = c.textContent; c.textContent = 'copied'; setTimeout(function () { c.textContent = o; }, 900); };
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { window.prompt('Copy:', t); }); else window.prompt('Copy:', t);
      });
    </script>
<!-- references:end -->'''

p = 'code.html'
s = open(p, encoding='utf-8').read()
if '<!-- references:start' in s:
    s = re.sub(r'<!-- references:start[\s\S]*?<!-- references:end -->', lambda m: SECTION, s)
else:
    anchor = '    <div class="rule"><span>the versions in detail · 1962</span></div>'
    assert s.count(anchor) == 1
    s = s.replace(anchor, SECTION + '\n\n' + anchor)
# the version table's Reference column
if '<th>Version</th><th>Reference</th>' not in s:   # once only
    s = s.replace('<tr><th>Version</th><th>Date</th><th>Author(s)</th><th>Status</th>', '<tr><th>Version</th><th>Reference</th><th>Date</th><th>Author(s)</th><th>Status</th>', 1)
    s = s.replace('<td colspan="7" style="background:rgba(108,242,255,0.06)', '<td colspan="8" style="background:rgba(108,242,255,0.06)')
    tb = s[s.index('<table class="vtable">'):s.index('</table>', s.index('<table class="vtable">'))]
    nb = tb
    for ver, refs in ROWREFS.items():
        cell = '<td>' + ('<br>'.join(chip(r) for r in refs) if refs else '–') + '</td>'
        nb, k = re.subn(r'(<tr><td>' + re.escape(ver) + r'</td>)', lambda m: m.group(1) + cell, nb, count=1)
        if not k: sys.exit('row not found: ' + ver)
    s = s.replace(tb, nb)
open(p, 'w', encoding='utf-8').write(s)
print('written; versions', len(VERSIONS), 'ports', len(PORTS))
