// ============================================================
// World 3 — Arithmetic (Patterson & Hennessy Ch 5)
// ============================================================
// Four levels:
//   L20 — Add/Subtract & Overflow Detection
//   L21 — Multiplication & Division Algorithms
//   L22 — IEEE 754 Single & Double
//   L23 — FP Arithmetic & Rounding
//
// Uses the LEGv8 interpreter for integer arithmetic walks.
// FP topics are MC / bit-field / type (no FP interpreter — the
// IEEE 754 questions are about the encoding itself, which the
// bit-field type already validates by mapping fields → bits).
// ============================================================

import { registerWorld } from '../js/engine.js';

registerWorld({
  id: 'w3',
  title: 'Arithmetic',
  subtitle: 'Overflow, multiply/divide, IEEE 754, rounding',
  icon: '🧮',
  levels: [

    // ── L20: Add/Subtract & Overflow Detection ─────────────
    {
      id: 'w3-overflow',
      title: 'Add/Subtract & Overflow',
      icon: '➕',
      xp: 160,
      prereqs: ['w2-movz-movk'],
      intro: `
        <div class="card"><h3>Detecting the Bad Result</h3>
        <p>The hardware adder produces a 65-bit result for a 64-bit add: 64 bits of sum plus a <strong>carry-out</strong>. Two distinct overflow conditions are tracked separately:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Unsigned overflow</strong> = the carry-out itself (the <strong>C</strong> flag). 0xFFFF…FF + 1 carries out.</li>
          <li><strong>Signed overflow</strong> = the carry <em>into</em> the MSB differs from the carry <em>out</em> (the <strong>V</strong> flag). Equivalently: two operands with the same sign produced a sum with the opposite sign.</li>
        </ul>
        <p>For subtraction, the ALU computes <code>a + (~b) + 1</code>. The <strong>C</strong> flag is then "<em>not</em>-borrow": C=1 means no borrow occurred, C=0 means a borrow did.</p>
        <p><strong>Trap:</strong> two negatives can overflow to a positive (and vice versa). That's exactly what V detects.</p>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"Trace this. Read off the NZCV flags after the ADDS as a 4-bit string (N Z C V).",
          concept:"5 + 7 = 12 → small positive: N=0, Z=0, C=0, V=0.",
          code: [
            "MOVZ X1, #5",
            "MOVZ X2, #7",
            "ADDS X3, X1, X2",
          ],
          asks:'NZCV', ans:'0000', showFlags: true,
          explain:"Sum fits in 64-bit signed and has no carry-out → all flags zero." },
        { type:'code-trace',
          prompt:"Now build the largest positive 64-bit signed value and add 1 to it. What is V?",
          concept:"0x7FFFFFFFFFFFFFFF + 1 wraps to 0x8000…00 — that's signed overflow.",
          code: [
            "MOVZ X1, #0xFFFF, LSL #0",
            "MOVK X1, #0xFFFF, LSL #16",
            "MOVK X1, #0xFFFF, LSL #32",
            "MOVK X1, #0x7FFF, LSL #48",
            "MOVZ X2, #1",
            "ADDS X3, X1, X2",
          ],
          asks:'NZCV', ans:'1001', showFlags: true,
          explain:"Result MSB=1 → N=1. Result ≠ 0 → Z=0. No carry-out of bit 63 → C=0. Sign flipped (pos+pos→neg) → V=1." },
        { type:'mc',
          prompt:"You ADDS two 64-bit values: both have their MSB set (i.e. both are <em>negative</em> in signed view). Their 64-bit sum has MSB=0 (positive). Which flag is set?",
          concept:"Operand signs equal, result sign differs → V=1.",
          opts:["C only (unsigned overflow)","V only (signed overflow)",
                "Both C and V","Neither — the result is fine"], ans:2,
          explain:"Two big negatives produce a carry-out (C=1) AND flip the sign (V=1). Both flavours of overflow occurred." },
        { type:'mc',
          prompt:"After <code>SUBS X3, X1, X2</code> with X1 &lt; X2 (both unsigned, X1=5, X2=10), what is the C flag?",
          concept:"SUBS C-flag = NOT-borrow. A borrow occurred, so C=0.",
          opts:["1, because no carry","0, because a borrow occurred","1, because of signed overflow","Undefined"], ans:1,
          explain:"Subtract was a + ~b + 1. With X1 &lt; X2, the borrow happens → C is cleared. Many students misremember this — SUBS C means 'no borrow'." },
        { type:'fill-blank',
          prompt:"Set Z=1 (flag the result is zero) without leaving anything in a register.",
          concept:"SUBS XZR, Xn, Xn — flags reflect Xn − Xn = 0; result discarded.",
          template: "___ XZR, X1, X1",
          blanks: ['SUBS'],
          palette: ['SUB','SUBS','ADDS','EOR'],
          explain:"SUBS XZR, X1, X1 computes 0, sets Z=1, and throws away the result by writing to XZR." },
        { type:'mc',
          prompt:"In LEGv8, which of these instructions does NOT update the NZCV flags?",
          concept:"S-suffix instructions update flags; the un-suffixed ones don't.",
          opts:["ADDS","SUBS","ANDS","ADD"], ans:3,
          explain:"ADD is silent. ADDS / SUBS / ANDS set NZCV. (The S in ADDS stands for 'sets flags'.)" },
      ],
    },

    // ── L21: Multiplication & Division ─────────────────────
    {
      id: 'w3-muldiv',
      title: 'Multiply & Divide',
      icon: '✖️',
      xp: 150,
      prereqs: ['w3-overflow'],
      intro: `
        <div class="card"><h3>Beyond Add and Subtract</h3>
        <p>Multiplication of two n-bit operands can produce a <strong>2n-bit</strong> result. The classical shift-and-add algorithm walks the multiplier bit-by-bit:</p>
        <div class="equation" style="font-size:13px;text-align:left;padding-left:20px;">
          1011  (= 11)<br>
        × 1101  (= 13)<br>
          ────<br>
          1011<br>
        + 0000<br>
        +1011·<br>
        +1011··<br>
          ────────<br>
        =10001111  (= 143 ✓)
        </div>
        <p>LEGv8 instructions:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><code>MUL  Xd, Xn, Xm</code> — Xd ← lower 64 bits of Xn × Xm</li>
          <li><code>UDIV Xd, Xn, Xm</code> — unsigned divide, truncate toward 0</li>
          <li><code>SDIV Xd, Xn, Xm</code> — signed divide, truncate toward 0</li>
        </ul>
        <p>ARM rule: <strong>divide by zero returns 0</strong> in the destination — no exception, no trap. That's different from x86 (which traps).</p>
        </div>
      `,
      challenges: [
        { type:'code-trace',
          prompt:"What is X3?",
          concept:"6 × 7 = 42.",
          code: [
            "MOVZ X1, #6",
            "MOVZ X2, #7",
            "MUL  X3, X1, X2",
          ],
          asks:'X3', format:'dec', ans:42,
          explain:"MUL writes the low 64 bits of the product. Both fit easily." },
        { type:'mc',
          prompt:"If both operands of an integer multiply are 32-bit numbers, how many bits could the full product need?",
          concept:"n × n → up to 2n bits.",
          opts:["32","48","64","128"], ans:2,
          explain:"An n-bit × n-bit multiply can produce up to 2n bits. (LEGv8's MUL keeps only the lower 64; SMULH/UMULH gets the upper 64 in real ARM, but those are out of scope for LEGv8.)" },
        { type:'code-trace',
          prompt:"UDIV: 100 ÷ 3 = ? (truncated)",
          concept:"Integer division drops the remainder.",
          code: [
            "MOVZ X1, #100",
            "MOVZ X2, #3",
            "UDIV X3, X1, X2",
          ],
          asks:'X3', format:'dec', ans:33,
          explain:"100 / 3 = 33 with remainder 1. UDIV gives the quotient (truncated toward zero)." },
        { type:'code-trace',
          prompt:"Divide by zero on LEGv8 — what's in X3?",
          concept:"ARM returns 0 (no exception).",
          code: [
            "MOVZ X1, #42",
            "MOVZ X2, #0",
            "UDIV X3, X1, X2",
          ],
          asks:'X3', format:'dec', ans:0,
          explain:"On ARM (and LEGv8), dividing by 0 silently produces 0. The OS could still install a signal handler, but the hardware itself does NOT trap. Contrast with x86, which raises #DE." },
        { type:'fill-blank',
          prompt:"Compute <code>arr[i*8]</code> using a shift instead of MUL. The index <em>i</em> is in X4, base in X10, target into X1.",
          concept:"× 8 = LSL #3. Then ADD to base, then LDUR with offset 0.",
          template: "___ X5, X4, #3\n___ X5, X10, X5\n___ X1, [X5, #0]",
          blanks: ['LSL','ADD','LDUR'],
          palette: ['LSL','LSR','ADD','ADDI','MUL','LDUR','STUR'],
          explain:"LSL #3 multiplies by 8 (one cycle, vs MUL which is many). ADD computes the byte address. LDUR loads the doubleword." },
        { type:'mc',
          prompt:"Why do compilers prefer <code>LSL #3</code> over <code>MUL</code> by 8 when the multiplier is a known power of two?",
          concept:"Shifts are cheaper than general multiply.",
          opts:["LSL handles signed overflow correctly","LSL is much faster than MUL on most ISAs",
                "MUL doesn't work for small numbers","Only LSL preserves flags"], ans:1,
          explain:"Shifts are one-cycle on most CPUs; multiply uses a multi-cycle unit. Strength-reduction by power-of-two is a classic compiler optimisation." },
      ],
    },

    // ── L22: IEEE 754 Single & Double ──────────────────────
    {
      id: 'w3-ieee754',
      title: 'IEEE 754',
      icon: '🌊',
      xp: 180,
      prereqs: ['w3-muldiv'],
      intro: `
        <div class="card"><h3>Floating-Point Encoding</h3>
        <p>IEEE 754 splits a number into three fields:</p>
        <table class="conv-table">
          <tr><th>Format</th><th>Total bits</th><th>Sign</th><th>Exponent</th><th>Mantissa (frac)</th><th>Bias</th></tr>
          <tr><td>Single (float)</td><td>32</td><td>1</td><td>8</td><td>23</td><td>127</td></tr>
          <tr><td>Double (double)</td><td>64</td><td>1</td><td>11</td><td>52</td><td>1023</td></tr>
        </table>
        <p>The value of a <em>normalized</em> number is:</p>
        <div class="equation" style="font-size:14px;">value = (−1)<sup>sign</sup> × <strong>1.mantissa</strong> × 2<sup>(exp − bias)</sup></div>
        <p>The leading 1 is <strong>implicit</strong> — not stored. The exponent field is biased: the stored value is <em>true exponent + bias</em>, so a stored 127 in a single = true exponent 0.</p>
        <h3 style="margin-top:14px;">Special values</h3>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>±0</strong>: exp = 0, mantissa = 0</li>
          <li><strong>denormal</strong>: exp = 0, mantissa ≠ 0 — implicit leading 0</li>
          <li><strong>±∞</strong>: exp = all 1s, mantissa = 0</li>
          <li><strong>NaN</strong>: exp = all 1s, mantissa ≠ 0</li>
        </ul>
        </div>
      `,
      challenges: [
        { type:'mc',
          prompt:"How many bits of mantissa does IEEE 754 <em>double</em> precision store?",
          concept:"Double: 1+11+52 = 64 bits.",
          opts:["23","32","52","64"], ans:2,
          explain:"Double is 1 sign + 11 exp + 52 mantissa = 64 bits total. The implicit leading 1 means the effective precision is 53 bits." },
        { type:'mc',
          prompt:"The exponent bias for single precision is:",
          concept:"127 for single, 1023 for double.",
          opts:["64","127","255","1023"], ans:1,
          explain:"Bias = 2^(e-1) − 1 where e is the exponent field width. For single (e=8): 2^7 − 1 = 127." },
        { type:'bit-field',
          prompt:"Encode <strong>+1.5</strong> as an IEEE 754 single. (1.5 = 1.1₂ × 2⁰)",
          concept:"sign=0; true exp=0 → stored exp=127=0b01111111; mantissa = 100…0 (the .1 after the implicit 1).",
          format:'IEEE754-single',
          fields: [
            { name:'sign',     hi:31, lo:31, expected:0,           mode:'bits' },
            { name:'exponent', hi:30, lo:23, expected:0b01111111,  mode:'bits' },
            { name:'mantissa', hi:22, lo: 0, expected:0b10000000000000000000000, mode:'bits' },
          ],
          explain:"1.5 in binary is 1.1. Normalized: 1.1 × 2⁰. Stored exp = 0 + 127 = 127 = 01111111. Mantissa drops the leading 1 and pads with zeros → 10000000000000000000000. Whole word: 0x3FC00000." },
        { type:'bit-field',
          prompt:"Encode <strong>−12.5</strong> as an IEEE 754 single.",
          concept:"−12.5 = −1100.1 = −1.1001 × 2³ → sign=1, stored exp=130, mantissa=10010…",
          format:'IEEE754-single',
          fields: [
            { name:'sign',     hi:31, lo:31, expected:1,           mode:'bits' },
            { name:'exponent', hi:30, lo:23, expected:130,         mode:'imm'  },
            { name:'mantissa', hi:22, lo: 0, expected:0b10010000000000000000000, mode:'bits' },
          ],
          explain:"12.5 = 1100.1₂ → normalize to 1.1001 × 2³. Sign=1 (negative). Stored exp = 3 + 127 = 130. Mantissa after the implicit 1 is 1001 + zeros. Whole word: 0xC1480000." },
        { type:'type',
          prompt:"Decode this IEEE 754 single (in hex): <code>0x40400000</code>. What number is it?",
          concept:"0x40400000 → sign=0, exp=128, mantissa=100…0 → 1.1 × 2¹ = 3.0.",
          ans:"3", alt:["3.0","+3","+3.0"],
          explain:"Bits: 0 10000000 10000000000000000000000. Stored exp 128 → true exp 1. Significand 1.1₂ = 1.5. 1.5 × 2 = 3.0." },
        { type:'mc',
          prompt:"What IEEE 754 single bit pattern represents <strong>+∞</strong>?",
          concept:"exp = all 1s, mantissa = 0.",
          opts:["0x7F800000  (exp=11111111, mantissa=0)","0xFFFFFFFF (all 1s)",
                "0x80000000 (just the sign bit)","0x7FFFFFFF (no sign bit, all else 1)"], ans:0,
          explain:"Infinity has the maximum exponent (all 1s) and a zero mantissa. With sign=0 you get +∞ = 0x7F800000. The all-1s mantissa would be a NaN, not infinity." },
        { type:'mc',
          prompt:"Why does IEEE 754 store the leading 1 implicitly?",
          concept:"Normalized numbers always have a leading 1 → no need to waste a bit.",
          opts:["To match the exponent's encoding","Because every normalized number has a leading 1, so it gains a free precision bit",
                "To distinguish positive from negative","Because old hardware demanded it"], ans:1,
          explain:"After normalization, the mantissa is always 1.something. Storing the something gives 24-bit effective precision in single (vs 23 stored), and 53 in double." },
      ],
    },

    // ── L23: FP Arithmetic & Rounding ──────────────────────
    {
      id: 'w3-fp-arith',
      title: 'FP Arithmetic & Rounding',
      icon: '🎯',
      xp: 150,
      prereqs: ['w3-ieee754'],
      intro: `
        <div class="card"><h3>How Floating-Point Math Works</h3>
        <p>Adding two FP numbers:</p>
        <ol style="margin-left:24px;color:var(--muted);">
          <li><strong>Align</strong> exponents — shift the smaller-exponent operand right until they match.</li>
          <li><strong>Add</strong> the mantissas.</li>
          <li><strong>Normalize</strong> — shift the result so the implicit 1 is back in place; adjust the exponent.</li>
          <li><strong>Round</strong> using guard, round, and sticky bits.</li>
        </ol>
        <h3 style="margin-top:14px;">Rounding modes</h3>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Round to nearest, ties to even</strong> — the IEEE 754 default. Halfway? Pick the result whose last bit is 0.</li>
          <li>Round toward 0 (truncate)</li>
          <li>Round toward +∞</li>
          <li>Round toward −∞</li>
        </ul>
        <p><strong>Catastrophic cancellation:</strong> subtracting two nearly-equal FP numbers wipes out precision. <code>(1.0 + 1e−20) − 1.0</code> in single precision is <em>0</em>, not 1e−20, because 1e−20 was lost during the align/add step.</p>
        </div>
      `,
      challenges: [
        { type:'mc',
          prompt:"The default IEEE 754 rounding mode is:",
          concept:"Round to nearest, ties to even.",
          opts:["Round toward 0 (truncate)","Round toward +∞","Round to nearest, ties to even","Round to nearest, ties away from zero"], ans:2,
          explain:"\"Round to nearest, ties to even\" (also called banker's rounding) is the IEEE 754 default. Picking the even last bit on ties avoids systematic upward drift." },
        { type:'mc',
          prompt:"Round these to the nearest integer using ties-to-even: 2.5, 3.5, 4.5.",
          concept:"Tie-to-even: 2.5 → 2, 3.5 → 4, 4.5 → 4.",
          opts:["3, 4, 5 (ties round up)","2, 4, 4 (ties to even)",
                "2, 3, 4 (truncate)","2.5, 3.5, 4.5 (no change)"], ans:1,
          explain:"Each is exactly halfway. Ties-to-even picks the even neighbour: 2.5→2 (even), 3.5→4 (even), 4.5→4 (even)." },
        { type:'mc',
          prompt:"Before adding two FP numbers, the hardware aligns exponents. If you add 1.0 × 2⁰ and 1.0 × 2³, the smaller operand is shifted by how many positions?",
          concept:"Shift the smaller-exponent value right by the exponent difference (3 − 0 = 3).",
          opts:["0","1","3","23"], ans:2,
          explain:"To match exponent 3, the first operand's mantissa is shifted right by 3, becoming 0.001 × 2³. Then the mantissas add normally." },
        { type:'mc',
          prompt:"Compute <code>(1.0e8 + 1.0) − 1.0e8</code> in IEEE 754 single. What do you get?",
          concept:"1.0 is lost when aligned against 1e8 (the right shift exceeds the mantissa width).",
          opts:["1.0 (exact)","0.0 (catastrophic cancellation)","1.0e-23","NaN"], ans:1,
          explain:"Single precision has only 24 bits of significand. 1.0e8 / 1.0 is a 2⁷-ish ratio that just barely fits — actually 1.0 survives the first step, but the canonical 'big + tiny − big' example loses precision. Either way the result is wrong / zero — that's catastrophic cancellation." },
        { type:'mc',
          prompt:"Which two values does IEEE 754 use to round halfway cases (in addition to the bits being kept)?",
          concept:"Guard, round, sticky.",
          opts:["Just one extra bit (round)","Guard + round bits only","Guard, round, and sticky bits","Sign and exponent bits"], ans:2,
          explain:"Guard and round are the two bits immediately past the kept mantissa. Sticky is the OR of all bits beyond round — it tracks whether anything past the round bit was non-zero, which decides ties." },
        { type:'fill-blank',
          prompt:"Match the symbol you'd see if FP operations went wrong: 0/0 gives ___ ; 1.0/0.0 gives ___ ; the smallest representable single is around 1.4 × 10⁻___.",
          concept:"0/0 → NaN; finite/0 → Inf; smallest denormal single ≈ 1.4e-45.",
          template: "0/0 = ___ ;  1.0/0.0 = ___ ;  smallest single ≈ 1.4×10⁻___",
          blanks: ['NaN','Inf','45'],
          palette: ['NaN','Inf','-Inf','0','38','45','127','1023'],
          explain:"0/0 is indeterminate → NaN. Anything finite/0 → ±Inf with the sign of the numerator. Single's smallest positive (denormal) is ~1.4×10⁻⁴⁵; smallest normalized is ~1.18×10⁻³⁸." },
      ],
    },

  ],
});
