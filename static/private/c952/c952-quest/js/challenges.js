// ============================================================
// challenges.js — challenge type implementations
// ============================================================
// Each type exposes:
//   render(container, ch, ctx)  → void   (build DOM + wire events)
//   check (ch, ctx)             → { correct, message?, locked? }
//
// `ctx` contains:
//   showFeedback(kind, html)   — kind: 'ok' | 'err' | 'info'
//   getRuntime() / setRuntime  — per-challenge mutable state slot
//   onAnswered(correct)        — used by some types to advance
//
// The engine (engine.js) calls render() once when a challenge is
// shown, and check() when the user clicks "Check". Some types
// (drag-match, bit-field) populate their answer via clicks and
// keep state in ctx.getRuntime().
//
// Author guide for each type lives next to its handler below.
// ============================================================

import {
  parse as legParse, makeMachine, answerMatches, toU64, toS64
} from './legv8.js';

// ── Helpers ────────────────────────────────────────────────

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k of Object.keys(props)) {
    if (k === 'class')      e.className = props[k];
    else if (k === 'style') e.setAttribute('style', props[k]);
    else if (k === 'html')  e.innerHTML = props[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
    else if (k in e)        e[k] = props[k];
    else                    e.setAttribute(k, props[k]);
  }
  for (const kid of kids) {
    if (kid == null) continue;
    if (typeof kid === 'string') e.appendChild(document.createTextNode(kid));
    else e.appendChild(kid);
  }
  return e;
}

function bitsToInt(bits) {
  let v = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i]) v += Math.pow(2, i);
  return v;
}
function signedFromBits(bits) {
  const v = bitsToInt(bits);
  return bits[bits.length - 1] ? v - Math.pow(2, bits.length) : v;
}

// Highlight a LEGv8 source line with simple syntax colours.
function highlightAsm(line) {
  // Order: comment last, mnemonic first, registers, immediates, labels.
  const comm = line.match(/(\/\/.*|;.*)$/);
  let body = comm ? line.slice(0, comm.index) : line;
  const cmt = comm ? `<span class="cm">${escapeHtml(comm[0])}</span>` : '';
  // Tokenise but keep separators
  const out = body.replace(/\b(ADDI?S?|SUBI?S?|AND[IS]?|ORR[I]?|EOR[I]?|ANDS|ANDIS|MOV[ZK]?|MOV|LSL|LSR|LDUR(SW|B|H)?|STUR(B|H|W)?|CBN?Z|B\.[A-Z]+|BL|BR|B|NOP)\b/gi,
    '<span class="mn">$&</span>')
    .replace(/\b(X(?:[12]\d|3[01]|\d)|XZR|SP|FP|LR)\b/g, '<span class="rg">$&</span>')
    .replace(/#-?(?:0x[0-9A-Fa-f]+|0b[01]+|\d+)/g, '<span class="im">$&</span>')
    .replace(/\b([A-Za-z_]\w*):/g, '<span class="lb">$1</span>:');
  return out + cmt;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[c]);
}

// ============================================================
//  MC — multiple choice
// ============================================================
// Author shape:
//   { type:'mc', prompt, opts:[s,s,s,s], ans:idx, concept?, explain? }
// ============================================================
function renderMC(container, ch, ctx) {
  const grid = el('div', { class: 'mc-grid' });
  ch.opts.forEach((opt, i) => {
    const b = el('div', {
      class: 'mc-opt',
      'data-idx': i,
      html: `${'ABCD'[i]}. ${opt}`,
      onclick(){
        if (this.classList.contains('locked')) return;
        grid.querySelectorAll('.mc-opt').forEach(x => x.classList.remove('selected'));
        this.classList.add('selected');
        ctx.setRuntime({ selected: i });
      }
    });
    grid.appendChild(b);
  });
  container.appendChild(grid);
}
function checkMC(ch, ctx) {
  const rt = ctx.getRuntime() || {};
  if (rt.selected == null) {
    return { correct: false, message: 'Select an option first.', soft: true };
  }
  const correct = rt.selected === ch.ans;
  const opts = document.querySelectorAll('.mc-opt');
  opts.forEach(o => o.classList.add('locked'));
  if (opts[ch.ans]) opts[ch.ans].classList.add('correct');
  if (!correct && opts[rt.selected]) opts[rt.selected].classList.add('wrong');
  return { correct, locked: true };
}

// ============================================================
//  TYPE — fill text input
// ============================================================
// Author shape:
//   { type:'type', prompt, ans:'5', alt:['five','0x05'], concept?, explain? }
//
// If the prompt contains a binary literal of 8 bits (e.g. `0001 0010`)
// a read-only place-value strip is rendered above the input as a hint.
// ============================================================
function renderType(container, ch, ctx) {
  // Optional binary-literal preview
  const m = ch.prompt && ch.prompt.match(/([01])\s*([01])\s*([01])\s*([01])\s*([01])\s*([01])\s*([01])\s*([01])/);
  if (m) {
    const bits = m.slice(1, 9).map(b => parseInt(b, 10));
    const pvRow = el('div', { class: 'pv-row' });
    const bitRow = el('div', { class: 'bit-row' });
    let grp = el('div', { class: 'bit-group' });
    for (let k = 0; k < 8; k++) {
      const pos = 7 - k;
      pvRow.appendChild(el('div', { class: 'pv-cell', html: String(Math.pow(2, pos)) }));
      if (k === 4) {
        pvRow.appendChild(el('div', { class: 'bit-sep' }));
        bitRow.appendChild(grp);
        bitRow.appendChild(el('div', { class: 'bit-sep' }));
        grp = el('div', { class: 'bit-group' });
      }
      const col = el('div', { class: 'bit-col' });
      col.appendChild(el('div', { class: 'bit-btn readonly' + (bits[k] ? ' on' : ''), html: String(bits[k]) }));
      col.appendChild(el('div', { class: 'bit-label', html: `bit ${pos}` }));
      grp.appendChild(col);
    }
    bitRow.appendChild(grp);
    container.appendChild(pvRow);
    container.appendChild(bitRow);
  }

  const input = el('input', {
    type: 'text', class: 'type-input', id: 'type-answer',
    placeholder: '?', autocomplete: 'off',
    onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); }
  });
  container.appendChild(el('div', { class: 'type-wrap' }, input));
  setTimeout(() => input.focus(), 80);
}
function checkType(ch, ctx) {
  const inp = document.getElementById('type-answer');
  if (!inp) return { correct: false, message: 'Input missing.' };
  const userVal = inp.value.trim().toUpperCase().replace(/^0X/, '');
  const ansVal  = String(ch.ans).toUpperCase().replace(/^0X/, '');
  const alts    = (ch.alt || []).map(a => String(a).toUpperCase().replace(/^0X/, ''));
  const correct = (userVal === ansVal) || alts.indexOf(userVal) >= 0;
  inp.classList.toggle('correct', correct);
  inp.classList.toggle('wrong',   !correct);
  inp.disabled = correct; // allow retry on wrong
  return { correct, locked: correct };
}

