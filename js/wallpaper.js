/* 动态壁纸模块 — 班级宠物园
 * 模式：off / gradient（渐变流动）/ particles（粒子星空）/ aurora（极光）/ custom（自定义渐变）/ image（自定义图）/ video（视频壁纸）
 * 配置按账号存数据库（app_config: wallpaper:<username>），跨设备同步；未登录用 localStorage
 * 自定义图/视频支持 URL 输入或本地上传（存 localStorage）
 */
(function () {
  const LK_MODE = 'dy_wallpaper_mode';
  const LK_IMG = 'dy_wallpaper_img';
  const LK_VIDEO = 'dy_wallpaper_video';
  const LK_CUSTOM = 'dy_wallpaper_custom';
  const API = '/backend/api.php';

  const MODES = ['off', 'gradient', 'particles', 'aurora', 'custom', 'image', 'video'];
  const LABELS = { off: '关闭', gradient: '渐变流动', particles: '粒子星空', aurora: '极光', custom: '自定义渐变', image: '自定义图片', video: '视频壁纸' };

  /* 预设多色渐变（可滚动选择） */
  const PRESETS = [
    { label: '晨光', colors: ['#ff9a9e', '#fad0c4', '#fbc2eb'] },
    { label: '海洋', colors: ['#2193b0', '#6dd5ed', '#2af598'] },
    { label: '森林', colors: ['#134e5e', '#71b280', '#b5e48c'] },
    { label: '晚霞', colors: ['#ff512f', '#dd2476', '#ff9966'] },
    { label: '星空紫', colors: ['#0f0c29', '#302b63', '#24243e'] },
    { label: '糖果', colors: ['#f6d365', '#fda085', '#fecfef'] },
    { label: '极光绿', colors: ['#00c9ff', '#92fe9d', '#a8ff78'] },
    { label: '沙漠', colors: ['#f7971e', '#ffd200', '#f2994a'] },
    { label: '葡萄', colors: ['#7b4397', '#dc2430', '#c33764'] },
    { label: '冰雪', colors: ['#83a4d4', '#b6fbff', '#e0ffff'] },
    { label: '柠檬', colors: ['#fceabb', '#f8b500', '#fff1a1'] },
    { label: '莓果', colors: ['#ee9ca7', '#ffdde1', '#fbc2eb'] },
    { label: '霓虹', colors: ['#fc00ff', '#00dbde', '#7f00ff'] },
    { label: '大地', colors: ['#8d6e63', '#a1887f', '#d7ccc8'] },
    { label: '薄荷', colors: ['#00b09b', '#96c93d', '#ccf7e9'] },
    { label: '午夜蓝', colors: ['#000428', '#004e92', '#3b5998'] },
    { label: '蜜桃', colors: ['#ffafbd', '#ffc3a0', '#ffe0ec'] },
    { label: '深海', colors: ['#005aa7', '#fffde4', '#00b4db'] },
    { label: '岩浆', colors: ['#f12711', '#f5af19', '#ff4e50'] },
    { label: '薰衣草', colors: ['#c471f5', '#fa71cd', '#e0b0ff'] },
  ];

  let layer = null;
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let particles = [];
  let currentMode = 'gradient';
  let imgEl = null;
  let videoEl = null;
  let customColors = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function getToken() {
    try { return (window.Store && Store.getToken) ? Store.getToken() : (localStorage.getItem('mc_token') || ''); } catch (e) { return ''; }
  }

  /* ── 注入 CSS ── */
  function injectCSS() {
    const css = `
#dy-wallpaper{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;overflow:hidden;background:transparent;}
#dy-wallpaper.dw-gradient{
  background:linear-gradient(125deg,#a8edea,#fed6e3,#c2e9fb,#fbc2eb,#d4fc79,#96e6a1);
  background-size:400% 400%;
  animation:dw-grad 18s ease infinite;
}
@keyframes dw-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
#dy-wallpaper.dw-custom{background-size:400% 400%;animation:dw-grad 16s ease infinite;}
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
/* 夜间模式：压暗壁纸 */
body.night-mode #dy-wallpaper{filter:brightness(.45) saturate(.8);}
body.night-mode #dy-wallpaper.dw-off{filter:none;}
/* 页面内容盖在壁纸上（内容自身背景透明） */
.page, .page.active, #page-class, body.class-page-active:not(.night-mode){
  background:transparent !important;
}
body{background-color:transparent !important;}
/* 面板 */
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
  position:fixed;right:16px;bottom:68px;z-index:9999;width:320px;max-height:82vh;overflow-y:auto;
  background:rgba(255,255,255,.97);backdrop-filter:blur(10px);
  border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.22);
  padding:16px;color:#1f2937;font-size:13px;
  transform-origin:bottom right;transition:transform .18s ease,opacity .18s ease;
}
#dy-wp-panel.hidden{transform:scale(.92);opacity:0;pointer-events:none;}
#dy-wp-panel h3{margin:0 0 10px;font-size:15px;font-weight:700;color:#111;}
.dw-mode-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;}
.dw-mode-btn{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:7px 2px;cursor:pointer;font-size:12px;color:#374151;transition:all .15s;text-align:center;}
.dw-mode-btn:hover{border-color:#8b5cf6;}
.dw-mode-btn.active{background:#8b5cf6;color:#fff;border-color:#8b5cf6;font-weight:600;}
.dw-sec{margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:10px;}
.dw-sec label{display:block;font-size:12px;color:#6b7280;margin-bottom:5px;font-weight:600;}
.dw-url-row{display:flex;gap:6px;margin-bottom:6px;}
.dw-url-row input{flex:1;border:1px solid #d1d5db;border-radius:6px;padding:6px 8px;font-size:12px;min-width:0;}
.dw-url-row input:focus{outline:none;border-color:#8b5cf6;}
.dw-btn{border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;background:#f3f4f6;color:#374151;}
.dw-btn.primary{background:#8b5cf6;color:#fff;}
.dw-btn:hover{filter:brightness(1.05);}
.dw-hint{font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.5;}
.dw-file{font-size:12px;color:#6b7280;}
/* 预设色板 */
.dw-preset-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-height:140px;overflow-y:auto;padding-right:2px;}
.dw-preset{height:34px;border-radius:8px;border:2px solid transparent;cursor:pointer;position:relative;background-size:200% 200%;}
.dw-preset.active{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.3);}
.dw-preset .pname{position:absolute;left:2px;bottom:1px;font-size:8px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);}
.dw-custom-row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;}
.dw-color-box{width:34px;height:34px;border-radius:8px;border:2px solid #d1d5db;cursor:pointer;position:relative;}
.dw-color-box input[type=color]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;}
.dw-color-box .cx{position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:#fff;font-size:10px;line-height:16px;text-align:center;cursor:pointer;}
.dw-add-color{border:2px dashed #d1d5db;border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:#6b7280;}
.dw-add-color:hover{border-color:#8b5cf6;color:#8b5cf6;}
.dw-sync-note{font-size:11px;color:#059669;margin-top:8px;}
`;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── 粒子模式 ── */
  function initParticles() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    particles = [];
    const count = Math.min(90, Math.floor(window.innerWidth / 14));
    for (let i = 0; i < count; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 + 0.6, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, a: Math.random() * 0.5 + 0.3 });
    }
    layer.appendChild(canvas);
    window.addEventListener('resize', resizeCanvas);
    animateParticles();
  }
  function resizeCanvas() { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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
        const q = particles[j], dx = p.x - q.x, dy = p.y - q.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / 110)})`; ctx.lineWidth = 0.6; ctx.stroke();
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
    videoEl.src = src; videoEl.autoplay = true; videoEl.muted = true; videoEl.loop = true; videoEl.playsInline = true;
    videoEl.onerror = () => { if (UI && UI.toast) UI.toast('视频加载失败，请检查地址', 'error'); };
    videoEl.play().catch(() => {});
    layer.appendChild(videoEl);
  }
  function clearCustom() {
    if (imgEl && imgEl.parentNode) imgEl.parentNode.removeChild(imgEl);
    if (videoEl && videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    if (videoEl) { videoEl.pause(); videoEl.src = ''; }
    imgEl = null; videoEl = null;
  }

  /* ── 应用模式 ── */
  function applyMode(mode) {
    currentMode = mode;
    if (!layer) return;
    layer.className = '';
    stopParticles(); clearCustom();
    if (mode === 'off') layer.classList.add('dw-off');
    else if (mode === 'gradient') layer.classList.add('dw-gradient');
    else if (mode === 'custom') { layer.classList.add('dw-custom'); applyCustomBg(); }
    else if (mode === 'aurora') layer.classList.add('dw-aurora');
    else if (mode === 'particles') { layer.classList.add('dw-particles'); initParticles(); }
    else if (mode === 'image') setImage(localStorage.getItem(LK_IMG));
    else if (mode === 'video') setVideo(localStorage.getItem(LK_VIDEO));
    syncPanelUI();
  }

  function applyCustomBg() {
    const cols = customColors.length ? customColors : ['#a8edea', '#fed6e3'];
    layer.style.background = 'linear-gradient(125deg,' + cols.join(',') + ')';
  }

  /* ── 读取/保存配置（数据库按账号同步 + localStorage 兜底）── */
  function loadConfig() {
    const saved = localStorage.getItem(LK_MODE);
    currentMode = MODES.includes(saved) ? saved : 'gradient';
    try { const c = JSON.parse(localStorage.getItem(LK_CUSTOM) || '[]'); if (Array.isArray(c) && c.length) customColors = c; } catch (e) {}
    // 从数据库拉账号配置
    const token = getToken();
    if (token) {
      fetch(API + '?action=getWallpaper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(r => r.json()).then(j => {
          if (j.ok && j.wp) {
            if (j.wp.mode) { currentMode = MODES.includes(j.wp.mode) ? j.wp.mode : currentMode; localStorage.setItem(LK_MODE, currentMode); }
            if (Array.isArray(j.wp.colors) && j.wp.colors.length) { customColors = j.wp.colors; localStorage.setItem(LK_CUSTOM, JSON.stringify(customColors)); }
            if (j.wp.img) localStorage.setItem(LK_IMG, j.wp.img);
            if (j.wp.video) localStorage.setItem(LK_VIDEO, j.wp.video);
            applyMode(currentMode);
          }
        }).catch(() => {});
    }
  }

  function persistConfig() {
    localStorage.setItem(LK_MODE, currentMode);
    localStorage.setItem(LK_CUSTOM, JSON.stringify(customColors));
    const token = getToken();
    if (!token) return;
    const wp = {
      mode: currentMode,
      colors: customColors,
      img: localStorage.getItem(LK_IMG) || '',
      video: localStorage.getItem(LK_VIDEO) || '',
    };
    fetch(API + '?action=saveWallpaper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, wp }) })
      .then(r => r.json()).then(j => {
        if (j.ok) { const n = document.getElementById('dw-sync-note'); if (n) { n.textContent = '✓ 已同步到账号，其他设备登录同账号自动应用'; setTimeout(() => { n.textContent = ''; }, 2500); } }
      }).catch(() => {});
  }

  /* ── 面板 UI ── */
  function syncPanelUI() {
    const btns = document.querySelectorAll('.dw-mode-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
    const imgInput = document.getElementById('dw-img-url');
    const vidInput = document.getElementById('dw-video-url');
    if (imgInput) imgInput.value = localStorage.getItem(LK_IMG) || '';
    if (vidInput) vidInput.value = localStorage.getItem(LK_VIDEO) || '';
    // 预设高亮
    document.querySelectorAll('.dw-preset').forEach(el => {
      const idx = Number(el.dataset.idx);
      const active = customColors.length && el.dataset.hex === JSON.stringify(customColors);
      el.classList.toggle('active', !!active);
    });
    renderColorBoxes();
  }

  function renderColorBoxes() {
    const box = document.getElementById('dw-color-list');
    if (!box) return;
    box.innerHTML = '';
    customColors.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'dw-color-box';
      d.style.background = c;
      d.innerHTML = '<input type="color" value="' + esc(c) + '"><span class="cx" data-rm="' + i + '">×</span>';
      d.querySelector('input').onchange = e => {
        customColors[i] = e.target.value;
        if (currentMode === 'custom') applyCustomBg();
        persistConfig();
      };
      d.querySelector('.cx').onclick = () => { customColors.splice(i, 1); if (!customColors.length) customColors = ['#a8edea', '#fed6e3']; if (currentMode === 'custom') applyCustomBg(); persistConfig(); };
      box.appendChild(d);
    });
    const add = document.createElement('div');
    add.className = 'dw-add-color'; add.textContent = '+';
    add.onclick = () => { customColors.push('#8b5cf6'); if (currentMode === 'custom') applyCustomBg(); persistConfig(); };
    box.appendChild(add);
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'dy-wp-panel';
    panel.className = 'hidden';
    const presetHtml = PRESETS.map((p, i) =>
      '<div class="dw-preset" data-idx="' + i + '" data-hex="' + esc(JSON.stringify(p.colors)) + '" style="background:linear-gradient(135deg,' + p.colors.join(',') + ')"><span class="pname">' + esc(p.label) + '</span></div>'
    ).join('');
    panel.innerHTML = `
      <h3>🎨 动态壁纸 <span id="dw-sync-note" class="dw-sync-note"></span></h3>
      <div class="dw-mode-grid">
        ${MODES.map(m => `<button class="dw-mode-btn" data-mode="${m}">${LABELS[m]}</button>`).join('')}
      </div>
      <div class="dw-sec">
        <label>选择颜色（可滚动查看更多）</label>
        <div class="dw-preset-grid">${presetHtml}</div>
        <div class="dw-custom-row" id="dw-color-list"></div>
        <div class="dw-hint">点击色块改色、点 × 删除、点 + 添加；下方「自定义渐变」即用所选颜色</div>
      </div>
      <div class="dw-sec">
        <label>自定义背景图</label>
        <div class="dw-url-row">
          <input id="dw-img-url" placeholder="粘贴图片链接 https://..." >
          <button class="dw-btn primary" id="dw-img-apply">应用</button>
        </div>
        <label class="dw-file">或本地上传：<input type="file" id="dw-img-file" accept="image/*" style="font-size:12px"></label>
      </div>
      <div class="dw-sec">
        <label>视频壁纸（存账号，跨设备生效，不限大小，用链接）</label>
        <div class="dw-url-row">
          <input id="dw-video-url" placeholder="粘贴视频链接 .mp4/.webm" >
          <button class="dw-btn primary" id="dw-video-apply">应用</button>
        </div>
        <label class="dw-file">或本地上传：<input type="file" id="dw-video-file" accept="video/*" style="font-size:12px"></label>
        <div class="dw-hint">视频建议用链接（localStorage 容量有限）；设置存数据库，另一台设备登录同账号自动同步</div>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelectorAll('.dw-mode-btn').forEach(b => { b.onclick = () => { applyMode(b.dataset.mode); persistConfig(); }; });
    panel.querySelectorAll('.dw-preset').forEach(el => {
      el.onclick = () => { customColors = JSON.parse(el.dataset.hex); if (currentMode === 'custom' || true) applyMode('custom'); persistConfig(); };
    });

    document.getElementById('dw-img-apply').onclick = () => {
      const v = document.getElementById('dw-img-url').value.trim();
      if (!v) { if (UI && UI.toast) UI.toast('请输入图片链接', 'warning'); return; }
      localStorage.setItem(LK_IMG, v); applyMode('image'); persistConfig();
      if (UI && UI.toast) UI.toast('已应用自定义背景图并同步', 'success');
    };
    document.getElementById('dw-video-apply').onclick = () => {
      const v = document.getElementById('dw-video-url').value.trim();
      if (!v) { if (UI && UI.toast) UI.toast('请输入视频链接', 'warning'); return; }
      localStorage.setItem(LK_VIDEO, v); applyMode('video'); persistConfig();
      if (UI && UI.toast) UI.toast('已应用视频壁纸并同步', 'success');
    };
    document.getElementById('dw-img-file').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { if (UI && UI.toast) UI.toast('图片过大，请用链接或压缩后上传', 'warning'); return; }
      const rd = new FileReader();
      rd.onload = () => { localStorage.setItem(LK_IMG, rd.result); applyMode('image'); persistConfig(); if (UI && UI.toast) UI.toast('已应用本地背景图', 'success'); };
      rd.readAsDataURL(f); e.target.value = '';
    };
    document.getElementById('dw-video-file').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 4 * 1024 * 1024) { if (UI && UI.toast) UI.toast('视频过大，请用链接（可存账号不限大小）', 'warning'); return; }
      const rd = new FileReader();
      rd.onload = () => { localStorage.setItem(LK_VIDEO, rd.result); applyMode('video'); persistConfig(); if (UI && UI.toast) UI.toast('已应用本地视频壁纸', 'success'); };
      rd.readAsDataURL(f); e.target.value = '';
    };

    document.addEventListener('click', e => {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target.id !== 'dy-wp-btn') panel.classList.add('hidden');
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
    btn.id = 'dy-wp-btn'; btn.title = '动态壁纸设置';
    btn.onclick = e => { e.stopPropagation(); togglePanel(); };
    document.body.appendChild(btn);

    buildPanel();
    loadConfig();
    applyMode(currentMode);
    // 登录后重新拉取账号配置
    const tryApplyAfterLogin = () => {
      if (getToken()) { loadConfig(); clearInterval(_loginTimer); }
    };
    const _loginTimer = setInterval(tryApplyAfterLogin, 2000);
    setTimeout(() => clearInterval(_loginTimer), 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
