# C952 Quest

A self-contained, zero-dependency game that walks through C952 (Computer
Architecture, Patterson & Hennessy ARM Edition / LEGv8) from bits up to
caches.

## Running

Just open `index.html` in any modern browser:

- Double-click `index.html` from the file manager.
- Or run `open index.html` (macOS), `xdg-open index.html` (Linux),
  `start index.html` (Windows).
- Or visit `/private/c952/c952-quest/` on the deployed Hugo site.

ES modules load via `<script type="module">` so the file:// protocol
works without any server. No build step, no npm, no fonts beyond the
system stack.

**Browser support**: Safari, Chrome, Firefox — latest two major versions.
ES2020+ (BigInt, optional chaining, dynamic import) is required.

## Layout

```
c952-quest/
  index.html               -- entry shell + theme bootstrap
  README.md                -- this file
  css/
    main.css               -- all styles (carries Binary Quest tokens)
  js/
    storage.js             -- localStorage wrapper + bq-state migration
    engine.js              -- level runner, XP, prereqs, hints
    ui.js                  -- screens, world picker, theme, keyboard, modals
    challenges.js          -- the 9 challenge types
    legv8.js               -- LEGv8 interpreter (BigInt 64-bit)
  levels/
    world1-foundations.js  -- 10 levels (ported from Binary Quest)
    world2-legv8.js        -- 9 levels: registers, formats, arith, mem, branches, procs
    world3-arithmetic.js   -- (planned)
    world4-datapath.js     -- (planned)
    world5-memory.js       -- (planned)
  assets/                  -- inline SVGs only; reserved for future PNGs
```

Total source size is well under the 500 KB budget.

## Adding a level

Open the right `levels/world*-*.js` and add an object inside the
`registerWorld({ levels: [...] })` array. Minimum shape:

```js
{
  id:       'w2-my-new-level',          // unique across the whole game
  title:    'My New Level',
  icon:     '🎯',                         // single emoji renders nicely
  xp:       150,                         // total XP available
  prereqs:  ['w2-procedures'],           // level IDs that must be completed
                                          // before this one unlocks (empty for first level)
  intro:    `<div class="card"><h3>...</h3><p>...</p></div>`,
  challenges: [
    { type: 'mc', prompt: '...', opts: ['A','B','C','D'], ans: 1,
      concept: 'short hint shown after a wrong answer',
      explain: 'shown after answering' },
    // … more challenges
  ],
}
```

Add the world's import to `js/ui.js` (top of the file) so it's loaded
into the engine.

## Challenge types

Each challenge has a `type` string and type-specific fields. The engine
calls into `js/challenges.js`, which dispatches to a per-type render +
check function. After World 1, levels should mix at least two types.

### `mc` — multiple choice

```js
{ type:'mc',
  prompt:'How many bits does the opcode field occupy in R-format?',
  opts:['5','6','8','11'],
  ans: 3,                           // index into opts
  concept:'R-format opcode = 11 bits',
  explain:'Bits 31–21 → 11 bits.' }
```

### `type` — type-the-answer

```js
{ type:'type',
  prompt:'Convert <code>0001 0001</code> to decimal.',
  ans:'17',
  alt: ['0x11', '17.0'],            // optional alternates (case-insensitive)
  concept:'Bit 4 + bit 0 = 17',
  explain:'16 + 1 = 17.' }
```

If the prompt contains an 8-bit binary literal like `0001 0001`, the
engine renders a read-only place-value strip above the input.

### `toggle-target` — click bits to match a target

```js
{ type:'toggle-target',
  prompt:'Set the bits to represent decimal <strong>42</strong>',
  bits: 8,
  target: 0b00101010,
  signed: true,                     // optional: switch the display to signed
  signedTarget: -5,                 // optional: target value in signed view
  concept:'42 = 32+8+2',
  explain:'…' }
```

### `toggle-free` — click bits until a "shape" is reached