// ============================================================
//  TOGGLE-TARGET / TOGGLE-FREE — clickable bit grid
// ============================================================
// Author shape (toggle-target):
//   { type:'toggle-target', prompt, bits:8, target:0b1010,
//     signed?:bool, signedTarget?:-5, concept?, explain? }
// (toggle-free):
//   { type:'toggle-free',   prompt, bits:8, target:0b11111111 }
// ============================================================
function renderToggle(container, ch, ctx) {
  const n = ch.bits || 8;
  const bits = new Array(n).fill(0);
  ctx.setRuntime({ bits });

  // Place-value row (top-down, MSB → LSB) — only for 8-bit which is the
  // only width the existing levels use.
  const pvRow = el('div', { class: 'pv-row' });
  for (let i = n - 1; i >= 0; i--) {
    if (i === 3 && n === 8) pvRow.appendChild(el('div', { class: 'bit-sep' }));
    pvRow.appendChild(el('div', { class: 'pv-cell', html: String(Math.pow(2, i)) }));
  }
  container.appendChild(pvRow);

  const row = el('div', { class: 'bit-row' });
  let grp = el('div', { class: 'bit-group' });
  for (let j = n - 1; j >= 0; j--) {
    const col = el('div', { class: 'bit-col' });
    const btn = el('button', {
      class: 'bit-btn', html: '0', 'data-pos': String(j),
      onclick(){
        const pos = parseInt(this.getAttribute('data-pos'), 10);
        bits[pos] = bits[pos] ? 0 : 1;
        this.textContent = bits[pos];
        this.classList.toggle('on', bits[pos] === 1);
        updateDisp();
      }
    });
    col.appendChild(btn);
    col.appendChild(el('div', { class: 'bit-label', html: `bit ${j}` }));
    grp.appendChild(col);
    if (j === 4 && n === 8) {
      row.appendChild(grp);
      row.appendChild(el('div', { class: 'bit-sep' }));
      grp = el('div', { class: 'bit-group' });
    }
  }
  row.appendChild(grp);
  container.appendChild(row);

  const disp = el('div', { class: 'sub-num', style: 'margin-top:8px;' });
  container.appendChild(disp);

  function updateDisp() {
    const v = bitsToInt(bits);
    const hex = v.toString(16).toUpperCase().padStart(Math.ceil(n / 4), '0');
    let cur;
    if (ch.signed) {
      cur = `${signedFromBits(bits)} (unsigned ${v}, 0x${hex})`;
    } else {
      cur = `${v} (0x${hex})`;
    }
    if (ch.type === 'toggle-target') {
      const targetStr = ch.signed && typeof ch.signedTarget === 'number' ? ch.signedTarget : ch.target;
      const matched = (v === ch.target);
      disp.innerHTML = `<span style="color:var(--gold)">Target: ${targetStr}</span>`
        + ' &nbsp;·&nbsp; '
        + `<span style="color:${matched?'var(--green)':'var(--accent)'};font-weight:700">Current: ${cur}${matched?' ✓':''}</span>`;
    } else if (ch.type === 'toggle-free') {
      const onCount = bits.filter(b => b === 1).length;
      const done = (v === ch.target);
      disp.innerHTML = `<span style="color:${done?'var(--green)':'var(--accent)'};font-weight:700">${onCount} / ${n} bits ON${done?' ✓':''}</span>`;
    } else {
      disp.textContent = `Current value: ${cur}`;
    }
  }
  updateDisp();
}
function checkToggle(ch, ctx) {
  const { bits } = ctx.getRuntime() || {};
  if (!bits) return { correct: false, message: 'No bits state.' };
  const v = bitsToInt(bits);
  const correct = v === ch.target;
  if (!correct) {
    const got = `${v} (0b${v.toString(2).padStart(ch.bits || 8, '0')})`;
    return { correct: false, message: `✗ Got ${got}. Target: ${ch.target}.` };
  }
  return { correct: true };
}

