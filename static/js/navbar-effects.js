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

  function eraseRetype(el) {
    const target = el.dataset.text;
    let len = target.length;
    const erase = setInterval(() => {
      el.textContent = target.slice(0, --len);
      if (len <= 0) {
        clearInterval(erase);
        const retype = setInterval(() => {
          el.textContent = target.slice(0, ++len);
          if (len >= target.length) clearInterval(retype);
        }, 55);
      }
    }, 42);
  }

  const EFFECTS = [glitch, cipherRoll, eraseRetype];

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
