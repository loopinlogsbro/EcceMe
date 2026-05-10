// ============================================================
// World 1 — Foundations (ported from Binary Quest)
// ============================================================
// All 10 original Binary Quest levels, ported into the new
// schema. Content is unchanged except for IDs, prereq chaining,
// and `xp` replacing `xpReward`.
//
// Migration mapping (Binary Quest idx → new id):
//   0 → w1-bits, 1 → w1-place-values, 2 → w1-bin-to-dec,
//   3 → w1-dec-to-bin, 4 → w1-hex, 5 → w1-twos,
//   6 → w1-arith, 7 → w1-bitwise, 8 → w1-bytes, 9 → w1-encoding.
// ============================================================

import { registerWorld } from '../js/engine.js';

registerWorld({
  id: 'w1',
  title: 'Foundations',
  subtitle: 'Bits, place values, hex, two\'s complement, instruction encoding',
  icon: '⚡',
  levels: [

    // ── L1: Bits & Switches ──────────────────────────────
    {
      id: 'w1-bits',
      title: 'Bits & Switches',
      icon: '⚡',
      xp: 60,
      prereqs: [],
      intro: `
        <div class="card"><h3>The Fundamental Unit</h3>
        <p>Everything in a computer — instructions, numbers, text, images — is stored as <strong>bits</strong>.</p>
        <p>A bit has exactly <strong>two possible values</strong>: <strong>0</strong> (off / false / low voltage) or <strong>1</strong> (on / true / high voltage). That's it. Two states, like a light switch.</p>
        <p>Eight bits grouped together is called a <strong>byte</strong>. A byte can hold 2⁸ = <strong>256 different values</strong>.</p>
        </div>
        <div class="card"><h3>Try It</h3><p>In the challenges ahead you'll click bits to flip them between 0 and 1.</p></div>
      `,
      challenges: [
        { type:'toggle-free',   prompt:"Click any bit to flip it ON (1). Make ALL 8 bits equal to 1.",
          concept:"A bit flips between 0 and 1", bits:8, target:0b11111111 },
        { type:'mc', prompt:"How many different values can a single bit represent?",
          concept:"2^n values for n bits", opts:["1","2","4","8"], ans:1,
          explain:"A single bit has 2 states: 0 or 1." },
        { type:'mc', prompt:"How many different values can 8 bits (one byte) represent?",
          concept:"2^8 = 256", opts:["16","64","128","256"], ans:3,
          explain:"2⁸ = 256. The values range from 0 to 255 for unsigned bytes." },
        { type:'mc', prompt:"A computer stores the letter 'A' as the number 65. How many bits does it take to store 65?",
          concept:"65 fits in one byte (0 – 255)", opts:["4 bits","8 bits","16 bits","32 bits"], ans:1,
          explain:"65 fits in one byte (8 bits). One byte can hold any value 0–255." },
        { type:'toggle-target', prompt:"Set the bits to match the pattern: 1 0 1 0  1 0 1 0",
          concept:"Practice toggling bits", bits:8, target:0b10101010 },
      ],
    },

    // ── L2: Place Values ─────────────────────────────────
    {
      id: 'w1-place-values',
      title: 'Place Values',
      icon: '🔢',
      xp: 80,
      prereqs: ['w1-bits'],
      intro: `
        <div class="card"><h3>Binary Counting</h3>
        <p>In decimal, each position is worth 10× the position to its right (ones, tens, hundreds…).</p>
        <p>In binary, each position is worth <strong>2× the position to its right</strong>:</p>
        <div class="equation" style="font-size:15px;">... 128 | 64 | 32 | 16 | 8 | 4 | 2 | 1</div>
        <p>The rightmost bit is <strong>bit 0</strong> (worth 2⁰ = 1). Bit 1 is worth 2, bit 2 is worth 4, and so on.</p>
        <p>To find the decimal value: <strong>add up the place values of every bit that is 1</strong>.</p>
        <p>Example: <code>0000 1011</code> = 8 + 2 + 1 = <strong>11</strong></p>
        </div>
      `,
      challenges: [
        { type:'mc', prompt:"What is the place value of bit position 0 (the rightmost bit)?",
          concept:"Bit 0 = 2⁰ = 1", opts:["0","1","2","8"], ans:1,
          explain:"Bit position 0 has value 2⁰ = 1." },
        { type:'mc', prompt:"What is the place value of bit position 3?",
          concept:"Bit 3 = 2³ = 8", opts:["3","6","8","16"], ans:2,
          explain:"Bit position 3 has value 2³ = 8." },
        { type:'mc', prompt:"Which bit position has the place value 64?",
          concept:"64 = 2⁶ → position 6",
          opts:["Position 5","Position 6","Position 7","Position 8"], ans:1,
          explain:"64 = 2⁶, so it is bit position 6." },
        { type:'type', prompt:"What decimal value does <code>0000 1000</code> equal?",
          concept:"Only bit 3 is set → 8", ans:"8", explain:"Only bit 3 (value 8) is set. Sum = 8." },
        { type:'type', prompt:"What decimal value does <code>0001 0001</code> equal?",
          concept:"Bit 4 (16) + bit 0 (1) = 17", ans:"17", explain:"Bit 4 = 16, bit 0 = 1. Total = 17." },
        { type:'type', prompt:"What decimal value does <code>0111 1111</code> equal?",
          concept:"64+32+16+8+4+2+1 = 127", ans:"127", explain:"64+32+16+8+4+2+1 = 127." },
      ],
    },

    // ── L3: Binary → Decimal ─────────────────────────────
    {
      id: 'w1-bin-to-dec',
      title: 'Binary → Decimal',
      icon: '→',
      xp: 100,
      prereqs: ['w1-place-values'],
      intro: `
        <div class="card"><h3>Reading Binary Numbers</h3>
        <p>To convert binary to decimal, scan left-to-right and <strong>add the place value of each '1' bit</strong>.</p>
        <div class="equation">1 0 1 1 0 1 0 0<br><span style="font-size:13px;color:var(--muted)">128 + 0 + 32 + 16 + 0 + 4 + 0 + 0 = <strong style="color:var(--gold)">180</strong></span></div>
        <p>Shortcut: start at the rightmost '1' bit and work left, doubling as you go.</p>
        </div>
      `,
      challenges: [
        { type:'type', prompt:"Convert <code>0000 0101</code> to decimal.",
          concept:"Bit 2 (4) + bit 0 (1) = 5", ans:"5", explain:"4 + 1 = 5." },
        { type:'type', prompt:"Convert <code>0000 1010</code> to decimal.",
          concept:"Bit 3 (8) + bit 1 (2) = 10", ans:"10", explain:"8 + 2 = 10." },
        { type:'type', prompt:"Convert <code>0001 1110</code> to decimal.",
          concept:"16+8+4+2 = 30", ans:"30", explain:"16 + 8 + 4 + 2 = 30." },
        { type:'type', prompt:"Convert <code>0100 0001</code> to decimal.",
          concept:"64 + 1 = 65 (ASCII 'A')", ans:"65", explain:"64 + 1 = 65. Fun fact: this is the ASCII code for 'A'." },
        { type:'type', prompt:"Convert <code>1010 1010</code> to decimal.",
          concept:"128+32+8+2 = 170", ans:"170", explain:"128 + 32 + 8 + 2 = 170." },
        { type:'type', prompt:"Convert <code>1111 0000</code> to decimal.",
          concept:"128+64+32+16 = 240", ans:"240", explain:"128 + 64 + 32 + 16 = 240." },
        { type:'type', prompt:"Convert <code>1111 1111</code> to decimal.",
          concept:"All 8 bits on = 255", ans:"255",
          explain:"128+64+32+16+8+4+2+1 = 255. The maximum value of an unsigned byte." },
      ],
    },

    // ── L4: Decimal → Binary ─────────────────────────────
    {
      id: 'w1-dec-to-bin',
      title: 'Decimal → Binary',
      icon: '←',
      xp: 100,
      prereqs: ['w1-bin-to-dec'],
      intro: `
        <div class="card"><h3>Building Binary Numbers</h3>
        <p>To convert decimal to binary, use the <strong>greedy subtraction method</strong>:</p>
        <p>1. Find the largest power of 2 that fits. Write a 1 in that position.<br>
        2. Subtract it. Repeat with the remainder.<br>
        3. Write 0 for every position you skip.</p>
        <p>Example: 42 → 32 fits (bit 5 = 1), remainder 10 → 8 fits (bit 3 = 1), remainder 2 → 2 fits (bit 1 = 1).</p>
        <div class="equation">42 = <strong>0010 1010</strong></div>
        </div>
      `,
      challenges: [
        { type:'toggle-target', prompt:"Set the bits to represent decimal <strong>7</strong>",
          concept:"7 = 4+2+1", bits:8, target:0b00000111 },
        { type:'toggle-target', prompt:"Set the bits to represent decimal <strong>13</strong>",
          concept:"13 = 8+4+1", bits:8, target:0b00001101 },
        { type:'toggle-target', prompt:"Set the bits to represent decimal <strong>42</strong>",
          concept:"42 = 32+8+2", bits:8, target:0b00101010 },
        { type:'toggle-target', prompt:"Set the bits to represent decimal <strong>100</strong>",
          concept:"100 = 64+32+4", bits:8, target:0b01100100 },
        { type:'toggle-target', prompt:"Set the bits to represent decimal <strong>200</strong>",
          concept:"200 = 128+64+8", bits:8, target:0b11001000 },
        { type:'mc', prompt:"Which is the correct 8-bit binary for decimal 17?",
          concept:"17 = 16 + 1 → bit 4 and bit 0",
          opts:["0001 0001","0001 0010","0010 0001","0000 1001"], ans:0,
          explain:"17 = 16 (bit 4) + 1 (bit 0) = 0001 0001." },
      ],
    },

    // ── L5: Hexadecimal ──────────────────────────────────
    {
      id: 'w1-hex',
      title: 'Hexadecimal',
      icon: '#️⃣',
      xp: 100,
      prereqs: ['w1-dec-to-bin'],
      intro: `
        <div class="card"><h3>Shorthand for Binary</h3>
        <p>Binary strings get long fast. Programmers use <strong>hexadecimal (base 16)</strong> as a compact shorthand.</p>
        <p>Each hex digit maps to exactly <strong>4 bits</strong>:</p>
        <table class="conv-table">
        <tr><th>Bin</th><th>Dec</th><th>Hex</th><th>Bin</th><th>Dec</th><th>Hex</th></tr>
        <tr><td>0000</td><td>0</td><td>0</td><td>1000</td><td>8</td><td>8</td></tr>
        <tr><td>0001</td><td>1</td><td>1</td><td>1001</td><td>9</td><td>9</td></tr>
        <tr><td>0010</td><td>2</td><td>2</td><td>1010</td><td>10</td><td>A</td></tr>
        <tr><td>0011</td><td>3</td><td>3</td><td>1011</td><td>11</td><td>B</td></tr>
        <tr><td>0100</td><td>4</td><td>4</td><td>1100</td><td>12</td><td>C</td></tr>
        <tr><td>0101</td><td>5</td><td>5</td><td>1101</td><td>13</td><td>D</td></tr>
        <tr><td>0110</td><td>6</td><td>6</td><td>1110</td><td>14</td><td>E</td></tr>
        <tr><td>0111</td><td>7</td><td>7</td><td>1111</td><td>15</td><td>F</td></tr>
        </table>
        <p>Split 8-bit binary into two 4-bit groups → convert each to one hex digit → prefix with <code>0x</code>.</p>
        <p>Example: <code>1100 1010</code> → C, A → <code>0xCA</code></p>
        </div>
      `,
      challenges: [
        { type:'mc', prompt:"What hex digit does <code>1111</code> map to?",
          concept:"1111 = 15 decimal = F hex",
          opts:["E","F","1F","10"], ans:1, explain:"1111 = 15 decimal, which is F in hexadecimal." },
        { type:'mc', prompt:"What hex digit does <code>1010</code> map to?",
          concept:"1010 = 10 decimal = A hex",
          opts:["9","A","B","10"], ans:1, explain:"1010 = 10 decimal = A in hex." },
        { type:'type', prompt:"Convert <code>1100 1100</code> to hex (e.g. type CC).",
          concept:"1100=C, 1100=C → 0xCC", ans:"CC", alt:["0xCC","cc","0xcc"],
          explain:"1100 = C, 1100 = C → 0xCC." },
        { type:'type', prompt:"What decimal value does <code>0xFF</code> equal?",
          concept:"FF = 1111 1111 = 255", ans:"255", explain:"F=1111, F=1111 → 1111 1111 = 255." },
        { type:'type', prompt:"Convert <code>0100 1000</code> to hex (type two hex digits).",
          concept:"0100=4, 1000=8 → 0x48", ans:"48", alt:["0x48","0X48"],
          explain:"0100 = 4, 1000 = 8 → 0x48. Fun fact: 0x48 = 72 = ASCII 'H'." },
        { type:'mc', prompt:"A 32-bit word needs how many hex digits to represent it?",
          concept:"32 bits ÷ 4 bits/digit = 8",
          opts:["4","6","8","16"], ans:2, explain:"32 ÷ 4 = 8 hex digits. E.g., 0xDEAD_BEEF is a 32-bit value." },
      ],
    },

    // ── L6: Two's Complement ─────────────────────────────
    {
      id: 'w1-twos',
      title: "Two's Complement",
      icon: '➖',
      xp: 120,
      prereqs: ['w1-hex'],
      intro: `
        <div class="card"><h3>Signed Integers</h3>
        <p>Computers need to represent negative numbers. The standard method is <strong>two's complement</strong>.</p>
        <p>In an 8-bit signed integer, the <strong>most significant bit (MSB)</strong> has a weight of <strong>−128</strong> instead of +128.</p>
        <div class="equation" style="font-size:14px;">value = −128·b₇ + 64·b₆ + 32·b₅ + 16·b₄ + 8·b₃ + 4·b₂ + 2·b₁ + 1·b₀</div>
        <p>Range: −128 to +127. Zero is <code>0000 0000</code>. Minus one is <code>1111 1111</code>.</p>
        <p><strong>How to negate</strong>: flip all bits, then add 1 (or equivalently, find the rightmost 1, keep it and everything to its right, flip everything to its left).</p>
        <p>Example: +5 = <code>0000 0101</code>. Flip: <code>1111 1010</code>. Add 1: <code>1111 1011</code> = −5 ✓</p>
        </div>
      `,
      challenges: [
        { type:'mc', prompt:"In 8-bit two's complement, what is the weight of the MSB (bit 7)?",
          concept:"MSB weight = −128",
          opts:["+128","−1","−128","−127"], ans:2,
          explain:"The MSB in two's complement contributes −128 to the value." },
        { type:'mc', prompt:"What is <code>1111 1111</code> in 8-bit two's complement?",
          concept:"−128 + 127 = −1",
          opts:["255","127","−1","−128"], ans:2,
          explain:"−128 + 64+32+16+8+4+2+1 = −128 + 127 = −1." },
        { type:'mc', prompt:"What is <code>1000 0000</code> in 8-bit two's complement?",
          concept:"Only the −128 bit is set",
          opts:["128","−127","−128","−1"], ans:2,
          explain:"Only bit 7 is set, contributing −128. All other bits are 0." },
        { type:'mc', prompt:"What is the range of an 8-bit two's complement integer?",
          concept:"−2^7 to 2^7 − 1",
          opts:["0 to 255","−127 to 127","−128 to 127","−128 to 128"], ans:2,
          explain:"−2⁷ = −128 to 2⁷ − 1 = 127. Note: there is only ONE zero, but the negative range extends one further than the positive." },
        { type:'toggle-target', prompt:"Set the bits to represent <strong>−5</strong> in 8-bit two's complement.<br><span class='hint'>Hint: flip all bits of +5 (0000 0101), then add 1.</span>",
          concept:"+5 = 0000 0101 → flip → 1111 1010 → +1 → 1111 1011",
          bits:8, target:0b11111011, signed:true, signedTarget:-5 },
        { type:'mc', prompt:"Sign extension: <code>1111 1011</code> (8-bit = −5) extended to 16 bits is…",
          concept:"Extend MSB: fill with 1s on the left",
          opts:["0000 0000 1111 1011","1111 1111 1111 1011","0111 1111 1111 1011","1111 1111 0000 0100"], ans:1,
          explain:"Sign extension copies the MSB (1) into all new upper bits: 1111 1111 1111 1011." },
      ],
    },

    // ── L7: Binary Arithmetic ────────────────────────────
    {
      id: 'w1-arith',
      title: 'Binary Arithmetic',
      icon: '➕',
      xp: 120,
      prereqs: ['w1-twos'],
      intro: `
        <div class="card"><h3>Adding in Binary</h3>
        <p>Binary addition works just like decimal, but with only two digits:</p>
        <div class="equation" style="font-size:14px;">0+0=0 &nbsp;|&nbsp; 0+1=1 &nbsp;|&nbsp; 1+0=1 &nbsp;|&nbsp; 1+1=0 carry 1</div>
        <p>When a carry makes the MSB overflow, you may get an incorrect result. This is <strong>overflow</strong>.</p>
        <p><strong>Unsigned overflow</strong>: carry out of the MSB. Result wraps around.</p>
        <p><strong>Signed overflow</strong>: two positives sum to negative, or two negatives sum to positive. Detected when carry-in to MSB ≠ carry-out from MSB.</p>
        </div>
      `,
      challenges: [
        { type:'toggle-target', prompt:"Calculate in binary: <code>0011 + 0001</code> = ?",
          concept:"3 + 1 = 4", bits:8, target:0b00000100 },
        { type:'mc', prompt:"Add: <code>0111 + 0001</code> in 4-bit two's complement. The result wraps to <code>1000</code>. What happened?",
          concept:"7 + 1 = 8, but +8 doesn't fit in 4-bit signed (max = +7)",
          opts:["No problem, the result is 8","Signed overflow: two positives summed to a negative",
                "Unsigned overflow: result wrapped","Carry-out only, no overflow"], ans:1,
          explain:"In 4-bit signed, +7 + +1 = −8 (1000₂). The carry-in to the MSB ≠ carry-out → signed overflow." },
        { type:'mc', prompt:"<code>1111 1111 + 0000 0001</code> (unsigned 8-bit). What is the result?",
          concept:"255 + 1 = 256, wraps to 0 with carry out",
          opts:["256","0 with carry","1","255"], ans:1,
          explain:"255 + 1 = 256, but 256 doesn't fit in 8 bits. The result is 0x00 with a carry out of bit 7." },
        { type:'mc', prompt:"In LEGv8, which instruction sets the condition flags (N, Z, C, V) after addition?",
          concept:"ADDS vs ADD",
          opts:["ADD","ADDS","ADDI","ADDIS"], ans:1,
          explain:"ADDS (Add, setting flags) sets the N, Z, C, V condition flags. ADD does NOT — this is a common exam trap." },
        { type:'toggle-target', prompt:"Calculate: <code>0101 1010 + 0010 0110</code> = ?  (90 + 38)",
          concept:"90 + 38 = 128 = 1000 0000", bits:8, target:0b10000000 },
        { type:'mc', prompt:"After <code>ADDS X3, X1, X2</code>, which condition flag tells you the result was zero?",
          concept:"Z = zero flag",
          opts:["N (negative)","Z (zero)","C (carry)","V (overflow)"], ans:1,
          explain:"The Z (zero) flag is set when the result equals zero." },
      ],
    },

    // ── L8: Bitwise Operations ───────────────────────────
    {
      id: 'w1-bitwise',
      title: 'Bitwise Operations',
      icon: '🔗',
      xp: 120,
      prereqs: ['w1-arith'],
      intro: `
        <div class="card"><h3>Bit-Level Logic</h3>
        <p>These operations work on <strong>each bit independently</strong>, in parallel:</p>
        <div class="equation" style="font-size:13px;text-align:left;padding-left:20px;">
        AND: 1 only if <em>both</em> bits are 1 &nbsp;(mask / clear bits)<br>
        OR &nbsp;: 1 if <em>either</em> bit is 1 &nbsp;(set bits)<br>
        XOR: 1 if bits are <em>different</em> &nbsp;(toggle / detect difference)<br>
        NOT: flip every bit &nbsp;(bitwise inverse)<br>
        LSL #n: shift left n positions (× 2ⁿ)<br>
        LSR #n: logical shift right n positions (÷ 2ⁿ, fills with 0s)
        </div>
        <p>These appear constantly in ISA instruction sets: AND, ORR, EOR (XOR), LSL, LSR in LEGv8/ARM. Note: there is no NOT instruction in LEGv8 — use <code>EOR Xn, Xm, #-1</code> instead.</p>
        </div>
      `,
      challenges: [
        { type:'toggle-target', prompt:"Compute: <code>1100 1010 AND 1111 0000</code>",
          concept:"AND keeps only bits where BOTH are 1",
          bits:8, target:0b11000000 },
        { type:'toggle-target', prompt:"Compute: <code>1100 0000 OR 0000 1111</code>",
          concept:"OR sets a bit if EITHER input is 1",
          bits:8, target:0b11001111 },
        { type:'toggle-target', prompt:"Compute: <code>1010 1010 XOR 1111 1111</code>",
          concept:"XOR with all 1s = NOT (flips every bit)",
          bits:8, target:0b01010101 },
        { type:'mc', prompt:"In LEGv8/ARM, which instruction performs bitwise AND?",
          concept:"AND vs ORR vs EOR in LEGv8",
          opts:["ORR","AND","EOR","LSL"], ans:1,
          explain:"AND performs bitwise AND. ORR = OR, EOR = XOR, LSL = left shift." },
        { type:'mc', prompt:"<code>LSL X0, X0, #3</code> multiplies X0 by what value?",
          concept:"LSL #3 = ×2³ = ×8",
          opts:["3","6","8","16"], ans:2,
          explain:"Shifting left by 3 = multiplying by 2³ = 8." },
        { type:'mc', prompt:"You want to extract bits [3:0] (the lower 4 bits) from a register. Which instruction + mask achieves this?",
          concept:"AND with 0x0F masks lower 4 bits",
          opts:["ORR X1, X1, #0x0F","AND X1, X1, #0x0F","EOR X1, X1, #0x0F","LSL X1, X1, #4"], ans:1,
          explain:"AND with 0x0F (0000 1111) clears the upper bits and keeps the lower 4." },
        { type:'mc', prompt:"<code>LSR X0, X0, #4</code> divides X0 by what? (unsigned integer division)",
          concept:"LSR #4 = ÷2⁴ = ÷16",
          opts:["4","8","16","32"], ans:2,
          explain:"Logical shift right by 4 = divide by 2⁴ = 16 (integer division, drops fraction)." },
        { type:'toggle-target', prompt:"Compute: <code>NOT 0011 0101</code>  (flip every bit)",
          concept:"NOT flips each bit (in LEGv8: EOR with all 1s)",
          bits:8, target:0b11001010 },
      ],
    },

    // ── L9: Bytes, Words, Alignment ──────────────────────
    {
      id: 'w1-bytes',
      title: 'Bytes, Words & Alignment',
      icon: '📦',
      xp: 100,
      prereqs: ['w1-bitwise'],
      intro: `
        <div class="card"><h3>Data Widths in Computer Architecture</h3>
        <p>Different data sizes have standard names:</p>
        <table class="conv-table">
        <tr><th>Name</th><th>Bits</th><th>Bytes</th><th>Example</th></tr>
        <tr><td>Byte</td><td>8</td><td>1</td><td>ASCII character</td></tr>
        <tr><td>Halfword</td><td>16</td><td>2</td><td>Unicode character</td></tr>
        <tr><td>Word</td><td>32</td><td>4</td><td>int, LEGv8 instruction</td></tr>
        <tr><td>Doubleword</td><td>64</td><td>8</td><td>LEGv8 register (X-regs)</td></tr>
        </table>
        <p><strong>Memory is byte-addressed</strong>: every byte has a unique address. A 32-bit word at address 0x1000 occupies bytes 0x1000, 0x1001, 0x1002, 0x1003.</p>
        <p><strong>Alignment</strong>: a word (4 bytes) must start at an address divisible by 4. A doubleword (8 bytes) must be divisible by 8 — this is why array strides for X-regs are 8.</p>
        </div>
      `,
      challenges: [
        { type:'mc', prompt:"LEGv8 instructions are how wide?",
          concept:"All LEGv8 instructions = 32 bits = 1 word",
          opts:["8 bits","16 bits","32 bits","64 bits"], ans:2,
          explain:"All LEGv8 instructions are exactly 32 bits wide. This uniform length simplifies pipelining." },
        { type:'mc', prompt:"LEGv8 X-registers (X0–X30) hold how many bits?",
          concept:"X-registers = 64-bit doublewords",
          opts:["8 bits","16 bits","32 bits","64 bits"], ans:3,
          explain:"LEGv8/ARM64 general-purpose registers are 64 bits (doublewords)." },
        { type:'mc', prompt:"A doubleword array starts at address 0x1000. Where does element [1] (index 1) begin?",
          concept:"Doubleword stride = 8 bytes",
          opts:["0x1001","0x1002","0x1004","0x1008"], ans:3,
          explain:"Each doubleword is 8 bytes. Address of [1] = 0x1000 + 8 = 0x1008." },
        { type:'mc', prompt:"In <code>LDUR X9, [X19, #0]</code>, if X19 = 4000, what memory address is read?",
          concept:"Base register + offset = address",
          opts:["4000","4008","0","X19"], ans:0,
          explain:"Address = X19 + offset = 4000 + 0 = 4000." },
        { type:'mc', prompt:"A struct has dimensions stored at offsets 0, 16, and 32. What size is each field?",
          concept:"Stride 16 means 16 bytes = 128 bits per element",
          opts:["8 bytes (doubleword)","16 bytes (2 doublewords)","32 bytes","4 bytes (word)"], ans:1,
          explain:"Offset jumps of 16 bytes = 128 bits per field." },
        { type:'mc', prompt:"Which LEGv8 instruction loads a single byte from memory (zero-extended to 64 bits)?",
          concept:"LDURB = Load Register Unsigned Byte",
          opts:["LDUR","LDURB","LDURH","LDURSW"], ans:1,
          explain:"LDURB loads a byte and zero-extends it. LDURH = halfword, LDURSW = word (sign-extended)." },
      ],
    },

    // ── L10: Instruction Encoding ────────────────────────
    {
      id: 'w1-encoding',
      title: 'Instruction Encoding',
      icon: '🧩',
      xp: 150,
      prereqs: ['w1-bytes'],
      intro: `
        <div class="card"><h3>32 Bits of Meaning</h3>
        <p>Every LEGv8 instruction is exactly 32 bits. Those bits are divided into <strong>fields</strong> whose positions tell the CPU what to do.</p>
        <h3 style="margin-top:14px;">R-format (Register): ADD, SUB, AND, ORR, LSL…</h3>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin:10px 0;font-family:monospace;font-size:12px;justify-content:center;">
          <div style="background:rgba(167,139,250,.2);border:1px solid #a78bfa;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 31–21</div><div style="font-weight:700;color:#a78bfa;">opcode</div><div>11 bits</div></div>
          <div style="background:rgba(56,189,248,.15);border:1px solid #38bdf8;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 20–16</div><div style="font-weight:700;color:#38bdf8;">Rm</div><div>5 bits</div></div>
          <div style="background:rgba(251,146,60,.15);border:1px solid #fb923c;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 15–10</div><div style="font-weight:700;color:#fb923c;">shamt</div><div>6 bits</div></div>
          <div style="background:rgba(244,114,182,.15);border:1px solid #f472b6;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 9–5</div><div style="font-weight:700;color:#f472b6;">Rn</div><div>5 bits</div></div>
          <div style="background:rgba(74,222,128,.15);border:1px solid #4ade80;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 4–0</div><div style="font-weight:700;color:#4ade80;">Rd</div><div>5 bits</div></div>
        </div>
        <h3 style="margin-top:14px;">D-format (Data/Memory): LDUR, STUR</h3>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin:10px 0;font-family:monospace;font-size:12px;justify-content:center;">
          <div style="background:rgba(167,139,250,.2);border:1px solid #a78bfa;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 31–21</div><div style="font-weight:700;color:#a78bfa;">opcode</div><div>11 bits</div></div>
          <div style="background:rgba(56,189,248,.15);border:1px solid #38bdf8;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 20–12</div><div style="font-weight:700;color:#38bdf8;">address</div><div>9 bits</div></div>
          <div style="background:rgba(251,146,60,.15);border:1px solid #fb923c;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 11–10</div><div style="font-weight:700;color:#fb923c;">op2</div><div>2 bits</div></div>
          <div style="background:rgba(244,114,182,.15);border:1px solid #f472b6;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 9–5</div><div style="font-weight:700;color:#f472b6;">Rn</div><div>5 bits</div></div>
          <div style="background:rgba(74,222,128,.15);border:1px solid #4ade80;border-radius:5px;padding:4px 8px;text-align:center;"><div>Bits 4–0</div><div style="font-weight:700;color:#4ade80;">Rt</div><div>5 bits</div></div>
        </div>
        <p>In <strong>R-format</strong>: <em>Rd</em> = destination, <em>Rn</em> = first source, <em>Rm</em> = second source, <em>shamt</em> = shift amount.</p>
        </div>
      `,
      challenges: [
        { type:'mc', prompt:"In <code>ADD X3, X1, X2</code> (R-format), which field holds X3?",
          concept:"Destination register → Rd field",
          opts:["Rm (bits 20–16)","shamt (bits 15–10)","Rn (bits 9–5)","Rd (bits 4–0)"], ans:3,
          explain:"The destination register is always in the Rd field (bits 4–0) for R-format instructions." },
        { type:'mc', prompt:"In <code>SUB X9, X7, X6</code>, which register is in the Rn field?",
          concept:"SUB Rd, Rn, Rm → Rn is first source",
          opts:["X6","X7","X9","XZR"], ans:1,
          explain:"Format: SUB Rd, Rn, Rm. X7 is the first source operand → Rn field." },
        { type:'mc', prompt:"How many bits does the opcode field occupy in an R-format LEGv8 instruction?",
          concept:"R-format opcode = 11 bits",
          opts:["5","6","8","11"], ans:3,
          explain:"The R-format opcode is 11 bits wide (bits 31–21)." },
        { type:'mc', prompt:"<code>LDUR X9, [X19, #8]</code> is D-format. Where is the #8 (offset) stored?",
          concept:"D-format address field = 9-bit signed offset",
          opts:["Rt field (5 bits)","Rn field (5 bits)","address field (9 bits)","opcode field (11 bits)"], ans:2,
          explain:"The 9-bit address field (bits 20–12) holds the signed byte offset. #8 = 0b000001000." },
        { type:'mc', prompt:"Why do all LEGv8 instructions have the same 32-bit length?",
          concept:"Uniform length simplifies pipelining",
          opts:["To save memory","To simplify pipelining and instruction fetch","To make immediates larger","To support more registers"], ans:1,
          explain:"Uniform 32-bit instruction length makes the IF stage trivial: always read exactly 4 bytes. It simplifies pipelining significantly." },
        { type:'mc', prompt:"The maximum unsigned value of a 5-bit register field is 31 (0b11111). How many registers can LEGv8 directly address?",
          concept:"5 bits → 2⁵ = 32 registers",
          opts:["16","31","32","64"], ans:2,
          explain:"5 bits → 2⁵ = 32 register addresses (X0–X30 + XZR = 32 registers total)." },
        { type:'mc', prompt:"In <code>SUBS XZR, X3, X4</code> (the compare idiom), which field holds XZR?",
          concept:"XZR as Rd discards the result",
          opts:["Rm","shamt","Rn","Rd"], ans:3,
          explain:"The result is written to Rd = XZR. Writing to XZR discards the value; SUBS still sets the condition flags." },
        { type:'mc', prompt:"An I-format instruction has a 12-bit signed immediate. Its range is −2048 to +2047. Which is the correct instruction type using immediates in LEGv8?",
          concept:"ADDI, SUBI, ANDI, ORRI use immediates",
          opts:["ADD","LDUR","ADDI","CBZ"], ans:2,
          explain:"ADDI (Add Immediate) uses I-format. It encodes a 12-bit immediate in the instruction word instead of a second register." },
      ],
    },

  ],
});