// ============================================================
//  CODE-TRACE — step-through LEGv8 program
// ============================================================
// Author shape:
//   { type:'code-trace',
//     prompt: "What is X3 after this runs?",
//     code: ["MOVZ X1, #5", "ADD X3, X1, X1"],
//     initRegs?: { X9: 100 },
//     initMem?:  { "0x1000": [1,2,3,4,5,6,7,8] },
//     asks: 'X3' | 'NZCV' | 'flags' | 'mem:0x1000:8' | 'pc',
//     format?: 'dec' | 'hex' | 'bin' | 'signed',
//     ans: 12,            // number, BigInt, or {N,Z,C,V}
//     showFlags?: bool,   // show NZCV in register panel
//     concept?, explain? }
// ============================================================
function renderCodeTrace(container, ch, ctx) {
  // Parse + build a fresh machine.
  const parsed = legParse(ch.code);
  const machine = makeMachine({
    ...parsed,
    initRegs: ch.initRegs || {},
    initMem:  ch.initMem  || {},
  });
  ctx.setRuntime({ machine, parsed, snapshot: machine.snapshot() });

  const codeBlock = el('div', { class: 'code-block' });
  ch.code.forEach((line, i) => {
    const lineDiv = el('div', { class: 'code-line', 'data-pc': String(i) });
    lineDiv.appendChild(el('span', { class: 'ln', html: String(i + 1) }));
    lineDiv.appendChild(el('span', { class: 'src', html: highlightAsm(line) }));
    codeBlock.appendChild(lineDiv);
  });
  container.appendChild(codeBlock);

  const controls = el('div', { class: 'trace-controls' });
  controls.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm', html: '⟳ Reset',
    onclick(){ resetTrace(); }
  }));
  controls.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm', id: 'btn-step', html: 'Step ▶',
    onclick(){ stepTrace(); }
  }));
  controls.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm', html: '▶▶ Run all',
    onclick(){ while (!ctx.getRuntime().machine.halted) stepTrace(); }
  }));
  container.appendChild(controls);

  // Register panel
  const regPanel = el('div', { class: 'reg-panel', id: 'reg-panel' });
  container.appendChild(regPanel);

  // Memory strip — render only if initMem provided
  if (ch.initMem) {
    const memEl = el('div', { class: 'mem-strip', id: 'mem-strip' });
    container.appendChild(memEl);
  }

  // Answer input (unless asks === '__none__')
  if (ch.asks && ch.asks !== '__none__') {
    const wrap = el('div', { class: 'type-wrap' });
    wrap.appendChild(el('span', { class: 'hint-pill', html:
      `Final value of <code>${escapeHtml(ch.asks)}</code>:` }));
    wrap.appendChild(el('input', {
      type: 'text', class: 'type-input', id: 'trace-answer',
      placeholder: 'value', autocomplete: 'off',
      onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); }
    }));
    container.appendChild(wrap);
  }

  function resetTrace() {
    const fresh = makeMachine({
      ...parsed,
      initRegs: ch.initRegs || {},
      initMem:  ch.initMem  || {},
    });
    ctx.setRuntime({ machine: fresh, parsed, snapshot: fresh.snapshot(), refreshUI });
    refreshUI();
  }
  function stepTrace() {
    const rt = ctx.getRuntime();
    if (rt.machine.halted) return;
    const prevSnap = rt.machine.snapshot();
    try { rt.machine.step(); }
    catch (e) { ctx.showFeedback('err', `Trace error: ${escapeHtml(e.message)}`); }
    rt.snapshot = rt.machine.snapshot();
    rt.prevSnap = prevSnap;
    refreshUI();
  }
  function refreshUI() {
    const rt = ctx.getRuntime();
    if (!rt) return;
    codeBlock.querySelectorAll('.code-line').forEach(l => {
      l.classList.remove('active', 'executed');
    });
    const pc = rt.machine.pc;
    codeBlock.querySelectorAll('.code-line').forEach((l, i) => {
      if (rt.machine.halted && i < ch.code.length) l.classList.add('executed');
      if (i === pc && !rt.machine.halted) l.classList.add('active');
      else if (i < pc) l.classList.add('executed');
    });
    drawRegPanel(regPanel, rt.snapshot, rt.prevSnap, ch.showFlags);
    if (ch.initMem) drawMemStrip(document.getElementById('mem-strip'), rt.machine.mem, ch.initMem, rt.machine.lastMem);
  }
  // Stash for checkCodeTrace to call after a final runAll().
  ctx.setRuntime({ ...ctx.getRuntime(), refreshUI });
  refreshUI();
}

function drawRegPanel(panel, snap, prev, showFlags) {
  panel.innerHTML = '';
  const head = el('div', { class: 'reg-panel-head' });
  head.appendChild(el('span', { html: `PC = line ${snap.pc + 1}${snap.halted ? ' (halted)' : ''}` }));
  if (showFlags) {
    const fl = el('div', { class: 'flags-row' });
    ['N','Z','C','V'].forEach(k => {
      fl.appendChild(el('span', {
        class: 'flag' + (snap.flags[k] ? ' set' : ''),
        html: `${k}=${snap.flags[k]}`
      }));
    });
    head.appendChild(fl);
  }
  panel.appendChild(head);

  const grid = el('div', { class: 'reg-grid' });
  // Show registers with non-zero values, plus SP, FP, LR if used.
  // Always show X0..X7 (commonly addressed) so the user can see their state.
  const seen = new Set();
  const cells = [];
  function add(idx) {
    if (seen.has(idx)) return;
    seen.add(idx);
    const name = idx === 28 ? 'SP' : idx === 29 ? 'FP' : idx === 30 ? 'LR' : idx === 31 ? 'XZR' : `X${idx}`;
    const v = snap.regs[idx];
    const changed = prev && prev.regs[idx] !== v;
    const cell = el('div', { class: 'reg-cell' + (changed ? ' changed' : '') });
    cell.appendChild(el('span', { class: 'rn', html: name }));
    cell.appendChild(el('span', { class: 'rv', html: fmtRegVal(v) }));
    cells.push({ idx, cell });
  }
  for (let i = 0; i <= 7; i++) add(i);
  for (let i = 8; i <= 31; i++) {
    if (snap.regs[i] !== 0n || (prev && prev.regs[i] !== 0n)) add(i);
  }
  cells.sort((a,b) => a.idx - b.idx).forEach(c => grid.appendChild(c.cell));
  panel.appendChild(grid);
}

function fmtRegVal(v) {
  // Show small values as decimal; large unsigned as hex.
  const u = toU64(v);
  const s = toS64(v);
  if (u === 0n) return '0';
  if (u < 0x10000n) return s < 0n ? `${s} (0x${u.toString(16).toUpperCase()})` : String(u);
  return '0x' + u.toString(16).toUpperCase();
}

function drawMemStrip(host, mem, initMem, lastMem) {
  if (!host) return;
  host.innerHTML = '';
  // Determine address range from initMem keys + sizes
  const bytes = [];
  Object.entries(initMem).forEach(([addr, val]) => {
    const a0 = Number(typeof addr === 'string' && addr.startsWith('0x') ? parseInt(addr, 16) : addr);
    const len = Array.isArray(val) ? val.length : 1;
    for (let i = 0; i < len; i++) bytes.push(a0 + i);
  });
  bytes.sort((a, b) => a - b);
  bytes.forEach(addr => {
    const cell = el('div', { class: 'mem-byte' });
    cell.appendChild(el('span', { class: 'ma', html: '0x' + addr.toString(16).toUpperCase() }));
    cell.appendChild(el('span', { class: 'mv', html: (mem.has(addr) ? mem.get(addr) : 0).toString(16).padStart(2,'0').toUpperCase() }));
    if (lastMem && lastMem.bytes && lastMem.bytes.includes(addr)) {
      cell.classList.add(lastMem.op === 'read' ? 'read' : 'write');
    }
    host.appendChild(cell);
  });
}

