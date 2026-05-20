// ============================================================
// ui.js — screen rendering, navigation, theme/sound toggles,
//         keyboard support, settings modal.
// ============================================================
// Entry point. Imports the world modules (which register their
// levels with the engine on load), then wires the title screen
// and starts the user at the saved location.
// ============================================================

import * as Storage from './storage.js';
import * as Engine from './engine.js';

// Side-effect imports — each world module calls Engine.registerWorld()
// at module load. Add new worlds here as they ship.
import './../levels/world1-foundations.js';
import './../levels/world2-legv8.js';
import './../levels/world3-arithmetic.js';
import './../levels/world4-datapath.js';
import './../levels/world5-memory.js';

const SOUND_FREQ_OK = 880;
const SOUND_FREQ_BAD = 220;

// ── Screen helpers ──
function show(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById('screen-' + screenId);
  if (t) t.classList.add('active');
  // Reset HUD progress when leaving challenge screens
  if (screenId !== 'challenge') {
    const bar = document.getElementById('hud-bar');
    if (bar) bar.style.width = '0%';
    const title = document.getElementById('hud-title');
    if (title) title.textContent = '⚡ C952 Quest';
  }
  window.scrollTo(0, 0);
}

// ── HUD ──
function updateHUD(level) {
  const state = Storage.get();
  const xpEl = document.getElementById('hud-xp');
  if (xpEl) xpEl.textContent = state.xp + ' XP';
  const sk = document.getElementById('hud-streak');
  if (sk) sk.textContent = state.streak >= 3 ? '🔥 ' + state.streak : '';
  if (level) {
    const rt = Engine.getRuntime();
    const pct = (rt.currentChallenge / level.challenges.length) * 100;
    const bar = document.getElementById('hud-bar');
    if (bar) bar.style.width = pct + '%';
    const t = document.getElementById('hud-title');
    if (t) t.textContent = level.title;
  }
}

// ── Title screen ──
function showTitle() {
  const state = Storage.get();
  document.getElementById('title-xp-badge').textContent = `⭐ ${state.xp} XP total`;
  // Compute next-recommended level (first unlocked-incomplete)
  let nextLabel = 'Start';
  for (const w of Engine.getWorlds()) {
    for (const lv of w.levels) {
      if (Engine.isUnlocked(lv) && !Engine.isCompleted(lv)) {
        nextLabel = state.xp > 0 ? `Continue: ${lv.title}` : 'Start';
        break;
      }
    }
    if (nextLabel !== 'Start') break;
  }
  document.getElementById('title-cta').textContent = '▶ ' + nextLabel;
  show('title');
  updateHUD(null);
}

// ── World picker ──
function renderWorldPicker() {
  const grid = document.getElementById('world-grid');
  grid.innerHTML = '';
  Engine.getWorlds().forEach((w, wi) => {
    const stats = Engine.worldStats(w);
    // A world is locked only if its first level has prereqs that aren't met.
    const firstUnlocked = w.levels.length === 0 || Engine.isUnlocked(w.levels[0]);
    const allDone = stats.completedCount === stats.total && stats.total > 0;
    const card = document.createElement('div');
    card.className = 'world-card ' + (firstUnlocked ? 'unlocked' : 'locked')
                   + (allDone ? ' completed' : '');
    card.innerHTML = `
      <div class="world-head">
        <div class="world-icon">${w.icon || '🌐'}</div>
        <div>
          <div class="world-title">World ${wi + 1}: ${w.title}</div>
          <div class="world-sub">${w.subtitle || ''}</div>
        </div>
      </div>
      <div class="world-stats">
        <span>${stats.completedCount} / ${stats.total} levels · ${w.levels.length} chapters of content</span>
        <span class="world-xp">${stats.earned} / ${stats.max} XP</span>
      </div>
      <div class="world-bar-wrap"><div class="world-bar" style="width:${stats.pct}%"></div></div>
      ${firstUnlocked ? '' : '<div class="lmap-badge">🔒</div>'}
    `;
    if (firstUnlocked) card.addEventListener('click', () => showLevelMap(w));
    grid.appendChild(card);
  });
  document.getElementById('worlds-xp-line').textContent =
    `⭐ ${Storage.get().xp} XP earned across all worlds`;
}
function showWorldPicker() {
  renderWorldPicker();
  show('worlds');
  updateHUD(null);
}

