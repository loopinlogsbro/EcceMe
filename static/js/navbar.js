(function () {
  // Shared character sets
  const CHARS_FULL  = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&';
  const CHARS_ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';

  // ── Brand scramble ──────────────────────────────────────────────────────────
  const FRAME_RATE = 40;
  const LOCK_DELAY = 6;

  function scramble(el) {
    const target = el.dataset.scramble || el.textContent;
    const len = target.length;
    let frame = 0;
    const total = len * LOCK_DELAY + 8;
    const id = setInterval(() => {
      let out = '';
      for (let i = 0; i < len; i++) {
        out += frame >= (i + 1) * LOCK_DELAY
          ? target[i]
          : CHARS_FULL[Math.floor(Math.random() * CHARS_FULL.length)];
      }
      el.textContent = out;
      if (++frame > total) { clearInterval(id); el.textContent = target; }
    }, FRAME_RATE);
  }

  function initBrand() {
    const brand = document.querySelector('.navbar-brand');
    if (!brand) return;
    const text = brand.childNodes[brand.childNodes.length - 1];
    if (!text || text.nodeType !== Node.TEXT_NODE) return;
    const span = document.createElement('span');
    span.dataset.scramble = text.textContent.trim();
    span.textContent = span.dataset.scramble;
    span.style.cursor = 'pointer';
    text.replaceWith(span);
    scramble(span);
    let clicks = 0, timer = null;
    span.addEventListener('click', () => {
      scramble(span);
      clicks++;
      clearTimeout(timer);
      if (clicks >= 3) { clicks = 0; window.location.href = '/private/c952/'; return; }
      timer = setTimeout(() => { clicks = 0; }, 700);
    });
  }

  // ── Nav link hover effects ──────────────────────────────────────────────────
  function glitch(el) {
    const target = el.dataset.text;
    let bursts = 0;
    const id = setInterval(() => {
      if (bursts++ >= 6) { clearInterval(id); el.textContent = target; return; }
      el.textContent = Array.from(target, c =>
        c === ' ' ? ' ' : CHARS_ALPHA[Math.floor(Math.random() * CHARS_ALPHA.length)]
      ).join('');
    }, 45);
  }

  function cipherRoll(el) {
    const target = el.dataset.text;
    const STEPS = 9;
    let frame = 0;
    const id = setInterval(() => {
      el.textContent = Array.from(target, c => {
        if (frame >= STEPS || !/[a-zA-Z]/.test(c)) return c;
        const base = c >= 'a' ? 97 : 65;
        return String.fromCharCode(base + (c.charCodeAt(0) - base + Math.floor(Math.random() * 5)) % 26);
      }).join('');
      if (++frame > STEPS) { clearInterval(id); el.textContent = target; }
    }, 38);
  }

  function charWave(el) {
    const target = el.dataset.text;
    const locked = new Array(target.length).fill(false);
    let col = 0;
    const id = setInterval(() => {
      if (col >= target.length) { clearInterval(id); el.textContent = target; return; }
      locked[col++] = true;
      el.textContent = Array.from(target, (c, i) =>
        locked[i] ? c : CHARS_ALPHA[Math.floor(Math.random() * CHARS_ALPHA.length)]
      ).join('');
    }, 55);
  }

  const EFFECTS = [glitch, cipherRoll, charWave];

  function initNavLinks() {
    let idx = 0;
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
      const text = link.textContent.trim();
      if (!text || link.querySelector('svg, input')) return;
      const span = document.createElement('span');
      span.dataset.text = text;
      span.textContent = text;
      link.textContent = '';
      link.appendChild(span);
      const effect = EFFECTS[idx++ % EFFECTS.length];
      link.addEventListener('mouseenter', () => effect(span));
    });
  }

  // ── OS colour-scheme live listener ─────────────────────────────────────────
  // Follows system preference in real time, but only when the user has NOT
  // manually chosen a theme (no pref-theme in localStorage).
  const osScheme = window.matchMedia('(prefers-color-scheme: dark)');
  osScheme.addEventListener('change', e => {
    if (localStorage.getItem('pref-theme')) return;
    document.documentElement.classList.toggle('dark', e.matches);
    document.body.classList.toggle('dark', e.matches);
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    initBrand();
    initNavLinks();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
