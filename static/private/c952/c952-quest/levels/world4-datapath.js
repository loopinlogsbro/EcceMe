// ============================================================
// World 4 — Datapath & Pipelining (Patterson & Hennessy Ch 6)
// ============================================================
// Five levels covering the single-cycle datapath, control
// signals, the 5-stage pipeline, hazards/forwarding, and
// branch prediction. Each level mixes ≥ 2 challenge types.
// ============================================================

import { registerWorld } from '../js/engine.js';

registerWorld({
  id: 'w4',
  title: 'Datapath & Pipelining',
  subtitle: 'Single-cycle datapath, control, pipelines, hazards, prediction',
  icon: '🏗',
  levels: [

    // ── L24: Single-Cycle Datapath Components ──────────────
    {
      id: 'w4-datapath',
      title: 'Single-Cycle Datapath',
      icon: '🏗',
      xp: 160,
      prereqs: ['w3-fp-arith'],
      intro: `
        <div class="card"><h3>The Boxes Inside the CPU</h3>
        <p>A single-cycle datapath wires together a small number of building blocks. Every instruction flows from left to right in one clock cycle:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>PC</strong> — program counter; holds the address of the next instruction.</li>
          <li><strong>I-Mem</strong> — instruction memory; the PC indexes into it to fetch the 32-bit instruction word.</li>
          <li><strong>Register File</strong> — 32 × 64-bit registers. Needs <strong>2 read ports</strong> (Rn, Rm) and <strong>1 write port</strong> (Rd / Rt).</li>
          <li><strong>ALU</strong> — performs arithmetic / logic on its two operands.</li>
          <li><strong>Sign-Extender</strong> — widens the 9-bit / 12-bit / 19-bit / 26-bit immediate to 64 bits, preserving sign.</li>
          <li><strong>D-Mem</strong> — data memory; LDUR reads it, STUR writes it.</li>
          <li><strong>Adders</strong> — separate add-4 unit for PC+4, plus a branch-target adder for PC + (sign-ext × 4).</li>
          <li><strong>Muxes</strong> — pick between two possible inputs (e.g. ALU-from-reg vs ALU-from-immediate; PC+4 vs branch target).</li>
        </ul>
        <p>A single-cycle clock must be slow enough for the longest instruction (typically a load). That's why we pipeline.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each datapath block to what it does.",
          concept:"Each block has one job; the wires tie them together.",
          pairs: [
            { chip:'PC',          target:'holds the address of the next instruction' },
            { chip:'I-Mem',       target:'fetches the 32-bit instruction word at PC' },
            { chip:'Register File', target:'reads up to 2 source registers + writes 1 destination' },
            { chip:'ALU',         target:'performs the arithmetic or logical operation' },
            { chip:'Sign-Extender', target:'widens an immediate to 64 bits with sign preserved' },
            { chip:'D-Mem',       target:'data memory — LDUR reads, STUR writes' },
          ],
          explain:"Every datapath drawing is just these blocks plus wires + a few muxes. Knowing each block's job is most of decoding." },
        { type:'mc',
          prompt:"The register file needs how many read ports to support R-format instructions like <code>ADD X3, X1, X2</code>?",
          concept:"Two source operands (Rn, Rm) → 2 read ports.",
          opts:["1","2","3","5"], ans:1,
          explain:"R-format reads Rn and Rm simultaneously → 2 read ports. Plus 1 write port for Rd. (3 ports total, not all reads.)" },
        { type:'datapath-trace',
          prompt:"Which datapath blocks are active when executing <code>LDUR X1, [X2, #0]</code>? Pick the option that lists them all.",
          concept:"PC → I-Mem → Reg read (Rn = X2) → Sign-Ext (#0) → ALU (X2 + 0) → D-Mem (read) → write back to X1.",
          instruction:"LDUR X1, [X2, #0]",
          activeWires:['PC','IM','RegRead','ALU','SignExt','DMem-read','MUX-mem','RegWrite'],
          opts:[
            "PC, I-Mem, Reg File (read), ALU, D-Mem (write), Reg File (write)",
            "PC, I-Mem, Reg File (read + write), ALU, Sign-Ext, D-Mem (read)",
            "PC, ALU only — loads don't need memory",
            "PC, I-Mem, D-Mem only — loads bypass the ALU",
          ], ans:1,
          explain:"LDUR uses the ALU to compute the address (base + sign-extended offset), then D-Mem to read the byte/halfword/word/doubleword, then writes the loaded value back to the register file." },
        { type:'mc',
          prompt:"Why does the single-cycle design typically waste time?",
          concept:"Cycle time = the slowest instruction's path (usually a load).",
          opts:["Because instructions take a variable number of cycles",
                "Because the clock must be long enough for the slowest instruction — short ones idle the rest of the cycle",
                "Because reads and writes never overlap",
                "Because pipelining adds bubbles"], ans:1,
          explain:"In single-cycle, every instruction takes one cycle, but that one cycle has to fit even the longest path (LDUR: PC + IMem + RegRead + ALU + DMem + RegWrite). Simple ADD finishes far earlier but still waits." },
        { type:'mc',
          prompt:"In a CB-format branch like <code>CBZ X1, target</code>, what does the dedicated <em>branch-target adder</em> compute?",
          concept:"branch_target = PC + (sign-ext(imm19) × 4)",
          opts:["PC + 4 (just the next instruction)",
                "PC + (sign-extended immediate × 4)",
                "X1 + immediate","Reg[Rn] + Reg[Rm]"], ans:1,
          explain:"The branch target is PC-relative: PC + (sign-ext(imm19) shifted left 2 to give a byte offset). The multiplier of 4 is the instruction width. A separate adder runs in parallel so the branch decision doesn't have to wait for the ALU." },
      ],
    },

    // ── L25: Control Signals ───────────────────────────────
    {
      id: 'w4-control',
      title: 'Control Signals',
      icon: '🎛',
      xp: 150,
      prereqs: ['w4-datapath'],
      intro: `
        <div class="card"><h3>How the Boxes Are Steered</h3>
        <p>Each datapath element has a small number of control inputs. They tell the muxes which input to pick and tell the memory / regfile whether to read or write. The control unit decodes the opcode and asserts the right combination per instruction.</p>
        <table class="conv-table">
          <tr><th>Signal</th><th>When asserted</th></tr>
          <tr><td><strong>RegWrite</strong></td><td>writes the regfile (any instr with a destination: ADD, LDUR, …)</td></tr>
          <tr><td><strong>MemRead</strong></td><td>reads D-Mem (LDUR family)</td></tr>
          <tr><td><strong>MemWrite</strong></td><td>writes D-Mem (STUR family)</td></tr>
          <tr><td><strong>ALUSrc</strong></td><td>ALU's 2nd input is the sign-extended immediate (LDUR, STUR, ADDI)</td></tr>
          <tr><td><strong>MemtoReg</strong></td><td>WB mux picks the D-Mem result (LDUR)</td></tr>
          <tr><td><strong>Branch</strong></td><td>conditional branch — combined with Zero flag picks the branch target</td></tr>
          <tr><td><strong>ALUOp</strong></td><td>tells the ALU which operation to perform (add, sub, AND, OR, …)</td></tr>
        </table>
        <p>Different instructions assert different subsets. The control unit is just a small ROM/PLA driven by the opcode bits.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each control signal to its job.",
          concept:"Most signals are 1-bit; ALUOp is 2 bits encoding R/I/D/B class.",
          pairs: [
            { chip:'RegWrite', target:'lets the regfile commit a write at the WB stage' },
            { chip:'MemRead',  target:'asserted only for LDUR* loads' },
            { chip:'MemWrite', target:'asserted only for STUR* stores' },
            { chip:'ALUSrc',   target:'mux: 0 = ALU input 2 from regfile; 1 = from sign-extended immediate' },
            { chip:'MemtoReg', target:'mux: 0 = write ALU result back; 1 = write D-Mem result back' },
            { chip:'Branch',   target:'enables the branch-target PC mux when the condition matches' },
          ],
          explain:"All of the muxes in the datapath are steered by exactly one of these signals. The control unit asserts the right combination based on opcode." },
        { type:'mc',
          prompt:"For <code>ADD X3, X1, X2</code> (R-format), which signals should be asserted?",
          concept:"R-format → RegWrite=1, ALUSrc=0, MemRead=MemWrite=Branch=MemtoReg=0.",
          opts:[
            "RegWrite only",
            "RegWrite + ALUSrc",
            "RegWrite + MemRead",
            "RegWrite + MemWrite + MemtoReg",
          ], ans:0,
          explain:"ADD writes its result back (RegWrite=1) and uses two registers (ALUSrc=0). It doesn't touch memory or branch." },
        { type:'mc',
          prompt:"For <code>LDUR X1, [X2, #8]</code>, which group of signals is asserted?",
          concept:"LDUR needs immediate (ALUSrc=1), reads D-Mem (MemRead=1), routes D-Mem to reg (MemtoReg=1), writes the regfile.",
          opts:[
            "RegWrite, ALUSrc, MemRead, MemtoReg",
            "RegWrite, ALUSrc, MemWrite",
            "RegWrite, Branch",
            "MemRead and MemWrite together",
          ], ans:0,
          explain:"LDUR uses ALUSrc=1 (offset as the 2nd ALU input), MemRead=1 (read D-Mem), MemtoReg=1 (route the loaded value to the WB mux), and RegWrite=1 (commit it)." },
        { type:'mc',
          prompt:"For <code>STUR X1, [X2, #8]</code>, what about RegWrite?",
          concept:"Stores don't write a register — RegWrite=0.",
          opts:["1 — every memory op writes a register","0 — STUR has no destination register",
                "Only asserted on cache miss","Depends on the value of X1"], ans:1,
          explain:"STUR sends X1's value out to D-Mem and writes nothing back to the register file. RegWrite=0, MemWrite=1." },
        { type:'fill-blank',
          prompt:"Pick the right signal for each blank. (Fill from the chip palette.)",
          concept:"Memory write → MemWrite=1. Branch path enabled → Branch=1.",
          template: "STUR uses ___=1.\nCBZ uses ___=1.",
          blanks: ['MemWrite','Branch'],
          palette: ['RegWrite','MemRead','MemWrite','MemtoReg','ALUSrc','Branch'],
          explain:"STUR is the only store-data signal. CBZ flips Branch=1 — combined with the zero condition, it lets the PC mux pick the branch target." },
      ],
    },

    // ── L26: Pipeline Stages ───────────────────────────────
    {
      id: 'w4-pipeline',
      title: 'Pipeline Stages',
      icon: '⛓',
      xp: 170,
      prereqs: ['w4-control'],
      intro: `
        <div class="card"><h3>5 Stages, Overlapped</h3>
        <p>The classic LEGv8 pipeline splits each instruction into five fixed stages, each taking one clock cycle:</p>
        <table class="conv-table">
          <tr><th>Stage</th><th>Name</th><th>What happens</th></tr>
          <tr><td>1</td><td><strong>IF</strong></td><td>Instruction Fetch — read instruction at PC; PC ← PC+4</td></tr>
          <tr><td>2</td><td><strong>ID</strong></td><td>Instruction Decode + register read</td></tr>
          <tr><td>3</td><td><strong>EX</strong></td><td>Execute — ALU op (or address compute for memory)</td></tr>
          <tr><td>4</td><td><strong>MEM</strong></td><td>Memory access (only loads/stores really use this)</td></tr>
          <tr><td>5</td><td><strong>WB</strong></td><td>Write Back the result into the register file</td></tr>
        </table>
        <p>Pipelining overlaps stages across consecutive instructions. In the ideal case, after the pipeline fills, one instruction completes <em>every</em> cycle — <strong>CPI = 1</strong>. The clock is also faster because each stage is shorter than the single-cycle path.</p>
        <p>Time for N instructions in a k-stage pipeline (no hazards): <strong>N + (k − 1)</strong> cycles. For 5 instructions in a 5-stage pipeline → 5 + 4 = 9 cycles.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each pipeline stage to its job.",
          concept:"IF = fetch, ID = decode + regread, EX = ALU, MEM = D-Mem, WB = regfile commit.",
          pairs: [
            { chip:'IF',  target:'fetch the 32-bit instruction at PC' },
            { chip:'ID',  target:'decode the opcode and read the source registers' },
            { chip:'EX',  target:'run the ALU (also computes load/store addresses)' },
            { chip:'MEM', target:'access data memory (LDUR / STUR)' },
            { chip:'WB',  target:'write the result back into the register file' },
          ],
          explain:"Each stage maps to a slice of the single-cycle datapath. Pipeline registers between stages remember what to do next." },
        { type:'pipeline-trace',
          prompt:"Five independent ADD instructions in a 5-stage pipeline (no hazards). How many cycles total to complete all five?",
          concept:"N + (k − 1) = 5 + 4 = 9.",
          rows: [
            { label:'ADD X1,X2,X3', stages:['IF','ID','EX','MEM','WB'] },
            { label:'ADD X4,X5,X6', stages:[null,'IF','ID','EX','MEM','WB'] },
            { label:'ADD X7,X8,X9', stages:[null,null,'IF','ID','EX','MEM','WB'] },
            { label:'ADD X10,X11,X12', stages:[null,null,null,'IF','ID','EX','MEM','WB'] },
            { label:'ADD X13,X14,X15', stages:[null,null,null,null,'IF','ID','EX','MEM','WB'] },
          ],
          opts:["5","8","9","10"], ans:2,
          explain:"Fill the pipeline (4 cycles), then drain one instruction per cycle. 5 + 4 = 9 cycles." },
        { type:'pipeline-trace',
          prompt:"At <strong>cycle 4</strong>, what stage is the third instruction in?",
          concept:"Each instruction enters IF one cycle after the previous.",
          rows: [
            { label:'I1', stages:['IF','ID','EX','MEM','WB'] },
            { label:'I2', stages:[null,'IF','ID','EX','MEM','WB'] },
            { label:'I3', stages:[null,null,'IF','ID','EX','MEM','WB'] },
            { label:'I4', stages:[null,null,null,'IF','ID','EX','MEM','WB'] },
          ],
          opts:["IF","ID","EX","MEM"], ans:1,
          explain:"I3 enters IF at cycle 3, so at cycle 4 it's in ID." },
        { type:'mc',
          prompt:"In the ideal pipelined CPU (no hazards), what is the <strong>steady-state CPI</strong>?",
          concept:"One instruction completes per cycle once the pipeline is full.",
          opts:["1","5","0.2","Depends on the instruction mix"], ans:0,
          explain:"In steady state, every cycle one instruction finishes WB → CPI = 1. Hazards push this above 1." },
        { type:'mc',
          prompt:"Why is the clock period in a 5-stage pipeline <em>shorter</em> than in the single-cycle design?",
          concept:"Each stage holds only one block's worth of work, not the entire datapath.",
          opts:[
            "Because pipelining reduces the number of transistors",
            "Because the clock period is the slowest <em>stage</em>, not the whole datapath",
            "Because branch prediction is faster",
            "Because the WB stage skips the regfile",
          ], ans:1,
          explain:"Splitting the path into 5 shorter sections lets the clock run at the speed of the longest stage, which is far shorter than the single-cycle critical path." },
      ],
    },

    // ── L27: Hazards & Forwarding ──────────────────────────
    {
      id: 'w4-hazards',
      title: 'Hazards & Forwarding',
      icon: '⚠️',
      xp: 200,
      prereqs: ['w4-pipeline'],
      intro: `
        <div class="card"><h3>Three Things That Slow the Pipe Down</h3>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Structural hazard</strong> — two stages want the same hardware unit. The LEGv8 textbook design avoids this with separate I-Mem and D-Mem.</li>
          <li><strong>Data hazard</strong> — an instruction needs a value that hasn't been written back yet.</li>
          <li><strong>Control hazard</strong> — a branch's direction isn't known until EX (or later), but IF wants to fetch next.</li>
        </ul>
        <h3 style="margin-top:14px;">Forwarding (a.k.a. bypassing)</h3>
        <p>If the ALU result of an earlier instruction is needed by a later one, route it directly from the EX/MEM (or MEM/WB) pipeline register back to the ALU input — no stall needed.</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>EX → EX</strong>: forward from one instruction's EX output to the next instruction's EX input (1-cycle gap).</li>
          <li><strong>MEM → EX</strong>: forward from MEM-stage result (LDUR or a 2-cycle-old ALU result) to a later EX.</li>
        </ul>
        <p><strong>The exception:</strong> a <em>load-use</em> hazard — a load followed immediately by an instruction that needs its result — still costs <strong>one stall cycle</strong> even with full forwarding, because the load's value isn't ready until end of MEM.</p>
        </div>
      `,
      challenges: [
        { type:'mc',
          prompt:"Which kind of hazard is this? <code>LDUR X1, [X2, #0]; ADD X3, X1, X4</code>",
          concept:"ADD needs X1 immediately after a load → load-use data hazard.",
          opts:["Structural","Data (load-use)","Control","No hazard"], ans:1,
          explain:"This is the textbook load-use data hazard. Even with MEM→EX forwarding, ADD must stall 1 cycle (the bubble) because LDUR's value isn't available until end of MEM, but ADD wants it at the start of EX." },
        { type:'pipeline-trace',
          prompt:"Load-use hazard with full forwarding. How many cycles does this 2-instruction sequence take?",
          concept:"LDUR finishes WB at cycle 5; with MEM→EX forwarding, the dependent ADD only needs to slip 1 bubble.",
          rows: [
            { label:'LDUR X1,[X2,#0]', stages:['IF','ID','EX','MEM','WB'] },
            { label:'ADD  X3,X1,X4',   stages:[null,'IF','ID','stall','EX','MEM','WB'] },
          ],
          forwarding: [{ from:{row:0, stage:3}, to:{row:1, stage:4}, kind:'MEM→EX' }],
          opts:["5","6","7","9"], ans:2,
          explain:"Two instructions normally would take 2 + 4 = 6 cycles in an ideal pipeline. One bubble pushes it to 7." },
        { type:'pipeline-trace',
          prompt:"Same with NO forwarding. Now how many cycles?",
          concept:"Without forwarding, ADD must wait until LDUR's WB completes — 2 bubbles.",
          rows: [
            { label:'LDUR X1,[X2,#0]', stages:['IF','ID','EX','MEM','WB'] },
            { label:'ADD  X3,X1,X4',   stages:[null,'IF','ID','stall','stall','EX','MEM','WB'] },
          ],
          opts:["6","7","8","10"], ans:2,
          explain:"Without forwarding, ADD's ID stage must wait until LDUR has written its result back (end of cycle 5). So ADD enters EX in cycle 6 — total = 8 cycles." },
        { type:'fill-blank',
          prompt:"Name the forwarding paths needed in a standard 5-stage pipeline.",
          concept:"The two paths bypass values from EX/MEM and MEM/WB pipeline registers back to the ALU input.",
          template: "Forward from EX/MEM register → ALU input: this path is called ___ →EX.\nForward from MEM/WB register → ALU input: ___ →EX.",
          blanks: ['EX','MEM'],
          palette: ['IF','ID','EX','MEM','WB'],
          explain:"EX→EX bypasses the EX output of the previous instruction. MEM→EX bypasses the MEM/WB register (which holds either a load's result or an ALU result that's already passed through MEM)." },
        { type:'mc',
          prompt:"A control hazard on a conditional branch is usually handled by:",
          concept:"Predict the branch direction; if mispredicted, flush the speculatively fetched instructions.",
          opts:[
            "Always stalling 3 cycles for every branch",
            "Predicting the branch direction and squashing on misprediction",
            "Disabling pipelining for branches",
            "Using more registers",
          ], ans:1,
          explain:"Modern designs predict (statically or dynamically) and speculate. On a misprediction, the wrongly-fetched instructions are flushed (turned into bubbles) and the correct path is fetched." },
        { type:'mc',
          prompt:"Which hazard category does the textbook LEGv8 pipeline AVOID by having separate instruction and data memories?",
          concept:"Otherwise IF (read instr) and MEM (read data) would compete for the same memory port.",
          opts:["Structural","Data","Control","WAW"], ans:0,
          explain:"If both instr fetch and data access shared one memory, they'd contend every cycle — that's a structural hazard. Splitting them into I-Mem and D-Mem removes it." },
      ],
    },

    // ── L28: Branch Prediction ─────────────────────────────
    {
      id: 'w4-prediction',
      title: 'Branch Prediction',
      icon: '🎲',
      xp: 160,
      prereqs: ['w4-hazards'],
      intro: `
        <div class="card"><h3>Guessing Forward</h3>
        <p>A conditional branch's direction isn't known until its EX stage at the earliest. To keep the pipeline fed, the CPU <em>predicts</em>:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Static predict-not-taken</strong> — always assume the branch falls through. Cheap but only good for forward branches.</li>
          <li><strong>Static predict-taken</strong> — better for backward branches (loops). Needs to know the target before predicting.</li>
          <li><strong>1-bit dynamic</strong> — Branch History Table (BHT) remembers the last outcome and predicts the same again. Mispredicts twice per loop (enter + exit).</li>
          <li><strong>2-bit (bimodal) dynamic</strong> — adds a "strongly/weakly" state. Doesn't flip on a single wrong outcome → far better on inner loops.</li>
          <li><strong>Correlating / tournament</strong> — combines local and global history; the state of the art in textbooks.</li>
        </ul>
        <p>A k-entry BHT indexed by low bits of the branch PC stores 1 or 2 bits per entry.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match the predictor to its behaviour.",
          concept:"Cheaper predictors are static; smarter ones use history.",
          pairs: [
            { chip:'Static predict-not-taken', target:'always guess "fall through"' },
            { chip:'1-bit dynamic (BHT)',      target:'predict same as last time; flips on a single wrong outcome' },
            { chip:'2-bit (bimodal)',          target:'has strongly / weakly states; needs two wrongs to flip' },
            { chip:'Correlating / tournament', target:'uses global history + per-branch state' },
          ],
          explain:"More state = better accuracy, but bigger predictor tables." },
        { type:'mc',
          prompt:"How many <em>mispredictions</em> does a 1-bit dynamic predictor make for a loop that runs exactly 100 times, assuming the predictor's bit starts at 0 (predict-not-taken)?",
          concept:"It mispredicts on the first taken iteration, predicts taken thereafter (correct 99 times), then mispredicts the loop exit. Total = 2.",
          opts:["1","2","100","0"], ans:1,
          explain:"First iteration: predict not-taken, actually taken → miss + flip bit. Iterations 2..100: predict taken, correct. Exit: predict taken, actually not-taken → miss. Two mispredictions." },
        { type:'mc',
          prompt:"How many mispredictions does a 2-bit (bimodal) predictor make over the same loop, starting in 'weakly not-taken'?",
          concept:"The 2-bit predictor needs two wrongs to flip its prediction. Often just 1 misprediction per loop run.",
          opts:["1","2","3","100"], ans:0,
          explain:"Iteration 1: predict not-taken, miss → state advances toward taken. Iteration 2: now predict taken, correct. The exit misprediction would only flip state once, not enough to switch direction. So 1 misprediction over the whole 100-iteration loop." },
        { type:'type',
          prompt:"A BHT has 1024 entries, each storing a 2-bit counter. How many bits total does the predictor table use?",
          concept:"1024 × 2 = 2048 bits.",
          ans:"2048", alt:["2 KB","2Kb","2,048","2 048"],
          explain:"Predictor size = entries × bits-per-entry = 1024 × 2 = 2048 bits = 256 bytes." },
        { type:'mc',
          prompt:"What does the CPU do when it discovers (in EX) that a branch was mispredicted?",
          concept:"Squash the wrongly-fetched instructions and refetch from the correct target.",
          opts:[
            "Stall until the next branch",
            "Flush (turn into bubbles) the instructions that were speculatively fetched, then fetch the correct path",
            "Roll back the register file using a checkpoint",
            "Do nothing — pipelines tolerate any prediction",
          ], ans:1,
          explain:"Speculatively fetched instructions haven't written anything yet (no WB), so flushing them is just zeroing out the pipeline registers and changing PC to the actual branch target." },
        { type:'mc',
          prompt:"Backward branches (loops) and forward branches: which static predictor does best on the <em>backward</em> ones?",
          concept:"Most backward branches are loops → almost always taken.",
          opts:["Predict not-taken","Predict taken","50/50 random","Static predictors don't differ"], ans:1,
          explain:"Loops dominate backward branches and they are taken almost every iteration. 'Backward predict-taken, forward predict-not-taken' is a common simple heuristic." },
      ],
    },

  ],
});