// ── Level map (within a world) ──
let activeWorld = null;
function showLevelMap(world) {
  activeWorld = world;
  document.getElementById('world-map-title').textContent =
    `${world.icon || ''} ${world.title}`;
  const map = document.getElementById('level-map');
  map.innerHTML = '';
  world.levels.forEach((lv, i) => {
    const unlocked  = Engine.isUnlocked(lv);
    const completed = Engine.isCompleted(lv);
    const xpEarned  = Engine.levelXP(lv);
    const card = document.createElement('div');
    card.className = 'lmap-card ' + (unlocked ? 'unlocked' : 'locked')
                   + (completed ? ' completed' : '');
    const badge = completed ? '✅' : (unlocked ? '' : '🔒');
    card.innerHTML = `
      <div class="lmap-badge">${badge}</div>
      <div class="lmap-icon">${lv.icon}</div>
      <div class="lmap-title">L${i + 1}: ${lv.title}</div>
      <div class="lmap-sub">${lv.challenges.length} challenges</div>
      <div class="lmap-xp">${completed ? `${xpEarned} / ${lv.xp} XP earned` : `${lv.xp} XP available`}</div>
      ${completed ? `<div class="progress-bar-wrap"><div class="progress-bar" style="width:${Math.round(xpEarned / lv.xp * 100)}%"></div></div>` : ''}
    `;
    if (unlocked) card.addEventListener('click', () => showIntro(lv.id));
    map.appendChild(card);
  });
  show('map');
  updateHUD(null);
}

// ── Level intro ──
function showIntro(levelId) {
  Engine.startLevel(levelId);
  const lv = Engine.getLevel(levelId);
  const world = Engine.getWorldOf(levelId);
  document.getElementById('intro-content').innerHTML =
    `<h2>${lv.icon || ''} ${lv.title}</h2>
     <div class="card"><p style="color:var(--muted);font-size:13px;">${world.title} · ${lv.challenges.length} challenges · ${lv.xp} XP available</p></div>`
    + (lv.intro || '');
  show('intro');
  updateHUD(null);
}

// ── Challenge runner ──
function startChallenges() {
  show('challenge');
  renderActiveChallenge();
}
function renderActiveChallenge() {
  const rt = Engine.getRuntime();
  const lv = Engine.getLevel(rt.currentLevelId);
  const ch = lv.challenges[rt.currentChallenge];
  document.getElementById('ch-level-label').textContent =
    `${lv.icon} ${lv.title}`;
  document.getElementById('ch-counter').textContent =
    `Challenge ${rt.currentChallenge + 1} of ${lv.challenges.length}`;
  document.getElementById('ch-prompt').innerHTML = ch.prompt;
  const cept = document.getElementById('ch-concept');
  cept.textContent = '';
  cept.style.display = 'none';
  hideFeedback();

  document.getElementById('btn-check').style.display = 'inline-block';
  document.getElementById('btn-check').disabled = false;
  document.getElementById('btn-next').style.display = 'none';

  const host = document.getElementById('ch-body');
  Engine.renderActiveChallenge(host, {
    showFeedback,
    requestCheck: doCheck,
  });
  updateHUD(lv);
}

function doCheck() {
  const result = Engine.submitAnswer({
    showFeedback,
    requestCheck: doCheck,
  });
  if (result.feedback) showFeedback(result.feedback.kind, result.feedback.html);
  if (result.correct) {
    flashXP('+' + result.xpEarned + ' XP');
    playSound(true);
    document.getElementById('btn-check').style.display = 'none';
    document.getElementById('btn-next').style.display = 'inline-block';
    document.getElementById('btn-next').focus();
  } else if (result.locked) {
    playSound(false);
    document.getElementById('btn-check').style.display = 'none';
    document.getElementById('btn-next').style.display = 'inline-block';
  } else {
    playSound(false);
    // Soft retry — surface concept hint after 1st miss for free
    const rt = Engine.getRuntime();
    if (rt.wrongThisChallenge === 1 && rt.hintsThisChallenge === 0) {
      const lv = Engine.getLevel(rt.currentLevelId);
      const ch = lv.challenges[rt.currentChallenge];
      if (ch.concept) {
        const cept = document.getElementById('ch-concept');
        cept.textContent = '💡 ' + ch.concept;
        cept.style.display = 'block';
        rt.hintsThisChallenge = 1;
      }
    }
    document.getElementById('btn-check').disabled = false;
  }
  updateHUD(Engine.getLevel(Engine.getRuntime().currentLevelId));
}

function nextChallenge() {
  const out = Engine.advanceChallenge();
  if (out.kind === 'complete') {
    showLevelComplete(out);
  } else {
    renderActiveChallenge();
  }
}

