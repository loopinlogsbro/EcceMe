// ============================================================
// legv8.js — Minimal LEGv8 (Patterson & Hennessy ARM Edition)
//            interpreter for code-trace challenges.
// ============================================================
// Supported instructions (case-insensitive):
//
//   Arithmetic:   ADD, ADDS, SUB, SUBS, ADDI, ADDIS, SUBI, SUBIS
//   Logical:      AND, ANDS, ORR, EOR, ANDI, ANDIS, ORRI, EORI
//   Shift:        LSL, LSR  (immediate shift amount form)
//   Wide const:   MOVZ, MOVK   (with optional `, LSL #n`)
//   Memory:       LDUR,  STUR,         (64-bit doubleword)
//                 LDURB, STURB,        (byte, zero-extend on load)
//                 LDURH, STURH,        (halfword, zero-extend on load)
//                 LDURSW, STURW        (word; LDURSW sign-extends)
//   Branches:     B  label
//                 CBZ Xn, label,  CBNZ Xn, label
//                 B.cond label   (EQ NE LT LE GT GE MI PL VS VC HI HS LO LS AL)
//                 BL label
//                 BR Xn          (typically `BR LR` for return)
//   Misc:         NOP, MOV (assembler alias for ADD Xd, XZR, Xm)
//
// Conventions (LEGv8 / P&H):
//   X28 = SP, X29 = FP, X30 = LR. Register 31 is XZR.
//
// Public API:
//   parse(srcLines)  -> { lines, labels, errors }
//   makeMachine({lines, labels, initRegs, initMem, sp})
//      -> { regs, mem, pc, flags, halted, step(), runAll(maxSteps) }
//
// Internal state:
//   regs is a 32-entry Array of BigInt (index 31 is XZR — always 0n).
//   mem is a Map<Number, Number> of byte addresses → 0..255.
//   flags is { N, Z, C, V }.
//   pc is a Number (line index, 0-based).
//
// All arithmetic uses BigInt 64-bit. Helpers below mask to 64-bit
// and convert between signed/unsigned views as needed. Carry/overflow
// follow the standard ALU semantics (N=MSB, Z=zero, C=carry-out for
// ADD or NOT-borrow for SUB, V=signed overflow).
// ============================================================

const MASK64 = (1n << 64n) - 1n;
const MSB64  = 1n << 63n;
const TOPBIT = 1n << 64n; // sentinel for carry detection
const SP_REG = 28;
const FP_REG = 29;
const LR_REG = 30;
const ZR_REG = 31;

// Parser ----------------------------------------------------------

const REG_PATTERNS = [
  // canonical aliases
  [/^XZR$/i,  ZR_REG],
  [/^SP$/i,   SP_REG],
  [/^FP$/i,   FP_REG],
  [/^LR$/i,   LR_REG],
];

export function parseRegister(token) {
  if (!token) return null;
  const t = token.replace(/[,]/g, '').trim();
  for (const [re, idx] of REG_PATTERNS) {
    if (re.test(t)) return idx;
  }
  const m = /^X(\d{1,2})$/i.exec(t);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 0 || n > 31) return null;
  return n;
}

// Parse an immediate operand. Accepts: #5, #-3, #0x10, #0b1010, 5, 0x10
export function parseImm(token) {
  if (token == null) return null;
  let t = String(token).replace(/[,]/g, '').trim();
  if (t.startsWith('#')) t = t.slice(1);
  if (t === '') return null;
  let neg = false;
  if (t.startsWith('-')) { neg = true; t = t.slice(1); }
  let v;
  if (/^0x[0-9a-f]+$/i.test(t)) v = parseInt(t, 16);
  else if (/^0b[01]+$/i.test(t)) v = parseInt(t.slice(2), 2);
  else if (/^\d+$/.test(t))      v = parseInt(t, 10);
  else return null;
  return BigInt(neg ? -v : v);
}

