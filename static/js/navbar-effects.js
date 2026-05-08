(function () {
  const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

  function glitch(el) {
    const target = el.dataset.text;
    let bursts = 0;
    const id = setInterval(() => {
      if (bursts++ >= 6) { clearInterval(id); el.textContent = target; return; }
      el.textContent = Array.from(target, c =>
        c === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]
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
        const roll = (c.charCodeAt(0) - base + Math.floor(Math.random() * 5)) % 26;
        return String.fromCharCode(base + roll);
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
      locked[col] = true;
      col++;
      el.textContent = Array.from(target, (c, i) =>
        locked[i] ? c : CHARS[Math.floor(Math.random() * CHARS.length)]
      ).join('');
    }, 55);
  }

  const EFFECTS = [glitch, cipherRoll, charWave];

  function init() {
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

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
