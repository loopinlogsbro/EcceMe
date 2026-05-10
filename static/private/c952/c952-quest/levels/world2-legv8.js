// ============================================================
// World 2 — LEGv8 Instructions (Patterson & Hennessy Ch 3)
// ============================================================
// Nine levels covering ARM/LEGv8 specifics. Each level mixes at
// least two challenge types — no level past World 1 is pure MC.
// Exam traps tested across this world:
//   - ADD does not set flags; only ADDS does
//   - No NOT instruction (use EOR with all-ones)
//   - Memory is byte-addressed; doublewords differ by 8
//   - CBZ branches if zero, CBNZ if non-zero
//   - Conditional branches (CB-format) reach ±1 MB only
//   - X0–X7 are NOT preserved across calls; X19–X27 ARE
//   - Adding two negatives can overflow into a positive
//   - Linker ≠ loader; Java compiles to bytecode, not native
// ============================================================

import { registerWorld } from '../js/engine.js';

registerWorld({
  id: 'w2',
  title: 'LEGv8 Instructions',
  subtitle: 'Registers, formats, arithmetic, memory, branches, procedures',
  icon: '🔧',
  levels: [

    // ── L11: Registers & Conventions ───────────────────────
    {
      id: 'w2-registers',
      title: 'Registers & Conventions',
      icon: '🗂️',
      xp: 130,
      prereqs: ['w1-encoding'],
      intro: `
        <div class="card"><h3>The 32 Registers</h3>
        <p>LEGv8 has <strong>32 registers</strong>, each 64 bits wide. Most are general-purpose <code>X0</code>–<code>X30</code>. The 32nd slot is <code>XZR</code> — the <strong>zero register</strong>. Reads of XZR always return 0; writes are discarded.</p>
        <table class="conv-table">
          <tr><th>Reg</th><th>Alias</th><th>Role</th><th>Preserved?</th></tr>
          <tr><td>X0–X7</td><td>—</td><td>Argument / return</td><td>❌ caller-saved</td></tr>
          <tr><td>X8</td><td>—</td><td>Indirect result</td><td>❌</td></tr>
          <tr><td>X9–X15</td><td>—</td><td>Temporary</td><td>❌</td></tr>
          <tr><td>X16–X17</td><td>IP0/IP1</td><td>Scratch / linker</td><td>❌</td></tr>
          <tr><td>X18</td><td>—</td><td>Platform</td><td>❌</td></tr>
          <tr><td>X19–X27</td><td>—</td><td>Callee-saved</td><td>✅ preserved</td></tr>
          <tr><td>X28</td><td>SP</td><td>Stack pointer</td><td>✅</td></tr>
          <tr><td>X29</td><td>FP</td><td>Frame pointer</td><td>✅</td></tr>
          <tr><td>X30</td><td>LR</td><td>Link register (return addr)</td><td>special</td></tr>
          <tr><td>XZR</td><td>—</td><td>Always zero</td><td>—</td></tr>
        </table>
        <p><strong>The trap:</strong> <code>X0</code>–<code>X7</code> are <em>caller-saved</em> — they may be clobbered by <code>BL</code>. Callees may use them freely. <code>X19</code>–<code>X27</code> are <em>callee-saved</em> — a callee that touches them must save and restore them.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each register / alias to its calling-convention role.",
          concept:"X0–X7 caller-saved args; X19–X27 callee-saved; X28=SP, X30=LR, XZR=always 0.",
          pairs: [
            { chip:'X0–X7',   target:'arguments / return values (caller-saved)' },
            { chip:'X19–X27', target:'callee-saved (preserved across calls)' },
            { chip:'X28 (SP)', target:'stack pointer' },
            { chip:'X30 (LR)', target:'link register — holds return address after BL' },
            { chip:'XZR',     target:'always reads as zero; writes discarded' },
          ],
          explain:"The caller/callee split is a contract: callers know X0–X7 won't survive a call, callees know they own X19–X27 only if they save them first." },
        { type:'mc',
          prompt:"You call a function with <code>BL foo</code>. Which of these registers MUST you assume might be clobbered?",
          concept:"Caller-saved set is X0–X18 (broadly).",
          opts:["X19","X22","X3","X29 (FP)"], ans:2,
          explain:"X3 is in X0–X7 — the caller-saved arg/temp range. X19/X22 are callee-saved; FP is preserved." },
        { type:'mc',
          prompt:"Inside a function, you need a long-lived variable. Which register is safest to use without spilling first?",
          concept:"Callee-saved registers (X19–X27) are preserved across nested calls — but you must save them before using them.",
          opts:["X0","X9","X19 (after saving it on the stack)","XZR"], ans:2,
          explain:"X19 is callee-saved. If you save it on entry and restore it on exit, you can use it across BL calls without losing its value." },
        { type:'fill-blank',
          prompt:"Complete the idiom: 'compare X1 against X2 and set flags, discard the result'.",
          concept:"SUBS XZR, X1, X2  — write the difference to XZR (discards) and set N/Z/C/V.",
          template: "___ XZR, X1, X2",
          blanks: ['SUBS'],
          palette: ['SUB','SUBS','ADDS','CMP','EOR'],
          alts: [['CMP']],
          explain:"SUBS XZR, X1, X2 is the canonical compare. Writing to XZR throws away the result; SUBS still sets condition flags." },
        { type:'mc',
          prompt:"Which of these is true about <code>XZR</code> on LEGv8?",
          concept:"XZR is register #31. Reads return 0, writes are dropped.",
          opts:["It's just an alias for X0","Reads return 0 and writes are silently dropped",
                "It can hold any value but starts at 0","It's only valid as a destination"], ans:1,
          explain:"XZR (register 31) is hardwired: reads give 0, writes are discarded. This is what makes 'CMP' encodable as 'SUBS XZR, …'." },
      ],
    },

    // ── L12: Instruction Formats ───────────────────────────
    {
      id: 'w2-formats',
      title: 'Instruction Formats',
      icon: '🧬',
      xp: 170,
      prereqs: ['w2-registers'],
      intro: `
        <div class="card"><h3>Six Encodings, One Width</h3>
        <p>Every LEGv8 instruction is exactly 32 bits. The opcode bits at the top of the word tell the CPU which <em>format</em> to use to decode the rest:</p>
        <table class="conv-table">
          <tr><th>Format</th><th>Opcode</th><th>Layout (high → low bits)</th><th>Examples</th></tr>
          <tr><td>R</td><td>11</td><td>opcode(11) | Rm(5) | shamt(6) | Rn(5) | Rd(5)</td><td>ADD, SUB, AND, ORR, LSL</td></tr>
          <tr><td>I</td><td>10</td><td>opcode(10) | imm12(12) | Rn(5) | Rd(5)</td><td>ADDI, SUBI, ANDI</td></tr>
          <tr><td>D</td><td>11</td><td>opcode(11) | addr(9) | op2(2) | Rn(5) | Rt(5)</td><td>LDUR, STUR</td></tr>
          <tr><td>B</td><td>6</td><td>opcode(6) | imm26(26)</td><td>B, BL</td></tr>
          <tr><td>CB</td><td>8</td><td>opcode(8) | imm19(19) | Rt(5)</td><td>CBZ, CBNZ, B.cond</td></tr>
          <tr><td>IM</td><td>9</td><td>opcode(9) | hw(2) | imm16(16) | Rd(5)</td><td>MOVZ, MOVK</td></tr>
        </table>
        <p>The 5-bit register fields can each address one of 32 registers. The 9-bit signed address in D-format limits LDUR/STUR offsets to <strong>−256 to +255</strong>. The 19-bit signed offset in CB-format times 4 bytes/instruction = <strong>±1 MB</strong> reach for conditional branches.</p>
        </div>
      `,
      challenges: [
        { type:'bit-field',
          prompt:"Encode <code>ADD X3, X1, X2</code> as R-format. Click bits to set the opcode (10001011000 for ADD), then type register numbers into the Rm/Rn/Rd fields.",
          concept:"R-format: opcode | Rm | shamt | Rn | Rd",
          format:'R',
          fields: [
            { name:'opcode', hi:31, lo:21, expected:0b10001011000, mode:'bits' },
            { name:'Rm',     hi:20, lo:16, expected:2,             mode:'reg'  },
            { name:'shamt',  hi:15, lo:10, expected:0,             mode:'imm'  },
            { name:'Rn',     hi: 9, lo: 5, expected:1,             mode:'reg'  },
            { name:'Rd',     hi: 4, lo: 0, expected:3,             mode:'reg'  },
          ],
          explain:"ADD X3, X1, X2 → opcode=0x458, Rm=2, shamt=0, Rn=1, Rd=3 → 0x8B020023." },
        { type:'bit-field',
          prompt:"Encode <code>LDUR X1, [X9, #16]</code> as D-format. Type register numbers; click address bits for the offset.",
          concept:"D-format: opcode | addr (signed 9-bit) | op2 | Rn | Rt. LDUR opcode = 11111000010.",
          format:'D',
          fields: [
            { name:'opcode',  hi:31, lo:21, expected:0b11111000010, mode:'bits' },
            { name:'address', hi:20, lo:12, expected:16,            mode:'imm'  },
            { name:'op2',     hi:11, lo:10, expected:0,             mode:'imm'  },
            { name:'Rn',      hi: 9, lo: 5, expected:9,             mode:'reg'  },
            { name:'Rt',      hi: 4, lo: 0, expected:1,             mode:'reg'  },
          ],
          explain:"address = 16 (0b000010000), Rn = X9 (#9), Rt = X1 (#1)." },
        { type:'mc',
          prompt:"What is the maximum (positive) byte offset encodable in a D-format LDUR/STUR?",
          concept:"D-format address = 9-bit SIGNED → range −256 to +255.",
          opts:["+255","+511","+2047","+32767"], ans:0,
          explain:"The 9-bit signed offset gives a range of −256 to +255. Beyond that you must compute the address in a register first." },
        { type:'mc',
          prompt:"A conditional branch <code>CBZ X1, target</code> uses CB-format with a 19-bit signed offset. Each instruction is 4 bytes. What range does that cover?",
          concept:"19-bit signed × 4 bytes ≈ ±1 MB",
          opts:["±32 KB","±256 KB","±1 MB","±2 GB"], ans:2,
          explain:"2¹⁹ × 4 bytes ÷ 2 = ~1 MB in either direction. This is why conditional branches can't reach across a whole binary; the assembler emits trampolines for longer jumps." },
        { type:'fill-blank',
          prompt:"Pick the format used by each instruction.",
          concept:"R = arithmetic with all registers. I = immediate. D = data movement. B = unconditional branch. CB = conditional branch. IM = move immediate.",
          template: "ADD = ___ , LDUR = ___ , CBZ = ___ , MOVZ = ___",
          blanks: ['R','D','CB','IM'],
          palette: ['R','I','D','B','CB','IM'],
          explain:"ADD is R-format (3 register operands). LDUR is D-format (load/store). CBZ is CB-format (conditional branch). MOVZ is IM-format (immediate move)." },
        { type:'mc',
          prompt:"Why does LEGv8 use 6 different formats instead of one universal layout?",
          concept:"Different ops need different fields. A fixed layout would waste bits or not fit immediates.",
          opts:["To make it harder to decode","To fit different field needs (regs vs immediates vs offsets) within 32 bits",
                "Because ARM accidentally invented 6 formats","To support more registers"], ans:1,
          explain:"R needs 3 registers + shift; I needs an immediate; D needs an offset; B needs a long target. Each format reserves bits where they matter most for that class of instruction." },
      ],
    },

    // ── L13: Arithmetic & Flags ────────────────────────────
    {
      id: 'w2-arith-flags',
      title: 'Arithmetic & Flags',
      icon: '🧮',
      xp: 160,
      prereqs: ['w2-formats'],
      intro: `
        <div class="card"><h3>ADD vs ADDS — the S matters</h3>
        <p>Plain arithmetic instructions <strong>do not set flags</strong>. The <strong>S</strong> suffix on <code>ADDS</code>, <code>SUBS</code>, <code>ANDS</code>, etc. is what updates <code>NZCV</code>:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>N</strong> — result MSB (negative, signed view)</li>
          <li><strong>Z</strong> — result is zero</li>
          <li><strong>C</strong> — carry-out (or NOT-borrow on subtract)</li>
          <li><strong>V</strong> — signed overflow</li>
        </ul>
        <p>The <strong>compare</strong> idiom <code>SUBS XZR, X1, X2</code> sets flags from <code>X1 - X2</code> while throwing away the result.</p>
        <p><strong>Trap:</strong> two negatives can overflow into a positive (V=1). E.g. (−128) + (−128) in 8-bit = +0 with V set.</p>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"Trace this program. What is the final value of X3?",
          concept:"X3 = X1 + X2; X1 = 5, X2 = 7 → 12.",
          code: [
            "MOVZ X1, #5",
            "MOVZ X2, #7",
            "ADD  X3, X1, X2",
          ],
          asks:'X3', format:'dec', ans:12,
          explain:"Plain ADD writes the sum to X3 but does not set flags." },
        { type:'mc',
          prompt:"After <code>ADD X4, X1, X2</code> with X1=0xFFFFFFFFFFFFFFFF and X2=1, what is the Z flag?",
          concept:"ADD does not set flags. Z is whatever it was before.",
          opts:["1, because the result is 0","0, because the result is non-zero",
                "Undefined","Whatever Z was before — ADD doesn't update flags"], ans:3,
          explain:"Trap. ADD never touches NZCV. The result IS 0 (with carry), but only ADDS would have set Z=1." },
        { type:'code-trace',
          prompt:"Trace this. After it runs, what is the Z flag (0 or 1)?",
          concept:"SUBS X4, X1, X2 with X1=10, X2=10 → 0 → Z=1.",
          code: [
            "MOVZ X1, #10",
            "MOVZ X2, #10",
            "SUBS X4, X1, X2",
          ],
          asks:'NZCV', ans:'0100',
          showFlags: true,
          explain:"X1 - X2 = 0 → Z=1, N=0. No carry from a subtract that didn't borrow → C=1 actually for SUBS (C is NOT-borrow). For exam purposes the Z flag is what's tested. Format here is N Z C V." },
        { type:'fill-blank',
          prompt:"Translate <code>if (a == b) goto same;</code> into LEGv8. Assume a in X1, b in X2.",
          concept:"Compare with SUBS XZR, then branch on EQ.",
          template: "___ XZR, X1, X2\nB.___ same",
          blanks: ['SUBS','EQ'],
          palette: ['SUB','SUBS','EQ','NE','LT','GT'],
          explain:"SUBS XZR, X1, X2 sets flags from a−b. B.EQ branches when Z=1, i.e. a==b." },
        { type:'mc',
          prompt:"In 8-bit signed: (−100) + (−40) = ? What flag should fire?",
          concept:"Sum is −140 which doesn't fit in 8-bit signed (−128 to +127).",
          opts:["Z (zero)","C (carry)","V (signed overflow) — two negatives summed past −128",
                "N only — no overflow"], ans:2,
          explain:"Two negatives whose sum is more negative than −128 wraps into the positive range. V detects this." },
        { type:'code-trace',
          prompt:"Trace and report the final X4 value.",
          concept:"Build a 64-bit constant via MOVZ + ADD.",
          code: [
            "MOVZ X1, #0x1000",
            "MOVZ X2, #0x0010",
            "ADD  X3, X1, X2",
            "ADDI X4, X3, #0x0F",
          ],
          asks:'X4', format:'hex', ans:0x101F,
          explain:"X1=0x1000, X2=0x10, X3=0x1010, X4=X3+0x0F=0x101F." },
      ],
    },

    // ── L14: Logical & Shift ───────────────────────────────
    {
      id: 'w2-logical',
      title: 'Logical & Shift',
      icon: '🔀',
      xp: 150,
      prereqs: ['w2-arith-flags'],
      intro: `
        <div class="card"><h3>Bitwise and Shift Instructions</h3>
        <p>LEGv8 spells the logical ops <code>AND</code>, <code>ORR</code> (or), <code>EOR</code> (xor). Shifts are <code>LSL</code> (left) and <code>LSR</code> (right, zero-fill).</p>
        <p><strong>The trap:</strong> there is <strong>no NOT instruction</strong>. To bitwise-invert a register, XOR it with all-ones:</p>
        <div class="equation" style="font-size:14px;"><code>EOR Xd, Xn, #-1</code>   // Xd = ~Xn</div>
        <p>The −1 immediate is interpreted as 0xFFFFFFFFFFFFFFFF — every bit set. XORing with all-ones flips every bit.</p>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"What is the final value of X3, in hex?",
          concept:"AND with a mask clears the upper bits.",
          code: [
            "MOVZ X1, #0xABCD",
            "MOVZ X2, #0x00FF",
            "AND  X3, X1, X2",
          ],
          asks:'X3', format:'hex', ans:0x00CD,
          explain:"0xABCD AND 0x00FF keeps only the low byte → 0x00CD." },
        { type:'mc',
          prompt:"How do you bitwise-invert X1 in LEGv8? (There's no NOT instruction!)",
          concept:"EOR with all-ones flips every bit.",
          opts:["NOT X1","EOR X1, X1, #-1","SUB X1, XZR, X1","ORR X1, X1, #0"], ans:1,
          explain:"LEGv8 has no NOT. EOR with all-ones (#−1 → 0xFFF…FF) flips every bit." },
        { type:'fill-blank',
          prompt:"Multiply X1 by 16 using a single shift instruction.",
          concept:"LSL Xd, Xn, #4 multiplies by 2⁴ = 16.",
          template: "___ X1, X1, #4",
          blanks: ['LSL'],
          palette: ['LSL','LSR','MUL','ADD'],
          explain:"LSL #4 shifts left 4 → multiplies by 16. Compilers often replace constant multiplies by power-of-2 with LSL because it's cheaper." },
        { type:'code-trace',
          prompt:"Final value of X3 (decimal)?",
          concept:"LSR by 3 = divide by 8, integer.",
          code: [
            "MOVZ X1, #100",
            "LSR  X3, X1, #3",
          ],
          asks:'X3', format:'dec', ans:12,
          explain:"100 / 8 = 12 (integer division by shifting)." },
        { type:'toggle-target',
          prompt:"Compute <code>0b10110010 OR 0b01001101</code> and click the bits.",
          concept:"OR sets a bit if either input has it.",
          bits:8, target:0b11111111,
          explain:"Every bit position has a 1 in at least one operand → 0xFF." },
        { type:'mc',
          prompt:"<code>LSL X1, X1, #1</code> followed by <code>LSL X1, X1, #1</code> is equivalent to:",
          concept:"Two shifts of 1 = one shift of 2.",
          opts:["LSL X1, X1, #1","LSL X1, X1, #2","LSR X1, X1, #2","Multiplied by 4"], ans:1,
          explain:"Shifting left by 1 twice = shifting left by 2 = multiplying by 4. Both option B and the description in D are correct, but LSL #2 is the single-instruction equivalent." },
      ],
    },

    // ── L15: Load / Store ──────────────────────────────────
    {
      id: 'w2-loadstore',
      title: 'Load / Store',
      icon: '📥',
      xp: 170,
      prereqs: ['w2-logical'],
      intro: `
        <div class="card"><h3>Touching Memory</h3>
        <p>LEGv8 is a <strong>load/store architecture</strong>: arithmetic only happens on registers; memory is accessed only via <code>LDUR</code>/<code>STUR</code>.</p>
        <table class="conv-table">
          <tr><th>Mnemonic</th><th>Width</th><th>Signedness</th></tr>
          <tr><td>LDUR  / STUR </td><td>8 bytes (doubleword)</td><td>—</td></tr>
          <tr><td>LDURH / STURH</td><td>2 bytes (halfword)  </td><td>load: zero-extend</td></tr>
          <tr><td>LDURB / STURB</td><td>1 byte               </td><td>load: zero-extend</td></tr>
          <tr><td>LDURSW / STURW</td><td>4 bytes (word)      </td><td>load: <strong>sign</strong>-extend</td></tr>
        </table>
        <p>Address form: <code>[Xn, #imm]</code> — base register plus a signed 9-bit byte offset (range −256 to +255).</p>
        <p><strong>Trap:</strong> memory is byte-addressed, but doublewords stride by <strong>8</strong>. <code>arr[1]</code> for an X-register array is at <code>base + 8</code>, not <code>base + 1</code>.</p>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"X9 starts at 0x1000 and memory holds 8 bytes there. What is X1 after the load?",
          concept:"LDUR reads 8 little-endian bytes. With bytes 01 02 03 04 05 06 07 08 we get 0x0807060504030201.",
          code: [
            "MOVZ X9, #0x1000",
            "LDUR X1, [X9, #0]",
          ],
          initRegs: { X9: 0x1000 },
          initMem:  { '0x1000': [0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08] },
          asks:'X1', format:'hex', ans:0x0807060504030201n,
          explain:"Little-endian: byte at lowest address goes into the lowest byte of the register. So 01 02 03 04 05 06 07 08 → 0x0807060504030201." },
        { type:'code-trace',
          prompt:"Now LDURB instead — what's X1?",
          concept:"LDURB reads ONE byte and zero-extends.",
          code: [
            "MOVZ X9, #0x1000",
            "LDURB X1, [X9, #0]",
          ],
          initRegs: { X9: 0x1000 },
          initMem:  { '0x1000': [0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] },
          asks:'X1', format:'hex', ans:0x00FFn,
          explain:"LDURB reads only byte 0 (=0xFF) and zero-extends to 64 bits → 0x00000000000000FF." },
        { type:'mc',
          prompt:"You load a signed 32-bit value with <code>LDURSW</code> and one byte equals 0xFFFFFFFF (the 32-bit value −1). What's in the destination 64-bit register?",
          concept:"LDURSW sign-extends — fills upper 32 bits with the sign bit.",
          opts:["0x00000000FFFFFFFF","0xFFFFFFFFFFFFFFFF (= −1)","0xFFFFFFFF00000000","Undefined"], ans:1,
          explain:"LDURSW is the only LDUR variant that sign-extends. The result is −1 in 64-bit signed = all 1s in unsigned hex." },
        { type:'fill-blank',
          prompt:"Store doubleword X3 to <code>arr[2]</code>. The base of the X-register array is in X10.",
          concept:"X-reg array stride = 8 bytes. arr[2] is at X10 + 16.",
          template: "___ X3, [X10, #___]",
          blanks: ['STUR','16'],
          palette: ['STUR','STURB','STURW','LDUR','8','16','24','32'],
          explain:"STUR writes 8 bytes. arr[2] = base + 2 × 8 = +16 bytes." },
        { type:'mc',
          prompt:"What's the maximum (positive) signed offset for <code>LDUR X1, [X9, #imm]</code>?",
          concept:"D-format address field = 9 bits signed → range −256 to +255.",
          opts:["+128","+255","+1023","+2047"], ans:1,
          explain:"The 9-bit signed offset's positive max is +255. For larger offsets, compute the address in a register first." },
        { type:'code-trace',
          prompt:"Swap two doublewords in memory using a temp. What's in memory at 0x2000 (8 bytes, little-endian as one number) after the code?",
          concept:"Classic load-load-store-store swap.",
          code: [
            "MOVZ X1, #0x2000",
            "LDUR X2, [X1, #0]",     // X2 = orig word at 0x2000
            "LDUR X3, [X1, #8]",     // X3 = orig word at 0x2008
            "STUR X3, [X1, #0]",
            "STUR X2, [X1, #8]",
          ],
          initRegs: { X1: 0x2000 },
          initMem:  {
            '0x2000': [0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88],
            '0x2008': [0xAA,0xBB,0xCC,0xDD,0xEE,0xFF,0x01,0x02],
          },
          asks:'mem:0x2000:8', format:'hex',
          ans: 0x0201FFEEDDCCBBAAn,
          explain:"After the swap, 0x2000 holds the original 0x2008 doubleword: bytes AA BB CC DD EE FF 01 02 → 0x0201FFEEDDCCBBAA." },
      ],
    },

    // ── L16: Branches & NZCV ──────────────────────────────
    {
      id: 'w2-branches',
      title: 'Branches & NZCV',
      icon: '🌿',
      xp: 160,
      prereqs: ['w2-loadstore'],
      intro: `
        <div class="card"><h3>Conditional Control Flow</h3>
        <p>LEGv8 has three branch families:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>B</strong> <em>label</em> — unconditional jump (B-format, ±128 MB)</li>
          <li><strong>CBZ</strong>/<strong>CBNZ</strong> <em>Xn, label</em> — branch if register is zero / non-zero (CB-format, ±1 MB)</li>
          <li><strong>B.cond</strong> <em>label</em> — branch on a flag condition (CB-format, ±1 MB). Examples: B.EQ, B.NE, B.LT, B.GE, B.GT, B.LE, B.MI, B.PL, B.VS, B.VC, B.HI, B.HS, B.LO, B.LS.</li>
        </ul>
        <p><strong>Trap:</strong> CBZ branches when the register <em>is</em> zero. CBNZ branches when it <em>isn't</em> zero.</p>
        <p><strong>Trap:</strong> B.cond and CBZ/CBNZ have a ±1 MB reach. The unconditional B reaches ±128 MB.</p>
        </div>
      `,
      challenges: [
        { type:'mc',
          prompt:"<code>CBZ X1, target</code> jumps to <code>target</code> when X1 equals…?",
          concept:"CBZ = compare-and-branch-if-Zero.",
          opts:["zero","non-zero","negative","XZR's value (always)"], ans:0,
          explain:"CBZ branches if the register IS zero. CBNZ branches if it isn't." },
        { type:'code-trace',
          prompt:"Trace through this loop. What is X1 when it ends?",
          concept:"Loop subtracts 1 from X1 and branches back while X1 ≠ 0.",
          code: [
            "MOVZ X1, #5",
            "loop: SUBI X1, X1, #1",
            "      CBNZ X1, loop",
          ],
          asks:'X1', format:'dec', ans:0,
          explain:"Decrement until X1 reaches 0; CBNZ falls through when X1 is zero." },
        { type:'fill-blank',
          prompt:"Translate <code>if (X1 < X2) goto less;</code> using SUBS + B.cond. (signed comparison)",
          concept:"SUBS sets flags; B.LT branches when N≠V (signed less-than).",
          template: "___ XZR, X1, X2\nB.___ less",
          blanks: ['SUBS','LT'],
          palette: ['SUB','SUBS','EQ','NE','LT','LE','GT','GE','LO','HI'],
          explain:"SUBS XZR, X1, X2 computes X1−X2 and sets flags. B.LT branches when N ≠ V — the signed less-than condition." },
        { type:'mc',
          prompt:"You write <code>CBZ X1, far_label</code> but far_label is 4 MB away. What happens?",
          concept:"CB-format reach is only ±1 MB.",
          opts:["It assembles fine — branches reach anywhere",
                "The assembler errors or emits a trampoline through B (which has ±128 MB reach)",
                "It assembles but corrupts X1",
                "It silently truncates to a near label"], ans:1,
          explain:"CB-format's 19-bit signed offset × 4 = ±1 MB. For longer ranges, the assembler synthesises a trampoline using unconditional B (or you use it manually)." },
        { type:'code-trace',
          prompt:"Trace the if/else. What is X3?",
          concept:"X1=5, X2=10. X1<X2, so it takes the 'less' branch: X3 = 100.",
          code: [
            "MOVZ X1, #5",
            "MOVZ X2, #10",
            "SUBS XZR, X1, X2",
            "B.LT less",
            "MOVZ X3, #200",
            "B    end",
            "less: MOVZ X3, #100",
            "end:  NOP",
          ],
          asks:'X3', format:'dec', ans:100,
          explain:"5 < 10 ⇒ N=1, V=0, so N≠V ⇒ B.LT taken ⇒ X3 = 100." },
        { type:'mc',
          prompt:"After <code>SUBS XZR, X1, X2</code> with X1=X2, which condition codes are TRUE?",
          concept:"X1 - X2 = 0 → Z=1, N=0. EQ, GE, LE, HS, PL all true.",
          opts:["EQ only","NE and LT","EQ, GE, LE","GT and LT"], ans:2,
          explain:"With Z=1 and N=V=0: EQ (Z=1) ✓, GE (N=V) ✓, LE (Z=1 OR N≠V) ✓, GT (Z=0 AND N=V) ✗, NE ✗." },
      ],
    },

    // ── L17: Procedures & Stack ────────────────────────────
    {
      id: 'w2-procedures',
      title: 'Procedures & Stack',
      icon: '🧱',
      xp: 180,
      prereqs: ['w2-branches'],
      intro: `
        <div class="card"><h3>Calling Conventions</h3>
        <p>A function call in LEGv8 is a single instruction:</p>
        <div class="equation" style="font-size:14px;"><code>BL foo</code>   // X30 (LR) ← address of next instr; PC ← foo</div>
        <p>Return is just a register-indirect branch:</p>
        <div class="equation" style="font-size:14px;"><code>BR LR</code>   (or equivalently <code>BR X30</code>)</div>
        <p>If <em>foo</em> calls something itself, it must save the incoming LR (and any X19–X27 it touches) on the stack:</p>
        <div class="equation" style="font-size:13px;text-align:left;padding-left:20px;">
        SUBI SP, SP, #16        // make room (16-byte aligned)<br>
        STUR LR,  [SP, #0]      // save return address<br>
        STUR X19, [SP, #8]      // save callee-saved reg we'll clobber<br>
        ...                      // body, possibly with more BLs<br>
        LDUR X19, [SP, #8]      // restore<br>
        LDUR LR,  [SP, #0]<br>
        ADDI SP, SP, #16        // pop frame<br>
        BR   LR                  // return</div>
        <p><strong>Traps:</strong></p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li>X0–X7 are <em>not</em> preserved across <code>BL</code>. X19–X27 ARE.</li>
          <li>Linker ≠ loader. The <strong>linker</strong> stitches .o files into an executable; the <strong>loader</strong> copies it into memory at runtime.</li>
          <li>Java compiles to <strong>bytecode</strong>, not native machine code; the JVM runs the bytecode (often JIT-compiling to native).</li>
        </ul>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each tool to what it actually does.",
          concept:"Compiler→assembly. Assembler→object code. Linker→executable. Loader→running memory. JVM→runs bytecode.",
          pairs: [
            { chip:'Compiler',  target:'translates source code to assembly' },
            { chip:'Assembler', target:'translates assembly to object (.o) machine code' },
            { chip:'Linker',    target:'combines .o files + libs into one executable' },
            { chip:'Loader',    target:'copies the executable into memory and starts it' },
            { chip:'JVM',       target:'runs Java bytecode (often JIT to native)' },
          ],
          explain:"Linker ≠ loader — that's a classic exam confusion. Java compiles to bytecode, NOT native, and the JVM does the heavy lifting." },
        { type:'code-trace',
          prompt:"Trace this call. What is X19 right before BR LR runs?",
          concept:"X19 is callee-saved. After foo's body it is back to its incoming value.",
          code: [
            "MOVZ X19, #42",      // caller sets X19
            "BL   foo",           // call foo
            "B    end",
            "foo: SUBI SP, SP, #16",
            "     STUR X19, [SP, #0]",
            "     STUR LR,  [SP, #8]",
            "     MOVZ X19, #99",       // foo clobbers X19 in its body
            "     LDUR X19, [SP, #0]",  // restore on the way out
            "     LDUR LR,  [SP, #8]",
            "     ADDI SP, SP, #16",
            "     BR   LR",
            "end: NOP",
          ],
          asks:'X19', format:'dec', ans:42,
          explain:"foo saved X19 on entry, used it as 99, then restored it on exit. From the caller's perspective X19 is preserved." },
        { type:'mc',
          prompt:"Which of these registers is the caller responsible for saving before <code>BL foo</code> if it cares about its value?",
          concept:"Caller-saved set is X0–X18. Callee-saved (X19–X27) the callee must preserve.",
          opts:["X3 (caller-saved — the caller saves it if needed)",
                "X22 (callee-saved — foo must preserve it)",
                "FP (preserved)",
                "LR (preserved by callee if it makes its own calls)"], ans:0,
          explain:"X3 is in the caller-saved range. If the caller wants to keep X3 across a BL, it must spill it itself." },
        { type:'fill-blank',
          prompt:"Complete the prologue of a leaf function that uses X19. (16-byte aligned frame; only LR + X19 saved.)",
          concept:"Subtract from SP, store callee-saved regs and LR.",
          template: "___ SP, SP, #16\n___ LR,  [SP, #0]\n___ X19, [SP, #8]",
          blanks: ['SUBI','STUR','STUR'],
          palette: ['SUBI','ADDI','STUR','LDUR','MOVZ'],
          explain:"Allocate 16 bytes (SUBI SP, SP, #16), then STUR LR and STUR X19 into the new frame." },
        { type:'mc',
          prompt:"Java source compiles to what?",
          concept:"Java → JVM bytecode (.class files). The JVM runs the bytecode.",
          opts:["Native machine code for the host CPU","x86 assembly","JVM bytecode (.class)","LEGv8"], ans:2,
          explain:"javac emits bytecode, not native. The JVM interprets and/or JIT-compiles bytecode at runtime." },
      ],
    },

    // ── L18: Addressing Modes ──────────────────────────────
    {
      id: 'w2-addressing',
      title: 'Addressing Modes',
      icon: '📍',
      xp: 130,
      prereqs: ['w2-procedures'],
      intro: `
        <div class="card"><h3>How Operands Are Specified</h3>
        <p>LEGv8 keeps it simple: every instruction's operands come in one of these forms:</p>
        <table class="conv-table">
          <tr><th>Mode</th><th>Example</th><th>Used by</th></tr>
          <tr><td>Register</td><td><code>ADD X3, X1, X2</code></td><td>R-format arithmetic</td></tr>
          <tr><td>Immediate</td><td><code>ADDI X3, X1, #4</code></td><td>I-format</td></tr>
          <tr><td>Base + displacement</td><td><code>LDUR X3, [X1, #8]</code></td><td>D-format LDUR/STUR</td></tr>
          <tr><td>PC-relative</td><td><code>B target</code>,  <code>CBZ X1, target</code></td><td>B / CB formats (offset added to PC)</td></tr>
        </table>
        <p>There is <strong>no</strong> [Xn + Xm] register-register addressing in LEGv8. All memory addresses are computed as register + immediate.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each instruction to the addressing mode it uses.",
          concept:"Categorise by where the operand lives.",
          pairs: [
            { chip:'ADD X3, X1, X2',     target:'register' },
            { chip:'ADDI X3, X1, #4',    target:'immediate' },
            { chip:'LDUR X3, [X1, #8]',  target:'base + displacement' },
            { chip:'CBZ X1, top',        target:'PC-relative' },
          ],
          explain:"Every LEGv8 instruction picks exactly one of these modes." },
        { type:'mc',
          prompt:"You want to load <code>arr[i]</code> where i is in X4 and base is in X10 (X-reg array). What's the LEGv8 idiom?",
          concept:"No register-register addressing — compute the address first.",
          opts:["LDUR X1, [X10, X4]","LDUR X1, [X10, X4, LSL #3]",
                "LSL X5, X4, #3 ; ADD X5, X10, X5 ; LDUR X1, [X5, #0]",
                "LDUR X1, [X10 + 8*X4]"], ans:2,
          explain:"LEGv8 LDUR only takes [Xn, #imm]. Compute index×8 + base in a register, then LDUR with offset 0." },
        { type:'fill-blank',
          prompt:"Translate <code>x = arr[3]</code> for a doubleword array based at X10. Result into X1.",
          concept:"Element 3 = base + 3 × 8 = +24.",
          template: "___ X1, [X10, #___]",
          blanks: ['LDUR','24'],
          palette: ['LDUR','STUR','LDURB','3','8','16','24','32'],
          explain:"Doublewords are 8 bytes apart. Index 3 → byte offset 24." },
        { type:'mc',
          prompt:"Why are conditional branches PC-relative instead of absolute?",
          concept:"PC-relative encoding is shorter and lets code be relocated without rewriting branch targets.",
          opts:["So the program counter can be 32-bit",
                "To save bits in the encoding (offset, not absolute) and make code relocatable",
                "To bypass the loader",
                "Because absolute branches are forbidden by ARM"], ans:1,
          explain:"A 19-bit relative offset fits into the CB-format word; an absolute address wouldn't. It also lets the loader place code anywhere without re-writing branch targets." },
      ],
    },

    // ── L19: MOVZ / MOVK Wide Constants ────────────────────
    {
      id: 'w2-movz-movk',
      title: 'MOVZ / MOVK',
      icon: '✏️',
      xp: 140,
      prereqs: ['w2-addressing'],
      intro: `
        <div class="card"><h3>Building 64-Bit Constants</h3>
        <p>An LEGv8 instruction is only 32 bits — there's no room to embed a full 64-bit constant. So loading a wide constant takes up to <strong>four</strong> instructions:</p>
        <div class="equation" style="font-size:13px;text-align:left;padding-left:20px;">
        MOVZ Xd, #<em>imm16</em>, LSL #<em>n</em>   // n ∈ {0,16,32,48}; zeroes the rest<br>
        MOVK Xd, #<em>imm16</em>, LSL #<em>n</em>   // keeps the rest, replaces this 16-bit slot
        </div>
        <p><strong>MOVZ</strong> writes a 16-bit chunk and zeros the other 48 bits. <strong>MOVK</strong> writes a 16-bit chunk and <em>keeps</em> the rest. So you start with one MOVZ and overlay the remaining slots with MOVKs.</p>
        <p>Example: load 0xDEAD_BEEF_CAFE_BABE into X1.</p>
        <div class="equation" style="font-size:13px;text-align:left;padding-left:20px;">
        MOVZ X1, #0xBABE              // X1 = 0x0000_0000_0000_BABE<br>
        MOVK X1, #0xCAFE, LSL #16     // X1 = 0x0000_0000_CAFE_BABE<br>
        MOVK X1, #0xBEEF, LSL #32     // X1 = 0x0000_BEEF_CAFE_BABE<br>
        MOVK X1, #0xDEAD, LSL #48     // X1 = 0xDEAD_BEEF_CAFE_BABE</div>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"Final value of X1 (in hex)?",
          concept:"MOVZ then a single MOVK at LSL #16.",
          code: [
            "MOVZ X1, #0x1234",
            "MOVK X1, #0xABCD, LSL #16",
          ],
          asks:'X1', format:'hex', ans:0xABCD1234,
          explain:"After MOVZ X1=0x1234. MOVK at LSL #16 overwrites bits [31:16] with 0xABCD → 0xABCD1234." },
        { type:'fill-blank',
          prompt:"Load 0x0000_0001_0000_0042 into X2 in two instructions.",
          concept:"MOVZ for the low slot, MOVK at LSL #32 for bit 32.",
          template: "___ X2, #0x42\n___ X2, #0x1, LSL #___",
          blanks: ['MOVZ','MOVK','32'],
          palette: ['MOVZ','MOVK','MOV','0','16','32','48'],
          explain:"MOVZ X2, #0x42 sets the low 16. MOVK X2, #0x1, LSL #32 sets bits [47:32] = 0x0001 without disturbing the rest." },
        { type:'mc',
          prompt:"What is the maximum number of MOVZ/MOVK instructions ever needed to set a 64-bit register to ANY constant?",
          concept:"64 bits / 16 bits per slot = 4.",
          opts:["1","2","4","8"], ans:2,
          explain:"Four 16-bit slots cover the full 64 bits: LSL #0, #16, #32, #48." },
        { type:'mc',
          prompt:"After <code>MOVZ X1, #0xFFFF, LSL #16</code>, what is X1 in hex?",
          concept:"MOVZ zeros the other slots.",
          opts:["0x000000000000FFFF","0x00000000FFFF0000","0xFFFF000000000000","0x000000000FFFF000"], ans:1,
          explain:"MOVZ #0xFFFF, LSL #16 puts 0xFFFF into bits [31:16] and zeros everything else → 0x00000000FFFF0000." },
        { type:'code-trace',
          prompt:"Three-step build. What is X3?",
          concept:"Build 0x0000_0042_AAAA_5555.",
          code: [
            "MOVZ X3, #0x5555",
            "MOVK X3, #0xAAAA, LSL #16",
            "MOVK X3, #0x42,   LSL #32",
          ],
          asks:'X3', format:'hex', ans:0x0000_0042_AAAA_5555n,
          explain:"Slot 0 = 0x5555, slot 1 = 0xAAAA, slot 2 = 0x0042; slot 3 left as zero." },
      ],
    },

  ],
});
