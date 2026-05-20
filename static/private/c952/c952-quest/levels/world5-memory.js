// ============================================================
// World 5 — Memory Hierarchy (Patterson & Hennessy Ch 7)
// ============================================================
// Five levels covering locality, cache mapping, cache math,
// virtual memory + TLBs, and cache coherence.
// ============================================================

import { registerWorld } from '../js/engine.js';

registerWorld({
  id: 'w5',
  title: 'Memory Hierarchy',
  subtitle: 'Locality, caches, virtual memory, TLBs, coherence',
  icon: '💾',
  levels: [

    // ── L29: Locality ──────────────────────────────────────
    {
      id: 'w5-locality',
      title: 'Locality',
      icon: '📍',
      xp: 130,
      prereqs: ['w4-prediction'],
      intro: `
        <div class="card"><h3>Why Caches Work at All</h3>
        <p>Programs don't touch memory uniformly. Two patterns appear over and over:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Temporal locality</strong> — if you accessed an address recently, you'll likely access it again soon. <em>Example:</em> a loop counter, the top of the stack, a frequently-called function's prologue.</li>
          <li><strong>Spatial locality</strong> — if you accessed address X, you'll likely access X+k for small k. <em>Example:</em> walking through an array, fetching successive instructions.</li>
        </ul>
        <p>A cache exploits temporal locality by keeping recently-used data around, and spatial locality by fetching <strong>whole blocks</strong> at once (a block is typically 16, 32, 64, or 128 bytes). When you load <code>arr[0]</code>, the cache pulls <code>arr[0..7]</code> in the same block — so the next 7 accesses are guaranteed cache hits.</p>
        <p>Real programs alternate between locality phases. Sequential access has high spatial locality. Hash-table lookups have neither, which is why hash tables are slow on modern hardware.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Classify each access pattern as exploiting temporal or spatial locality (or both / neither).",
          concept:"Loop variables reused → temporal. Sequential arrays → spatial. Random-access → poor locality.",
          pairs: [
            { chip:'A loop counter <code>i</code> read every iteration', target:'temporal locality (same address, reused)' },
            { chip:'Walking through <code>arr[0], arr[1], arr[2]…</code>', target:'spatial locality (nearby addresses)' },
            { chip:'Calling the same helper fn 1000 times', target:'temporal locality on the function\'s instruction bytes' },
            { chip:'Random hash-table probe',                    target:'poor locality (scattered, single accesses)' },
          ],
          explain:"Compilers and CPUs assume real code has lots of both flavours. When the assumption breaks (random access), the cache is mostly useless." },
        { type:'mc',
          prompt:"A cache with a 64-byte block size loads <code>arr[0]</code> (an 8-byte doubleword). How many of <code>arr[1]</code>…<code>arr[7]</code> are now guaranteed hits?",
          concept:"64 / 8 = 8 doublewords per block. The block holds arr[0..7].",
          opts:["0","1","7","8"], ans:2,
          explain:"arr[0] brings in all 8 doublewords of the block. arr[1..7] are then hits — that's 7 guaranteed hits. arr[0] was the miss that brought them in." },
        { type:'mc',
          prompt:"Which locality kind benefits most from <em>larger</em> cache blocks?",
          concept:"Bigger blocks pull more neighbours per miss → spatial wins.",
          opts:["Temporal","Spatial","Both equally","Neither — block size doesn't matter"], ans:1,
          explain:"A bigger block prefetches more nearby data per miss → spatial locality is the direct beneficiary. Temporal locality benefits from cache <em>size</em> instead (more old data fits)." },
        { type:'mc',
          prompt:"A program walks a linked list scattered across memory. What locality does it have?",
          concept:"Pointers can land anywhere — spatial is poor. The nodes themselves are reused only rarely.",
          opts:[
            "Strong spatial and temporal",
            "Strong temporal, weak spatial",
            "Strong spatial, weak temporal",
            "Weak on both — linked lists are notoriously cache-unfriendly",
          ], ans:3,
          explain:"This is exactly why arrays beat linked lists on modern hardware for many workloads — arrays have spatial locality almost for free." },
        { type:'fill-blank',
          prompt:"Fill in the names of the two kinds of locality.",
          concept:"Temporal = time (soon), spatial = space (nearby).",
          template: "Reusing the same address soon = ___ locality.\nReading addresses near a recently used one = ___ locality.",
          blanks: ['temporal','spatial'],
          palette: ['temporal','spatial','random','strided'],
          explain:"Temporal = time (the same address again). Spatial = space (nearby addresses)." },
      ],
    },

    // ── L30: Cache Mapping ─────────────────────────────────
    {
      id: 'w5-mapping',
      title: 'Cache Mapping',
      icon: '🗺',
      xp: 170,
      prereqs: ['w5-locality'],
      intro: `
        <div class="card"><h3>Where Can a Block Land?</h3>
        <p>Three classic placement policies, in order of flexibility:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Direct-mapped</strong> — each memory block has exactly <em>one</em> spot it can occupy. Index = (address / block) mod (#sets). Cheap to look up; collisions = conflict misses.</li>
          <li><strong>n-way set-associative</strong> — each block can land in any of <em>n</em> ways within its set. Index picks the set; tag comparison picks the way. Most real L1 / L2 caches are 4- or 8-way.</li>
          <li><strong>Fully associative</strong> — any block can land anywhere. No conflicts, but every lookup compares all entries → expensive. Usually only the TLB is fully associative.</li>
        </ul>
        <p>Number of sets = <code>total_size ÷ (block_size × ways)</code>. As ways grow, # sets shrinks, and # index bits shrinks.</p>
        <h3 style="margin-top:14px;">The Three Cs</h3>
        <p>Misses come in three flavours:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Compulsory</strong> — first ever access to a block. Unavoidable except by prefetch.</li>
          <li><strong>Capacity</strong> — the working set doesn't fit. Even fully-assoc would miss.</li>
          <li><strong>Conflict</strong> — would have fit, but two competing blocks mapped to the same set. Higher associativity reduces these.</li>
        </ul>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each mapping to its key property.",
          concept:"Direct = 1 slot; n-way = n slots; fully-assoc = anywhere.",
          pairs: [
            { chip:'Direct-mapped',           target:'each block has exactly ONE possible location' },
            { chip:'4-way set-associative',   target:'each block can occupy any of 4 ways in its set' },
            { chip:'Fully associative',       target:'any block can occupy any slot — no conflict misses' },
            { chip:'Conflict miss',           target:'would have fit; lost its slot to another mapped block' },
            { chip:'Capacity miss',           target:'working set too big — even with infinite associativity, would miss' },
          ],
          explain:"Associativity trades hardware cost for conflict-miss reduction. Compulsory and capacity misses are unaffected by associativity alone." },
        { type:'fill-blank',
          prompt:"Compute the number of <strong>sets</strong> in a 4 KB, 4-way set-associative cache with 32-byte blocks.",
          concept:"# sets = total ÷ (block × ways) = 4096 ÷ (32 × 4) = 32.",
          template: "# sets = 4096 ÷ (32 × 4) = ___",
          blanks: ['32'],
          palette: ['8','16','32','64','128'],
          explain:"4096 / (32 × 4) = 4096 / 128 = 32 sets. Index field needs log₂(32) = 5 bits." },
        { type:'mc',
          prompt:"You change a 4 KB cache from direct-mapped to 4-way set-associative, keeping 32-byte blocks. What happens to the number of <em>index bits</em>?",
          concept:"4 ways → 1/4 the sets → 2 fewer index bits (and 2 more tag bits).",
          opts:[
            "Up by 2 (more ways means more index bits)",
            "Down by 2 (fewer sets to index)",
            "No change",
            "Down by 4",
          ], ans:1,
          explain:"Direct-mapped: 128 sets → 7 index bits. 4-way: 32 sets → 5 index bits. Tag gains 2 bits to compensate." },
        { type:'mc',
          prompt:"Which kind of miss does <em>raising associativity</em> primarily reduce?",
          concept:"Higher associativity gives more places for a block to land → fewer conflicts.",
          opts:["Compulsory","Capacity","Conflict","All three equally"], ans:2,
          explain:"Conflicts happen when two blocks fight over a set. More ways = fewer such conflicts. Compulsory and capacity are about working-set vs cache-size, not about placement policy." },
        { type:'mc',
          prompt:"What miss category does pre-fetching primarily address?",
          concept:"Prefetch brings in blocks before the first demand access → kills compulsory misses.",
          opts:["Compulsory","Capacity","Conflict","Coherence"], ans:0,
          explain:"Prefetching predicts which blocks you'll need and brings them in early — converting compulsory misses into hits." },
        { type:'cache-sim',
          prompt:"Compute tag, index, and offset for address <code>0x1A2C</code> in this cache.",
          concept:"Layout: 16 bits = 6 tag + 6 index + 4 offset. 0x1A2C = 0001101000101100 → tag 000110 = 6, index 100010 = 34, offset 1100 = 12.",
          cache: { totalBytes: 1024, blockBytes: 16, ways: 1, addrBits: 16 },
          address: 0x1A2C,
          ask: 'fields',
          ans: { tag: 6, index: 34, offset: 12 },
          explain:"1024 B / (16 × 1) = 64 sets → 6 index bits. Block size 16 → 4 offset bits. 16 − 6 − 4 = 6 tag bits. Split 0x1A2C: 000110 | 100010 | 1100." },
      ],
    },

    // ── L31: Cache Calculations & AMAT ─────────────────────
    {
      id: 'w5-amat',
      title: 'Cache Math & AMAT',
      icon: '🧮',
      xp: 180,
      prereqs: ['w5-mapping'],
      intro: `
        <div class="card"><h3>Average Memory Access Time</h3>
        <p>The standard formula for a single level of cache:</p>
        <div class="equation" style="font-size:15px;"><strong>AMAT = hit_time + miss_rate × miss_penalty</strong></div>
        <p>Adding a second level extends it recursively:</p>
        <div class="equation" style="font-size:13px;">AMAT = L1_hit + L1_miss_rate × (L2_hit + L2_miss_rate × main_mem_latency)</div>
        <h3 style="margin-top:14px;">Field-bit accounting</h3>
        <p>For a cache with <em>S</em> sets and a block of <em>B</em> bytes, an n-bit address splits like this:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>offset</strong> = log₂(B) low bits — picks the byte within the block</li>
          <li><strong>index</strong>  = log₂(S) next bits — picks the set</li>
          <li><strong>tag</strong>    = remaining bits — what we store next to the data</li>
        </ul>
        <p><strong>Bits per cache entry</strong> ≈ tag bits + 1 (valid) + 8 × block_bytes (data). For a write-back cache, add 1 (dirty) bit.</p>
        </div>
      `,
      challenges: [
        { type:'cache-sim',
          prompt:"Split address <code>0x4A7F</code> in a 16-bit-addressable cache: 256 B total, 8 B blocks, direct-mapped.",
          concept:"256 / 8 = 32 sets → 5 index bits. Offset 3 bits. Tag = 16 − 5 − 3 = 8.",
          cache: { totalBytes: 256, blockBytes: 8, ways: 1, addrBits: 16 },
          address: 0x4A7F,
          ask: 'fields',
          ans: { tag: 0x4A, index: 15, offset: 7 },
          explain:"0x4A7F = 0100 1010 0111 1111 → tag 01001010=0x4A, index 01111=15, offset 111=7." },
        { type:'type',
          prompt:"Compute AMAT (in cycles): hit time = 1, miss rate = 5%, miss penalty = 100 cycles.",
          concept:"AMAT = 1 + 0.05 × 100 = 6.",
          ans:"6", alt:["6.0","6 cycles","6cy"],
          explain:"1 + (0.05 × 100) = 1 + 5 = 6 cycles." },
        { type:'type',
          prompt:"Same cache, miss rate drops to 2% (you doubled the cache). New AMAT?",
          concept:"1 + 0.02 × 100 = 3.",
          ans:"3", alt:["3.0","3 cycles"],
          explain:"1 + (0.02 × 100) = 3 cycles. A 2.5% absolute reduction in miss rate cut AMAT almost in half." },
        { type:'type',
          prompt:"Two-level AMAT: L1 hit = 1, L1 miss rate = 5%, L2 hit = 10, L2 miss rate = 50%, main memory = 100 cycles. AMAT?",
          concept:"1 + 0.05 × (10 + 0.5 × 100) = 1 + 0.05 × 60 = 4.",
          ans:"4", alt:["4.0","4 cycles"],
          explain:"AMAT = 1 + 0.05 × (10 + 0.5 × 100) = 1 + 0.05 × 60 = 4 cycles. The L2 cuts the effective miss penalty from 100 to 60." },
        { type:'mc',
          prompt:"For a 64-byte block, how many offset bits are needed?",
          concept:"log₂(64) = 6.",
          opts:["3","4","6","8"], ans:2,
          explain:"log₂(64) = 6. The offset selects 1 of 64 bytes within the block." },
        { type:'mc',
          prompt:"You have a 32 KB direct-mapped cache with 64-byte blocks on a 32-bit machine. How many tag bits per entry?",
          concept:"# sets = 32768 / 64 = 512 → 9 index bits. Offset = 6. Tag = 32 − 9 − 6 = 17.",
          opts:["13","15","17","19"], ans:2,
          explain:"32 KB / 64 B = 512 sets → 9 index bits. Offset 6. Tag = 32 − 9 − 6 = 17 bits per entry." },
      ],
    },

    // ── L32: Virtual Memory & TLBs ─────────────────────────
    {
      id: 'w5-vm',
      title: 'Virtual Memory & TLBs',
      icon: '🪟',
      xp: 170,
      prereqs: ['w5-amat'],
      intro: `
        <div class="card"><h3>One Process, One Address Space</h3>
        <p>Virtual memory gives each process the illusion of a private, contiguous address space. The hardware (with help from the OS) translates each virtual address to a physical address using a <strong>page table</strong>.</p>
        <p>Addresses split into two parts:</p>
        <div class="equation" style="font-size:14px;">virtual address = <strong>VPN</strong> | <strong>page offset</strong></div>
        <p>A typical 4 KB page has 12 offset bits. The VPN indexes the page table; the result is the physical page number, which concatenates with the offset to form the physical address.</p>
        <h3 style="margin-top:14px;">The TLB</h3>
        <p>Going to memory for every translation would be ruinous. The <strong>TLB (Translation Lookaside Buffer)</strong> is a cache of recent page-table entries — typically 32–512 entries, often fully associative. On a TLB miss, the hardware (or OS) walks the page table and refills the TLB.</p>
        <p>Possible outcomes on a memory reference:</p>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>TLB hit + cache hit</strong> — fast path.</li>
          <li><strong>TLB hit + cache miss</strong> — fetch the block from memory.</li>
          <li><strong>TLB miss + page in memory</strong> — page-table walk; fill TLB.</li>
          <li><strong>TLB miss + page NOT in memory</strong> — page fault → OS trap → load from disk → restart.</li>
        </ul>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each virtual-memory term to what it does.",
          concept:"Page table = full translation. TLB = its cache. PFN = physical part. PT base reg = where the table lives.",
          pairs: [
            { chip:'Page table',         target:'full map from virtual page → physical page (one per process)' },
            { chip:'TLB',                target:'small cache of recently used page-table entries' },
            { chip:'Page Frame Number',  target:'the physical page number that the VPN translates to' },
            { chip:'Page-table base register', target:'CPU register pointing at the current process\'s page table' },
            { chip:'Page fault',         target:'OS trap when the referenced page is not in memory' },
          ],
          explain:"The page table is the truth; the TLB is the cache. The base register is what the OS swaps on a context switch." },
        { type:'mc',
          prompt:"How many bits are in the page-offset field for a 4 KB page?",
          concept:"log₂(4096) = 12.",
          opts:["8","10","12","16"], ans:2,
          explain:"4 KB = 4096 B → log₂(4096) = 12 bits of offset. Larger pages (e.g. 2 MB huge pages) move the boundary." },
        { type:'fill-blank',
          prompt:"A 32-bit virtual address with 4 KB pages splits into how many VPN bits and offset bits?",
          concept:"32 = VPN + 12 → VPN = 20.",
          template: "VPN: ___ bits ; offset: ___ bits",
          blanks: ['20','12'],
          palette: ['8','10','12','16','20','22','32'],
          explain:"Offset = 12 (for 4 KB pages). VPN = 32 − 12 = 20 bits. A simple flat page table would have 2²⁰ = 1 M entries per process — which is why real OSes use multi-level page tables." },
        { type:'mc',
          prompt:"The TLB is fundamentally a cache of:",
          concept:"It stores recent VPN → PFN mappings (i.e. page-table entries).",
          opts:[
            "instruction bytes (like the I-cache)",
            "data bytes (like the D-cache)",
            "page-table entries (VPN → PFN translations)",
            "branch outcomes",
          ], ans:2,
          explain:"Hit in the TLB = no need to walk the page table = no extra memory accesses for translation." },
        { type:'mc',
          prompt:"On a page fault, the hardware:",
          concept:"It raises an exception; the OS handles the disk I/O and restarts the instruction.",
          opts:[
            "Loads the page itself from disk and continues silently",
            "Traps into the OS, which loads the page from disk and resumes the faulting instruction",
            "Returns zero to the program",
            "Sends a SIGSEGV",
          ], ans:1,
          explain:"A page fault is a controlled exception. The CPU saves state, jumps to the OS handler. The OS reads the page off disk into an available frame, updates the page table, and restarts the faulting instruction. Only invalid faults (no mapping at all) end in SIGSEGV." },
        { type:'mc',
          prompt:"Why is the TLB usually <em>fully</em> associative?",
          concept:"Small (32–512 entries) and lookups happen on every memory access → conflict misses would dominate.",
          opts:[
            "It's actually direct-mapped — the lookup is too fast for associativity to matter",
            "Because it has too few entries to spare any to conflict misses",
            "To make the encoding match the cache",
            "Because TLB entries are huge",
          ], ans:1,
          explain:"TLBs are tiny. A direct-mapped TLB would thrash on common access patterns. Fully associative keeps conflict misses to zero at the cost of doing N comparisons per lookup — affordable because N is small." },
      ],
    },

    // ── L33: Cache Coherence ───────────────────────────────
    {
      id: 'w5-coherence',
      title: 'Cache Coherence',
      icon: '🔄',
      xp: 170,
      prereqs: ['w5-vm'],
      intro: `
        <div class="card"><h3>When Many Cores Cache the Same Block</h3>
        <p>In a multi-core CPU, each core has its own L1 (and often L2) cache. Without coordination, core 1 could write to address X while core 2's cache still holds the old value — incoherent. A coherence protocol makes the parallel system <em>behave as if</em> a single shared memory existed.</p>
        <h3 style="margin-top:14px;">MESI states (per cache line)</h3>
        <table class="conv-table">
          <tr><th>State</th><th>Meaning</th><th>Read?</th><th>Write?</th></tr>
          <tr><td><strong>M</strong>odified</td><td>dirty, exclusive to this cache</td><td>yes</td><td>yes (already dirty)</td></tr>
          <tr><td><strong>E</strong>xclusive</td><td>clean, only this cache holds it</td><td>yes</td><td>yes (transitions to M)</td></tr>
          <tr><td><strong>S</strong>hared</td><td>clean, possibly in other caches too</td><td>yes</td><td>NO — must upgrade first (invalidates others)</td></tr>
          <tr><td><strong>I</strong>nvalid</td><td>not present (or stale)</td><td>—</td><td>—</td></tr>
        </table>
        <h3 style="margin-top:14px;">Protocol families</h3>
        <ul style="margin-left:20px;color:var(--muted);">
          <li><strong>Snooping</strong> — every cache watches a shared bus for memory transactions. Simple; doesn't scale past ~16 cores.</li>
          <li><strong>Directory</strong> — a central directory tracks which caches hold each line. Scales to many cores; more complex hardware.</li>
        </ul>
        <p><strong>Write-back vs write-through</strong> — coherence usually pairs with write-back caches and an "invalidate" policy: write transitions to M and invalidates any other cache holding the line.</p>
        </div>
      `,
      challenges: [
        { type:'drag-match',
          prompt:"Match each MESI state to its definition.",
          concept:"M = dirty; E = clean & exclusive; S = clean & shared; I = invalid.",
          pairs: [
            { chip:'Modified',  target:'dirty, only this cache has it; must write back before eviction' },
            { chip:'Exclusive', target:'clean, only this cache has it; can be written without bus traffic' },
            { chip:'Shared',    target:'clean, may be in other caches; write requires invalidating them' },
            { chip:'Invalid',   target:'this cache line is empty or stale; a fresh fetch is required to use it' },
          ],
          explain:"E exists so the first read of a block can go directly to M on a write, without first announcing on the bus." },
        { type:'mc',
          prompt:"Core 1 reads block X (no one else has it). What MESI state does X go into?",
          concept:"First reader, no sharers → Exclusive.",
          opts:["Modified","Exclusive","Shared","Invalid"], ans:1,
          explain:"E means clean and unshared. If core 1 later writes, it can silently transition E → M without a bus message." },
        { type:'mc',
          prompt:"Core 1 holds X in S. Core 1 wants to write. What must it do first?",
          concept:"Issue an invalidation so other caches drop their copies; transition to M.",
          opts:[
            "Just write — Shared allows writes",
            "Write through to memory directly",
            "Broadcast an invalidate, wait for ACKs, then transition to Modified",
            "Drop the line and refetch from memory",
          ], ans:2,
          explain:"You can't have multiple writers. Core 1 invalidates other holders, transitions S → M, and only then writes." },
        { type:'fill-blank',
          prompt:"Fill in the resulting MESI states.",
          concept:"Single reader → E. Write to a Shared line → M (after invalidating). Eviction → I.",
          template: "Core A reads X (no one else has it) → state ___\nCore A in Shared writes X → state ___\nCore A evicts X → state ___",
          blanks: ['E','M','I'],
          palette: ['M','E','S','I'],
          explain:"E for the first reader; M after a write (requires invalidation broadcast); I after eviction." },
        { type:'mc',
          prompt:"Why does directory-based coherence scale better than bus snooping?",
          concept:"A shared bus saturates with many cores; directories let coherence traffic be point-to-point.",
          opts:[
            "Directories use less memory",
            "Snooping requires every cache to see every transaction; that bus saturates as cores grow. Directories send messages only to the caches that actually share the line.",
            "Directories don't need invalidations",
            "Snooping doesn't work on multi-socket systems",
          ], ans:1,
          explain:"Snooping is O(cores) per transaction (everyone hears). Directories are O(sharers) per transaction (only those who care). Past ~16 cores, the bus is the bottleneck and directories win." },
        { type:'mc',
          prompt:"\"False sharing\" is a performance pathology where:",
          concept:"Two cores write to DIFFERENT variables that happen to share a cache line → constant invalidations.",
          opts:[
            "Two cores share data they shouldn't",
            "Two cores write to different variables that happen to fall in the same cache line, causing constant invalidations",
            "A core caches a stale value",
            "Two threads use the same lock",
          ], ans:1,
          explain:"From the program's view, the variables are independent. From the cache's view, they're one block — so writes by one core invalidate the other's cache line, costing huge amounts of traffic. Padding to one variable per cache line fixes it." },
      ],
    },

  ],
});