function checkCodeTrace(ch, ctx) {
  const rt = ctx.getRuntime();
  if (!rt) return { correct: false, message: 'No trace state.' };
  // Run to completion if user hasn't.
  if (!rt.machine.halted) rt.machine.runAll();
  rt.snapshot = rt.machine.snapshot();
  if (typeof rt.refreshUI === 'function') rt.refreshUI();
  if (!ch.asks || ch.asks === '__none__') {
    return { correct: true };
  }
  const inp = document.getElementById('trace-answer');
  if (!inp) return { correct: false, message: 'Answer field missing.' };
  if (ch.asks === 'NZCV' || ch.asks === 'flags') {
    // Expect e.g. "1010" or "N=1 Z=0 C=1 V=0"
    const userRaw = inp.value.trim().toUpperCase();
    const got = `${rt.machine.flags.N}${rt.machine.flags.Z}${rt.machine.flags.C}${rt.machine.flags.V}`;
    const wantRaw = String(ch.ans).toUpperCase().replace(/[^01NZCV=]/g, '');
    const correct = userRaw.replace(/[^01]/g, '') === got || userRaw === wantRaw;
    inp.classList.toggle('correct', correct);
    inp.classList.toggle('wrong',   !correct);
    return { correct, locked: correct };
  }
  // Register read or memory read
  let actual;
  if (ch.asks.startsWith('mem:')) {
    const parts = ch.asks.split(':');
    const a0 = parseInt(parts[1], 16) || parseInt(parts[1], 10);
    const n  = parseInt(parts[2] || '8', 10);
    let v = 0n;
    for (let i = 0; i < n; i++) v |= BigInt(rt.machine.mem.get(a0 + i) || 0) << (8n * BigInt(i));
    actual = v;
  } else {
    const ridx = ['SP','FP','LR','XZR'].indexOf(ch.asks);
    let r;
    if (ridx === 0) r = 28;
    else if (ridx === 1) r = 29;
    else if (ridx === 2) r = 30;
    else if (ridx === 3) r = 31;
    else { const m = /^X(\d+)$/i.exec(ch.asks); r = m ? parseInt(m[1], 10) : null; }
    if (r == null) return { correct: false, message: `Unknown asks target: ${ch.asks}` };
    actual = rt.machine.regs[r];
  }
  const signed = ch.format === 'signed';
  const correct = answerMatches(ch.ans, inp.value, { signed });
  inp.classList.toggle('correct', correct);
  inp.classList.toggle('wrong',   !correct);
  if (!correct) {
    const expectedShow = ch.format === 'hex' ? '0x' + toU64(ch.ans).toString(16).toUpperCase()
                       : ch.format === 'bin' ? '0b' + toU64(ch.ans).toString(2)
                       : ch.format === 'signed' ? String(toS64(ch.ans))
                       : String(ch.ans);
    return { correct, message: `✗ Final ${ch.asks} was ${expectedShow}.` };
  }
  return { correct, locked: true };
}

// ============================================================
//  FILL-BLANK — instruction template with blanks
// ============================================================
// Author shape:
//   { type:'fill-blank',
//     prompt: "Complete the instruction:",
//     template: "___ X3, X1, X2",       // each ___ is one blank
//     blanks:   ["ADD"],                 // expected answers for each blank, in order
//     palette?: ["ADD","SUB","AND","ORR"],  // chip palette
//     comment?: "X3 = X1 + X2",
//     concept?, explain? }
// ============================================================
function renderFillBlank(container, ch, ctx) {
  const filled = new Array((ch.blanks || []).length).fill(null);
  ctx.setRuntime({ filled });

  const line = el('div', { class: 'fb-line' });
  const parts = ch.template.split(/(___+)/);
  let blankIdx = 0;
  parts.forEach(p => {
    if (/^_+$/.test(p)) {
      const idx = blankIdx++;
      const blank = el('span', {
        class: 'fb-blank', 'data-idx': String(idx), html: '___',
        onclick(){
          // tap-to-clear: remove placed chip back to palette
          if (filled[idx]) returnChipToPalette(filled[idx], idx);
        }
      });
      // Allow keyboard typing if no palette is provided
      if (!ch.palette) {
        blank.innerHTML = '';
        blank.appendChild(el('input', {
          class: 'fb-input', placeholder: '___', 'data-bidx': String(idx),
          onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); },
          oninput(){ filled[idx] = this.value.trim(); }
        }));
      }
      line.appendChild(blank);
    } else {
      // Render plain text, with light syntax colour for register/imm tokens
      const span = el('span', { html: highlightAsm(p) });
      line.appendChild(span);
    }
  });
  if (ch.comment) {
    line.appendChild(el('span', { class: 'cm', style: 'color:var(--muted);font-style:italic;margin-left:8px;', html: '// ' + escapeHtml(ch.comment) }));
  }
  container.appendChild(line);

  if (ch.palette) {
    const palette = el('div', { class: 'fb-palette', id: 'fb-palette' });
    ch.palette.forEach(p => palette.appendChild(makeChip(p)));
    container.appendChild(palette);
  }

  function makeChip(label) {
    return el('div', {
      class: 'dm-chip', 'data-label': label, html: label,
      onclick(){
        // Place into the next empty blank
        if (this.classList.contains('placed')) return;
        const idx = filled.findIndex(v => v == null);
        if (idx < 0) return;
        placeChip(this, idx);
      }
    });
  }
  function placeChip(chip, idx) {
    chip.classList.add('placed');
    chip.style.opacity = '0.4';
    filled[idx] = chip.getAttribute('data-label');
    const blank = container.querySelector(`.fb-blank[data-idx="${idx}"]`);
    blank.classList.add('filled');
    blank.textContent = filled[idx];
  }
  function returnChipToPalette(label, idx) {
    filled[idx] = null;
    const blank = container.querySelector(`.fb-blank[data-idx="${idx}"]`);
    blank.classList.remove('filled');
    blank.textContent = '___';
    const palette = document.getElementById('fb-palette');
    if (!palette) return;
    const chip = palette.querySelector(`.dm-chip[data-label="${CSS.escape(label)}"]`);
    if (chip) { chip.classList.remove('placed'); chip.style.opacity = ''; }
  }
}
function checkFillBlank(ch, ctx) {
  const { filled } = ctx.getRuntime() || {};
  if (!filled) return { correct: false, message: 'No state.' };
  // For each blank, accept exact match (case-insensitive) or alternates
  const expected = ch.blanks || [];
  const alts = ch.alts || expected.map(() => []);
  let allCorrect = true;
  filled.forEach((v, i) => {
    const want = String(expected[i] || '').toUpperCase().trim();
    const got  = String(v || '').toUpperCase().trim();
    const match = got === want || (alts[i] || []).map(s => s.toUpperCase()).includes(got);
    const blank = document.querySelector(`.fb-blank[data-idx="${i}"]`);
    if (blank) {
      blank.classList.remove('filled');
      blank.classList.toggle('correct', match);
      blank.classList.toggle('wrong', !match);
      if (!match) allCorrect = false;
    }
  });
  return { correct: allCorrect, locked: allCorrect };
}

