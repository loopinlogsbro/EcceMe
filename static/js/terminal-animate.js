(function () {
  function init() {
    const body = document.getElementById('github-terminal-output');
    if (!body) return;

    const lines = Array.from(body.querySelectorAll('.terminal-line'));
    if (!lines.length) return;

    // Hide all lines immediately so there's no flash of static content
    lines.forEach(l => {
      l.style.opacity = '0';
      l.style.transform = 'translateY(5px)';
    });

    // Insert a boot command line before the first commit
    const bootLine = document.createElement('div');
    bootLine.className = 'terminal-line';
    bootLine.innerHTML = '<span class="prompt">></span> <span class="term-date" id="terminal-boot-cmd"></span>';
    body.insertBefore(bootLine, lines[0]);

    const cmdEl = document.getElementById('terminal-boot-cmd');
    const CMD = 'git log --oneline loopinlogsbro@ecce';
    let i = 0;

    const typeCmd = setInterval(() => {
      cmdEl.textContent = CMD.slice(0, ++i);
      if (i >= CMD.length) {
        clearInterval(typeCmd);
        revealLines();
      }
    }, 32);

    function revealLines() {
      lines.forEach((line, idx) => {
        setTimeout(() => {
          line.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          line.style.opacity = '1';
          line.style.transform = 'translateY(0)';
        }, 180 + idx * 110);
      });
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
