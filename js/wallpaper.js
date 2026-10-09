/* 动态壁纸模块 — 班级宠物园
 * 模式：off / gradient（渐变流动）/ particles（粒子星空）/ aurora（极光）
 * 右下角浮动按钮切换，状态存 localStorage
 */
(function () {
  const KEY = 'dy_wallpaper_mode';
  const MODES = ['off', 'gradient', 'particles', 'aurora'];
  const LABELS = { off: '壁纸关', gradient: '渐变流动', particles: '粒子星空', aurora: '极光' };

  let layer = null;
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let particles = [];
  let currentMode = 'gradient';

  /* 注入 CSS */
  function injectCSS() {
    const css = `
#dy-wallpaper{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;overflow:hidden;}
#dy-wallpaper.dw-gradient{
  background:linear-gradient(125deg,#a8edea,#fed6e3,#c2e9fb,#fbc2eb,#d4fc79,#96e6a1);
  background-size:400% 400%;
  animation:dw-grad 18s ease infinite;
}
@keyframes dw-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
#dy-wallpaper.dw-aurora{background:#0f0c29;}
#dy-wallpaper.dw-aurora::before,#dy-wallpaper.dw-aurora::after{
  content:'';position:absolute;width:60vw;height:60vw;border-radius:50%;filter:blur(80px);opacity:.55;
}
#dy-wallpaper.dw-aurora::before{background:radial-gradient(circle,#7f00ff,#e100ff);top:-20%;left:-10%;animation:dw-aurora1 14s ease-in-out infinite;}
#dy-wallpaper.dw-aurora::after{background:radial-gradient(circle,#00c6ff,#0072ff);bottom:-25%;right:-15%;animation:dw-aurora2 18s ease-in-out infinite;}
@keyframes dw-aurora1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30vw,20vh) scale(1.3)}}
@keyframes dw-aurora2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-25vw,-15vh) scale(1.2)}}
#dy-wallpaper canvas{display:block;width:100%;height:100%;}
#dy-wp-btn{
  position:fixed;right:16px;bottom:16px;z-index:9998;
  width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;
  background:rgba(255,255,255,.85);backdrop-filter:blur(8px);
  box-shadow:0 2px 12px rgba(0,0,0,.18);font-size:20px;
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s,box-shadow .2s;
}
#dy-wp-btn:hover{transform:scale(1.1);box-shadow:0 4px 18px rgba(0,0,0,.25);}
#dy-wp-btn:active{transform:scale(.95);}
#dy-wp-label{
  position:fixed;right:68px;bottom:24px;z-index:9998;
  background:rgba(0,0,0,.65);color:#fff;font-size:12px;padding:4px 10px;border-radius:12px;
  opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;
}
#dy-wp-label.show{opacity:1;}
body{background-color:transparent !important;}
`;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* 粒子模式 */
  function initParticles() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    particles = [];
    const count = Math.min(90, Math.floor(window.innerWidth / 14));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.6,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        a: Math.random() * 0.5 + 0.3,
      });
    }
    layer.appendChild(canvas);
    window.addEventListener('resize', resizeCanvas);
    animateParticles();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function animateParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#667eea');
    grad.addColorStop(1, '#764ba2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.fill();
      // 连线
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(animateParticles);
  }

  function stopParticles() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
    window.removeEventListener('resize', resizeCanvas);
  }

  function applyMode(mode) {
    currentMode = mode;
    if (!layer) return;
    layer.className = '';
    stopParticles();
    if (mode === 'gradient') layer.classList.add('dw-gradient');
    else if (mode === 'aurora') layer.classList.add('dw-aurora');
    else if (mode === 'particles') { layer.classList.add('dw-particles'); initParticles(); }
    // off: 什么都不加，透明
    localStorage.setItem(KEY, mode);
    updateBtn();
  }

  function updateBtn() {
    const btn = document.getElementById('dy-wp-btn');
    const label = document.getElementById('dy-wp-label');
    if (!btn) return;
    const icons = { off: '🌑', gradient: '🌈', particles: '✨', aurora: '🌌' };
    btn.textContent = icons[currentMode] || '🖼️';
    if (label) label.textContent = LABELS[currentMode] || currentMode;
  }

  function cycleMode() {
    const idx = MODES.indexOf(currentMode);
    const next = MODES[(idx + 1) % MODES.length];
    applyMode(next);
    const label = document.getElementById('dy-wp-label');
    if (label) {
      label.classList.add('show');
      clearTimeout(label._t);
      label._t = setTimeout(() => label.classList.remove('show'), 1500);
    }
  }

  function init() {
    injectCSS();
    layer = document.createElement('div');
    layer.id = 'dy-wallpaper';
    document.body.insertBefore(layer, document.body.firstChild);

    const btn = document.createElement('button');
    btn.id = 'dy-wp-btn';
    btn.title = '切换动态壁纸';
    btn.onclick = cycleMode;
    document.body.appendChild(btn);

    const label = document.createElement('div');
    label.id = 'dy-wp-label';
    document.body.appendChild(label);

    const saved = localStorage.getItem(KEY);
    applyMode(MODES.includes(saved) ? saved : 'gradient');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
