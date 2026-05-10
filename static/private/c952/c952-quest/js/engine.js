// ============================================================
// engine.js — level runner, XP, progression, hint system
// ============================================================
// Owns the runtime state for "currently playing a level":
//   - which challenge we're on
//   - per-challenge runtime slot (passed to challenges.js handlers)
//   - XP tally for the in-progress level (separate from total XP)
//   - hint usage for the current challenge
//
// Level / world data flows through here from levels/world*.js
// modules. The UI layer (ui.js) calls engine functions to begin
// a level, advance challenges, and read progress for rendering.
//
// XP math (matches Binary Quest):
//   base XP per challenge = round(level.xp / level.challenges.length)
//   multiplier:  0 wrong → 1.0
//                1 wrong → 0.75
//                2+ wrong → 0.5
//   streak bonus: x1.1 once streak ≥ 3
//   hint cost: 2nd hint deducts round(base * 0.25) before awarding
//
// Hint policy: 1 free hint per challenge, 2nd hint costs 25% of base XP.
// Hints come from challenge.concept and challenge.deepHint (optional).
// ============================================================

import * as Storage from './storage.js';
import { renderChallenge, checkChallenge } from './challenges.js';

// ── World registry (filled by registerWorld()) ──
const worlds = [];
const levelById = new Map();   // id → { level, world }

export function registerWorld(world) {
  worlds.push(world);
  for (const lv of world.levels) {
    levelById.set(lv.id, { level: lv, world });
  }
}

export function getWorlds() { return worlds; }
export function getLevel(id) {
  const entry = levelById.get(id);
  return entry ? entry.level : null;
}
export function getWorldOf(levelId) {
  const entry = levelById.get(levelId);
  return entry ? entry.world : null;
}

// ── Active runtime state ──
const runtime = {
  currentLevelId: null,
  currentChallenge: 0,
  wrongThisChallenge: 0,
  hintsThisChallenge: 0,
  challengeRuntime: null, // arbitrary state owned by the active challenge type
  sessionXP: 0,
  sessionCorrect: 0,
  sessionTotal: 0,
};

export function getRuntime() { return runtime; }

// ── Level lock / unlock ──
export function isUnlocked(level) {
  // No prereqs OR every prereq id is in the completed set.
  const prereqs = level.prereqs || [];
  const state = Storage.get();
  return prereqs.every(id => state.completed[id]);
}

export function isCompleted(level) {
  return Storage.isCompleted(level.id);
}

export function levelXP(level) {
  return Storage.getLevelXP(level.id);
}

export function worldStats(world) {
  let earned = 0, max = 0, completedCount = 0;
  let unlockedCount = 0;
  world.levels.forEach(lv => {
    earned += levelXP(lv);
    max    += lv.xp || 0;
    if (isCompleted(lv))   completedCount++;
    if (isUnlocked(lv))    unlockedCount++;
  });
  return {
    earned, max, completedCount, unlockedCount,
    total: world.levels.length,
    pct: max > 0 ? Math.round(earned / max * 100) : 0,
  };
}