// ============================================================
//  BIT-FIELD — instruction-format bit-field builder
// ============================================================
// Author shape:
//   { type:'bit-field',
//     prompt: "Encode ADD X3, X1, X2 as R-format.",
//     format:  'R' | 'I' | 'D' | 'B' | 'CB' | 'IM',
//     fields:  // list of segments, each { name, hi, lo, color, expected, mode }
//       [
//         { name:'opcode', hi:31, lo:21, expected:0b10001011000, mode:'bits',  width:11 },
//         { name:'Rm',     hi:20, lo:16, expected:2, mode:'reg',   width:5  },
//         { name:'shamt',  hi:15, lo:10, expected:0, mode:'imm',   width:6  },
//         { name:'Rn',     hi: 9, lo: 5, expected:1, mode:'reg',   width:5  },
//         { name:'Rd',     hi: 4, lo: 0, expected:3, mode:'reg',   width:5  },
//       ],
//     concept?, explain? }
//
// `mode` controls how the user fills the field:
//   'bits' — click each bit to toggle 0/1
//   'reg'  — type a register number (e.g. "3" for X3) or a name (XZR, SP)
//   'imm'  — type a decimal/hex immediate (auto-converted to bits)
// ============================================================
function renderBitField(container, ch, ctx) {
  const fields = ch.fields.map(f => ({
    ...f,
    width: (f.hi - f.lo + 1),
    bits: new Array(f.hi - f.lo + 1).fill(0), // index 0 = LSB
    text: '',
  }));
  ctx.setRuntime({ fields, format: ch.format });

  const row = el('div', { class: 'field-row' });
  const colourClass = {
    opcode: 'hl-opcode', Rm: 'hl-rm', shamt: 'hl-shamt', Rn: 'hl-rn', Rd: 'hl-rd',
    immediate: 'hl-imm', address: 'hl-addr', op2: 'hl-op2', Rt: 'hl-rt',
    cond: 'hl-cond', shift: 'hl-shift', hw: 'hl-hw', imm12: 'hl-imm', imm9: 'hl-imm',
    imm16: 'hl-imm', imm26: 'hl-imm', imm19: 'hl-imm',
  };
  const fsClass = {
    opcode:'fs-op', Rm:'fs-rm', shamt:'fs-sh', Rn:'fs-rn', Rd:'fs-rd',
    immediate:'fs-imm', address:'fs-addr', op2:'fs-op2', Rt:'fs-rt',
    cond:'fs-cond', shift:'fs-sh', hw:'fs-hw', imm12:'fs-imm', imm9:'fs-imm',
    imm16:'fs-imm', imm26:'fs-imm', imm19:'fs-imm',
  };
  fields.forEach((f, fi) => {
    const seg = el('div', { class: 'field-segment ' + (colourClass[f.name] || 'hl-opcode') });
    const bitsRow = el('div', { class: 'field-seg-bits ' + (fsClass[f.name] || 'fs-op') });
    for (let b = f.width - 1; b >= 0; b--) {
      const bb = el('div', {
        class: 'field-seg-bit editable', html: '0',
        'data-fi': String(fi), 'data-b': String(b),
        onclick(){
          if (f.mode !== 'bits') return;
          const bi = parseInt(this.getAttribute('data-b'), 10);
          f.bits[bi] = f.bits[bi] ? 0 : 1;
          this.textContent = f.bits[bi];
          this.style.fontWeight = f.bits[bi] ? '700' : '400';
        }
      });
      bitsRow.appendChild(bb);
    }
    seg.appendChild(bitsRow);
    seg.appendChild(el('div', { class: 'field-seg-label', html: `${f.name} (${f.hi}–${f.lo})` }));
    if (f.mode === 'reg' || f.mode === 'imm') {
      seg.appendChild(el('input', {
        class: 'field-input', 'data-fi': String(fi),
        placeholder: f.mode === 'reg' ? 'X#' : '#',
        oninput(){
          f.text = this.value.trim();
          // Live preview: update bits row
          let v = parseFieldValue(f.text, f.mode);
          if (v == null) v = 0;
          for (let b = 0; b < f.width; b++) {
            f.bits[b] = (v >> b) & 1;
            const bel = bitsRow.querySelector(`[data-b="${b}"]`);
            if (bel) { bel.textContent = String(f.bits[b]); bel.style.fontWeight = f.bits[b] ? '700' : '400'; }
          }
        },
        onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); }
      }));
    }
    row.appendChild(seg);
  });
  container.appendChild(row);

  if (ch.encoded) {
    const reveal = el('p', { class: 'hint', html: `Hex (after you fill all fields, this should equal): <code>${ch.encoded}</code>` });
    container.appendChild(reveal);
  }
}
function parseFieldValue(text, mode) {
  if (text == null || text === '') return null;
  if (mode === 'reg') {
    if (/^XZR$/i.test(text)) return 31;
    if (/^SP$/i.test(text))  return 28;
    if (/^FP$/i.test(text))  return 29;
    if (/^LR$/i.test(text))  return 30;
    const m = /^X?(\d{1,2})$/i.exec(text.trim());
    if (m) return parseInt(m[1], 10);
    return null;
  }
  if (/^0x[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
  if (/^0b[01]+$/i.test(text))     return parseInt(text.slice(2), 2);
  if (/^-?\d+$/.test(text))        return parseInt(text, 10);
  return null;
}
function checkBitField(ch, ctx) {
  const { fields } = ctx.getRuntime() || {};
  if (!fields) return { correct: false, message: 'No state.' };
  let allCorrect = true;
  fields.forEach((f, fi) => {
    const v = bitsToInt(f.bits);
    let exp = f.expected;
    // Mask to field width for comparison.
    const mask = (1 << f.width) - 1;
    const match = (v & mask) === (exp & mask);
    if (!match) allCorrect = false;
    // visual feedback on the segment
    const seg = document.querySelectorAll('.field-segment')[fi];
    if (seg) {
      seg.style.borderColor = match ? 'var(--green)' : 'var(--red)';
      seg.style.boxShadow = match ? '0 0 8px rgba(74,222,128,.25)' : '0 0 8px rgba(248,113,113,.2)';
    }
    const inp = document.querySelector(`.field-input[data-fi="${fi}"]`);
    if (inp) inp.classList.toggle('correct', match), inp.classList.toggle('wrong', !match);
  });
  return { correct: allCorrect, locked: allCorrect };
}

// ============================================================
//  DRAG-MATCH — drag/tap chips onto labelled targets
// ============================================================
// Author shape:
//   { type:'drag-match',
//     prompt: "Match each register to its calling-convention role.",
//     pairs: [
//       { chip:'X0–X7',   target:'argument / return values' },
//       { chip:'X19–X27', target:'callee-saved (preserved across calls)' },
//       { chip:'X30',     target:'link register (return address)' },
//       { chip:'XZR',     target:'always reads zero' },
//     ],
//     concept?, explain? }
// ============================================================
function renderDragMatch(container, ch, ctx) {
  const placement = {}; // targetIdx → chipIdx
  ctx.setRuntime({ placement });

  const area = el('div', { class: 'dm-area' });

  const bank = el('div', { class: 'dm-bank' });
  bank.appendChild(el('div', { class: 'dm-pool-title', html: 'Drag/tap a chip…' }));
  // Shuffle chip order so the layout doesn't trivially answer the puzzle.
  const chipOrder = ch.pairs.map((_, i) => i).sort(() => Math.random() - 0.5);
  chipOrder.forEach(ci => {
    const chip = el('div', {
      class: 'dm-chip', 'data-ci': String(ci), html: ch.pairs[ci].chip,
      onclick(){
        // Tap-to-select: highlight, then tap a target to place.
        const cur = bank.querySelector('.dm-chip.selected');
        if (cur === this) { this.classList.remove('selected'); return; }
        if (cur) cur.classList.remove('selected');
        this.classList.add('selected');
      }
    });
    chip.draggable = true;
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/ci', String(ci));
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    bank.appendChild(chip);
  });
  area.appendChild(bank);

  const targets = el('div', { class: 'dm-targets' });
  targets.appendChild(el('div', { class: 'dm-pool-title', html: '… onto its match' }));
  const targetOrder = ch.pairs.map((_, i) => i).sort(() => Math.random() - 0.5);
  targetOrder.forEach(ti => {
    const t = el('div', {
      class: 'dm-target', 'data-ti': String(ti),
      onclick(){
        const sel = bank.querySelector('.dm-chip.selected');
        if (!sel) {
          // tap-to-clear placed chip
          const ci = placement[ti];
          if (ci != null) returnChip(ti, ci);
          return;
        }
        placeChip(parseInt(sel.getAttribute('data-ci'), 10), ti);
        sel.classList.remove('selected');
      },
      ondragover(e){ e.preventDefault(); this.classList.add('drop-hover'); },
      ondragleave(){ this.classList.remove('drop-hover'); },
      ondrop(e){
        e.preventDefault();
        this.classList.remove('drop-hover');
        const ci = parseInt(e.dataTransfer.getData('text/ci'), 10);
        if (!isNaN(ci)) placeChip(ci, ti);
      }
    });
    t.appendChild(el('span', { class: 'dm-tlabel', html: ch.pairs[ti].target }));
    t.appendChild(el('span', { class: 'dm-slot' }));
    targets.appendChild(t);
  });
  area.appendChild(targets);
  container.appendChild(area);

  function placeChip(ci, ti) {
    // If chip already placed elsewhere, clear that slot first.
    Object.keys(placement).forEach(k => { if (placement[k] === ci) returnChip(parseInt(k,10), ci); });
    // If target already has a chip, return it.
    if (placement[ti] != null && placement[ti] !== ci) returnChip(ti, placement[ti]);
    placement[ti] = ci;
    const chip = bank.querySelector(`.dm-chip[data-ci="${ci}"]`);
    const slot = targets.querySelector(`.dm-target[data-ti="${ti}"] .dm-slot`);
    if (slot) {
      slot.innerHTML = '';
      const placed = el('div', { class: 'dm-chip placed', 'data-ci': String(ci), html: ch.pairs[ci].chip });
      slot.appendChild(placed);
    }
    if (chip) chip.style.visibility = 'hidden';
    targets.querySelector(`.dm-target[data-ti="${ti}"]`).classList.add('has-chip');
  }
  function returnChip(ti, ci) {
    delete placement[ti];
    const chip = bank.querySelector(`.dm-chip[data-ci="${ci}"]`);
    if (chip) chip.style.visibility = '';
    const tEl = targets.querySelector(`.dm-target[data-ti="${ti}"]`);
    if (tEl) {
      tEl.classList.remove('has-chip');
      const slot = tEl.querySelector('.dm-slot');
      if (slot) slot.innerHTML = '';
    }
  }
}
function checkDragMatch(ch, ctx) {
  const { placement } = ctx.getRuntime() || {};
  if (!placement) return { correct: false, message: 'No state.' };
  let allCorrect = true;
  ch.pairs.forEach((pair, ti) => {
    const ci = placement[ti];
    const t = document.querySelector(`.dm-target[data-ti="${ti}"]`);
    const match = ci === ti;
    if (!match) allCorrect = false;
    if (t) {
      t.classList.toggle('correct', match);
      t.classList.toggle('wrong', ci != null && !match);
    }
  });
  if (Object.keys(placement).length !== ch.pairs.length) {
    return { correct: false, message: 'Place every chip first.', soft: true };
  }
  return { correct: allCorrect, locked: allCorrect };
}

// ============================================================
//  DATAPATH-TRACE — show single-cycle datapath, ask which
//                   wires/blocks light up for an instruction.
// ============================================================
// Author shape (kept simple — MC over which paths activate):
//   { type:'datapath-trace',
//     prompt: "Which datapath signals are active for `LDUR X1, [X2,#0]`?",
//     instruction: "LDUR X1, [X2, #0]",
//     activeWires: ['PC','IM','RegRead','ALU','DMem-read','MUX-mem','RegWrite'],
//     opts:[ ... ], ans: idx,           // OR
//     concept?, explain? }
// ============================================================
function renderDatapath(container, ch, ctx) {
  // Static SVG of a simplified single-cycle datapath. Highlight the
  // wires named in ch.activeWires.
  const svg = makeDatapathSVG(ch.activeWires || []);
  container.appendChild(el('div', { class: 'datapath-wrap' }, svg));
  if (ch.instruction) {
    container.appendChild(el('div', { class: 'sub-num', html: `Instruction: <code>${escapeHtml(ch.instruction)}</code>` }));
  }
  // Defer to MC for the actual question.
  if (ch.opts) renderMC(container, ch, ctx);
  else if (ch.ans != null) renderType(container, ch, ctx);
}
function checkDatapath(ch, ctx) {
  if (ch.opts) return checkMC(ch, ctx);
  return checkType(ch, ctx);
}
function makeDatapathSVG(active) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 720 280');
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  function block(x, y, w, h, label, id) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', 6);
    r.setAttribute('class', 'dp-block' + (active.includes(id) ? ' active' : ''));
    svg.appendChild(r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x + w/2); t.setAttribute('y', y + h/2 + 4);
    t.setAttribute('class', 'dp-block-text');
    t.textContent = label;
    svg.appendChild(t);
  }
  function wire(d, id, kind = '') {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'dp-wire ' + kind + (active.includes(id) ? ' active' : ''));
    svg.appendChild(p);
  }
  // Blocks
  block( 20, 100,  50, 40, 'PC',      'PC');
  block( 90,  90, 100, 60, 'I-Mem',   'IM');
  block(220,  60, 130,  130,'Reg File','RegRead');
  block(380, 100, 110, 50, 'ALU',     'ALU');
  block(520,  70, 130, 60, 'D-Mem (R)','DMem-read');
  block(520, 150, 130, 60, 'D-Mem (W)','DMem-write');
  block(380, 200,  90, 40, 'Sign-Ext', 'SignExt');
  // Wires
  wire('M70,120 L90,120',                          'PC');
  wire('M190,120 L220,120',                        'IM');
  wire('M350,100 L380,115',                        'RegRead');
  wire('M350,150 L380,135',                        'RegRead');
  wire('M490,125 L520,100',                        'DMem-read');
  wire('M490,125 L520,180',                        'DMem-write', 'write');
  wire('M650,100 L700,100 L700,75 L350,75 L350,90','RegWrite',   'write');
  wire('M425,150 L425,200',                        'SignExt');
  wire('M470,220 L490,150',                        'MUX-mem');
  return svg;
}

