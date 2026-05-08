(function () {
  const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&';
  const FRAME_RATE = 40;   // ms per frame
  const LOCK_DELAY = 6;    // frames before each char locks in

  function scramble(el) {
    const target = el.dataset.scramble || el.textContent;
    const len = target.length;
    let frame = 0;
    const total = len * LOCK_DELAY + 8;

    const id = setInterval(() => {
      let out = '';
      for (let i = 0; i < len; i++) {
        if (frame >= (i + 1) * LOCK_DELAY) {
          out += target[i];
        } else {
          out += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      el.textContent = out;
      if (++frame > total) {
        clearInterval(id);
        el.textContent = target;
      }
    }, FRAME_RATE);
  }

  function init() {
    const brand = document.querySelector('.navbar-brand');
    if (!brand) return;
    const text = brand.childNodes[brand.childNodes.length - 1];
    if (!text || text.nodeType !== Node.TEXT_NODE) return;

    const span = document.createElement('span');
    span.dataset.scramble = text.textContent.trim();
    span.textContent = span.dataset.scramble;
    text.replaceWith(span);

    scramble(span);
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => scramble(span));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
