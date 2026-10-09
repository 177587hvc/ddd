/* 动态壁纸模块 — 班级宠物园
 * 模式：off / gradient（渐变流动）/ particles（粒子星空）/ aurora（极光）/ image（自定义图）/ video（视频壁纸）
 * 右下角浮动按钮弹出面板，自定义图/视频支持 URL 输入或本地上传（存 localStorage）
 */
(function () {
  const KEY_MODE = 'dy_wallpaper_mode';
  const KEY_IMG = 'dy_wallpaper_img';
  const KEY_VIDEO = 'dy_wallpaper_video';
  const MODES = ['off', 'gradient', 'particles', 'aurora', 'image', 'video'];
  const LABELS = { off: '关闭', gradient: '渐变流动', particles: '粒子星空', aurora: '极光', image: '自定义图片', video: '视频壁纸' };

  let layer = null;
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let particles = [];
  let currentMode = 'gradient';
  let imgEl = null;
  let videoEl = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* 注入 CSS */
  function injectCSS() {
    const css = `
#dy-wallpaper{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;overflow:hidden;background:transparent;}
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
#dy-wallpaper .dw-img,#dy-wallpaper video.dw-video{position:absolute;inset:0;width:100%;height:100%;}
#dy-wallpaper video.dw-video{object-fit:cover;}
#dy-wallpaper .dw-img{background-size:cover;background-position:center;background-repeat:no-repeat;}
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
#dy-wp-panel{
  position:fixed;right:16px;bottom:68px;z-index:9999;width:300px;
  background:rgba(255,255,255,.96);backdrop-filter:blur(10px);
  border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.22);
  padding:16px;color:#1f2937;font-size:13px;
  transform-origin:bottom right;transition:transform .18s ease,opacity .18s ease;
}
#dy-wp-panel.hidden{transform:scale(.92);opacity:0;pointer-events:none;}
#dy-wp-panel h3{margin:0 0 10px;font-size:15px;font-weight:700;color:#111;}
.dw-mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;}
.dw-mode-btn{
  border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:7px 4px;cursor:pointer;
  font-size:12px;color:#374151;transition:all .15s;text-align:center;
}
.dw-mode-btn:hover{border-color:#8b5cf6;}
.dw-mode-btn.active{background:#8b5cf6;color:#fff;border-color:#8b5cf6;font-weight:600;}
.dw-sec{margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:10px;}
.dw-sec label{display:block;font-size:12px;color:#6b7280;margin-bottom:5px;font-weight:600;}
.dw-url-row{display:flex;gap:6px;margin-bottom:6px;}
.dw-url-row input{
  flex:1;border:1px solid #d1d5db;border-radius:6px;padding:6px 8px;font-size:12px;min-width:0;
}
.dw-url-row input:focus{outline:none;border-color:#8b5cf6;}
.dw-btn{border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;background:#f3f4f6;color:#374151;}
.dw-btn.primary{background:#8b5cf6;color:#fff;}
.dw-btn:hover{filter:brightness(1.05);}
.dw-hint{font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.5;}
.dw-file{font-size:12px;color:#6b7280;}
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
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.6, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
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
    grad.addColorStop(0, '#667eea'); grad.addColorStop(1, '#764ba2');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.a})`; ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(animateParticles);
  }
  function stopParticles() {
    if (rafId) cancelAnimationFrame(rafId); rafId = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
    window.removeEventListener('resize', resizeCanvas);
  }

  function setImage(src) {
    clearCustom();
    if (!src) return;
    imgEl = document.createElement('div');
    imgEl.className = 'dw-img';
    imgEl.style.backgroundImage = `url('${src}')`;
    layer.appendChild(imgEl);
  }
  function setVideo(src) {
    clearCustom();
    if (!src) return;
    videoEl = document.createElement('video');
    videoEl.className = 'dw-video';
    videoEl.src = src;
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.onerror = () => {
      UI && UI.toast ? UI.toast('视频加载失败，请检查地址', 'error') : alert('视频加载失败，请检查地址');
    };
    videoEl.play().catch(() => {});
    layer.appendChild(videoEl);
  }
  function clearCustom() {
    if (imgEl && imgEl.parentNode) imgEl.parentNode.removeChild(imgEl);
    if (videoEl && videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    if (videoEl) { videoEl.pause(); videoEl.src = ''; }
    imgEl = null; videoEl = null;
  }

  function applyMode(mode) {
    currentMode = mode;
    if (!layer) return;
    layer.className = '';
    stopParticles();
    clearCustom();
    if (mode === 'gradient') layer.classList.add('dw-gradient');
    else if (mode === 'aurora') layer.classList.add('dw-aurora');
    else if (mode === 'particles') { layer.classList.add('dw-particles'); initParticles(); }
    else if (mode === 'image') setImage(localStorage.getItem(KEY_IMG));
    else if (mode === 'video') setVideo(localStorage.getItem(KEY_VIDEO));
    localStorage.setItem(KEY_MODE, mode);
    syncPanelUI();
  }

  function syncPanelUI() {
    const btns = document.querySelectorAll('.dw-mode-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
    const imgInput = document.getElementById('dw-img-url');
    const vidInput = document.getElementById('dw-video-url');
    if (imgInput) imgInput.value = localStorage.getItem(KEY_IMG) || '';
    if (vidInput) vidInput.value = localStorage.getItem(KEY_VIDEO) || '';
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'dy-wp-panel';
    panel.className = 'hidden';
    panel.innerHTML = `
      <h3>🎨 动态壁纸</h3>
      <div class="dw-mode-grid">
        ${MODES.map(m => `<button class="dw-mode-btn" data-mode="${m}">${LABELS[m]}</button>`).join('')}
      </div>
      <div class="dw-sec">
        <label>自定义背景图</label>
        <div class="dw-url-row">
          <input id="dw-img-url" placeholder="粘贴图片链接 https://..." >
          <button class="dw-btn primary" id="dw-img-apply">应用</button>
        </div>
        <label class="dw-file">或本地上传：<input type="file" id="dw-img-file" accept="image/*" style="font-size:12px"></label>
        <div class="dw-hint">上传的图会存到本地浏览器，刷新仍保留（建议 ≤2MB，大图请用链接）</div>
      </div>
      <div class="dw-sec">
        <label>视频壁纸</label>
        <div class="dw-url-row">
          <input id="dw-video-url" placeholder="粘贴视频链接 .mp4/.webm" >
          <button class="dw-btn primary" id="dw-video-apply">应用</button>
        </div>
        <label class="dw-file">或本地上传：<input type="file" id="dw-video-file" accept="video/*" style="font-size:12px"></label>
        <div class="dw-hint">视频建议用链接（localStorage 容量有限），本地上传仅支持小文件</div>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelectorAll('.dw-mode-btn').forEach(b => {
      b.onclick = () => { applyMode(b.dataset.mode); };
    });
    document.getElementById('dw-img-apply').onclick = () => {
      const v = document.getElementById('dw-img-url').value.trim();
      if (!v) { if (UI && UI.toast) UI.toast('请输入图片链接', 'warning'); return; }
      localStorage.setItem(KEY_IMG, v);
      applyMode('image');
      if (UI && UI.toast) UI.toast('已应用自定义背景图', 'success');
    };
    document.getElementById('dw-video-apply').onclick = () => {
      const v = document.getElementById('dw-video-url').value.trim();
      if (!v) { if (UI && UI.toast) UI.toast('请输入视频链接', 'warning'); return; }
      localStorage.setItem(KEY_VIDEO, v);
      applyMode('video');
      if (UI && UI.toast) UI.toast('已应用视频壁纸', 'success');
    };
    document.getElementById('dw-img-file').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) {
        if (UI && UI.toast) UI.toast('图片过大，请用链接或压缩后上传', 'warning');
        return;
      }
      const rd = new FileReader();
      rd.onload = () => {
        localStorage.setItem(KEY_IMG, rd.result);
        applyMode('image');
        if (UI && UI.toast) UI.toast('已应用本地背景图', 'success');
      };
      rd.readAsDataURL(f);
      e.target.value = '';
    };
    document.getElementById('dw-video-file').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) {
        if (UI && UI.toast) UI.toast('视频过大，请用链接', 'warning');
        return;
      }
      const rd = new FileReader();
      rd.onload = () => {
        localStorage.setItem(KEY_VIDEO, rd.result);
        applyMode('video');
        if (UI && UI.toast) UI.toast('已应用本地视频壁纸', 'success');
      };
      rd.readAsDataURL(f);
      e.target.value = '';
    };

    /* 点面板外关闭 */
    document.addEventListener('click', e => {
      if (!panel.classList.contains('hidden') &&
          !panel.contains(e.target) && e.target.id !== 'dy-wp-btn') {
        panel.classList.add('hidden');
      }
    });
    return panel;
  }

  function togglePanel() {
    const panel = document.getElementById('dy-wp-panel');
    panel.classList.toggle('hidden');
    syncPanelUI();
  }

  function init() {
    injectCSS();
    layer = document.createElement('div');
    layer.id = 'dy-wallpaper';
    document.body.insertBefore(layer, document.body.firstChild);

    const btn = document.createElement('button');
    btn.id = 'dy-wp-btn';
    btn.title = '动态壁纸设置';
    btn.onclick = e => { e.stopPropagation(); togglePanel(); };
    document.body.appendChild(btn);

    buildPanel();

    const saved = localStorage.getItem(KEY_MODE);
    applyMode(MODES.includes(saved) ? saved : 'gradient');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
