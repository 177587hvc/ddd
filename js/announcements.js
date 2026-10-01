/* ═══════════════════════════════════════════════════════
   Remote Announcement Module (隔空喊话)
   Handles polling, displaying popups, and TTS reading.
   ═══════════════════════════════════════════════════════ */

const Announcements = (() => {
  let _pollTimer = null;
  let _isPolling = false;
  let _speechUnlocked = false;
  let _keepAliveAudio = null; // 后台保活用的静音循环音频
  let _sharedAudioCtx = null; // 共享 AudioContext，便于每次播报前 resume

  /** 创建/启动一个静音循环音频，保持标签在后台仍有音频活跃，
   *  这样浏览器不会暂停 speechSynthesis 与 AudioContext，实现最小化后仍能播报。 */
  function _ensureKeepAliveAudio() {
    if (_keepAliveAudio) {
      try { _keepAliveAudio.play().catch(() => {}); } catch (_) {}
      return;
    }
    try {
      const audio = document.createElement('audio');
      audio.loop = true;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.preload = 'auto';
      audio.volume = 0.0001; // 近乎静音，但保持“正在播放音频”的状态
      // 一段极短的合法 WAV 静音（约 0.05 秒），base64 内联，避免外部依赖
      audio.src = 'data:audio/wav;base64,UklGRlIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YS4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
      audio.style.display = 'none';
      document.body.appendChild(audio);
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      _keepAliveAudio = audio;
    } catch (_) {}
  }

  function _ensureSharedAudioCtx() {
    if (_sharedAudioCtx) return _sharedAudioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _sharedAudioCtx = new AC();
    } catch (_) {}
    return _sharedAudioCtx;
  }

  function _unlockSpeech() {
    if (_speechUnlocked || !window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance('');
    msg.volume = 0;
    window.speechSynthesis.speak(msg);
    // 用户交互中同步启动静音音频与 AudioContext，规避后台受限
    _ensureKeepAliveAudio();
    const ctx = _ensureSharedAudioCtx();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
    _speechUnlocked = true;
    document.removeEventListener('click', _unlockSpeech);
    document.removeEventListener('touchstart', _unlockSpeech);
  }

  function init() {
    document.addEventListener('click', _unlockSpeech);
    document.addEventListener('touchstart', _unlockSpeech);
    // 页面可见性变化时，尝试恢复音频/语音调度，保证从后台切回或后台唤醒后仍能播报
    document.addEventListener('visibilitychange', () => {
      try {
        if (_keepAliveAudio && _keepAliveAudio.paused) _keepAliveAudio.play().catch(() => {});
        if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') _sharedAudioCtx.resume();
        if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch (_) {}
    });
    startPolling();
    _injectStyles();
  }

  function startPolling() {
    if (_isPolling) return;
    _isPolling = true;
    _poll();
  }

  async function _poll() {
    if (!_isPolling) return;
    const token = Store.getToken();
    if (!token) {
      setTimeout(_poll, 10000); // Wait longer if not logged in
      return;
    }

    try {
      const res = await fetch(Store.API + '?action=pollAnnouncements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.ok && data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          const times = Math.max(1, parseInt(msg.repeat_count, 10) || 1);
          showPopup(msg.content, times);
        });
      }
    } catch (e) { console.error('Poll failed:', e); }

    _pollTimer = setTimeout(_poll, 5000); // Check every 5 seconds
  }

  function showPopup(content, repeatCount = 1) {
    const overlay = document.createElement('div');
    overlay.className = 'ra-overlay';
    const times = Math.max(1, parseInt(repeatCount, 10) || 1);
    overlay.innerHTML = `
      <div class="ra-modal">
        <div class="ra-header">📢 隔空喊话</div>
        <div class="ra-body">${content}</div>
        ${times > 1 ? `<div class="ra-repeat-hint">语音将播报 ${times} 次</div>` : ''}
        <button class="ra-close">我知道了</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.ra-close');
    closeBtn.onclick = () => {
      // 关闭弹窗时中止未播完的循环播报
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    };

    // Text to Speech
    speak(content, times);
  }

  function _playAttentionTone() {
    // 用 Web Audio 播放一个短促、较响的提示音，弥补 speechSynthesis 音量无法超过 1.0 的限制
    // 复用共享 AudioContext，避免每次 new 出的实例在后台被立即挂起
    try {
      const ctx = _ensureSharedAudioCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  function speak(text, repeatCount = 1) {
    if (!window.speechSynthesis) return;
    // 确保静音保活音频和 AudioContext 处于播放/运行状态，
    // 即使 B 设备浏览器最小化或切到后台也能继续播报
    _ensureKeepAliveAudio();
    if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
      try { _sharedAudioCtx.resume(); } catch (_) {}
    }
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch (_) {}
    window.speechSynthesis.cancel(); // Stop current speech
    const times = Math.max(1, parseInt(repeatCount, 10) || 1);
    // 播报前先播放提示音，抬升整体感知音量
    _playAttentionTone();
    for (let i = 0; i < times; i++) {
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'zh-CN';
      msg.rate = 1.0;
      msg.pitch = 1.0;
      msg.volume = 1.0; // Web Speech API 支持的最大音量
      window.speechSynthesis.speak(msg);
    }
  }

  async function shout(content, repeatCount = 1) {
    const token = Store.getToken();
    if (!token) return { ok: false, msg: '未登录' };
    let repeat = parseInt(repeatCount, 10) || 1;
    if (repeat < 1) repeat = 1;
    if (repeat > 20) repeat = 20;
    try {
      const res = await fetch(Store.API + '?action=sendAnnouncement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, content, repeatCount: repeat })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, msg: '网络请求失败' };
    }
  }

  function openShoutModal() {
    if (document.getElementById('ra-input-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ra-input-overlay';
    overlay.className = 'ra-overlay';
    overlay.innerHTML = `
      <div class="ra-modal" style="padding: 25px;">
        <div class="ra-header" style="font-size: 1.3rem; margin-bottom: 15px;">📢 发送隔空喊话</div>
        <input type="text" id="ra-input-text" style="width: 100%; border: 2px solid #e2e8f0; padding: 12px 15px; border-radius: 12px; font-size: 1.05rem; margin-bottom: 14px; outline: none; transition: border 0.2s; box-sizing: border-box;" placeholder="请输入对教室喊话的内容..." autocomplete="off">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 20px;">
          <label for="ra-input-repeat" style="font-size: 0.95rem; color: #334155; font-weight: 600;">语音循环次数</label>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" id="ra-repeat-minus" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">−</button>
            <input type="number" id="ra-input-repeat" min="1" max="20" value="1" style="width: 60px; text-align: center; border: 2px solid #e2e8f0; padding: 6px 4px; border-radius: 8px; font-size: 1rem; outline: none;">
            <button type="button" id="ra-repeat-plus" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">+</button>
          </div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="ra-close" id="ra-input-cancel" style="background: #94a3b8; box-shadow: none; flex: 1;">取消</button>
          <button class="ra-close" id="ra-input-send" style="flex: 1;">发送</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('ra-input-text');
    input.focus();

    input.addEventListener('focus', () => input.style.borderColor = '#3b82f6');
    input.addEventListener('blur', () => input.style.borderColor = '#e2e8f0');

    const closeOverlay = () => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    };

    document.getElementById('ra-input-cancel').onclick = closeOverlay;

    const repeatInput = document.getElementById('ra-input-repeat');
    const clampRepeat = () => {
      let v = parseInt(repeatInput.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 20) v = 20;
      repeatInput.value = v;
      return v;
    };
    repeatInput.addEventListener('change', clampRepeat);
    repeatInput.addEventListener('blur', clampRepeat);
    document.getElementById('ra-repeat-minus').onclick = () => {
      repeatInput.value = Math.max(1, (parseInt(repeatInput.value, 10) || 1) - 1);
      clampRepeat();
    };
    document.getElementById('ra-repeat-plus').onclick = () => {
      repeatInput.value = Math.min(20, (parseInt(repeatInput.value, 10) || 1) + 1);
      clampRepeat();
    };

    const send = async () => {
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      const times = clampRepeat();
      closeOverlay();

      try {
        const res = await shout(text, times);
        if (res.ok) {
          if (typeof UI !== 'undefined') UI.toast('📢 喊话已发送', 'success');
        } else {
          if (typeof UI !== 'undefined') UI.toast('❌ 发送失败：' + res.msg, 'error');
        }
      } catch (e) {
        console.error(e);
        if (typeof UI !== 'undefined') UI.toast('❌ 发生错误，请重试', 'error');
      }
    };

    document.getElementById('ra-input-send').onclick = send;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') send();
      if (e.key === 'Escape') closeOverlay();
    };
  }

  function _injectStyles() {
    if (document.getElementById('ra-styles')) return;
    const style = document.createElement('style');
    style.id = 'ra-styles';
    style.textContent = `
      .ra-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
        z-index: 200000; display: flex; align-items: center; justify-content: center;
        animation: ra-fade-in 0.4s ease-out;
      }
      .ra-modal {
        background: #ffffff; border-radius: 24px; width: 90%; max-width: 400px; padding: 30px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.3); border: 2px solid #3b82f6;
        text-align: center; transform: scale(1); transition: 0.3s;
        box-sizing: border-box;
      }
      .ra-header { font-size: 1.5rem; font-weight: 900; color: #1e3a8a; margin-bottom: 20px; }
      .ra-body { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.6; margin-bottom: 25px; }
      .ra-close {
        background: #3b82f6; color: white; border: none; padding: 12px 30px;
        border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }
      .ra-overlay.fade-out { opacity: 0; pointer-events: none; }
      @keyframes ra-fade-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(style);
  }

  return { init, shout, speak, openShoutModal };
})();