// ── Level complete ──
function showLevelComplete(out) {
  const { level, sessionXP, correct, total } = out;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 70 ? '⭐⭐' : '⭐';
  document.getElementById('lc-icon').textContent = level.icon;
  document.getElementById('lc-title').textContent = level.title + ' Complete!';
  document.getElementById('lc-stars').textContent = stars;
  document.getElementById('lc-stats').innerHTML = `
    <div class="stat-row"><span>XP earned</span><span class="stat-val">+${sessionXP}</span></div>
    <div class="stat-row"><span>Total XP</span><span class="stat-val">${Storage.get().xp}</span></div>
    <div class="stat-row"><span>Accuracy</span><span class="stat-val">${correct}/${total} (${pct}%)</span></div>
    <div class="stat-row"><span>Best streak</span><span class="stat-val">${Storage.get().streak}</span></div>
  `;
  // Find next unlocked-incomplete level (within this world preferred)
  let nextId = null;
  const world = Engine.getWorldOf(level.id);
  for (const lv of world.levels) {
    if (lv.id !== level.id && !Engine.isCompleted(lv) && Engine.isUnlocked(lv)) { nextId = lv.id; break; }
  }
  if (!nextId) {
    for (const w of Engine.getWorlds()) {
      for (const lv of w.levels) {
        if (!Engine.isCompleted(lv) && Engine.isUnlocked(lv)) { nextId = lv.id; break; }
      }
      if (nextId) break;
    }
  }
  const btn = document.getElementById('btn-lc-next');
  if (nextId) {
    btn.textContent = 'Next Level →';
    btn.onclick = () => showIntro(nextId);
  } else {
    btn.textContent = '🏆 Back to map';
    btn.onclick = () => showWorldPicker();
  }
  show('lc');
  updateHUD(null);
}

// ── Feedback bar ──
function showFeedback(kind, html) {
  const fb = document.getElementById('feedback');
  fb.innerHTML = html;
  fb.className = kind;
  fb.style.display = 'block';
}
function hideFeedback() {
  const fb = document.getElementById('feedback');
  fb.style.display = 'none';
  fb.className = '';
}

// ── XP popup ──
function flashXP(msg) {
  const el = document.getElementById('xp-popup');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1000);
}

// ── Sound ──
let audioCtx = null;
function playSound(ok) {
  const settings = Storage.get().settings;
  if (!settings.soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = ok ? SOUND_FREQ_OK : SOUND_FREQ_BAD;
    osc.type = 'sine';
    g.gain.value = 0.06;
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.10);
  } catch (e) {}
}

// ── Hints ──
function requestHint() {
  const rt = Engine.getRuntime();
  if (rt.currentLevelId == null) return;
  const out = Engine.requestHint();
  showFeedback('info', out.html + (out.cost > 0 ? ` <span style="font-size:11.5px;color:var(--muted)">(−${out.cost} XP from this challenge)</span>` : ''));
}

// ── Lesson modal ──
function showLessonModal() {
  const lv = Engine.getLevel(Engine.getRuntime().currentLevelId);
  if (!lv) return;
  document.getElementById('lesson-modal-content').innerHTML =
    `<h2>${lv.icon} ${lv.title}</h2>` + (lv.intro || '');
  document.getElementById('lesson-modal').style.display = 'block';
}
function hideLessonModal() {
  document.getElementById('lesson-modal').style.display = 'none';
}

// ── Settings modal ──
function showSettings() {
  const inner = document.getElementById('settings-inner');
  const sound = Storage.get().settings.soundOn;
  inner.innerHTML = `
    <div class="modal-head">
      <h2>Settings</h2>
      <button class="btn btn-ghost btn-sm" id="btn-settings-close">✕ Close</button>
    </div>
    <div class="set-row">
      <div>
        <div class="lab">Sound effects</div>
        <div class="desc">Subtle correct/incorrect tones</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-sound">${sound ? '🔊 On' : '🔇 Off'}</button>
    </div>
    <hr class="divider"/>
    <div class="set-row">
      <div>
        <div class="lab">Reset progress for one world</div>
        <div class="desc">Clears completion + earned XP for that world</div>
      </div>
      <select id="reset-world-sel" class="type-input" style="width:170px;font-size:13px;">
        <option value="">Choose world…</option>
        ${Engine.getWorlds().map(w => `<option value="${w.id}">${w.title}</option>`).join('')}
      </select>
    </div>
    <div class="set-row">
      <div>
        <div class="lab">Reset all progress</div>
        <div class="desc">Wipes everything. Migration from Binary Quest will not run again.</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-reset-all" style="color:var(--red);">Reset all</button>
    </div>
  `;
  document.getElementById('settings-modal').style.display = 'block';
  document.getElementById('btn-settings-close').onclick = hideSettings;
  document.getElementById('btn-toggle-sound').onclick = () => {
    Storage.setSetting('soundOn', !Storage.get().settings.soundOn);
    showSettings();
  };
  document.getElementById('reset-world-sel').onchange = function() {
    if (!this.value) return;
    const w = Engine.getWorlds().find(x => x.id === this.value);
    if (!w) return;
    if (!confirm(`Reset all progress for "${w.title}"?`)) { this.value = ''; return; }
    Storage.resetWorld(w.id, w.levels.map(l => l.id));
    showSettings();
  };
  document.getElementById('btn-reset-all').onclick = () => {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      Storage.resetAll();
      hideSettings();
      showTitle();
    }
  };
}
function hideSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

