/* ═══════════════════════ AUDIO-CHALLENGE.JS ═══════════════════════
   Star Tree Challenge (V13 - Mode Identification Fix)
   Correctly handling 'silence' mode and differentiating UI.
═══════════════════════════════════════════════════════════════════ */

const AudioChallenge = (() => {

  let _stream = null;
  let _audioCtx = null;
  let _analyser = null;
  let _dataArray = null;
  let _rafId = null;

  let _mode = 'reading';
  let _isActive = false;
  let _isPaused = false;
  let _modalEl = null;

  // Settings
  let _sensitivity = 50;
  let _threshold = 40;
  let _rewardMinutes = 5;
  let _rewardPoints = 2;
  let _toleranceSec = 3;

  let _rewardEnabled = true;
  let _autoAddPoints = false;
  let _timerStartTime = null;
  let _accumulatedTime = 0;
  let _failStartTime = null;

  let _treeGrowth = 0;

  function init() { }

  function openModal(mode) {
    if (_isActive) return;

    // Basic support checks
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.toast('您的设备或浏览器不支持麦克风访问，无法开启挑战', 'error');
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      UI.toast('您的浏览器不支持音频处理，无法开启挑战', 'error');
      return;
    }

    // Map 'silence' (from class-view.js) or 'quiet' to our internal mode
    _mode = (mode === 'silence' || mode === 'quiet') ? 'quiet' : 'reading';

    _isActive = true;
    _isPaused = false;
    _accumulatedTime = 0;
    _timerStartTime = null;
    _failStartTime = null;
    _treeGrowth = 0;

    // Quiet mode defaults to a stricter threshold
    if (_mode === 'quiet') _threshold = 20;
    else _threshold = 40;

    _renderModal();
    _startAudio().catch(e => {
      console.error('AudioChallenge startup failed:', e);
    });
  }

  function _renderModal() {
    _modalEl = document.createElement('div');
    _modalEl.id = 'ac-v13-overlay';

    const isQuiet = _mode === 'quiet';
    const modeTitle = isQuiet ? '静音挑战模式' : '朗读挑战模式';
    const modeIcon = isQuiet ? '🤫' : '📖';
    const goalText = isQuiet ? '保持安静树木就会长大' : '放声朗读树木就会长大';
    const themeColor = isQuiet ? '#8b5cf6' : '#3b82f6'; // Purple for Quiet, Blue for Reading

    if (!document.getElementById('ac-v13-styles')) {
      const style = document.createElement('style');
      style.id = 'ac-v13-styles';
      style.textContent = `
        #ac-v13-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.75);
          z-index: 100000; display: flex; align-items: center; justify-content: center;
        }
        @supports (backdrop-filter: blur(8px)) {
          #ac-v13-overlay { backdrop-filter: blur(8px); background: rgba(0,0,0,0.5); }
        }
      .ac-v13-modal {
        background: #ffffff; width: 95%; max-width: 1100px; height: 90vh; max-height: 700px;
        border-radius: 24px; display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 30px 80px rgba(0,0,0,0.3); border: 1px solid #f1f5f9;
      }
      .ac-v13-left { flex: 0 0 35%; min-height: 200px; background: #f8fafc; position: relative; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .ac-v13-right { width: 100%; flex: 1; background: #ffffff; display: flex; flex-direction: column; overflow: hidden; }
      
      @media (min-width: 768px) {
        .ac-v13-modal { flex-direction: row; height: 640px; max-height: 95vh; border-radius: 40px; }
        .ac-v13-left { flex: 1; border-bottom: none; border-right: 1px solid #f1f5f9; }
        .ac-v13-right { width: 380px; flex: none; }
      }
      
      .ac-v13-sidebar-scroll { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
      
      .ac-v13-card { background: #f8fafc; border-radius: 20px; padding: 18px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 12px; }
      .ac-v13-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; font-weight: 800; color: #475569; }
      
      .ac-v13-slider-wrap { display: flex; align-items: center; gap: 10px; flex: 1; }
      .ac-v13-slider-wrap input { flex: 1; height: 6px; accent-color: ${themeColor}; cursor: pointer; }
      .ac-v13-val { width: 32px; font-family: monospace; font-weight: 900; }
      .ac-v13-val.blue { color: ${themeColor}; }
      .ac-v13-val.orange { color: #f59e0b; }
      
      .ac-v13-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
      .ac-v13-switch input { opacity: 0; width: 0; height: 0; }
      .ac-v13-slider-track { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; border-radius: 24px; transition: .3s; cursor: pointer; }
      .ac-v13-slider-track:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
      .ac-v13-switch input:checked + .ac-v13-slider-track { background: ${themeColor}; }
      .ac-v13-switch input:checked + .ac-v13-slider-track:before { transform: translateX(20px); }
      
      .ac-v13-num-input { background: #fff; border: 2px solid #e2e8f0; border-radius: 10px; width: 65px; height: 38px; text-align: center; font-weight: 900; font-size: 16px; color: #1e293b; }
      .ac-v13-num-input.orange { border-color: #fed7aa; color: #f59e0b; background: #fffcf9; }
      
      .ac-v13-footer { padding: 15px 20px; border-top: 1px solid #f1f5f9; background: #ffffff; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
      .ac-v13-timer-box { background: #1e293b; color: #ffffff; padding: 12px; border-radius: 16px; text-align: center; font-family: monospace; font-weight: 900; font-size: 2rem; letter-spacing: 2px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
      .ac-v13-btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .ac-v13-btn { border: none; padding: 14px; border-radius: 16px; font-weight: 800; font-size: 15px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 0 rgba(0,0,0,0.1); }
      .ac-v13-btn.gray { background: #f1f5f9; color: #475569; border-bottom: 4px solid #cbd5e1; }
      .ac-v13-btn.gray.active { background: #f59e0b; color: white; border-bottom: 4px solid #b45309; }
      .ac-v13-btn.red { background: #fee2e2; color: #ef4444; border-bottom: 4px solid #fecaca; }
      .ac-v13-btn:active { transform: translateY(4px); border-bottom-width: 0; }
      
      .ac-v13-header { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; background: ${isQuiet ? '#faf5ff' : '#f0f9ff'}; flex-shrink: 0; }
      .ac-v13-header h2 { margin: 0; font-size: 1.2rem; font-weight: 900; color: ${isQuiet ? '#6b21a8' : '#1e3a8a'}; }
      .ac-v13-close-btn { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: #64748b; font-weight: bold; }
      
      .ac-v13-growth-label { position: absolute; top: 15px; left: 15px; background: white; padding: 6px 16px; border-radius: 16px; font-weight: 900; color: #475569; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.08); z-index: 10; font-size: 0.85rem; }
      
      .ac-v13-hint { position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); font-weight: 800; color: ${isQuiet ? '#8b5cf6' : '#3b82f6'}; font-size: 14px; background: white; padding: 4px 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); white-space: nowrap; }
      
      /* Noise Warning Indicator */
      .ac-v13-noise-alert { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); background: #fee2e2; color: #ef4444; padding: 8px 20px; border-radius: 30px; font-weight: 900; font-size: 14px; opacity: 0; transition: 0.2s; pointer-events: none; border: 2px solid #ef4444; }
      .ac-v13-noise-alert.show { opacity: 1; transform: translateX(-50%) translateY(10px); }
      
      .ac-v13-rules-card { background: ${isQuiet ? '#f5f3ff' : '#eff6ff'}; border: 1px dashed ${themeColor}; border-radius: 16px; padding: 12px; margin-bottom: 5px; }
      .ac-v13-rules-card h3 { margin: 0 0 8px 0; font-size: 14px; color: ${themeColor}; display: flex; align-items: center; gap: 6px; }
      .ac-v13-rules-card ul { margin: 0; padding-left: 18px; font-size: 12px; color: #4b5563; line-height: 1.6; }
      
      .ac-v13-header-btns { display: flex; gap: 8px; align-items: center; }
      .ac-v13-help-btn { background: #fff; border: 1px solid #e2e8f0; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: ${themeColor}; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
      .ac-v13-help-btn:hover { background: ${themeColor}; color: #fff; border-color: ${themeColor}; }
    `;
      document.head.appendChild(style);
    }

    _modalEl.innerHTML = `
      <div class="ac-v13-modal">
        <!-- Tree View (Left) -->
        <div class="ac-v13-left">
          <div class="ac-v13-growth-label">成长值: <span id="ac-v13-growth-val">0</span>%</div>
          <div class="ac-v13-noise-alert" id="ac-v13-noise-warn">⚠️ 太吵啦！树木停止生长</div>
          <div class="ac-v13-hint">${goalText}</div>
          <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMax meet" style="height:90%; overflow:visible;">
            <defs>
              <linearGradient id="v13-trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#3e2723" />
                <stop offset="100%" style="stop-color:#5d4037" />
              </linearGradient>
              <symbol id="v13-star-icon" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </symbol>
            </defs>
            <ellipse cx="50" cy="115" rx="30" ry="4" fill="#f1f5f9" />
            <path id="v13-trunk" d="M50,115 Q52,95 50,85" stroke="url(#v13-trunkGrad)" stroke-width="0" stroke-linecap="round" fill="none" />
            <g id="v13-canopy"></g>
            <g id="v13-cloud" opacity="0">
               <ellipse cx="50" cy="25" rx="15" ry="8" fill="#f8fafc" />
               <circle cx="42" cy="25" r="7" fill="#f8fafc" />
               <circle cx="58" cy="25" r="7" fill="#f8fafc" />
            </g>
            <g id="v13-stars"></g>
          </svg>
        </div>

        <!-- Control Sidebar (Right) -->
        <div class="ac-v13-right">
          <div class="ac-v13-header">
            <h2>${modeIcon} ${modeTitle}</h2>
            <div class="ac-v13-header-btns">
              <button class="ac-v13-help-btn" id="ac-v13-help-btn" title="查看使用说明">?</button>
              <button class="ac-v13-close-btn" id="ac-v13-corner-close">✕</button>
            </div>
          </div>

          <div class="ac-v13-sidebar-scroll">
            <!-- Rules Card -->
            <div class="ac-v13-rules-card" id="ac-v13-rules-card">
              <h3><span style="font-size:1.1rem;">💡</span> 使用说明</h3>
              <ul>
                ${isQuiet 
                  ? `<li><strong>目标：</strong>保持教室内安静。</li>
                     <li><strong>生长：</strong>声音低于“上限”时，树木稳步生长。</li>
                     <li><strong>惩罚：</strong>声音过大时，树木停止生长并变黄。</li>`
                  : `<li><strong>目标：</strong>鼓励学生放声朗读。</li>
                     <li><strong>生长：</strong>声音超过“阈值”时，树木快速生长。</li>
                     <li><strong>规则：</strong>计时器记录累计达到目标的时长。</li>`
                }
                <li><strong>加分：</strong>累计成功达到设定时长后，自动为全班学生加分。</li>
              </ul>
            </div>

            <!-- Monitoring Sliders -->
            <div class="ac-v13-card">
              <div class="ac-v13-row">
                <span style="width:60px;">灵敏度</span>
                <div class="ac-v13-slider-wrap">
                  <input type="range" id="ac-v13-sens-slider" min="1" max="100" value="${_sensitivity}">
                  <span class="ac-v13-val blue" id="ac-v13-sens-val">${_sensitivity}</span>
                </div>
              </div>
              <div class="ac-v13-row">
                <span style="width:60px;">${isQuiet ? '噪音上限' : '监测阈值'}</span>
                <div class="ac-v13-slider-wrap">
                  <input type="range" id="ac-v13-thresh-slider" min="5" max="95" value="${_threshold}">
                  <span class="ac-v13-val orange" id="ac-v13-thresh-val">${_threshold}</span>
                </div>
              </div>
            </div>

            <!-- Toggle Switches -->
            <div class="ac-v13-card">
              <div class="ac-v13-row">
                <span>开启奖励模式</span>
                <label class="ac-v13-switch">
                  <input type="checkbox" id="ac-v13-reward-toggle" checked>
                  <span class="ac-v13-slider-track"></span>
                </label>
              </div>
              <div class="ac-v13-row">
                <span>挑战自动加分</span>
                <label class="ac-v13-switch">
                  <input type="checkbox" id="ac-v13-auto-toggle">
                  <span class="ac-v13-slider-track"></span>
                </label>
              </div>
            </div>

            <!-- Parameters Inputs -->
            <div class="ac-v13-card">
              <div class="ac-v13-row">
                <span>挑战时长</span>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="number" id="ac-v13-reward-mins" value="${_rewardMinutes}" class="ac-v13-num-input">
                  <span>分钟</span>
                </div>
              </div>
              <div class="ac-v13-row">
                <span>容错宽容</span>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="number" id="ac-v13-tolerance-sec" value="${_toleranceSec}" class="ac-v13-num-input orange">
                  <span>秒</span>
                </div>
              </div>
              <div class="ac-v13-row">
                <span>挑战加分</span>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="number" id="ac-v13-reward-pts" value="${_rewardPoints}" class="ac-v13-num-input orange">
                  <span>分</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Actions (Fixed) -->
          <div class="ac-v13-footer">
            <div class="ac-v13-timer-box" id="ac-v13-timer">00:00</div>
            <div class="ac-v13-btn-group">
              <button class="ac-v13-btn gray" id="ac-v13-pause-btn">暂停监测</button>
              <button class="ac-v13-btn red" id="ac-v13-close-btn">停止挑战</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(_modalEl);

    // Event Binding
    document.getElementById('ac-v13-close-btn').onclick = _closeModal;
    document.getElementById('ac-v13-corner-close').onclick = _closeModal;
    
    const helpBtn = document.getElementById('ac-v13-help-btn');
    const rulesCard = document.getElementById('ac-v13-rules-card');
    
    // Set initial active state for help button (since card is visible by default)
    helpBtn.style.background = themeColor;
    helpBtn.style.color = '#fff';

    helpBtn.onclick = () => {
      const isVisible = rulesCard.style.display !== 'none';
      rulesCard.style.display = isVisible ? 'none' : 'block';
      helpBtn.style.background = isVisible ? '#fff' : themeColor;
      helpBtn.style.color = isVisible ? themeColor : '#fff';
    };

    document.getElementById('ac-v13-pause-btn').onclick = () => {
      _isPaused = !_isPaused;
      const btn = document.getElementById('ac-v13-pause-btn');
      btn.textContent = _isPaused ? '恢复监测' : '暂停监测';
      btn.classList.toggle('active', _isPaused);
    };

    document.getElementById('ac-v13-sens-slider').oninput = (e) => {
      _sensitivity = Number(e.target.value);
      document.getElementById('ac-v13-sens-val').textContent = _sensitivity;
    };
    document.getElementById('ac-v13-thresh-slider').oninput = (e) => {
      _threshold = Number(e.target.value);
      document.getElementById('ac-v13-thresh-val').textContent = _threshold;
    };

    document.getElementById('ac-v13-reward-toggle').onchange = (e) => _rewardEnabled = e.target.checked;
    document.getElementById('ac-v13-auto-toggle').onchange = (e) => _autoAddPoints = e.target.checked;
    document.getElementById('ac-v13-reward-mins').oninput = (e) => _rewardMinutes = Number(e.target.value) || 1;
    document.getElementById('ac-v13-tolerance-sec').oninput = (e) => _toleranceSec = Number(e.target.value) || 0;
    document.getElementById('ac-v13-reward-pts').oninput = (e) => _rewardPoints = Number(e.target.value) || 1;

    _generateTreeData();
  }

  let _leafData = [];
  let _starData = [];

  function _generateTreeData() {
    _leafData = [
      { cx: 50, cy: 80, r: 13 }, { cx: 40, cy: 85, r: 11 }, { cx: 60, cy: 85, r: 11 },
      { cx: 35, cy: 75, r: 12 }, { cx: 65, cy: 75, r: 12 }, { cx: 50, cy: 65, r: 14 },
      { cx: 42, cy: 60, r: 10 }, { cx: 58, cy: 60, r: 10 }, { cx: 50, cy: 55, r: 11 }
    ];
    const colors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#a855f7'];
    _starData = [];
    for (let i = 0; i < 20; i++) {
      _starData.push({
        x: 25 + Math.random() * 50,
        y: 45 + Math.random() * 50,
        s: 4 + Math.random() * 2,
        c: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 30
      });
    }
  }

  function _closeModal() {
    _isActive = false; _stopAudio();
    if (_modalEl) { _modalEl.remove(); _modalEl = null; }
  }

  async function _startAudio() {
    try {
      // 1. Get Stream
      _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Create Context with compatibility fallbacks
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('NOT_SUPPORTED');
      
      // Try with common sample rate to avoid some Windows driver issues
      try {
        _audioCtx = new AudioContext({ sampleRate: 44100 });
      } catch (e) {
        _audioCtx = new AudioContext();
      }
      
      // 3. Handle suspended state (required for Chrome/Safari)
      if (_audioCtx.state === 'suspended') {
        await _audioCtx.resume();
      }

      // 4. Setup Analyser
      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;
      _analyser.smoothingTimeConstant = 0.3; // Make meter smoother
      
      const source = _audioCtx.createMediaStreamSource(_stream);
      source.connect(_analyser);
      
      _dataArray = new Uint8Array(_analyser.frequencyBinCount);
      _rafId = requestAnimationFrame(_loop);
      
      // Hide error state if any
      const errEl = document.getElementById('ac-v13-error-msg');
      if (errEl) errEl.style.display = 'none';
      
    } catch (e) {
      console.error('AudioChallenge error:', e);
      let msg = '无法启动麦克风，请检查权限设置';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = '麦克风权限被拒绝，请在浏览器设置中开启并刷新页面';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        msg = '未找到麦克风设备，请连接麦克风后重试';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        msg = '麦克风被占用或硬件故障，请关闭其他使用麦克风的程序';
      } else if (e.message === 'NOT_SUPPORTED') {
        msg = '您的浏览器不支持音频处理，请尝试使用最新版 Chrome 浏览器';
      }
      
      // Display error inside modal instead of closing immediately (avoids "flash and quit")
      const timerEl = document.getElementById('ac-v13-timer');
      if (timerEl) {
        timerEl.innerHTML = '<span style="font-size:0.8rem; color:#ef4444; line-height:1.2; display:block; padding:5px;">⚠️ ' + msg + '</span>';
        timerEl.style.background = '#fee2e2';
      }
      UI.toast(msg, 'error');
      // We don't call _closeModal() here to let the user see the error
    }
  }

  function _stopAudio() {
    if (_rafId) cancelAnimationFrame(_rafId);
    if (_audioCtx) {
      try { _audioCtx.close(); } catch (e) { }
      _audioCtx = null;
    }
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    _analyser = null;
    _dataArray = null;
  }

  function _loop(timestamp) {
    if (!_isActive) return;
    if (_isPaused) { _rafId = requestAnimationFrame(_loop); return; }

    if (!_analyser || !_dataArray) {
      _rafId = requestAnimationFrame(_loop);
      return;
    }

    _analyser.getByteFrequencyData(_dataArray);
    let sum = 0; for (let i = 0; i < _dataArray.length; i++) sum += _dataArray[i] * _dataArray[i];
    const rms = Math.sqrt(sum / _dataArray.length);
    let vol = (rms / 128) * 100 * (_sensitivity / 50);
    vol = Math.max(0, Math.min(100, vol));

    let isSuccess = false;
    if (_mode === 'quiet') {
      isSuccess = vol < _threshold; // Quiet: Success if below threshold
      const warn = document.getElementById('ac-v13-noise-warn');
      if (warn) warn.classList.toggle('show', !isSuccess);
    } else {
      isSuccess = vol >= _threshold; // Reading: Success if above threshold
    }

    _updateLogic(isSuccess, timestamp);
    _rafId = requestAnimationFrame(_loop);
  }

  function _updateLogic(isSuccess, timestamp) {
    if (isSuccess) {
      _treeGrowth += 0.25;
      _failStartTime = null;
    } else {
      _treeGrowth -= 0.5;
      if (!_failStartTime) _failStartTime = timestamp;
    }
    _treeGrowth = Math.max(0, Math.min(100, _treeGrowth));

    const trunk = document.getElementById('v13-trunk');
    if (trunk) {
      trunk.setAttribute('stroke-width', Math.min(7, (_treeGrowth / 15) * 7));
      const canopy = document.getElementById('v13-canopy');
      if (canopy) {
        let html = '';
        const p = Math.max(0, Math.min(1, (_treeGrowth - 20) / 60));
        _leafData.forEach((d, i) => {
          const scale = Math.max(0, Math.min(1, p * 1.5 - (i * 0.06)));
          if (scale > 0) html += `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r * scale}" fill="#3f6212" opacity="0.9" />`;
        });
        canopy.innerHTML = html;
      }
      const stars = document.getElementById('v13-stars');
      if (stars) {
        let html = '';
        const p = Math.max(0, Math.min(1, (_treeGrowth - 80) / 20));
        _starData.forEach(d => {
          const scale = Math.max(0, Math.min(1, p * 2.5 - (d.delay / 20)));
          if (scale > 0) html += `<use href="#v13-star-icon" x="${d.x - (d.s / 2)}" y="${d.y - (d.s / 2)}" width="${d.s * scale}" height="${d.s * scale}" fill="${d.c}" />`;
        });
        stars.innerHTML = html;
      }
      const cloud = document.getElementById('v13-cloud');
      if (cloud) cloud.style.opacity = _treeGrowth > 70 ? 1 : 0;
    }

    const growthVal = document.getElementById('ac-v13-growth-val');
    if (growthVal) growthVal.textContent = Math.round(_treeGrowth);

    if (_rewardEnabled) {
      let effectivelySuccess = isSuccess;
      if (!isSuccess && _failStartTime && (timestamp - _failStartTime < _toleranceSec * 1000)) effectivelySuccess = true;

      if (effectivelySuccess) {
        if (!_timerStartTime) _timerStartTime = timestamp;
        _accumulatedTime += (timestamp - _timerStartTime);
        _timerStartTime = timestamp;
      } else { _accumulatedTime = 0; _timerStartTime = null; }

      _updateTimerDisplay(_accumulatedTime);

      if (_accumulatedTime >= _rewardMinutes * 60000) {
        const reason = _mode === 'quiet' ? '静音挑战成功' : '朗读挑战成功';
        
        if (_autoAddPoints) {
          _rewardClass(_rewardPoints, reason);
          _accumulatedTime = 0; _timerStartTime = null;
        } else {
          // 非自动加分模式：重置计时并暂停，弹出确认提醒
          _accumulatedTime = 0;
          _timerStartTime = null;
          _updateTimerDisplay(0);
          
          _isPaused = true;
          const btn = document.getElementById('ac-v13-pause-btn');
          if (btn) {
            btn.textContent = '恢复监测';
            btn.classList.add('active');
          }

          UI.confirm(`🌟 ${reason}！累计成功时长已达标，是否现在为全班学生加 ${_rewardPoints} 分并自动投喂？`, () => {
            _rewardClass(_rewardPoints, reason);
          }, '挑战成功奖励');
        }
      }
    }
  }

  function _updateTimerDisplay(ms) {
    const el = document.getElementById('ac-v13-timer');
    if (!el) return;
    const s = Math.floor(ms / 1000);
    el.textContent = `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  function _rewardClass(pts, reason) {
    const targetIds = [];
    document.querySelectorAll('.student-card').forEach(card => {
      const sid = card.dataset.id;
      if (sid) targetIds.push(sid);
    });

    if (targetIds.length > 0) {
      // 使用 batchAddScoreAndFeed 自动处理加分和投喂（只有投喂了宠物才会升级）
      Store.students.batchAddScoreAndFeed(targetIds, pts, reason, `挑战成功自动投喂 (${reason})`);
      
      UI.toast(`🌟 ${reason}！全班加 ${pts} 分并自动投喂`, 'success');
      
      // 触发界面刷新以显示新等级
      if (typeof Students !== 'undefined' && Students.render) {
        Students.render();
      }
    }
  }

  return { init, openModal };
})();