Same shape as `toggle-target` but worded as a hands-on warmup ("turn
all 8 bits ON").

### `code-trace` — step through a LEGv8 program

```js
{ type:'code-trace',
  prompt:'After this code runs, what is X3?',
  code: [
    'MOVZ X1, #5',
    'MOVZ X2, #7',
    'ADD  X3, X1, X2',
  ],
  initRegs: { X9: 100 },                                  // optional seed
  initMem:  { '0x1000': [0x01,0x02,0x03,0x04,0,0,0,0] }, // optional seed
  asks: 'X3',                                             // 'X<n>' | 'SP' | 'FP' | 'LR'
                                                          // | 'NZCV' | 'mem:0x1000:8'
  format: 'dec',                                          // 'dec'|'hex'|'bin'|'signed'
  ans: 12,                                                // number, BigInt, or NZCV string
  showFlags: true,                                        // show NZCV in the panel
  concept:'…',
  explain:'…' }
```

The user can click **Step** or **Run all** to watch the register panel
update line-by-line. Memory accesses show in the strip when `initMem`
is provided. The interpreter supports the full set of LEGv8 mnemonics
listed at the top of `js/legv8.js`.

### `fill-blank` — instruction template with blanks

```js
{ type:'fill-blank',
  prompt:'Translate `if (a==b) goto same;`',
  template: '___ XZR, X1, X2\nB.___ same',  // each ___ is one blank
  blanks:  ['SUBS','EQ'],                    // expected fillings, in order
  alts:    [['SUB.S'], []],                  // optional alternates per blank
  palette: ['SUB','SUBS','EQ','NE','LT'],    // optional chip palette
  concept:'…',
  explain:'…' }
```

If `palette` is omitted, the user types into each blank directly.

### `bit-field` — encode an instruction

```js
{ type:'bit-field',
  prompt:'Encode ADD X3, X1, X2 as R-format.',
  format: 'R',
  fields: [
    { name:'opcode', hi:31, lo:21, expected:0b10001011000, mode:'bits' },
    { name:'Rm',     hi:20, lo:16, expected:2,             mode:'reg'  },
    { name:'shamt',  hi:15, lo:10, expected:0,             mode:'imm'  },
    { name:'Rn',     hi: 9, lo: 5, expected:1,             mode:'reg'  },
    { name:'Rd',     hi: 4, lo: 0, expected:3,             mode:'reg'  },
  ],
  encoded:'0x8B020023',             // optional: hex preview shown as a hint
  concept:'…',
  explain:'…' }
```

`mode` is one of:
- `'bits'` — user clicks each bit to toggle 0/1
- `'reg'` — user types a register (e.g. `X3`, `XZR`, `SP`)
- `'imm'` — user types a decimal/hex/binary number

### `drag-match` — pair chips with targets

```js
{ type:'drag-match',
  prompt:'Match each register to its role.',
  pairs: [
    { chip:'X0–X7',  target:'argument / return values' },
    { chip:'XZR',    target:'always reads zero' },
  ],
  concept:'…',
  explain:'…' }
```

Works with both drag-and-drop on desktop and tap-to-select on mobile.
Layout order is shuffled per render so the answer can't be guessed
from position.

### `datapath-trace` — single-cycle datapath wires

```js
{ type:'datapath-trace',
  prompt:'Which datapath signals are active for `LDUR X1, [X2, #0]`?',
  instruction:'LDUR X1, [X2, #0]',
  activeWires: ['PC','IM','RegRead','ALU','DMem-read','MUX-mem','RegWrite'],
  opts: ['…','…','…','…'],
  ans: 2,
  concept:'…',
  explain:'…' }
```

Renders a simplified datapath SVG with the named wires lit up, then
asks an MC about the highlighted activity. (Used in World 4.)

### `pipeline-trace` — 5-stage pipeline timeline

```js
{ type:'pipeline-trace',
  prompt:'How many cycles does this sequence take?',
  rows: [
    { label:'LDUR X1,[X2,#0]', stages:['IF','ID','EX','MEM','WB'] },
    { label:'ADD  X3,X1,X4',   stages:[null,'IF','ID','stall','EX','MEM','WB'] },
  ],
  forwarding: [{ from:{row:0, stage:3}, to:{row:1, stage:4}, kind:'MEM→EX' }],
  opts: ['5','6','7','9'], ans: 2,
  concept:'…',
  explain:'…' }
```

Each row is one instruction; `stages[i]` is what occupies cycle `i+1`.
Valid stage tokens: `'IF'`, `'ID'`, `'EX'`, `'MEM'`, `'WB'`,
`'stall'`, `'bubble'`, or `null`/empty for blank cells. Optional
`forwarding` array adds a text caption underneath the grid listing
the bypass paths (full SVG arrows kept out of scope for portability).
Followed by an `opts`/`ans` MC or a single `type` answer.
(Used in World 4 for hazard / scheduling questions.)

### `cache-sim` — tag/index/offset and hit/miss

```js
{ type:'cache-sim',
  prompt:'Compute tag/index/offset for 0x1A2C.',
  cache: { totalBytes:1024, blockBytes:16, ways:1, addrBits:16 },
  ask: 'fields',                    // 'fields' | 'hit-miss' | 'amat'
  ans: { tag:0x1A, index:2, offset:12 },
  concept:'…',
  explain:'…' }
```

(Used in World 5.)

## Engine details

- **Progress**: stored in `localStorage` under `c952-quest-progress`.
  Schema is documented at the top of `js/storage.js`.
- **Migration**: on first run, World 1 completion / XP from
  `bq-state` (Binary Quest) is copied over once. After that the legacy
  key is left alone.
- **Theme**: shared with the surrounding C952 chapter pages via the
  `c952-theme` key, so the theme toggle here also affects ch2.html etc.
- **Locks**: a level is unlocked when every prereq id in `prereqs[]`
  is in the completed set.
- **XP math** (matches Binary Quest):
  - base = round(level.xp / level.challenges.length)
  - multiplier: 0 wrong → ×1.0, 1 wrong → ×0.75, 2+ wrong → ×0.5
  - streak bonus: ×1.1 when the global correct streak ≥ 3
  - paid hints: 2nd hint deducts round(base × 0.25)
- **Hints**: 1 free hint per challenge (uses `concept`), a 2nd hint
  costs 25% of base XP (uses `deepHint` if present, else `explain`).
- **Reset**: settings modal exposes "Reset world" (per-world wipe) and
  "Reset all" (full state wipe — disables migration too).

## Migration note (Binary Quest → C952 Quest)

| Binary Quest level (idx)  | C952 Quest id    | Status                  |
|---------------------------|------------------|-------------------------|
| 0  Bits & Switches        | `w1-bits`        | ported as-is            |
| 1  Place Values           | `w1-place-values`| ported as-is            |
| 2  Binary → Decimal       | `w1-bin-to-dec`  | ported as-is            |
| 3  Decimal → Binary       | `w1-dec-to-bin`  | ported as-is            |
| 4  Hexadecimal            | `w1-hex`         | ported as-is            |
| 5  Two's Complement       | `w1-twos`        | ported as-is + 1 trap line on the range Q (only one zero, neg goes one further)|
| 6  Binary Arithmetic      | `w1-arith`       | ported as-is + ADD-vs-ADDS trap callout in the explain text |
| 7  Bitwise Operations     | `w1-bitwise`     | ported as-is + intro mentions "no NOT instruction" trap |
| 8  Bytes & Words          | `w1-bytes`       | ported as-is, lab-specific references softened to be more generic |
| 9  Instruction Encoding   | `w1-encoding`    | ported as-is            |

All challenge prompts, options, and answers are unchanged. The only
edits are: id field added, `xpReward` renamed to `xp`, prereqs added
(each level requires the previous), and a few intros got one-line
exam-trap callouts to match the narrative of World 2.

## Roadmap

- World 1 (Foundations)        — 10 levels, **shipped**
- World 2 (LEGv8 Instructions) — 9 levels, **shipped**
- World 3 (Arithmetic)         — 4 levels, **shipped**
- World 4 (Datapath/Pipeline)  — 5 levels, **shipped**
- World 5 (Memory Hierarchy)   — 5 levels, planned

Total target: 33 levels.