// ============================================================
//  CACHE-SIM — given an address and cache config, compute the
//              tag/index/offset, then judge hit/miss.
// ============================================================
// Author shape:
//   { type:'cache-sim',
//     prompt: "Compute the tag/index/offset for 0x1A2C in this cache.",
//     cache: { totalBytes:1024, blockBytes:16, ways:1, addrBits:16 },
//     accesses: [ { addr:0x1A2C, expected:'miss' } ],   // optional sequence
//     ask: 'fields' | 'hit-miss' | 'amat',
//     ans: { tag:0x1A, index:2, offset:12 } | 'miss' | 5.5,
//     concept?, explain? }
// ============================================================
function renderCacheSim(container, ch, ctx) {
  const c = ch.cache;
  const offsetBits = Math.log2(c.blockBytes);
  const sets = c.totalBytes / (c.blockBytes * c.ways);
  const indexBits = Math.log2(sets);
  const tagBits = c.addrBits - offsetBits - indexBits;
  ctx.setRuntime({ cache: c, offsetBits, indexBits, tagBits });

  const summary = el('p', { class: 'hint',
    html: `Cache: ${c.totalBytes}B, ${c.blockBytes}B/block, ${c.ways === 1 ? 'direct-mapped' : c.ways + '-way'}, ${sets} sets. `
          + `Address: ${c.addrBits} bits → tag ${tagBits} | index ${indexBits} | offset ${offsetBits}.` });
  container.appendChild(summary);

  if (ch.ask === 'fields') {
    const wrap = el('div', { class:'two-col', style:'margin-top:10px;' });
    ['tag','index','offset'].forEach(field => {
      const w = el('div');
      w.appendChild(el('div', { class: 'sub-num', style:'text-align:left;', html: `<strong>${field}</strong>` }));
      w.appendChild(el('input', {
        type: 'text', class: 'type-input', 'data-field': field,
        placeholder: `${field} value`, autocomplete:'off',
        onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); }
      }));
      wrap.appendChild(w);
    });
    container.appendChild(wrap);
  } else {
    // Single answer (hit/miss or AMAT) — text input
    container.appendChild(el('div', { class: 'type-wrap' },
      el('input', { type: 'text', class: 'type-input', id: 'cache-answer', placeholder: 'answer',
                    onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); } })));
  }
}
function checkCacheSim(ch, ctx) {
  if (ch.ask === 'fields') {
    const want = ch.ans;
    let allMatch = true;
    ['tag','index','offset'].forEach(f => {
      const inp = document.querySelector(`input[data-field="${f}"]`);
      if (!inp) { allMatch = false; return; }
      const v = inp.value.trim();
      let n;
      if (/^0x[0-9a-f]+$/i.test(v)) n = parseInt(v, 16);
      else if (/^0b[01]+$/i.test(v)) n = parseInt(v.slice(2), 2);
      else n = parseInt(v, 10);
      const ok = !isNaN(n) && n === want[f];
      inp.classList.toggle('correct', ok);
      inp.classList.toggle('wrong',   !ok);
      if (!ok) allMatch = false;
    });
    return { correct: allMatch, locked: allMatch };
  }
  const inp = document.getElementById('cache-answer');
  if (!inp) return { correct: false, message: 'Answer field missing.' };
  const userVal = inp.value.trim().toLowerCase();
  const want    = String(ch.ans).toLowerCase();
  const correct = userVal === want;
  inp.classList.toggle('correct', correct);
  inp.classList.toggle('wrong',   !correct);
  return { correct, locked: correct };
}

