/*
 * fiodec.js - read a FIO-DEC source tape.
 *
 * The PDP-1's programmers punched their source in FIO-DEC, the code of the
 * Friden Flexowriter: six data channels (1-6), odd parity in channel 8, and
 * shift codes for lower (072) and upper (074) case. Channel 7 frames are
 * treated as control or leader. Lower-case 056 is the non-spacing overbar
 * that marks a variable, rendered "\" as the assembler expects; 040 is the
 * non-spacing underline (upper case: overline, as in "‾+" for ±). Code 013 is the stop
 * code (a page break on the tape). Object tapes (binary) fail the parity
 * test on roughly a third of their frames, which is how the two are told
 * apart.
 */
(function (root) {
  'use strict';

  // FIO-DEC to ASCII, lower and upper case (after macro1's table, inverted).
  var LC = {}, UC = {};
  var pairs = [
    [0o00, ' ', ' '], [0o01, '1', '"'], [0o02, '2', "'"], [0o03, '3', '~'], [0o04, '4', '#'], [0o05, '5', '!'],
    [0o06, '6', '&'], [0o07, '7', '<'], [0o10, '8', '>'], [0o11, '9', '^'], [0o20, '0', '`'], [0o21, '/', '?'],
    [0o22, 's', 'S'], [0o23, 't', 'T'], [0o24, 'u', 'U'], [0o25, 'v', 'V'], [0o26, 'w', 'W'], [0o27, 'x', 'X'],
    [0o30, 'y', 'Y'], [0o31, 'z', 'Z'], [0o33, ',', '='], [0o40, '_', '‾'], [0o41, 'j', 'J'], [0o42, 'k', 'K'],
    [0o43, 'l', 'L'], [0o44, 'm', 'M'], [0o45, 'n', 'N'], [0o46, 'o', 'O'], [0o47, 'p', 'P'], [0o50, 'q', 'Q'],
    [0o51, 'r', 'R'], [0o54, '-', '+'], [0o55, ')', ']'], [0o56, '\\', '|'], [0o57, '(', '['], [0o61, 'a', 'A'],
    [0o62, 'b', 'B'], [0o63, 'c', 'C'], [0o64, 'd', 'D'], [0o65, 'e', 'E'], [0o66, 'f', 'F'], [0o67, 'g', 'G'],
    [0o70, 'h', 'H'], [0o71, 'i', 'I'], [0o73, '.', '*'], [0o75, '\b', '\b'], [0o36, '\t', '\t'], [0o77, '\n', '\n']
  ];
  pairs.forEach(function (p) { LC[p[0]] = p[1]; UC[p[0]] = p[2]; });

  function parityOK(x) {
    var n = 0;
    [0, 1, 2, 3, 4, 5, 7].forEach(function (k) { if ((x >> k) & 1) n++; });
    return n % 2 === 1;
  }

  // bytes -> { text, frames, parityErrors, stops, control, isSource }
  function decode(bytes) {
    var out = '', uc = false, bad = 0, frames = 0, stops = 0, control = 0;
    for (var i = 0; i < bytes.length; i++) {
      var x = bytes[i];
      if (x === 0) continue;                 // blank tape (leader, gaps)
      frames++;
      if (x & 0o100) { control++; continue; } // channel 7: not a character
      if (!parityOK(x)) bad++;
      var c = x & 0o77;
      if (c === 0o72) { uc = false; continue; }
      if (c === 0o74) { uc = true; continue; }
      if (c === 0o13) { stops++; out += '\f'; continue; }
      if (c === 0o75) continue;              // backspace: an overstrike follows
      var ch = (uc ? UC : LC)[c];
      out += ch !== undefined ? ch : '{' + c.toString(8) + '}';
    }
    return { text: out, frames: frames, parityErrors: bad, stops: stops, control: control,
             isSource: frames > 0 && bad / frames < 0.01 };
  }

  // What each frame of a source tape is, frame by frame (for the Tape view's
  // magnifier): '' for blank tape, else the character, or a word for a code.
  function frameChars(bytes) {
    var uc = false, out = new Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) {
      var x = bytes[i], c = x & 0o77;
      if (x === 0) { out[i] = ''; continue; }
      if (x & 0o100) { out[i] = 'control code'; continue; }
      if (c === 0o72) { uc = false; out[i] = 'lower case'; continue; }
      if (c === 0o74) { uc = true; out[i] = 'upper case'; continue; }
      if (c === 0o13) { out[i] = 'stop code'; continue; }
      if (c === 0o75) { out[i] = 'backspace'; continue; }
      var ch = (uc ? UC : LC)[c];
      out[i] = ch === undefined ? '' : ch === ' ' ? 'space' : ch === '\t' ? 'tab' : ch === '\n' ? 'carriage return' : '“' + ch + '”';
    }
    return out;
  }

  var api = { decode: decode, parityOK: parityOK, frameChars: frameChars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SWFiodec = api;
})(this);