// Tokenize a single line into mnemonic + operand strings.
function tokenize(raw) {
  // Strip comments (// or ;)
  let line = raw.split('//')[0].split(';')[0].trim();
  if (!line) return null;
  // Split off label `label: rest`
  let label = null;
  const labelMatch = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
  if (labelMatch) { label = labelMatch[1]; line = labelMatch[2].trim(); }
  if (!line) return { label, mnemonic: null, operands: [] };
  // Split mnemonic and operands. Memory operands `[X1, #8]` may contain
  // commas, so preserve bracketed groups.
  const firstSpace = line.search(/\s/);
  const mnemonic = (firstSpace < 0 ? line : line.slice(0, firstSpace)).toUpperCase();
  const rest = firstSpace < 0 ? '' : line.slice(firstSpace + 1).trim();
  const operands = splitOperands(rest);
  return { label, mnemonic, operands };
}

// Split on commas at depth 0 (respect [...] groups for memory operands).
function splitOperands(s) {
  if (!s) return [];
  const out = [];
  let depth = 0, buf = '';
  for (const ch of s) {
    if (ch === '[') depth++;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(buf.trim()); buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// Parse `[Xn]` or `[Xn, #imm]` memory operand.
function parseMemOperand(op) {
  const m = /^\[\s*([^,\s\]]+)\s*(?:,\s*(.+?))?\s*\]$/.exec(op);
  if (!m) return null;
  const base = parseRegister(m[1]);
  if (base == null) return null;
  const offset = m[2] ? parseImm(m[2]) : 0n;
  if (offset == null) return null;
  return { base, offset };
}

export function parse(srcLines) {
  const lines  = [];
  const labels = {};
  const errors = [];
  srcLines.forEach((src, idx) => {
    try {
      const tok = tokenize(src);
      if (!tok) { lines.push({ source: src, blank: true }); return; }
      if (tok.label) labels[tok.label] = lines.length;
      // A pure label line still occupies its own line index for stepping,
      // but executes as a NOP.
      const entry = {
        source: src,
        label:  tok.label || null,
        mnemonic: tok.mnemonic,
        operands: tok.operands,
      };
      lines.push(entry);
    } catch (e) {
      errors.push(`Line ${idx + 1}: ${e.message}`);
      lines.push({ source: src, error: e.message });
    }
  });
  return { lines, labels, errors };
}

// Machine ---------------------------------------------------------

// Turn a 64-bit BigInt (potentially negative or oversized) into the
// canonical 0..2^64-1 representation.
export function toU64(v) { return ((BigInt(v) % (1n << 64n)) + (1n << 64n)) & MASK64; }

// Signed view of a 64-bit BigInt.
export function toS64(v) {
  v = toU64(v);
  return v & MSB64 ? v - (1n << 64n) : v;
}

export function makeMachine({ lines, labels, initRegs = {}, initMem = {}, sp = 0x7FFC00000n } = {}) {
  const regs = new Array(32).fill(0n);
  // Default SP — high page so STUR with negative offsets has room. The
  // exact value doesn't matter for level math; users will see SP-relative
  // offsets directly.
  regs[SP_REG] = typeof sp === 'bigint' ? sp : BigInt(sp);
  // Apply caller-supplied seed values.
  Object.keys(initRegs).forEach(name => {
    const r = parseRegister(name);
    if (r != null && r !== ZR_REG) regs[r] = toU64(initRegs[name]);
  });

  const mem = new Map();
  // initMem may be { "0x1000": [b0, b1, ...] } or { "0x1000": 0xFF }
  Object.entries(initMem).forEach(([addr, val]) => {
    const a0 = Number(parseImm(addr) ?? addr);
    if (Array.isArray(val)) {
      val.forEach((b, i) => mem.set(a0 + i, Number(b) & 0xFF));
    } else {
      mem.set(a0, Number(val) & 0xFF);
    }
  });

  const flags = { N: 0, Z: 0, C: 0, V: 0 };
  const m = {
    regs, mem, flags,
    pc: 0,
    halted: false,
    lastWritten: null,
    log: [],
    callDepth: 0,
    step,
    runAll,
    snapshot() {
      return {
        regs: regs.slice(),
        flags: { ...flags },
        pc: m.pc,
        halted: m.halted,
        lastWritten: m.lastWritten,
        memTouched: m.lastMem ? { ...m.lastMem } : null,
      };
    },
  };

  function readByte(addr) {
    const n = Number(addr);
    return mem.has(n) ? mem.get(n) : 0;
  }
  function writeByte(addr, byte) {
    mem.set(Number(addr), byte & 0xFF);
  }
  // little-endian read/write of 1, 2, 4, 8 bytes
  function readN(addr, n) {
    let v = 0n;
    const a0 = Number(addr);
    for (let i = 0; i < n; i++) v |= BigInt(readByte(a0 + i)) << (8n * BigInt(i));
    return v;
  }
  function writeN(addr, n, val) {
    val = toU64(val);
    const a0 = Number(addr);
    const touched = [];
    for (let i = 0; i < n; i++) {
      const b = Number((val >> (8n * BigInt(i))) & 0xFFn);
      writeByte(a0 + i, b);
      touched.push(a0 + i);
    }
    m.lastMem = { addr: a0, n, op: 'write', bytes: touched };
  }

  function setReg(idx, val) {
    if (idx === ZR_REG) return;
    regs[idx] = toU64(val);
    m.lastWritten = idx;
  }

  function setFlagsAdd(a, b, r) {
    // a, b are unsigned 64-bit BigInts. r is the 65-bit sum.
    flags.N = (r & MSB64) ? 1 : 0;
    flags.Z = (r & MASK64) === 0n ? 1 : 0;
    flags.C = (r & TOPBIT) ? 1 : 0;
    const sa = !!(a & MSB64), sb = !!(b & MSB64), sr = !!(r & MSB64);
    flags.V = (sa === sb && sr !== sa) ? 1 : 0;
  }
  function setFlagsSub(a, b, r) {
    // a - b implemented as a + (~b) + 1 → carry-out is "no borrow".
    flags.N = (r & MSB64) ? 1 : 0;
    flags.Z = (r & MASK64) === 0n ? 1 : 0;
    flags.C = (r & TOPBIT) ? 1 : 0;
    const sa = !!(a & MSB64), sb = !!(b & MSB64), sr = !!(r & MSB64);
    flags.V = (sa !== sb && sr !== sa) ? 1 : 0;
  }
  function setFlagsLogical(r) {
    flags.N = (r & MSB64) ? 1 : 0;
    flags.Z = (r & MASK64) === 0n ? 1 : 0;
    flags.C = 0;
    flags.V = 0;
  }

  function condTrue(cond) {
    const { N, Z, C, V } = flags;
    switch (cond.toUpperCase()) {
      case 'EQ': return Z === 1;
      case 'NE': return Z === 0;
      case 'LT': return N !== V;
      case 'LE': return Z === 1 || N !== V;
      case 'GT': return Z === 0 && N === V;
      case 'GE': return N === V;
      case 'MI': return N === 1;
      case 'PL': return N === 0;
      case 'VS': return V === 1;
      case 'VC': return V === 0;
      case 'HI': return C === 1 && Z === 0;
      case 'HS': case 'CS': return C === 1;
      case 'LO': case 'CC': return C === 0;
      case 'LS': return C === 0 || Z === 1;
      case 'AL': return true;
    }
    return false;
  }

  function lookupLabel(name) {
    if (labels[name] == null) {
      throw new Error(`Unknown label: ${name}`);
    }
    return labels[name];
  }

  // Execute the line at m.pc, advance pc.
  function step() {
    if (m.halted) return m.snapshot();
    m.lastMem = null;
    const line = lines[m.pc];
    if (!line || line.blank) {
      m.pc++;
      if (m.pc >= lines.length) m.halted = true;
      return m.snapshot();
    }
    if (!line.mnemonic) {
      // pure label or comment-only line
      m.pc++;
      if (m.pc >= lines.length) m.halted = true;
      return m.snapshot();
    }
    const mn = line.mnemonic;
    const op = line.operands;
    // For convenience
    const reg = (i) => regs[parseRegister(op[i])];
    const rw  = (i) => parseRegister(op[i]);
    let nextPc = m.pc + 1;

    try {
      switch (mn) {
        case 'NOP': break;

        case 'MOV': {
          // Assembler alias: MOV Xd, Xm  =>  ADD Xd, XZR, Xm
          //                  MOV Xd, #imm => MOVZ Xd, #imm
          const dst = rw(0);
          const second = parseRegister(op[1]);
          if (second != null) setReg(dst, regs[second]);
          else setReg(dst, parseImm(op[1]));
          break;
        }

        case 'ADD': case 'ADDS': {
          const a = reg(1), b = reg(2);
          const r = a + b;
          setReg(rw(0), r);
          if (mn === 'ADDS') setFlagsAdd(a, b, r);
          break;
        }
        case 'SUB': case 'SUBS': {
          const a = reg(1), b = reg(2);
          const r = a + ((~b) & MASK64) + 1n;
          setReg(rw(0), r);
          if (mn === 'SUBS') setFlagsSub(a, b, r);
          break;
        }
        case 'ADDI': case 'ADDIS': {
          const a = reg(1), b = toU64(parseImm(op[2]));
          const r = a + b;
          setReg(rw(0), r);
          if (mn === 'ADDIS') setFlagsAdd(a, b, r);
          break;
        }
        case 'SUBI': case 'SUBIS': {
          const a = reg(1), b = toU64(parseImm(op[2]));
          const r = a + ((~b) & MASK64) + 1n;
          setReg(rw(0), r);
          if (mn === 'SUBIS') setFlagsSub(a, b, r);
          break;
        }

        case 'AND': case 'ANDS': {
          const r = reg(1) & reg(2);
          setReg(rw(0), r);
          if (mn === 'ANDS') setFlagsLogical(r);
          break;
        }
        case 'ORR': {
          setReg(rw(0), reg(1) | reg(2));
          break;
        }
        case 'EOR': {
          setReg(rw(0), reg(1) ^ reg(2));
          break;
        }
        case 'ANDI': case 'ANDIS': {
          const r = reg(1) & toU64(parseImm(op[2]));
          setReg(rw(0), r);
          if (mn === 'ANDIS') setFlagsLogical(r);
          break;
        }
        case 'ORRI': {
          setReg(rw(0), reg(1) | toU64(parseImm(op[2])));
          break;
        }
        case 'EORI': {
          setReg(rw(0), reg(1) ^ toU64(parseImm(op[2])));
          break;
        }

        case 'LSL': {
          const sh = parseImm(op[2]) || 0n;
          setReg(rw(0), (reg(1) << sh) & MASK64);
          break;
        }
        case 'LSR': {
          const sh = parseImm(op[2]) || 0n;
          setReg(rw(0), reg(1) >> sh);
          break;
        }

        case 'MUL': {
          // MUL Xd, Xn, Xm — keeps the lower 64 bits of the product
          setReg(rw(0), (reg(1) * reg(2)) & MASK64);
          break;
        }
        case 'UDIV': {
          // ARM rule: divide by zero returns 0 (no exception).
          const d = reg(2);
          setReg(rw(0), d === 0n ? 0n : (reg(1) / d) & MASK64);
          break;
        }
        case 'SDIV': {
          const d = toS64(reg(2));
          if (d === 0n) { setReg(rw(0), 0n); break; }
          const n = toS64(reg(1));
          // Round-toward-zero (BigInt /). LEGv8 specifies truncate toward 0.
          let q = n / d;
          // BigInt division truncates toward zero for both pos and neg in JS.
          setReg(rw(0), q);
          break;
        }

        case 'MOVZ': case 'MOVK': {
          const dst = rw(0);
          const imm = parseImm(op[1]);
          // Optional `, LSL #n` (n must be 0/16/32/48)
          let lsl = 0n;
          if (op.length >= 3) {
            const m2 = /^LSL\s+#?(\d+)$/i.exec(op[2]);
            if (m2) lsl = BigInt(parseInt(m2[1], 10));
          }
          const piece = (toU64(imm) & 0xFFFFn) << lsl;
          if (mn === 'MOVZ') {
            setReg(dst, piece);
          } else {
            // MOVK keeps other bits, replaces the 16-bit slot
            const cur = regs[dst];
            const mask = ~(0xFFFFn << lsl) & MASK64;
            setReg(dst, (cur & mask) | piece);
          }
          break;
        }

        // ── Memory ──
        case 'LDUR':  case 'LDURB': case 'LDURH': case 'LDURSW':
        case 'STUR':  case 'STURB': case 'STURH': case 'STURW': {
          // Form: <op> Xt, [Xn{, #imm}]
          const dstSrc = rw(0);
          const memOp = parseMemOperand(op[1]);
          if (!memOp) throw new Error(`Bad memory operand: ${op[1]}`);
          const addr = regs[memOp.base] + memOp.offset;
          const isLoad = mn[0] === 'L';
          const widths = {
            LDUR: 8, STUR: 8,
            LDURB: 1, STURB: 1,
            LDURH: 2, STURH: 2,
            LDURSW: 4, STURW: 4,
          };
          const width = widths[mn];
          if (isLoad) {
            let v = readN(addr, width);
            // Sign-extend for LDURSW only (LDUR, LDURB, LDURH zero-extend).
            if (mn === 'LDURSW' && (v & (1n << 31n))) {
              v = v | (~((1n << 32n) - 1n) & MASK64);
            }
            setReg(dstSrc, v);
            m.lastMem = { addr: Number(addr), n: width, op: 'read',
                          bytes: Array.from({length: width}, (_, i) => Number(addr) + i) };
          } else {
            writeN(addr, width, regs[dstSrc]);
          }
          break;
        }

        case 'B': {
          nextPc = lookupLabel(op[0]);
          break;
        }
        case 'BL': {
          regs[LR_REG] = BigInt(m.pc + 1); // PC+4 abstracted to "next line"
          m.callDepth++;
          nextPc = lookupLabel(op[0]);
          break;
        }
        case 'BR': {
          const r = regs[parseRegister(op[0])];
          // We store line indexes in LR (not real byte addresses).
          nextPc = Number(r);
          if (m.callDepth > 0) m.callDepth--;
          break;
        }
        case 'CBZ': {
          if (regs[parseRegister(op[0])] === 0n) nextPc = lookupLabel(op[1]);
          break;
        }
        case 'CBNZ': {
          if (regs[parseRegister(op[0])] !== 0n) nextPc = lookupLabel(op[1]);
          break;
        }

        default: {
          // B.cond — mnemonic comes through as `B.EQ` etc.
          const bm = /^B\.([A-Z]+)$/i.exec(mn);
          if (bm) {
            if (condTrue(bm[1])) nextPc = lookupLabel(op[0]);
          } else {
            throw new Error(`Unsupported instruction: ${mn}`);
          }
        }
      }
    } catch (e) {
      m.log.push({ pc: m.pc, error: e.message });
      m.halted = true;
      throw e;
    }

    m.pc = nextPc;
    if (m.pc < 0 || m.pc >= lines.length) m.halted = true;
    return m.snapshot();
  }

  function runAll(maxSteps = 1000) {
    let steps = 0;
    while (!m.halted && steps < maxSteps) { step(); steps++; }
    if (steps === maxSteps && !m.halted) {
      m.halted = true;
      m.log.push({ error: 'Hit maxSteps (likely infinite loop)' });
    }
    return m.snapshot();
  }

  return m;
}

// Convenience: parse + execute, return final snapshot. Throws if any
// instruction errors. Used by challenge validation.
export function runProgram(srcLines, opts = {}) {
  const parsed = parse(srcLines);
  if (parsed.errors.length) {
    throw new Error('Parse errors: ' + parsed.errors.join('; '));
  }
  const machine = makeMachine({ ...parsed, ...opts });
  machine.runAll(opts.maxSteps || 1000);
  return machine;
}

// Compare a user-typed answer against an expected register/flag/memory
// value, accepting decimal, hex (0x...), or binary (0b...) and respecting
// signed two's-complement notation for negatives.
export function answerMatches(expected, userInput, opts = {}) {
  if (userInput == null) return false;
  let s = String(userInput).trim().replace(/_/g, '');
  if (s === '') return false;
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  let v;
  if (/^0x[0-9a-f]+$/i.test(s))      v = BigInt('0x' + s.slice(2));
  else if (/^0b[01]+$/i.test(s))     v = BigInt('0b' + s.slice(2));
  else if (/^[0-9]+$/.test(s))       v = BigInt(s);
  else return false;
  if (neg) v = -v;
  const e = typeof expected === 'bigint' ? expected : BigInt(expected);
  // Compare in the same domain as expected.
  if (opts.signed) return toS64(v) === toS64(e);
  return toU64(v) === toU64(e);
}
