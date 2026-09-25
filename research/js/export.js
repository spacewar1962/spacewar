/*
 * export.js - Word (.docx) and Markdown export for the research tool.
 *
 * The analyser's readings (annotated listings, diffs between versions,
 * symbol tables, marginal notes and figures) are gathered by the caller into
 * a small, neutral document model and written out here, so that they can be
 * carried into the manuscript of the book without retyping. Nothing in this
 * file knows about Spacewar! itself; it only knows how to set a listing so
 * that the columns of a MACRO source survive the journey into a word
 * processor.
 *
 * Everything is written by hand and depends on nothing: a store-only ZIP
 * writer (with its own CRC-32 and UTF-8 encoder), a minimal but complete
 * WordprocessingML package, and a GitHub-flavoured Markdown serialiser. The
 * module runs unchanged in the browser (as window.SWExport) and in Node.
 *
 * The document model:
 *   { title, subtitle?, meta?: [[label, value], ...], created?: Date|string,
 *     blocks: [
 *       {type:'h1'|'h2'|'h3', text}
 *       {type:'p', text} | {type:'p', runs:[{text, bold, italic, code}]}
 *       {type:'quote', text}
 *       {type:'list', ordered, items:[string]}
 *       {type:'code', caption?, lines:[{n?, addr?, word?, text, mark?, notes?}]}
 *       {type:'table', caption?, head:[..], rows:[[..], ..]}
 *       {type:'note', by, date, text, anchor?, replies?}
 *       {type:'figure', png?, width?, height?, caption?, svg?}
 *       {type:'pagebreak'} ] }
 *   where mark is 'add' | 'del' | 'hl', and a note is {by, date, text, replies?}.
 *
 * Deliberate choices, noted so that nobody mistakes them for accidents:
 *  - In Markdown the document title takes '#', so block headings h1-h3 are
 *    written one level down ('##' to '####').
 *  - In Markdown, tabs in code are expanded to spaces (stops every 8
 *    columns, counted from the start of the source text, not the gutter),
 *    since a fenced block cannot carry tab stops; in Word they stay real
 *    tabs, with stops set after the gutter so the columns align.
 *  - ISO dates (YYYY-MM-DD) are shown in British order, '25 Sep 2026'; any
 *    other date string is shown as given.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Bytes: UTF-8 and CRC-32
   * ------------------------------------------------------------------ */

  // UTF-8 encode a string. TextEncoder where available; otherwise by hand
  // (lone surrogates become U+FFFD, as TextEncoder would do).
  function utf8(str) {
    str = String(str);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        else c = 0xFFFD;
      } else if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ------------------------------------------------------------------ *
   * ZIP (store only, method 0)
   * ------------------------------------------------------------------ */

  // files: [{name, data: string|Uint8Array}] -> Uint8Array.
  // Names are flagged as UTF-8 (general purpose bit 11). No ZIP64: the
  // exports are small, and every size must stay below 4 GiB.
  function zip(files) {
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var FLAGS = 0x0800;

    var entries = files.map(function (f) {
      var data = typeof f.data === 'string' ? utf8(f.data) : f.data;
      return { name: utf8(f.name), data: data, crc: crc32(data), offset: 0 };
    });

    var size = 22;
    entries.forEach(function (e) { size += 30 + e.name.length + e.data.length + 46 + e.name.length; });
    var out = new Uint8Array(size), view = new DataView(out.buffer), p = 0;
    function u16(v) { view.setUint16(p, v, true); p += 2; }
    function u32(v) { view.setUint32(p, v >>> 0, true); p += 4; }
    function bytes(b) { out.set(b, p); p += b.length; }

    entries.forEach(function (e) {          // local file headers and data
      e.offset = p;
      u32(0x04034B50); u16(20); u16(FLAGS); u16(0); u16(dosTime); u16(dosDate);
      u32(e.crc); u32(e.data.length); u32(e.data.length);
      u16(e.name.length); u16(0);
      bytes(e.name); bytes(e.data);
    });
    var cdStart = p;
    entries.forEach(function (e) {          // central directory
      u32(0x02014B50); u16(20); u16(20); u16(FLAGS); u16(0); u16(dosTime); u16(dosDate);
      u32(e.crc); u32(e.data.length); u32(e.data.length);
      u16(e.name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(e.offset);
      bytes(e.name);
    });
    var cdSize = p - cdStart;
    u32(0x06054B50); u16(0); u16(0); u16(entries.length); u16(entries.length);
    u32(cdSize); u32(cdStart); u16(0);    // end of central directory
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Shared helpers
   * ------------------------------------------------------------------ */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // '2026-09-25' (or an ISO timestamp) -> '25 Sep 2026'; anything else as given.
  function fmtDate(d) {
    if (d == null || d === '') return '';
    if (d instanceof Date) return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    if (!m || +m[2] < 1 || +m[2] > 12) return String(d);
    return (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1];
  }

  function str(v) { return v == null ? '' : String(v); }

  // Characters XML 1.0 forbids: C0 controls other than tab/LF/CR, U+FFFE/F,
  // and unpaired surrogates.
  var ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

  function xmlEsc(s) {
    return str(s).replace(ILLEGAL_XML, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function padLeft(s, w) { s = str(s); while (s.length < w) s = ' ' + s; return s; }
  function padRight(s, w) { s = str(s); while (s.length < w) s += ' '; return s; }

  // The gutter columns a code block needs: which of n/addr/word occur, and
  // how wide each is, so that every line of the block shares one gutter.
  function gutterSpec(lines) {
    var g = { n: 0, addr: 0, word: 0 };
    lines.forEach(function (l) {
      if (l.n != null && l.n !== '') g.n = Math.max(g.n, str(l.n).length);
      if (l.addr != null && l.addr !== '') g.addr = Math.max(g.addr, str(l.addr).length);
      if (l.word != null && l.word !== '') g.word = Math.max(g.word, str(l.word).length);
    });
    return g;
  }

  // 'n  addr  word  ' for one line (sep between and after columns), or ''.
  function gutterText(g, l) {
    var parts = [];
    if (g.n) parts.push(padLeft(l.n, g.n));
    if (g.addr) parts.push(padRight(l.addr, g.addr));
    if (g.word) parts.push(padRight(l.word, g.word));
    return parts.length ? parts.join('  ') + '  ' : '';
  }

  // Expand tabs to spaces with stops every `w` columns.
  function expandTabs(s, w) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '\t') { do out += ' '; while (out.length % w); }
      else out += c;
    }
    return out;
  }

  // Width and height of a PNG from its IHDR chunk, or null.
  function pngSize(png) {
    if (!png || png.length < 24 || png[0] !== 0x89 || png[1] !== 0x50) return null;
    var v = new DataView(png.buffer, png.byteOffset, png.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }

  // Figures are numbered in document order, the same way in both outputs.
  function figures(doc) {
    var n = 0;
    return (doc.blocks || []).filter(function (b) { return b.type === 'figure'; })
      .map(function (b) { return { block: b, n: ++n }; });
  }

  /* ------------------------------------------------------------------ *
   * WordprocessingML
   * ------------------------------------------------------------------ */

  var NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  var NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  var XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  // Measures. Courier New advances 0.6 em, so at 8.5pt a character is
  // 5.1pt = 102 twips and a MACRO tab stop (8 characters) is 816 twips.
  var CODE_SZ = 17;                 // half-points
  var CHAR_TW = 102;                // twips per code character
  var TAB_TW = 8 * CHAR_TW;
  var NOTE_IND = 864;               // 0.6in
  var REPLY_IND = 1296;             // 0.9in
  var EMU_PER_IN = 914400, PX_PER_IN = 96, MAX_FIG_IN = 6;
  var GREY = '808080';
  var SHADE = { add: 'E6F4EA', del: 'FBE3E4', hl: 'FFF4C2' };

  // A run of text; tabs and newlines become <w:tab/> and <w:br/>.
  function wRun(text, rPr) {
    var inner = str(text).split(/(\t|\r?\n)/).map(function (piece) {
      if (piece === '\t') return '<w:tab/>';
      if (piece === '\n' || piece === '\r\n') return '<w:br/>';
      return piece ? '<w:t xml:space="preserve">' + xmlEsc(piece) + '</w:t>' : '';
    }).join('');
    return '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + inner + '</w:r>';
  }

  function wPara(content, pPr) {
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + (content || '') + '</w:p>';
  }

  function pStyle(id) { return '<w:pStyle w:val="' + id + '"/>'; }

  // Inline runs of a 'p' block, or its plain text.
  function wRuns(b) {
    if (!b.runs) return wRun(b.text);
    return b.runs.map(function (r) {
      if (typeof r === 'string') return wRun(r);
      var rPr = (r.code ? '<w:rStyle w:val="CodeChar"/>' : '') +
                (r.bold ? '<w:b/>' : '') + (r.italic ? '<w:i/>' : '');
      return wRun(r.text, rPr);
    }).join('');
  }

  // '[DMB · 25 Sep 2026] ' in grey small capitals, then the note itself.
  function wNoteHead(n, reply) {
    var head = (reply ? '↳ ' : '') + '[' + str(n.by) + (n.date ? ' · ' + fmtDate(n.date) : '') + '] ';
    return wRun(head, '<w:smallCaps/><w:color w:val="' + GREY + '"/>');
  }

  function wNote(n, indent, anchor) {
    var out = wPara(wNoteHead(n, false) +
                    (anchor ? wRun(anchor, '<w:i/>') + wRun(': ') : '') + wRun(n.text),
                    pStyle('NoteBy') + '<w:ind w:left="' + indent + '"/>');
    (n.replies || []).forEach(function (r) {
      out += wPara(wNoteHead(r, true) + wRun(r.text),
                   pStyle('NoteBy') + '<w:ind w:left="' + (indent + REPLY_IND - NOTE_IND) + '"/>');
    });
    return out;
  }

  function wCode(b) {
    var lines = b.lines || [], g = gutterSpec(lines);
    var gw = gutterText(g, {}).length;      // every line pads to this width
    var gutterTw = gw ? (gw + 2) * CHAR_TW : 0;
    // Tab stops every eight characters from where the source text begins,
    // and a hanging indent so that a wrapped line stays clear of the gutter.
    var tabs = '<w:tabs>';
    for (var k = 1; k <= 12; k++) tabs += '<w:tab w:val="left" w:pos="' + (gutterTw + k * TAB_TW) + '"/>';
    tabs += '</w:tabs>';
    var ind = gutterTw ? '<w:ind w:left="' + gutterTw + '" w:hanging="' + gutterTw + '"/>' : '';

    var out = b.caption ? wPara(wRun(b.caption), pStyle('CodeCaption')) : '';
    lines.forEach(function (l) {
      var shd = SHADE[l.mark] ? '<w:shd w:val="clear" w:color="auto" w:fill="' + SHADE[l.mark] + '"/>' : '';
      var gut = gutterText(g, l);
      var runs = (gut ? wRun('  ' + gut, '<w:rStyle w:val="Gutter"/>') : '') +
                 wRun(l.text, l.mark === 'del' ? '<w:strike/>' : '');
      out += wPara(runs, pStyle('Code') + tabs + shd + ind);
      (l.notes || []).forEach(function (n) { out += wNote(n, NOTE_IND); });
    });
    return out;
  }

  function wCell(text, head) {
    var tcPr = head ? '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>' : '';
    return '<w:tc>' + tcPr + wPara(wRun(text, head ? '<w:b/>' : ''), pStyle('TableText')) + '</w:tc>';
  }

  function wTable(head, rows, caption) {
    var ncol = Math.max(head ? head.length : 0, rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
    if (!ncol) return '';
    function row(cells, isHead) {
      var tr = '<w:tr>' + (isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
      for (var i = 0; i < ncol; i++) tr += wCell(cells[i], isHead);
      return tr + '</w:tr>';
    }
    var grid = '<w:tblGrid>';
    for (var i = 0; i < ncol; i++) grid += '<w:gridCol w:w="' + Math.floor(9026 / ncol) + '"/>';
    grid += '</w:tblGrid>';
    return (caption ? wPara(wRun(caption), pStyle('CodeCaption')) : '') +
      '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>' +
      grid + (head && head.length ? row(head, true) : '') +
      rows.map(function (r) { return row(r, false); }).join('') + '</w:tbl>' +
      wPara('', pStyle('TableGap'));   // Word needs a paragraph between adjacent tables
  }

  function wFigure(b, n, rid) {
    var size = (b.width && b.height) ? { width: b.width, height: b.height } : pngSize(b.png);
    var caption = 'Figure ' + n + '.' + (b.caption ? ' ' + b.caption : '');
    if (!b.png || !size) return wPara(wRun('[' + caption + ' The image is not available in this export.]'), pStyle('CodeCaption'));
    var wIn = size.width / PX_PER_IN, hIn = size.height / PX_PER_IN;
    if (wIn > MAX_FIG_IN) { hIn *= MAX_FIG_IN / wIn; wIn = MAX_FIG_IN; }
    var cx = Math.round(wIn * EMU_PER_IN), cy = Math.round(hIn * EMU_PER_IN);
    var drawing =
      '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="' + n + '" name="Figure ' + n + '" descr="' + xmlEsc(b.caption) + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="' + NS_A + '" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="' + NS_A + '"><a:graphicData uri="' + NS_PIC + '">' +
      '<pic:pic xmlns:pic="' + NS_PIC + '"><pic:nvPicPr><pic:cNvPr id="' + n + '" name="image' + n + '.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    return wPara(drawing, pStyle('Figure')) + wPara(wRun(caption), pStyle('CodeCaption'));
  }

  // Each list gets its own w:num so that ordered lists restart at 1.
  function wList(b, numId) {
    return (b.items || []).map(function (it) {
      return wPara(wRun(it), pStyle('ListParagraph') +
                   '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + numId + '"/></w:numPr>');
    }).join('');
  }

  var STYLES = XML_DECL +
    '<w:styles xmlns:w="' + NS_W + '">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Times New Roman"/>' +
    '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
    [[1, 32, '<w:b/>'], [2, 26, '<w:b/>'], [3, 22, '<w:b/><w:i/>']].map(function (h) {
      return '<w:style w:type="paragraph" w:styleId="Heading' + h[0] + '"><w:name w:val="heading ' + h[0] + '"/>' +
        '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="' + (h[0] === 1 ? 360 : 240) + '" w:after="120"/>' +
        '<w:outlineLvl w:val="' + (h[0] - 1) + '"/></w:pPr>' +
        '<w:rPr>' + h[2] + '<w:sz w:val="' + h[1] + '"/><w:szCs w:val="' + h[1] + '"/></w:rPr></w:style>';
    }).join('') +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:contextualSpacing/></w:pPr>' +
    '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:eastAsia="Courier New" w:cs="Courier New"/>' +
    '<w:noProof/><w:sz w:val="' + CODE_SZ + '"/><w:szCs w:val="' + CODE_SZ + '"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="CodeCaption"><w:name w:val="Code Caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/></w:pPr>' +
    '<w:rPr><w:i/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="NoteBy"><w:name w:val="Note By"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:before="20" w:after="40" w:line="240" w:lineRule="auto"/><w:ind w:left="' + NOTE_IND + '"/></w:pPr>' +
    '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:before="120" w:after="120"/><w:ind w:left="720" w:right="720"/></w:pPr>' +
    '<w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Figure"><w:name w:val="Figure"/><w:basedOn w:val="Normal"/><w:next w:val="CodeCaption"/>' +
    '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="0"/><w:jc w:val="center"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableGap"><w:name w:val="Table Gap"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="12"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:customStyle="1" w:styleId="CodeChar"><w:name w:val="Code Char"/>' +
    '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:noProof/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:customStyle="1" w:styleId="Gutter"><w:name w:val="Code Gutter"/>' +
    '<w:rPr><w:color w:val="' + GREY + '"/></w:rPr></w:style>' +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/>' +
    '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
    '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/>' +
    '<w:tblPr><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) {
      return '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>';
    }).join('') +
    '</w:tblBorders><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '</w:styles>';

  function numberingXml(lists) {
    var x = XML_DECL + '<w:numbering xmlns:w="' + NS_W + '">' +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
      '<w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
      '<w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>';
    lists.forEach(function (ordered, i) {
      x += '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + (ordered ? 1 : 0) + '"/>' +
        (ordered ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : '') + '</w:num>';
    });
    return x + '</w:numbering>';
  }

  function isoNow(d) {
    d = d ? new Date(d) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toISOString().replace(/\.\d+Z$/, 'Z');
  }

  // doc -> Uint8Array holding a .docx package.
  function docx(doc) {
    var body = '', lists = [], media = [];
    var figNo = 0;

    if (doc.title) body += wPara(wRun(doc.title), pStyle('Title'));
    if (doc.subtitle) body += wPara(wRun(doc.subtitle), pStyle('Subtitle'));
    if (doc.meta && doc.meta.length) body += wTable(null, doc.meta, null);

    (doc.blocks || []).forEach(function (b) {
      switch (b.type) {
        case 'h1': case 'h2': case 'h3':
          body += wPara(wRun(b.text), pStyle('Heading' + b.type.charAt(1))); break;
        case 'p':
          body += wPara(wRuns(b)); break;
        case 'quote':
          body += wPara(wRun(b.text), pStyle('Quote')); break;
        case 'list':
          lists.push(!!b.ordered); body += wList(b, lists.length); break;
        case 'code':
          body += wCode(b); break;
        case 'table':
          body += wTable(b.head, b.rows || [], b.caption); break;
        case 'note':
          body += wNote(b, 0, b.anchor); break;
        case 'figure':
          figNo++;
          var rid = null;
          if (b.png) { media.push(b.png); rid = 'rIdImg' + media.length; }
          body += wFigure(b, figNo, rid); break;
        case 'pagebreak':
          body += wPara('<w:r><w:br w:type="page"/></w:r>'); break;
        default:
          if (b.text) body += wPara(wRun(b.text));
      }
    });

    // A4, one-inch margins: a 6.27in measure, so a 6in figure always fits.
    var document = XML_DECL +
      '<w:document xmlns:w="' + NS_W + '" xmlns:r="' + NS_R + '" xmlns:wp="' + NS_WP + '" xmlns:a="' + NS_A + '" xmlns:pic="' + NS_PIC + '">' +
      '<w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';

    var docRels = XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="' + REL + 'styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdNumbering" Type="' + REL + 'numbering" Target="numbering.xml"/>' +
      media.map(function (_, i) {
        return '<Relationship Id="rIdImg' + (i + 1) + '" Type="' + REL + 'image" Target="media/image' + (i + 1) + '.png"/>';
      }).join('') + '</Relationships>';

    var contentTypes = XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      (media.length ? '<Default Extension="png" ContentType="image/png"/>' : '') +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';

    var rels = XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + REL + 'officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>';

    var created = isoNow(doc.created);
    var core = XML_DECL +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xmlEsc(doc.title) + '</dc:title>' +
      '<dc:creator>Spacewar! research tool</dc:creator>' +
      '<dc:language>en-GB</dc:language>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + created + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + created + '</dcterms:modified>' +
      '</cp:coreProperties>';

    var files = [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'word/document.xml', data: document },
      { name: 'word/styles.xml', data: STYLES },
      { name: 'word/numbering.xml', data: numberingXml(lists) },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'docProps/core.xml', data: core }
    ];
    media.forEach(function (png, i) { files.push({ name: 'word/media/image' + (i + 1) + '.png', data: png }); });
    return zip(files);
  }

  /* ------------------------------------------------------------------ *
   * Markdown (GitHub-flavoured)
   * ------------------------------------------------------------------ */

  // Escape inline Markdown punctuation in running text.
  function mdEsc(s) {
    return str(s).replace(ILLEGAL_XML, '').replace(/([\\`*_\[\]<>|])/g, '\\$1')
      .replace(/^(\s*)([#+\-]|\d+\.)(\s)/gm, '$1\\$2$3');
  }

  // Inline code span with a fence longer than any backtick run inside it.
  function mdCode(s) {
    s = str(s).replace(ILLEGAL_XML, '');
    var runs = s.match(/`+/g) || [], n = 1;
    runs.forEach(function (r) { if (r.length >= n) n = r.length + 1; });
    var f = new Array(n + 1).join('`');
    var pad = /^`|`$/.test(s) ? ' ' : '';
    return f + pad + s + pad + f;
  }

  function mdRuns(b) {
    if (!b.runs) return mdEsc(b.text);
    return b.runs.map(function (r) {
      if (typeof r === 'string') return mdEsc(r);
      if (!r.text) return '';
      // Emphasis may not begin or end with a space, so keep spaces outside.
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str(r.text));
      if (!m[2]) return m[0];
      var t = r.code ? mdCode(m[2]) : mdEsc(m[2]);
      if (r.italic) t = '*' + t + '*';
      if (r.bold) t = '**' + t + '**';
      return m[1] + t + m[3];
    }).join('');
  }

  function mdCell(s) { return mdEsc(s).replace(/\r?\n/g, '<br>'); }

  function mdTable(head, rows) {
    var ncol = Math.max(head ? head.length : 0, rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
    if (!ncol) return '';
    function row(cells) {
      var c = [];
      for (var i = 0; i < ncol; i++) c.push(mdCell(cells && cells[i]));
      return '| ' + c.join(' | ') + ' |';
    }
    var sep = [];
    for (var i = 0; i < ncol; i++) sep.push('---');
    return [row(head || []), '| ' + sep.join(' | ') + ' |'].concat(rows.map(row)).join('\n');
  }

  // A note as a blockquote paragraph, with its replies nested below it.
  function mdNote(n, ref) {
    var head = '**' + mdEsc(n.by) + '**' + (n.date ? ', ' + fmtDate(n.date) : '') + (ref ? ' (' + ref + ')' : '');
    var out = ['> ' + head + ': ' + mdEsc(n.text).replace(/\r?\n/g, '\n> ')];
    (n.replies || []).forEach(function (r) {
      out.push('>', '> > ↳ **' + mdEsc(r.by) + '**' + (r.date ? ', ' + fmtDate(r.date) : '') + ': ' +
               mdEsc(r.text).replace(/\r?\n/g, '\n> > '));
    });
    return out.join('\n');
  }

  function mdCodeBlock(b) {
    var lines = b.lines || [], g = gutterSpec(lines);
    var marked = lines.some(function (l) { return SHADE[l.mark]; });
    var MARK = { add: '+ ', del: '- ', hl: '* ' };
    var body = lines.map(function (l) {
      return (marked ? (MARK[l.mark] || '  ') : '') + gutterText(g, l) +
             expandTabs(str(l.text).replace(ILLEGAL_XML, ''), 8);
    });
    var longest = 2;
    body.forEach(function (t) { (t.match(/`+/g) || []).forEach(function (r) { longest = Math.max(longest, r.length); }); });
    var fence = new Array(longest + 2).join('`');
    var out = [];
    if (b.caption) out.push('*' + mdEsc(b.caption) + '*', '');
    out.push(fence + '\n' + body.join('\n') + '\n' + fence);
    var notes = [];
    lines.forEach(function (l) {
      (l.notes || []).forEach(function (n) {
        notes.push(mdNote(n, (l.n != null && l.n !== '') ? 'l. ' + l.n : (l.addr ? mdEsc(l.addr) : '')));
      });
    });
    if (notes.length) out.push('', notes.join('\n>\n'));
    return out.join('\n');
  }

  // doc -> Markdown string. Figures are referenced as figure-N.png (and
  // figure-N.svg), which markdownAssets(doc) supplies for saving alongside.
  function markdown(doc) {
    var out = [];
    if (doc.title) out.push('# ' + mdEsc(doc.title));
    if (doc.subtitle) out.push('*' + mdEsc(doc.subtitle) + '*');
    if (doc.meta && doc.meta.length) out.push(mdTable(['', ''], doc.meta));
    var figNo = 0;

    (doc.blocks || []).forEach(function (b) {
      switch (b.type) {
        case 'h1': case 'h2': case 'h3':
          out.push(new Array(+b.type.charAt(1) + 2).join('#') + ' ' + mdEsc(b.text)); break;
        case 'p':
          out.push(mdRuns(b)); break;
        case 'quote':
          out.push('> ' + mdEsc(b.text).replace(/\r?\n/g, '\n> ')); break;
        case 'list':
          out.push((b.items || []).map(function (it, i) {
            return (b.ordered ? (i + 1) + '. ' : '- ') + mdEsc(it).replace(/\r?\n/g, ' ');
          }).join('\n')); break;
        case 'code':
          out.push(mdCodeBlock(b)); break;
        case 'table':
          out.push((b.caption ? '*' + mdEsc(b.caption) + '*\n\n' : '') + mdTable(b.head, b.rows || [])); break;
        case 'note':
          out.push(mdNote(b, b.anchor ? '*' + mdEsc(b.anchor) + '*' : '')); break;
        case 'figure':
          figNo++;
          var cap = 'Figure ' + figNo + '.' + (b.caption ? ' ' + b.caption : '');
          var alt = mdEsc(cap).replace(/\r?\n/g, ' ');
          var lines = [];
          if (b.png) lines.push('![' + alt + '](figure-' + figNo + '.png)');
          else if (b.svg) lines.push('![' + alt + '](figure-' + figNo + '.svg)');
          else lines.push('*[' + alt + ' The image is not available in this export.]*');
          if (b.png || b.svg) {
            var names = [b.png && 'figure-' + figNo + '.png', b.svg && 'figure-' + figNo + '.svg'].filter(Boolean);
            lines.push('', '<!-- ' + names.join(' and ') + (names.length > 1 ? ' are' : ' is') +
                       ' exported separately; keep ' + (names.length > 1 ? 'them' : 'it') + ' beside this file. -->');
          }
          lines.push('', '*' + alt + '*');
          out.push(lines.join('\n')); break;
        case 'pagebreak':
          out.push('<div style="page-break-after: always;"></div>'); break;
        default:
          if (b.text) out.push(mdEsc(b.text));
      }
    });
    return out.join('\n\n') + '\n';
  }

  // The image files a Markdown export refers to: [{name, data}].
  function markdownAssets(doc) {
    var out = [];
    figures(doc).forEach(function (f) {
      if (f.block.png) out.push({ name: 'figure-' + f.n + '.png', data: f.block.png });
      if (f.block.svg) out.push({ name: 'figure-' + f.n + '.svg', data: utf8(f.block.svg) });
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Browser download
   * ------------------------------------------------------------------ */

  var MIME = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    md: 'text/markdown;charset=utf-8', png: 'image/png', svg: 'image/svg+xml', zip: 'application/zip'
  };

  // Offer `data` (string or Uint8Array) as a file. Returns false (and does
  // nothing) where there is no DOM, as in Node.
  function download(filename, data, mime) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
    var ext = (/\.([^.]+)$/.exec(filename) || [])[1];
    var blob = new Blob([data], { type: mime || MIME[ext] || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    return true;
  }

  var api = { zip: zip, docx: docx, markdown: markdown, markdownAssets: markdownAssets,
              download: download, crc32: crc32, utf8: utf8, formatDate: fmtDate, MIME: MIME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SWExport = api;
})(this);
