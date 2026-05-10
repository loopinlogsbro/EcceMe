// ============================================================
// storage.js — localStorage wrapper for C952 Quest progress
// ============================================================
// Persists per-level XP, completions, hint usage, and settings.
// Migrates legacy `bq-state` (Binary Quest) into the new
// `c952-quest-progress` slot once on first load.
//
// Schema (all under key `c952-quest-progress`):
//   {
//     version: 1,
//     xp:        <total earned XP>,
//     streak:    <current correct-in-a-row count>,
//     completed: { "<level-id>": true, ... },
//     levelXP:   { "<level-id>": <int>, ... },
//     hintsUsed: { "<level-id>:<challenge-idx>": <int>, ... },
//     settings:  { soundOn: bool, ... },
//     migratedFromBQ: bool,
//   }
//
// Theme is stored separately under `c952-theme` (shared across
// the C952 study-guide pages) so toggling here also affects the
// chapter pages.
// ============================================================

const STORAGE_KEY = 'c952-quest-progress';
const LEGACY_KEY  = 'bq-state';

const DEFAULT_STATE = () => ({
  version: 1,
  xp: 0,
  streak: 0,
  completed: {},
  levelXP: {},
  hintsUsed: {},
  settings: { soundOn: false },
  migratedFromBQ: false,
});

// Map of legacy Binary Quest level index → new C952 Quest level id.
// World 1 (Foundations) keeps the same 10 levels in the same order.
const LEGACY_LEVEL_MAP = {
  0: 'w1-bits',
  1: 'w1-place-values',
  2: 'w1-bin-to-dec',
  3: 'w1-dec-to-bin',
  4: 'w1-hex',
  5: 'w1-twos',
  6: 'w1-arith',
  7: 'w1-bitwise',
  8: 'w1-bytes',
  9: 'w1-encoding',
};

let state = DEFAULT_STATE();

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = Object.assign(DEFAULT_STATE(), parsed);
      // Defensive: ensure nested objects exist after partial parses.
      state.completed = state.completed || {};
      state.levelXP   = state.levelXP   || {};
      state.hintsUsed = state.hintsUsed || {};
      state.settings  = Object.assign({ soundOn: false }, state.settings || {});
    } catch (e) {
      state = DEFAULT_STATE();
    }
  }
  if (!state.migratedFromBQ) {
    migrateFromBinaryQuest();
  }
  return state;
}

function migrateFromBinaryQuest() {
  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch (e) {}
  state.migratedFromBQ = true;
  if (!raw) { save(); return; }
  try {
    const old = JSON.parse(raw);
    // Carry over total XP only if the new state has none yet, so
    // re-running migration after manual progress doesn't double-credit.
    if (state.xp === 0 && typeof old.xp === 'number') {
      state.xp = old.xp;
    }
    if (Array.isArray(old.completedLevels)) {
      old.completedLevels.forEach(idx => {
        const newId = LEGACY_LEVEL_MAP[idx];
        if (newId) state.completed[newId] = true;
      });
    }
    if (old.levelXP && typeof old.levelXP === 'object') {
      Object.keys(old.levelXP).forEach(k => {
        const newId = LEGACY_LEVEL_MAP[Number(k)];
        if (newId && !state.levelXP[newId]) state.levelXP[newId] = old.levelXP[k];
      });
    }
  } catch (e) {
    // ignore — corrupted legacy state, just mark migrated
  }
  save();
}

export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

export function get() { return state; }

export function setState(patch) {
  Object.assign(state, patch);
  save();
}

export function addXP(levelId, amount) {
  state.xp += amount;
  state.levelXP[levelId] = (state.levelXP[levelId] || 0) + amount;
  save();
}

export function markCompleted(levelId) {
  state.completed[levelId] = true;
  save();
}

export function isCompleted(levelId) {
  return !!state.completed[levelId];
}

export function getLevelXP(levelId) {
  return state.levelXP[levelId] || 0;
}

export function getHints(levelId, challengeIdx) {
  return state.hintsUsed[`${levelId}:${challengeIdx}`] || 0;
}

export function bumpHints(levelId, challengeIdx) {
  const k = `${levelId}:${challengeIdx}`;
  state.hintsUsed[k] = (state.hintsUsed[k] || 0) + 1;
  save();
  return state.hintsUsed[k];
}

export function setStreak(n) { state.streak = n; save(); }
export function bumpStreak()  { state.streak++; save(); return state.streak; }
export function resetStreak() { state.streak = 0; save(); }

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

// ── Reset operations ──
export function resetAll() {
  state = DEFAULT_STATE();
  state.migratedFromBQ = true; // don't pull legacy back in after a manual reset
  save();
}

export function resetWorld(worldId, levelIds) {
  // Clear completion + XP for all levels in the named world.
  let removedXP = 0;
  levelIds.forEach(id => {
    removedXP += state.levelXP[id] || 0;
    delete state.completed[id];
    delete state.levelXP[id];
    Object.keys(state.hintsUsed).forEach(k => {
      if (k.startsWith(id + ':')) delete state.hintsUsed[k];
    });
  });
  state.xp = Math.max(0, state.xp - removedXP);
  save();
}