// ============================================================
//  PIPELINE-TRACE — render a 5-stage timeline + ask MC/type
// ============================================================
// Author shape:
//   { type:'pipeline-trace',
//     prompt: "How many total cycles does this sequence take?",
//     // Each row = one instruction.
//     // stages[] is what appears in each column (cycle 1..N).
//     // Use 'IF','ID','EX','MEM','WB','stall','bubble', or null for empty.
//     rows: [
//       { label:'ADD X1,X2,X3', stages:['IF','ID','EX','MEM','WB'] },
//       { label:'SUB X4,X1,X5', stages:[null,'IF','ID','stall','EX','MEM','WB'] },
//     ],
//     // Optional forwarding arrows: array of { from:{row,stage}, to:{row,stage}, kind:'EX-EX'|'MEM-EX' }
//     forwarding?: [{ from:{row:0,stage:4}, to:{row:1,stage:4} }],
//     // Then a multiple-choice question OR a text answer:
//     opts?: [...], ans?: idx,                 // multiple choice
//     // OR
//     askType?: 'type', ans?: '6',             // free-form answer
//     concept?, explain? }
// ============================================================
function renderPipelineTrace(container, ch, ctx) {
  const rows = ch.rows || [];
  const cols = Math.max(0, ...rows.map(r => (r.stages || []).length));

  // Header row: cycle numbers
  const grid = el('div', { class: 'pipe-grid',
    style: `grid-template-columns: 160px repeat(${cols}, minmax(48px, 1fr));` });
  grid.appendChild(el('div', { class: 'pipe-row-label', html: 'Instruction \\ cycle' }));
  for (let c = 1; c <= cols; c++) {
    grid.appendChild(el('div', { class: 'pipe-row-label', html: String(c) }));
  }

  rows.forEach((row, ri) => {
    grid.appendChild(el('div', { class: 'pipe-row-label', html: escapeHtml(row.label || '') }));
    for (let c = 0; c < cols; c++) {
      const s = (row.stages || [])[c];
      if (!s) {
        grid.appendChild(el('div', { class: 'pipe-cell empty', 'data-row': String(ri), 'data-col': String(c) }));
      } else if (s === 'stall' || s === 'bubble') {
        grid.appendChild(el('div', { class: `pipe-cell ${s}`, 'data-row': String(ri), 'data-col': String(c), html: '⊘' }));
      } else {
        grid.appendChild(el('div', { class: `pipe-cell ${s}`, 'data-row': String(ri), 'data-col': String(c), html: s }));
      }
    }
  });
  container.appendChild(grid);

  // Optional forwarding callouts (rendered below the grid as text, since
  // overlaying SVG arrows on a CSS grid is fiddly across browsers).
  if (ch.forwarding && ch.forwarding.length) {
    const caption = el('div', { class: 'sub-num', style: 'text-align:left;margin-top:6px;' });
    caption.innerHTML = '<strong style="color:var(--accent)">Forwarding paths:</strong> '
      + ch.forwarding.map(f => {
          const fr = rows[f.from.row]?.label || `row ${f.from.row}`;
          const to = rows[f.to.row]?.label   || `row ${f.to.row}`;
          const ks = f.kind ? ` (${f.kind})` : '';
          return `${fr}[cycle ${f.from.stage+1}] → ${to}[cycle ${f.to.stage+1}]${ks}`;
        }).join('; ');
    container.appendChild(caption);
  }

  // Defer the answer prompt to MC or text.
  if (ch.opts) {
    renderMC(container, ch, ctx);
  } else if (ch.askType === 'type' || ch.ans != null) {
    container.appendChild(el('div', { class: 'type-wrap' },
      el('input', {
        type:'text', class:'type-input', id:'pipe-answer',
        placeholder:'answer', autocomplete:'off',
        onkeydown(e){ if (e.key === 'Enter') ctx.requestCheck(); }
      })));
  }
}
function checkPipelineTrace(ch, ctx) {
  if (ch.opts) return checkMC(ch, ctx);
  const inp = document.getElementById('pipe-answer');
  if (!inp) return { correct: false, message: 'Answer field missing.' };
  const userVal = inp.value.trim().toLowerCase();
  const want    = String(ch.ans).toLowerCase();
  const correct = userVal === want;
  inp.classList.toggle('correct', correct);
  inp.classList.toggle('wrong',   !correct);
  return { correct, locked: correct };
}