// ── Begin a level ──
export function startLevel(levelId) {
  const level = getLevel(levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  runtime.currentLevelId = levelId;
  runtime.currentChallenge = 0;
  runtime.sessionXP = 0;
  runtime.sessionCorrect = 0;
  runtime.sessionTotal = 0;
  runtime.wrongThisChallenge = 0;
  runtime.hintsThisChallenge = 0;
  runtime.challengeRuntime = null;
}

// ── Render the active challenge into a host element ──
export function renderActiveChallenge(host, callbacks) {
  const level = getLevel(runtime.currentLevelId);
  const ch = level.challenges[runtime.currentChallenge];
  runtime.wrongThisChallenge = 0;
  runtime.hintsThisChallenge = 0;
  runtime.challengeRuntime = null;

  // Build a context object for the challenge handler.
  const ctx = {
    showFeedback: callbacks.showFeedback,
    requestCheck: callbacks.requestCheck,
    setRuntime(state) { runtime.challengeRuntime = state; },
    getRuntime()      { return runtime.challengeRuntime; },
  };

  host.innerHTML = '';
  renderChallenge(host, ch, ctx);
  return ch;
}

// ── Validate the current answer ──
// Returns {
//   correct: bool,
//   xpEarned: int,
//   feedback: { kind, html },
//   advanceTo: 'next-challenge' | 'level-complete' | null,
//   locked: bool,
// }
export function submitAnswer(callbacks) {
  const level = getLevel(runtime.currentLevelId);
  const ch = level.challenges[runtime.currentChallenge];
  const ctx = {
    showFeedback: callbacks.showFeedback,
    requestCheck: callbacks.requestCheck,
    setRuntime(state) { runtime.challengeRuntime = state; },
    getRuntime()      { return runtime.challengeRuntime; },
  };
  const result = checkChallenge(ch, ctx);

  // "soft" failures (e.g. didn't pick an MC option) don't burn an attempt.
  if (result.soft) {
    return {
      correct: false,
      xpEarned: 0,
      feedback: { kind: 'info', html: result.message || '' },
      advanceTo: null,
      locked: false,
    };
  }

  runtime.sessionTotal++;
  if (result.correct) {
    Storage.bumpStreak();
    runtime.sessionCorrect++;
    const baseXP = Math.round((level.xp || 100) / level.challenges.length);
    const multiplier = runtime.wrongThisChallenge === 0 ? 1.0
                     : runtime.wrongThisChallenge === 1 ? 0.75 : 0.5;
    const streak = Storage.get().streak;
    const streakBonus = streak >= 3 ? 1.1 : 1.0;
    let earned = Math.round(baseXP * multiplier * streakBonus);
    // Subtract for paid hints (each paid hint = 25% of base XP)
    const paidHints = Math.max(0, runtime.hintsThisChallenge - 1);
    earned = Math.max(0, earned - paidHints * Math.round(baseXP * 0.25));
    runtime.sessionXP += earned;
    Storage.addXP(level.id, earned);

    return {
      correct: true,
      xpEarned: earned,
      feedback: {
        kind: 'ok',
        html: `✓ Correct! +${earned} XP`
              + (streak >= 3 ? ` 🔥 streak ×${streak}!` : '')
              + (ch.explain ? `<br><span style="font-size:12.5px;color:var(--muted)">${ch.explain}</span>` : ''),
      },
      advanceTo: 'next-challenge',
      locked: !!result.locked,
    };
  }

  // Wrong
  runtime.wrongThisChallenge++;
  Storage.resetStreak();
  // For MC: locked after first attempt; for others: caller may allow retry.
  if (result.locked) {
    return {
      correct: false,
      xpEarned: 0,
      feedback: {
        kind: 'err',
        html: `✗ Incorrect. ${ch.explain ? '<br><span style="font-size:12.5px;color:var(--muted)">' + ch.explain + '</span>' : ''}`
              + '<br><span style="font-size:12.5px;color:var(--muted)">No XP for this one.</span>',
      },
      advanceTo: 'next-challenge',
      locked: true,
    };
  }
  return {
    correct: false,
    xpEarned: 0,
    feedback: {
      kind: 'err',
      html: result.message || '✗ Not quite — try again.',
    },
    advanceTo: null,
    locked: false,
  };
}

export function advanceChallenge() {
  const level = getLevel(runtime.currentLevelId);
  runtime.currentChallenge++;
  if (runtime.currentChallenge >= level.challenges.length) {
    return finishLevel();
  }
  return { kind: 'next' };
}

function finishLevel() {
  const level = getLevel(runtime.currentLevelId);
  Storage.markCompleted(level.id);
  return { kind: 'complete', level, sessionXP: runtime.sessionXP,
           correct: runtime.sessionCorrect, total: runtime.sessionTotal };
}

// ── Hint system ──
// Returns { html, cost, hintsUsed } for display.
export function requestHint() {
  const level = getLevel(runtime.currentLevelId);
  const ch = level.challenges[runtime.currentChallenge];
  const which = runtime.hintsThisChallenge;
  const baseXP = Math.round((level.xp || 100) / level.challenges.length);
  const cost = which === 0 ? 0 : Math.round(baseXP * 0.25);
  // Texts: hint #1 = ch.concept, hint #2 = ch.deepHint or ch.explain
  let text;
  if (which === 0) text = ch.concept || 'Re-read the prompt and the lesson card.';
  else if (which === 1) text = ch.deepHint || ch.explain || ch.concept || 'No deeper hint available.';
  else return { html: 'No more hints.', cost: 0, hintsUsed: which };

  runtime.hintsThisChallenge++;
  Storage.bumpHints(level.id, runtime.currentChallenge);
  return {
    html: (which === 0 ? '💡 Hint: ' : '💡💡 Deeper hint: ') + text,
    cost,
    hintsUsed: runtime.hintsThisChallenge,
  };
}

// ── Reset the in-progress challenge (R key) ──
export function resetChallenge(host, callbacks) {
  return renderActiveChallenge(host, callbacks);
}
