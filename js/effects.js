/* ═══════════════════════ EFFECTS.JS ═══════════════════════
   视觉特效：主题系统 · 升级庆典 · 浮动分数 · 卡片交互
═══════════════════════════════════════════════════════════ */

const Effects = (() => {

  /* ══════════════════════════════════════════════════════
     主题系统
  ══════════════════════════════════════════════════════ */
  const THEMES = [
    {
      id: 'purple', name: '梦幻紫', icon: '💜',
      g1: '#8b5cf6', g2: '#7c3aed', g3: '#6d28d9',
      vars: {
        '--primary': '#7c3aed', '--primary-rgb': '124,58,237', '--primary-light': '#a78bfa',
        '--primary-dark': '#5b21b6', '--primary-xdark': '#3b0764',
        '--bg': '#f4f2ff', '--bg-soft': '#ede9fe',
        '--border-focus': 'rgba(124,58,237,.45)',
        '--progress-grad': 'linear-gradient(90deg,#8b5cf6,#a78bfa,#c4b5fd)',
        '--auth-bg': 'linear-gradient(135deg,#1e0533 0%,#3b0764 25%,#6d28d9 55%,#a855f7 80%,#f472b6 100%)',
      },
    },
    {
      id: 'pink', name: '少女粉', icon: '🌸',
      g1: '#f472b6', g2: '#db2777', g3: '#be185d',
      vars: {
        '--primary': '#db2777', '--primary-rgb': '219,39,119', '--primary-light': '#f9a8d4',
        '--primary-dark': '#be185d', '--primary-xdark': '#831843',
        '--bg': '#fff0f8', '--bg-soft': '#fce7f3',
        '--border-focus': 'rgba(219,39,119,.45)',
        '--progress-grad': 'linear-gradient(90deg,#f472b6,#f9a8d4,#fce7f3)',
        '--auth-bg': 'linear-gradient(135deg,#3b0022 0%,#831843 25%,#db2777 55%,#f472b6 80%,#fda4af 100%)',
      },
    },
    {
      id: 'cyan', name: '海洋青', icon: '🩵',
      g1: '#22d3ee', g2: '#0891b2', g3: '#0e7490',
      vars: {
        '--primary': '#0891b2', '--primary-rgb': '8,145,178', '--primary-light': '#67e8f9',
        '--primary-dark': '#0e7490', '--primary-xdark': '#164e63',
        '--bg': '#ecfeff', '--bg-soft': '#cffafe',
        '--border-focus': 'rgba(8,145,178,.45)',
        '--progress-grad': 'linear-gradient(90deg,#22d3ee,#67e8f9,#a5f3fc)',
        '--auth-bg': 'linear-gradient(135deg,#042630 0%,#164e63 25%,#0891b2 55%,#22d3ee 80%,#a5f3fc 100%)',
      },
    },
    {
      id: 'emerald', name: '翡翠绿', icon: '💚',
      g1: '#34d399', g2: '#059669', g3: '#047857',
      vars: {
        '--primary': '#059669', '--primary-rgb': '5,150,105', '--primary-light': '#6ee7b7',
        '--primary-dark': '#047857', '--primary-xdark': '#064e3b',
        '--bg': '#f0fdf4', '--bg-soft': '#dcfce7',
        '--border-focus': 'rgba(5,150,105,.45)',
        '--progress-grad': 'linear-gradient(90deg,#34d399,#6ee7b7,#a7f3d0)',
        '--auth-bg': 'linear-gradient(135deg,#022c1e 0%,#064e3b 25%,#059669 55%,#34d399 80%,#a7f3d0 100%)',
      },
    },
    {
      id: 'orange', name: '暖橙色', icon: '🧡',
      g1: '#fb923c', g2: '#ea580c', g3: '#c2410c',
      vars: {
        '--primary': '#ea580c', '--primary-rgb': '234,88,12', '--primary-light': '#fdba74',
        '--primary-dark': '#c2410c', '--primary-xdark': '#7c2d12',
        '--bg': '#fff7ed', '--bg-soft': '#ffedd5',
        '--border-focus': 'rgba(234,88,12,.45)',
        '--progress-grad': 'linear-gradient(90deg,#fb923c,#fdba74,#fed7aa)',
        '--auth-bg': 'linear-gradient(135deg,#3d0f00 0%,#7c2d12 25%,#ea580c 55%,#fb923c 80%,#fed7aa 100%)',
      },
    },
    {
      id: 'rose', name: '玫瑰红', icon: '🌹',
      g1: '#fb7185', g2: '#e11d48', g3: '#be123c',
      vars: {
        '--primary': '#e11d48', '--primary-rgb': '225,29,72', '--primary-light': '#fda4af',
        '--primary-dark': '#be123c', '--primary-xdark': '#881337',
        '--bg': '#fff1f2', '--bg-soft': '#ffe4e6',
        '--border-focus': 'rgba(225,29,72,.45)',
        '--progress-grad': 'linear-gradient(90deg,#fb7185,#fda4af,#fecdd3)',
        '--auth-bg': 'linear-gradient(135deg,#2d0010 0%,#881337 25%,#e11d48 55%,#fb7185 80%,#fecdd3 100%)',
      },
    },
    {
      id: 'blue', name: '天空蓝', icon: '💙',
      g1: '#60a5fa', g2: '#2563eb', g3: '#1d4ed8',
      vars: {
        '--primary': '#2563eb', '--primary-rgb': '37,99,235', '--primary-light': '#93c5fd',
        '--primary-dark': '#1d4ed8', '--primary-xdark': '#1e3a8a',
        '--bg': '#eff6ff', '--bg-soft': '#dbeafe',
        '--border-focus': 'rgba(37,99,235,.45)',
        '--progress-grad': 'linear-gradient(90deg,#60a5fa,#93c5fd,#bfdbfe)',
        '--auth-bg': 'linear-gradient(135deg,#0c1929 0%,#1e3a8a 25%,#2563eb 55%,#60a5fa 80%,#93c5fd 100%)',
      },
    },
    {
      id: 'indigo', name: '靛青', icon: '🩵',
      g1: '#818cf8', g2: '#4f46e5', g3: '#4338ca',
      vars: {
        '--primary': '#4f46e5', '--primary-rgb': '79,70,229', '--primary-light': '#a5b4fc',
        '--primary-dark': '#4338ca', '--primary-xdark': '#312e81',
        '--bg': '#eef2ff', '--bg-soft': '#e0e7ff',
        '--border-focus': 'rgba(79,70,229,.45)',
        '--progress-grad': 'linear-gradient(90deg,#818cf8,#a5b4fc,#c7d2fe)',
        '--auth-bg': 'linear-gradient(135deg,#1e1b4b 0%,#312e81 25%,#4f46e5 55%,#818cf8 80%,#a5b4fc 100%)',
      },
    },
    {
      id: 'teal', name: '青绿', icon: '🪷',
      g1: '#2dd4bf', g2: '#14b8a6', g3: '#0d9488',
      vars: {
        '--primary': '#14b8a6', '--primary-rgb': '20,184,166', '--primary-light': '#5eead4',
        '--primary-dark': '#0d9488', '--primary-xdark': '#134e4a',
        '--bg': '#f0fdfa', '--bg-soft': '#ccfbf1',
        '--border-focus': 'rgba(20,184,166,.45)',
        '--progress-grad': 'linear-gradient(90deg,#2dd4bf,#5eead4,#99f6e4)',
        '--auth-bg': 'linear-gradient(135deg,#042f2e 0%,#134e4a 25%,#14b8a6 55%,#2dd4bf 80%,#99f6e4 100%)',
      },
    },
    {
      id: 'lime', name: '柠檬黄', icon: '🍋',
      g1: '#a3e635', g2: '#84cc16', g3: '#65a30d',
      vars: {
        '--primary': '#84cc16', '--primary-rgb': '132,204,22', '--primary-light': '#bef264',
        '--primary-dark': '#65a30d', '--primary-xdark': '#3f6212',
        '--bg': '#f7fee7', '--bg-soft': '#ecfccb',
        '--border-focus': 'rgba(132,204,22,.45)',
        '--progress-grad': 'linear-gradient(90deg,#a3e635,#bef264,#d9f99d)',
        '--auth-bg': 'linear-gradient(135deg,#1a2e05 0%,#3f6212 25%,#84cc16 55%,#a3e635 80%,#d9f99d 100%)',
      },
    },
    {
      id: 'amber', name: '琥珀金', icon: '🟡',
      g1: '#fbbf24', g2: '#d97706', g3: '#b45309',
      vars: {
        '--primary': '#d97706', '--primary-rgb': '217,119,6', '--primary-light': '#fcd34d',
        '--primary-dark': '#b45309', '--primary-xdark': '#78350f',
        '--bg': '#fffbeb', '--bg-soft': '#fef3c7',
        '--border-focus': 'rgba(217,119,6,.45)',
        '--progress-grad': 'linear-gradient(90deg,#fbbf24,#fcd34d,#fde68a)',
        '--auth-bg': 'linear-gradient(135deg,#451a03 0%,#78350f 25%,#d97706 55%,#fbbf24 80%,#fde68a 100%)',
      },
    },
    {
      id: 'sky', name: '天青', icon: '☁️',
      g1: '#38bdf8', g2: '#0ea5e9', g3: '#0284c7',
      vars: {
        '--primary': '#0ea5e9', '--primary-rgb': '14,165,233', '--primary-light': '#7dd3fc',
        '--primary-dark': '#0284c7', '--primary-xdark': '#075985',
        '--bg': '#f0f9ff', '--bg-soft': '#e0f2fe',
        '--border-focus': 'rgba(14,165,233,.45)',
        '--progress-grad': 'linear-gradient(90deg,#38bdf8,#7dd3fc,#bae6fd)',
        '--auth-bg': 'linear-gradient(135deg,#032a3d 0%,#075985 25%,#0ea5e9 55%,#38bdf8 80%,#bae6fd 100%)',
      },
    },
    {
      id: 'violet', name: '紫罗兰', icon: '💜',
      g1: '#a78bfa', g2: '#7c3aed', g3: '#6d28d9',
      vars: {
        '--primary': '#7c3aed', '--primary-rgb': '124,58,237', '--primary-light': '#c4b5fd',
        '--primary-dark': '#6d28d9', '--primary-xdark': '#4c1d95',
        '--bg': '#f5f3ff', '--bg-soft': '#ede9fe',
        '--border-focus': 'rgba(124,58,237,.45)',
        '--progress-grad': 'linear-gradient(90deg,#a78bfa,#c4b5fd,#ddd6fe)',
        '--auth-bg': 'linear-gradient(135deg,#2e1065 0%,#4c1d95 25%,#7c3aed 55%,#a78bfa 80%,#ddd6fe 100%)',
      },
    },
    {
      id: 'slate', name: '石板灰', icon: '🩶',
      g1: '#64748b', g2: '#475569', g3: '#334155',
      vars: {
        '--primary': '#475569', '--primary-rgb': '71,85,105', '--primary-light': '#94a3b8',
        '--primary-dark': '#334155', '--primary-xdark': '#1e293b',
        '--bg': '#f8fafc', '--bg-soft': '#f1f5f9',
        '--border-focus': 'rgba(71,85,105,.45)',
        '--progress-grad': 'linear-gradient(90deg,#64748b,#94a3b8,#cbd5e1)',
        '--auth-bg': 'linear-gradient(135deg,#0f172a 0%,#1e293b 25%,#475569 55%,#64748b 80%,#94a3b8 100%)',
      },
    },
    {
      id: 'red', name: '朱砂红', icon: '❤️',
      g1: '#f87171', g2: '#dc2626', g3: '#b91c1c',
      vars: {
        '--primary': '#dc2626', '--primary-rgb': '220,38,38', '--primary-light': '#fca5a5',
        '--primary-dark': '#b91c1c', '--primary-xdark': '#7f1d1d',
        '--bg': '#fef2f2', '--bg-soft': '#fee2e2',
        '--border-focus': 'rgba(220,38,38,.45)',
        '--progress-grad': 'linear-gradient(90deg,#f87171,#fca5a5,#fecaca)',
        '--auth-bg': 'linear-gradient(135deg,#450a0a 0%,#7f1d1d 25%,#dc2626 55%,#f87171 80%,#fecaca 100%)',
      },
    },
    {
      id: 'flame', name: '烈焰橙', icon: '🔥',
      g1: '#ff3d00', g2: '#dd2c00', g3: '#bf360c',
      vars: {
        '--primary': '#ff3d00', '--primary-rgb': '255,61,0', '--primary-light': '#ff9e80',
        '--primary-dark': '#dd2c00', '--primary-xdark': '#bf360c',
        '--bg': '#fff5f2', '--bg-soft': '#ffebe5',
        '--border-focus': 'rgba(255,61,0,.45)',
        '--progress-grad': 'linear-gradient(90deg,#ff3d00,#ff6e40,#ff9e80)',
        '--auth-bg': 'linear-gradient(135deg,#3e1000 0%,#bf360c 25%,#dd2c00 55%,#ff3d00 80%,#ff9e80 100%)',
      },
    },
    {
      id: 'spring', name: '春意绿', icon: '🌱',
      g1: '#00e676', g2: '#00c853', g3: '#1b5e20',
      vars: {
        '--primary': '#00c853', '--primary-rgb': '0,200,83', '--primary-light': '#69f0ae',
        '--primary-dark': '#00c853', '--primary-xdark': '#1b5e20',
        '--bg': '#f0fff4', '--bg-soft': '#e6ffed',
        '--border-focus': 'rgba(0,200,83,.45)',
        '--progress-grad': 'linear-gradient(90deg,#00e676,#69f0ae,#b9f6ca)',
        '--auth-bg': 'linear-gradient(135deg,#0a2a12 0%,#1b5e20 25%,#00c853 55%,#00e676 80%,#b9f6ca 100%)',
      },
    },
    {
      id: 'neon-purple', name: '霓虹紫', icon: '🎆',
      g1: '#f129ff', g2: '#d500f9', g3: '#aa00ff',
      vars: {
        '--primary': '#d500f9', '--primary-rgb': '213,0,249', '--primary-light': '#ea80fc',
        '--primary-dark': '#aa00ff', '--primary-xdark': '#4a148c',
        '--bg': '#fdf2ff', '--bg-soft': '#fae8ff',
        '--border-focus': 'rgba(213,0,249,.45)',
        '--progress-grad': 'linear-gradient(90deg,#f129ff,#ea80fc,#f5d0fe)',
        '--auth-bg': 'linear-gradient(135deg,#1e002a 0%,#4a148c 25%,#d500f9 55%,#f129ff 80%,#f5d0fe 100%)',
      },
    },
    {
      id: 'royal-blue', name: '皇室蓝', icon: '👑',
      g1: '#651fff', g2: '#3d5afe', g3: '#311b92',
      vars: {
        '--primary': '#3d5afe', '--primary-rgb': '61,90,254', '--primary-light': '#8c9eff',
        '--primary-dark': '#311b92', '--primary-xdark': '#1a237e',
        '--bg': '#f0f3ff', '--bg-soft': '#e8edff',
        '--border-focus': 'rgba(61,90,254,.45)',
        '--progress-grad': 'linear-gradient(90deg,#651fff,#8c9eff,#c5cae9)',
        '--auth-bg': 'linear-gradient(135deg,#0a1033 0%,#1a237e 25%,#3d5afe 55%,#651fff 80%,#c5cae9 100%)',
      },
    },
    {
      id: 'golden', name: '金灿灿', icon: '💰',
      g1: '#ffd600', g2: '#ffab00', g3: '#ff6f00',
      vars: {
        '--primary': '#ffab00', '--primary-rgb': '255,171,0', '--primary-light': '#ffe57f',
        '--primary-dark': '#ff6f00', '--primary-xdark': '#e65100',
        '--bg': '#fffdeb', '--bg-soft': '#fff9c4',
        '--border-focus': 'rgba(255,171,0,.45)',
        '--progress-grad': 'linear-gradient(90deg,#ffd600,#ffe57f,#fff9c4)',
        '--auth-bg': 'linear-gradient(135deg,#3e2723 0%,#e65100 25%,#ffab00 55%,#ffd600 80%,#fff9c4 100%)',
      },
    },
    {
      id: 'azure', name: '蔚蓝色', icon: '🌊',
      g1: '#00b0ff', g2: '#0091ea', g3: '#01579b',
      vars: {
        '--primary': '#0091ea', '--primary-rgb': '0,145,234', '--primary-light': '#80d8ff',
        '--primary-dark': '#01579b', '--primary-xdark': '#0d47a1',
        '--bg': '#f0f9ff', '--bg-soft': '#e1f5fe',
        '--border-focus': 'rgba(0,145,234,.45)',
        '--progress-grad': 'linear-gradient(90deg,#00b0ff,#80d8ff,#b3e5fc)',
        '--auth-bg': 'linear-gradient(135deg,#001a33 0%,#0d47a1 25%,#0091ea 55%,#00b0ff 80%,#b3e5fc 100%)',
      },
    },
    {
      id: 'ruby', name: '红宝石', icon: '💎',
      g1: '#f50057', g2: '#c51162', g3: '#880e4f',
      vars: {
        '--primary': '#c51162', '--primary-rgb': '197,17,98', '--primary-light': '#ff80ab',
        '--primary-dark': '#880e4f', '--primary-xdark': '#4a148c',
        '--bg': '#fff0f5', '--bg-soft': '#fce4ec',
        '--border-focus': 'rgba(197,17,98,.45)',
        '--progress-grad': 'linear-gradient(90deg,#f50057,#ff80ab,#f8bbd0)',
        '--auth-bg': 'linear-gradient(135deg,#2a0016 0%,#4a148c 25%,#c51162 55%,#f50057 80%,#f8bbd0 100%)',
      },
    },
    {
      id: 'hot-pink', name: '火热粉', icon: '💝',
      g1: '#f900ae', g2: '#f50057', g3: '#c51162',
      vars: {
        '--primary': '#f50057', '--primary-rgb': '245,0,87', '--primary-light': '#ff4081',
        '--primary-dark': '#c51162', '--primary-xdark': '#880e4f',
        '--bg': '#fff0f6', '--bg-soft': '#fce4ec',
        '--border-focus': 'rgba(245,0,87,.45)',
        '--progress-grad': 'linear-gradient(90deg,#f900ae,#ff4081,#ff80ab)',
        '--auth-bg': 'linear-gradient(135deg,#31001a 0%,#880e4f 25%,#f50057 55%,#f900ae 80%,#ff80ab 100%)',
      },
    },
    {
      id: 'aqua', name: '极光青', icon: '❄️',
      g1: '#00e5ff', g2: '#00b8d4', g3: '#006064',
      vars: {
        '--primary': '#00b8d4', '--primary-rgb': '0,184,212', '--primary-light': '#84ffff',
        '--primary-dark': '#006064', '--primary-xdark': '#00363a',
        '--bg': '#e0ffff', '--bg-soft': '#e0f7fa',
        '--border-focus': 'rgba(0,184,212,.45)',
        '--progress-grad': 'linear-gradient(90deg,#00e5ff,#84ffff,#b2ebf2)',
        '--auth-bg': 'linear-gradient(135deg,#002129 0%,#00363a 25%,#00b8d4 55%,#00e5ff 80%,#b2ebf2 100%)',
      },
    },
    {
      id: 'acid-green', name: '荧光绿', icon: '🎾',
      g1: '#76ff03', g2: '#64dd17', g3: '#33691e',
      vars: {
        '--primary': '#64dd17', '--primary-rgb': '100,221,23', '--primary-light': '#b2ff59',
        '--primary-dark': '#33691e', '--primary-xdark': '#1b5e20',
        '--bg': '#f9fff0', '--bg-soft': '#f1f8e9',
        '--border-focus': 'rgba(100,221,23,.45)',
        '--progress-grad': 'linear-gradient(90deg,#76ff03,#b2ff59,#ccff90)',
        '--auth-bg': 'linear-gradient(135deg,#0d1f00 0%,#1b5e20 25%,#64dd17 55%,#76ff03 80%,#ccff90 100%)',
      },
    },
  ];

  let _currentTheme = 'purple';

  function initTheme() {
    const saved = localStorage.getItem('mc_theme') || 'purple';
    applyTheme(saved, false);
    _injectThemeBtn();
  }

  function applyTheme(id, save = true) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0];
    _currentTheme = theme.id;
    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));

    // Apply gradient overrides via data-theme attribute
    root.setAttribute('data-theme', theme.id);

    if (save) localStorage.setItem('mc_theme', theme.id);

    // Refresh active swatches if picker is open
    document.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.theme === theme.id);
    });
  }

  function _injectThemeBtn() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('btn-theme')) return;

    // Create fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'btn-fullscreen';
    fullscreenBtn.className = 'btn-ghost';
    fullscreenBtn.title = '全屏';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.style.marginRight = '8px';
    
    // Check if already in fullscreen
    const updateFullscreenIcon = () => {
      if (document.fullscreenElement || document.webkitFullscreenElement || 
          document.mozFullScreenElement || document.msFullscreenElement) {
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = '退出全屏';
      } else {
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = '全屏';
      }
    };
    
    fullscreenBtn.onclick = e => {
      e.stopPropagation();
      
      if (!document.fullscreenElement && !document.webkitFullscreenElement && 
          !document.mozFullScreenElement && !document.msFullscreenElement) {
        // 进入全屏
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      } else {
        // 退出全屏
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    };
    
    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
    document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
    document.addEventListener('msfullscreenchange', updateFullscreenIcon);

    // Create night mode button
    const nightBtn = document.createElement('button');
    nightBtn.id = 'btn-night-mode';
    nightBtn.className = 'btn-ghost';
    nightBtn.title = '夜间模式';
    nightBtn.innerHTML = '🌙';
    nightBtn.style.marginRight = '8px'; // Add some space between the buttons
    
    // Check local storage for initial state
    const isNight = localStorage.getItem('mc_night_mode') === 'true';
    if(isNight) {
      document.body.classList.add('night-mode');
      nightBtn.innerHTML = '☀️';
      nightBtn.title = '日间模式';
      _createNightModeEffects();
    }

    nightBtn.onclick = e => { 
      e.stopPropagation(); 
      document.body.classList.toggle('night-mode');
      const active = document.body.classList.contains('night-mode');
      localStorage.setItem('mc_night_mode', active);
      
      if(active) {
        nightBtn.innerHTML = '☀️';
        nightBtn.title = '日间模式';
        _createNightModeEffects();
      } else {
        nightBtn.innerHTML = '🌙';
        nightBtn.title = '夜间模式';
        _removeNightModeEffects();
      }
    };

    const btn = document.createElement('button');
    btn.id = 'btn-theme';
    btn.className = 'btn-ghost btn-theme-toggle';
    btn.title = '切换主题';
    btn.innerHTML = '🎨';
    btn.onclick = e => { e.stopPropagation(); showThemePicker(btn); };
    
    // insertBefore first child pushes older children right.
    // Insert theme button first...
    headerRight.insertBefore(btn, headerRight.firstChild);
    // ...then insert night mode button so it appears to the left of the theme button
    headerRight.insertBefore(nightBtn, headerRight.firstChild);
    // ...then insert fullscreen button so it appears to the left of the night mode button
    headerRight.insertBefore(fullscreenBtn, headerRight.firstChild);
  }

  function _createNightModeEffects() {
    if (document.getElementById('nm-stars')) return;

    // Create stars container
    const starsEl = document.createElement('div');
    starsEl.id = 'nm-stars';
    document.body.appendChild(starsEl);

    // Generate 180 individual twinkling star dots
    for (let i = 0; i < 180; i++) {
      const star = document.createElement('div');
      star.className = 'nm-star';
      const size = 0.5 + Math.random() * 2;           // 0.5–2.5px
      const x = Math.random() * 100;                   // % from left
      const y = Math.random() * 100;                   // % from top
      const dur = (1.5 + Math.random() * 3).toFixed(2); // 1.5–4.5s
      const delay = (Math.random() * 4).toFixed(2);    // 0–4s delay
      const minOp = (0.05 + Math.random() * 0.2).toFixed(2);
      const maxOp = (0.6 + Math.random() * 0.4).toFixed(2);
      star.style.cssText = `
        width:${size}px; height:${size}px;
        left:${x}%; top:${y}%;
        --dur:${dur}s; --delay:${delay}s;
        --min-op:${minOp}; --max-op:${maxOp};
      `;
      starsEl.appendChild(star);
    }

    // Create aurora layer
    const aurora = document.createElement('div');
    aurora.id = 'nm-aurora';
    document.body.appendChild(aurora);
  }
  
  function _removeNightModeEffects() {
    const stars = document.getElementById('nm-stars');
    if (stars) stars.remove();
    const aurora = document.getElementById('nm-aurora');
    if (aurora) aurora.remove();
  }

  function showThemePicker(anchorEl) {
    const existing = document.getElementById('theme-picker-popup');
    if (existing) { existing.remove(); return; }

    const popup = document.createElement('div');
    popup.id = 'theme-picker-popup';
    popup.className = 'theme-picker-popup';
    popup.innerHTML = `
      <div class="tp-title">🎨 选择主题颜色</div>
      <div class="tp-grid">
        ${THEMES.map(t => `
          <button class="theme-swatch ${t.id === _currentTheme ? 'active' : ''}"
            data-theme="${t.id}"
            style="--sw-g1:${t.g1};--sw-g2:${t.g2}">
            <span class="sw-icon">${t.icon}</span>
            <span class="sw-name">${t.name}</span>
          </button>
        `).join('')}
      </div>
    `;
    document.body.appendChild(popup);

    const rect = anchorEl.getBoundingClientRect();
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.style.right = (window.innerWidth - rect.right) + 'px';

    popup.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.onclick = e => { e.stopPropagation(); applyTheme(sw.dataset.theme); popup.remove(); };
    });

    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        if (!popup.contains(e.target) && e.target !== anchorEl) {
          popup.remove();
          document.removeEventListener('click', _close);
        }
      });
    }, 10);
  }

  /* ══════════════════════════════════════════════════════
     升级庆典
  ══════════════════════════════════════════════════════ */
  const PARTICLE_SHAPES = ['●', '★', '▲', '◆', '♥', '✦', '❋'];
  const PARTICLE_COLORS = [
    '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6',
    '#f472b6', '#34d399', '#fbbf24', '#a855f7', '#06b6d4',
    '#fb923c', '#e11d48', '#22d3ee', '#4ade80',
  ];

  function levelUp(studentName, petType, newLevel, newTitle, petImg) {
    const old = document.getElementById('levelup-overlay');
    if (old) old.remove();

    const ov = document.createElement('div');
    ov.id = 'levelup-overlay';
    ov.className = 'luo';
    ov.innerHTML = `
      <div class="luo-backdrop"></div>
      <button type="button" class="luo-close" aria-label="关闭">&times;</button>
      <div class="luo-center">
        <div class="luo-rays" aria-hidden="true"></div>
        <div class="luo-ring luo-ring1"></div>
        <div class="luo-ring luo-ring2"></div>
        <div class="luo-pet-wrap">
          <div class="luo-aura"></div>
          <img src="${petImg}" class="luo-pet-img" alt=""
            onerror="this.outerHTML='<div class=luo-pet-emoji>${_petEmoji(petType)}</div>'">
        </div>
        <div class="luo-badge-wrap">
          <span class="luo-badge">Lv.${newLevel}</span>
        </div>
        <div class="luo-texts">
          <div class="luo-up-label">✨ LEVEL UP ✨</div>
          <div class="luo-name">${studentName}</div>
          <div class="luo-subtitle">${newTitle}</div>
        </div>
        <div class="luo-stars" id="luo-stars"></div>
      </div>
      <div class="luo-particles" id="luo-particles"></div>
      <div class="luo-dismiss-hint">点击任意处关闭</div>
    `;

    document.body.appendChild(ov);
    _spawnStars(ov.querySelector('#luo-stars'));
    _spawnParticles(ov.querySelector('#luo-particles'));

    ov.addEventListener('click', () => _dismissLevelUp(ov));
    const closeBtn = ov.querySelector('.luo-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _dismissLevelUp(ov);
      });
    }
  }

  function _dismissLevelUp(ov) {
    ov.classList.add('luo-exit');
    setTimeout(() => ov.remove(), 500);
  }

  let _mcAudioCtx = null;
  function _getAudioContext() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!_mcAudioCtx) _mcAudioCtx = new Ctx();
      return _mcAudioCtx;
    } catch(e) {
      return null;
    }
  }

  function _resumeAudio(ctx) {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { });
  }

  /** 加分奖励音：轻快上行音阶 */
  function playScoreRewardSound() {
    try {
      const ctx = _getAudioContext();
      if (!ctx) return;
      _resumeAudio(ctx);
      const freqs = [523.25, 659.25, 783.99, 987.77];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.055;
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.14);
      });
    } catch (e) { /* 静默失败 */ }
  }

  /** 扣分提示音：低沉下行 */
  function playScorePenaltySound() {
    try {
      const ctx = _getAudioContext();
      if (!ctx) return;
      _resumeAudio(ctx);
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(146, t0 + 0.22);
      gain.gain.setValueAtTime(0.14, t0);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    } catch (e) { /* 静默失败 */ }
  }

  /** 满级胜利音效（Web Audio API 生成，无需外部文件） */
  function playVictorySound() {
    try {
      const ctx = _getAudioContext();
      if (!ctx) return;
      _resumeAudio(ctx);
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (e) { /* 静默失败 */ }
  }

  /** 满级庆典：更长的庆祝琶音 + 终止和弦 */
  function playMaxLevelFanfare() {
    try {
      const ctx = _getAudioContext();
      if (!ctx) return;
      _resumeAudio(ctx);
      const melody = [392, 523.25, 659.25, 783.99, 1046.5];
      melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.4);
      });
      const chordT = ctx.currentTime + 0.55;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = chordT + i * 0.02;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);
        osc.start(t);
        osc.stop(t + 0.9);
      });
    } catch (e) { /* 静默失败 */ }
  }

  function _spawnMaxLevelStarfall(container) {
    if (!container) return;
    /* 使用 Unicode 星形字符，避免彩色 emoji 边缘发糊；与遮罩分层后更清晰 */
    const glyphs = ['★', '☆', '✦', '✧', '✩', '⋆'];
    const n = 48;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'luo-ml-starfall';
      el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      const left = Math.random() * 100;
      const dur = 2.8 + Math.random() * 2.2;
      const delay = Math.random() * 1.8;
      el.style.left = `${left}%`;
      el.style.animationDuration = `${dur}s`;
      el.style.animationDelay = `${delay}s`;
      el.style.fontSize = `${14 + Math.random() * 18}px`;
      container.appendChild(el);
    }
  }

  function _spawnMaxLevelConfetti(container) {
    if (!container) return;
    const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981', '#ec4899', '#fbbf24', '#a855f7'];
    const n = 36;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'luo-ml-confetti-piece';
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      const dur = 2.5 + Math.random() * 2;
      const delay = Math.random() * 1.2;
      const drift = (Math.random() - 0.5) * 120;
      el.style.animationDuration = `${dur}s`;
      el.style.animationDelay = `${delay}s`;
      el.style.setProperty('--ml-drift', `${drift}px`);
      el.style.width = `${5 + Math.random() * 8}px`;
      el.style.height = `${8 + Math.random() * 10}px`;
      container.appendChild(el);
    }
  }

  function _spawnMaxLevelLightBursts(container) {
    if (!container) return;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = 'luo-ml-burst-ring';
      ring.style.animationDelay = `${i * 0.5}s`;
      container.appendChild(ring);
    }
  }

  /** 满级：礼花筒喷礼花（底部多筒 + 多波次喷发） */
  function _spawnPartyPopperEffect(fxEl) {
    if (!fxEl) return;
    const colors = [
      '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981',
      '#fbbf24', '#f97316', '#22d3ee', '#a855f7', '#eab308',
    ];
    const party = document.createElement('div');
    party.className = 'luo-ml-party';
    party.setAttribute('aria-hidden', 'true');

    const units = [
      { left: '20%', tilt: 'luo-ml-popper--tilt-l' },
      { left: '50%', tilt: 'luo-ml-popper--tilt-c' },
      { left: '80%', tilt: 'luo-ml-popper--tilt-r' },
    ];

    const anchors = [];
    units.forEach((u) => {
      const unit = document.createElement('div');
      unit.className = `luo-ml-popper-unit ${u.tilt}`;
      unit.style.left = u.left;
      unit.innerHTML = `
        <div class="luo-ml-popper-tube" aria-hidden="true"></div>
        <div class="luo-ml-popper-anchor"></div>`;
      party.appendChild(unit);
      anchors.push(unit.querySelector('.luo-ml-popper-anchor'));
    });

    function burstFromAnchor(anchor, angleBias) {
      if (!anchor) return;
      const n = 38;
      for (let i = 0; i < n; i++) {
        const el = document.createElement('span');
        const ribbon = Math.random() > 0.55;
        el.className = ribbon ? 'luo-ml-popper-ribbon' : 'luo-ml-popper-piece';
        const spread = Math.PI * 0.58;
        const base = Math.PI / 2 - spread / 2 + (angleBias || 0);
        const angle = base + Math.random() * spread;
        const dist = 120 + Math.random() * 280;
        const tx = Math.cos(angle) * dist;
        const ty = -Math.sin(angle) * dist;
        const rot = (Math.random() - 0.5) * 900;
        el.style.setProperty('--tx', `${tx}px`);
        el.style.setProperty('--ty', `${ty}px`);
        el.style.setProperty('--rot', `${rot}deg`);
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDelay = `${Math.random() * 0.07}s`;
        el.style.animationDuration = `${0.78 + Math.random() * 0.42}s`;
        anchor.appendChild(el);
      }
    }

    fxEl.appendChild(party);

    burstFromAnchor(anchors[0], -0.1);
    burstFromAnchor(anchors[1], 0);
    burstFromAnchor(anchors[2], 0.1);

    setTimeout(() => {
      burstFromAnchor(anchors[0], -0.06);
      burstFromAnchor(anchors[1], 0);
      burstFromAnchor(anchors[2], 0.06);
    }, 380);
    setTimeout(() => {
      burstFromAnchor(anchors[1], 0);
    }, 820);
  }

  /** 养宠满级庆祝弹窗（养成成功界面）
   *  支持 (opts) 或 (studentName, petType, petImg)
   *  opts: { studentName, studentId, petType, petName, petImg, onCollect } */
  function maxLevelCelebration(optsOrName, petType, petImg) {
    playMaxLevelFanfare();
    const isObj = typeof optsOrName === 'object' && optsOrName !== null;
    const args = isObj ? optsOrName : {};
    const studentName = args.studentName || optsOrName;
    const studentId = args.studentId;
    const pt = args.petType || petType;
    const pn = args.petName || (typeof getPet === 'function' ? ((getPet(pt)==null?void 0:getPet(pt)).name || pt) : pt);
    const petImgSrc = args.petImg || petImg;
    const onCollect = args.onCollect;

    const old = document.getElementById('levelup-overlay');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'levelup-overlay';
    ov.className = 'luo luo-maxlevel luo-maxlevel-v2';
    ov.innerHTML = `
      <div class="luo-backdrop"></div>
      <div class="luo-maxlevel-fx" aria-hidden="true">
        <div class="luo-maxlevel-falling" id="luo-ml-falling"></div>
        <div class="luo-maxlevel-confetti" id="luo-ml-confetti"></div>
        <div class="luo-maxlevel-bursts" id="luo-ml-bursts"></div>
      </div>
      <div class="luo-maxlevel-modal">
        <div class="luo-maxlevel-sparkles" aria-hidden="true">✨</div>
        <h2 class="luo-maxlevel-main-title">养成成功!</h2>
        <p class="luo-maxlevel-subtitle">恭喜你成功养成了满级萌宠！</p>
        <div class="luo-maxlevel-pet-frame">
          <img src="${petImgSrc}" class="luo-maxlevel-pet-img" alt="${pn}"
            onerror="this.outerHTML='<div class=luo-maxlevel-pet-emoji>${_petEmoji(pt)}</div>'">
        </div>
        <div class="luo-maxlevel-pet-name">${pn}</div>
        <div class="luo-maxlevel-form">✨ 守护神兽·满级形态 ✨</div>
        <div class="luo-maxlevel-badge-row">
          <span class="luo-maxlevel-badge-icon">🏅</span>
          <span>获得养成徽章</span>
        </div>
        <p class="luo-maxlevel-badge-hint">✨徽章将永久保存在你的收藏中✨</p>
        <div class="luo-maxlevel-btns">
          <button type="button" class="luo-maxlevel-btn luo-maxlevel-btn-primary" data-action="dismiss">✨ 我知道了</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    _spawnMaxLevelStarfall(ov.querySelector('#luo-ml-falling'));
    _spawnMaxLevelConfetti(ov.querySelector('#luo-ml-confetti'));
    _spawnMaxLevelLightBursts(ov.querySelector('#luo-ml-bursts'));
    _spawnPartyPopperEffect(ov.querySelector('.luo-maxlevel-fx'));

    const dismiss = () => _dismissLevelUp(ov);
    const dismissBtn = ov.querySelector('[data-action="dismiss"]');
    if (dismissBtn) dismissBtn.onclick = (e) => { e.stopPropagation(); dismiss(); };
    ov.querySelector('.luo-backdrop').onclick = dismiss;
    /* 满级不自动关闭，便于阅读说明并点击「我知道了」 */
  }

  function _petEmoji(type) {
    const p = typeof getPet === 'function' ? getPet(type) : null;
    return p ? p.emoji : '🐾';
  }

  function _spawnParticles(container) {
    const count = 60;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'luo-p';
      const angle = (i / count) * 360 + Math.random() * 10;
      const dist = 100 + Math.random() * 220;
      const dx = Math.cos(angle * Math.PI / 180) * dist;
      const dy = Math.sin(angle * Math.PI / 180) * dist;
      const size = 7 + Math.random() * 16;
      p.textContent = PARTICLE_SHAPES[Math.floor(Math.random() * PARTICLE_SHAPES.length)];
      p.style.cssText = `
        --dx:${dx}px; --dy:${dy}px;
        --delay:${(Math.random() * 0.4).toFixed(2)}s;
        --dur:${(0.9 + Math.random() * 0.8).toFixed(2)}s;
        font-size:${size}px;
        color:${PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]};
      `;
      container.appendChild(p);
    }
  }

  function _spawnStars(container) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'luo-star';
      s.textContent = ['⭐', '🌟', '✨', '💫'][Math.floor(Math.random() * 4)];
      s.style.cssText = `
        left:${Math.random() * 100}%;
        top:${Math.random() * 100}%;
        animation-delay:${(Math.random() * 0.6).toFixed(2)}s;
        animation-duration:${(0.5 + Math.random() * 0.5).toFixed(2)}s;
        font-size:${18 + Math.random() * 24}px;
      `;
      container.appendChild(s);
    }
  }

  /* ══════════════════════════════════════════════════════
     浮动分数 / 投喂动画
  ══════════════════════════════════════════════════════ */
  function floatScore(cardEl, value) {
    const pos = value > 0;
    _spawnFloat(
      cardEl,
      `float-score ${pos ? 'fs-add' : 'fs-deduct'}`,
      (pos ? '+' : '') + value
    );
  }

  function floatFeed(cardEl) {
    _spawnFloat(cardEl, 'float-score fs-feed', '🍗');
  }

  function floatEmoji(cardEl, emoji) {
    _spawnFloat(cardEl, 'float-score fs-feed', emoji);
  }

  function _spawnFloat(cardEl, cls, text) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;

    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2 + window.scrollX;
      const y = rect.top + window.scrollY + rect.height * 0.3;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--hx', (Math.random() * 40 - 20) + 'px');
    } else {
      el.style.left = '50%';
      el.style.top = '40%';
      el.style.setProperty('--hx', '0px');
    }
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  /* ══════════════════════════════════════════════════════
     卡片 3D 倾斜
  ══════════════════════════════════════════════════════ */
  let _tiltEl = null;

  function initCardTilt() {
    document.addEventListener('mousemove', _onTiltMove);
    document.addEventListener('mouseleave', _onTiltLeave, true);
  }

  function _onTiltMove(e) {
    const card = e.target.closest('.student-card');
    if (!card) {
      if (_tiltEl) { _resetTilt(_tiltEl); _tiltEl = null; }
      return;
    }
    if (_tiltEl && _tiltEl !== card) { _resetTilt(_tiltEl); }
    _tiltEl = card;

    const rect = card.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const rx = -dy * 7;
    const ry = dx * 7;
    card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-5px) scale(1.025)`;
    card.style.boxShadow = `
      ${-ry * 1.5}px ${rx * 1.5 + 8}px 32px rgba(0,0,0,.15),
      0 4px 16px var(--shadow-color, rgba(124,58,237,.15))`;
    card.style.zIndex = '5';
  }

  function _onTiltLeave(e) {
    const card = e.target.closest ? e.target.closest('.student-card') : null;
    if (card) { _resetTilt(card); if (_tiltEl === card) _tiltEl = null; }
  }

  function _resetTilt(card) {
    card.style.transform = '';
    card.style.boxShadow = '';
    card.style.zIndex = '';
  }

  /* ══════════════════════════════════════════════════════
     卡片投喂反馈（心跳 + 爱心雨）
  ══════════════════════════════════════════════════════ */
  function cardFeedPulse(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('card-feed-pulse');
    void cardEl.offsetWidth;
    cardEl.classList.add('card-feed-pulse');
    cardEl.addEventListener('animationend', () => cardEl.classList.remove('card-feed-pulse'), { once: true });
  }

  /* ══════════════════════════════════════════════════════
     加分卡片闪光
  ══════════════════════════════════════════════════════ */
  function cardScoreFlash(cardEl, isAdd) {
    if (!cardEl) return;
    const cls = isAdd ? 'card-flash-add' : 'card-flash-deduct';
    cardEl.classList.remove('card-flash-add', 'card-flash-deduct');
    void cardEl.offsetWidth;
    cardEl.classList.add(cls);
    cardEl.addEventListener('animationend', () => cardEl.classList.remove(cls), { once: true });
  }

  return {
    THEMES,
    initTheme,
    applyTheme,
    showThemePicker,
    levelUp,
    maxLevelCelebration,
    floatScore,
    floatFeed,
    floatEmoji,
    initCardTilt,
    cardFeedPulse,
    cardScoreFlash,
    confetti: () => {
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:999999;pointer-events:none;overflow:hidden;';
      document.body.appendChild(container);
      _spawnMaxLevelConfetti(container);
      playVictorySound();
      setTimeout(() => container.remove(), 5000);
    },
    playScoreRewardSound,
    playScorePenaltySound,
  };
})();