// ============================================================
//  Registry
// ============================================================
export const TYPES = {
  'mc':              { render: renderMC,         check: checkMC },
  'type':            { render: renderType,       check: checkType },
  'toggle-target':   { render: renderToggle,     check: checkToggle },
  'toggle-free':     { render: renderToggle,     check: checkToggle },
  'code-trace':      { render: renderCodeTrace,  check: checkCodeTrace },
  'fill-blank':      { render: renderFillBlank,  check: checkFillBlank },
  'bit-field':       { render: renderBitField,   check: checkBitField },
  'drag-match':      { render: renderDragMatch,  check: checkDragMatch },
  'datapath-trace':  { render: renderDatapath,   check: checkDatapath },
  'pipeline-trace':  { render: renderPipelineTrace, check: checkPipelineTrace },
  'cache-sim':       { render: renderCacheSim,   check: checkCacheSim },
};

export function renderChallenge(container, ch, ctx) {
  const handler = TYPES[ch.type];
  if (!handler) {
    container.appendChild(el('div', { class: 'card',
      html: `<p>Unknown challenge type: <code>${escapeHtml(ch.type)}</code></p>` }));
    return;
  }
  handler.render(container, ch, ctx);
}

export function checkChallenge(ch, ctx) {
  const handler = TYPES[ch.type];
  if (!handler) return { correct: false, message: 'Unknown type' };
  return handler.check(ch, ctx);
}