// ── Keyboard ──
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs (except for global Esc)
  const tag = (e.target.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

  if (e.key === 'Escape') {
    if (document.getElementById('lesson-modal').style.display === 'block') return hideLessonModal();
    if (document.getElementById('settings-modal').style.display === 'block') return hideSettings();
    // Pop back one screen
    const active = document.querySelector('.screen.active');
    if (!active) return;
    if (active.id === 'screen-challenge' || active.id === 'screen-intro') return showLevelMap(activeWorld);
    if (active.id === 'screen-map')  return showWorldPicker();
    if (active.id === 'screen-worlds') return showTitle();
    return;
  }

  if (isInput) return;

  // Global shortcuts
  if (e.key === '?') { e.preventDefault(); requestHint(); return; }

  // On the challenge screen
  const onChallenge = document.querySelector('.screen.active')?.id === 'screen-challenge';
  if (!onChallenge) {
    if (e.key === 'Enter') {
      const active = document.querySelector('.screen.active');
      if (active && active.id === 'screen-intro') {
        document.getElementById('btn-start-level').click();
      } else if (active && active.id === 'screen-title') {
        document.getElementById('title-cta').click();
      } else if (active && active.id === 'screen-lc') {
        document.getElementById('btn-lc-next').click();
      }
    }
    return;
  }

  // MC: 1–4 / A–D
  const ch = Engine.getLevel(Engine.getRuntime().currentLevelId).challenges[Engine.getRuntime().currentChallenge];
  if (ch.type === 'mc') {
    let idx = -1;
    if (e.key >= '1' && e.key <= '4') idx = parseInt(e.key, 10) - 1;
    else if (/^[a-dA-D]$/.test(e.key)) idx = e.key.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < (ch.opts || []).length) {
      e.preventDefault();
      const opts = document.querySelectorAll('.mc-opt');
      if (opts[idx] && !opts[idx].classList.contains('locked')) opts[idx].click();
      return;
    }
  }
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    renderActiveChallenge();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const next = document.getElementById('btn-next');
    const check = document.getElementById('btn-check');
    if (next.style.display !== 'none') next.click();
    else if (!check.disabled) check.click();
  }
});

// ── Theme toggle (shared key with C952 chapter pages) ──
(function setupTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  function currentTheme() {
    const t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mq.matches ? 'light' : 'dark';
  }
  function updateLabel() {
    const t = currentTheme();
    const label = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('study-guide-theme', next); } catch (e) {}
    updateLabel();
  });
  if (mq.addEventListener) {
    mq.addEventListener('change', () => {
      let saved = null;
      try { saved = localStorage.getItem('study-guide-theme'); } catch (e) {}
      if (saved !== 'light' && saved !== 'dark') updateLabel();
    });
  }
  updateLabel();
})();

// ── Wire up the static HTML buttons on load ──
function wireButtons() {
  document.getElementById('title-cta').onclick = showWorldPicker;
  document.getElementById('btn-title-settings').onclick = showSettings;
  document.getElementById('btn-worlds-back').onclick = showTitle;
  document.getElementById('btn-map-back').onclick = showWorldPicker;
  document.getElementById('btn-intro-back').onclick = () => showLevelMap(activeWorld);
  document.getElementById('btn-start-level').onclick = startChallenges;
  document.getElementById('btn-check').onclick = doCheck;
  document.getElementById('btn-next').onclick = nextChallenge;
  document.getElementById('btn-ch-back').onclick = () => showLevelMap(activeWorld);
  document.getElementById('btn-lesson').onclick = showLessonModal;
  document.getElementById('btn-hint').onclick = requestHint;
  document.getElementById('btn-lesson-close').onclick = hideLessonModal;
}

// ── Init ──
Storage.load();
wireButtons();
showTitle();
