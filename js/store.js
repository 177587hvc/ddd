/* ═══════════════════════ STORE.JS ═══════════════════════
   数据层：localStorage 缓存 + PHP 后端自动同步
   ─────────────────────────────────────────────────────────
   策略：所有读写操作保持同步（localStorage），每次写入后
   触发防抖同步，将数据 POST 到 backend/api.php 持久化。
   登录/注册从服务端加载数据，离线时自动降级为纯本地模式。
═══════════════════════════════════════════════════════════ */

const Store = (() => {

  /* ── localStorage Key 映射 ───────────────────────────── */
  const K = {
    teachers: 'pets_teachers',
    classes: 'pets_classes',
    deletedClasses: 'pets_deleted_classes', // 已删除班级ID墓碑，跨设备同步删除操作
    students: 'pets_students',
    records: 'pets_records',
    groups: 'pets_groups',
    shop: 'pets_shop',
    levels: 'pets_levels',  // 前缀；实际 key = pets_levels_<classId>
    luckyWheel: 'pets_luckyWheel', // 实际 key = pets_luckyWheel_<classId>
    session: 'pets_session',
    // 作业统计
    homeworkTasks: 'hw_tasks',
    homeworkStates: 'hw_task_states',
  };

  // Token 单独存储，不随 session 清空
  const TOKEN_KEY = 'pets_token';
  // API 路径（相对于 index.html 所在目录）
  const API = 'backend/api.php';

  /* ── 基础读写（含内存缓存，避免重复 JSON.parse 大数组） ── */
  let _memCache = {}; // key → 已解析的数组/对象，写入时同步更新

  function _get(key) {
    if (Object.prototype.hasOwnProperty.call(_memCache, key)) return _memCache[key];
    try {
      const val = JSON.parse(localStorage.getItem(key)) || [];
      _memCache[key] = val;
      return val;
    } catch(e) { return []; }
  }
  function _set(key, val, immediate = false) {
    const oldVal = _memCache[key]; // 备份旧值，用于回滚
    _memCache[key] = val; // 先更新内存缓存，保证本次操作后的读取立即反映新值
    try {
      localStorage.setItem(key, JSON.stringify(val));
      localStorage.setItem('pets_last_write', Date.now().toString());
    } catch (e) {
      console.error('Storage setItem failed:', e);
      // 回滚内存缓存，防止内存和持久化不一致
      if (oldVal !== undefined) {
        _memCache[key] = oldVal;
      } else {
        delete _memCache[key];
      }
      if (typeof UI !== 'undefined') {
        UI.toast('本地存储空间不足，数据保存失败！请清理浏览器缓存后重试。', 'error', 5000);
      }
      // 抛出错误，阻止同步执行
      throw new Error('localStorage quota exceeded');
    }
    _dataMutation++;
    _scheduleSync(immediate);
  }
  function _remove(key) {
    delete _memCache[key]; // 清除对应缓存
    localStorage.removeItem(key);
    localStorage.setItem('pets_last_write', Date.now().toString());
    _dataMutation++;
    _scheduleSync();
  }

  /* ── Token 管理 ─────────────────────────────────────── */
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  /* ══════════════════════════════════════════════════════
     自动同步引擎
     每次 _set / _remove 后防抖 1.5s，统一打包上传到服务端；
     页面关闭时用 sendBeacon 确保最后一次数据不丢失。
  ══════════════════════════════════════════════════════ */
  let _syncTimer = null;
  let _syncInProgress = false;
  let _syncAbortController = null;
  let _syncAgain = false;
  let _dataMutation = 0;
  let _firstDirtyTime = 0; // 首次标记 dirty 的时间，用于节流
  const MAX_SYNC_DELAY = 300; // 节流：最多等待300ms强制同步（降低以减少多设备覆盖风险）
  const DEBOUNCE_DELAY = 50; // 防抖延迟：停止操作后50ms同步（快速响应）
  let _syncDirty = localStorage.getItem('pets_sync_dirty') === '1'; // 是否有待同步的脏数据
  let _pollTimer = null; // 背景轮询计时器
  let _lastKnownServerTime = null; // 最近一次成功拉取的服务端时间戳
  let _pendingServerUpdate = false; // 检测到服务器更新但因 dirty 无法拉取，等待同步完成后拉取
  let _restoreLock = false; // 互斥锁：防止轮询拉取和本地写入的竞态冲突
  let _syncRetryCount = 0; // 同步失败重试计数器
  let _syncHealthCheckTimer = null; // 同步健康检查计时器
  let _uiUpdateTimer = null; // UI 更新防抖计时器
  const MAX_SYNC_RETRIES = 10; // 最大重试次数（增加到10次）
  let _dataVersion = Number(localStorage.getItem('pets_data_version') || 0); // 本地数据版本号
  let _isLoggingOut = false; // 退出登录标志，防止退出时触发"被挤掉线"提示
  
  // 同步状态监控
  let _syncStatus = {
    lastSyncTime: 0,
    lastSyncSuccess: true,
    totalSyncs: 0,
    failedSyncs: 0,
    conflictCount: 0
  };
  
  /** 获取同步状态（供调试和监控使用） */
  function getSyncStatus() {
    return {
      ..._syncStatus,
      isDirty: _getSyncDirty(),
      version: _dataVersion,
      retryCount: _syncRetryCount,
      isPolling: !!_pollTimer,
      restoreLocked: _restoreLock
    };
  }
  
  /** 记录同步日志到 localStorage（保留最近50条） */
  function _logSync(type, message, details = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem('pets_sync_logs') || '[]');
      logs.push({
        time: new Date().toISOString(),
        type, // success, error, conflict, warning
        message,
        details
      });
      // 只保留最近50条
      if (logs.length > 50) logs.splice(0, logs.length - 50);
      localStorage.setItem('pets_sync_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('记录同步日志失败:', e);
    }
  }

  function _getSyncDirty() {
    return localStorage.getItem('pets_sync_dirty') === '1';
  }
  
  function _setSyncDirty(val) {
    _syncDirty = val;
    localStorage.setItem('pets_sync_dirty', val ? '1' : '0');
    if (val) {
      localStorage.setItem('pets_last_write', Date.now().toString());
    }
  }

  /** 触发 UI 更新（带防抖，避免频繁刷新） */
  function _triggerUIUpdate() {
    clearTimeout(_uiUpdateTimer);
    _uiUpdateTimer = setTimeout(() => {
      console.log('[UI] 触发更新');
      window.dispatchEvent(new CustomEvent('pets-data-sync'));
    }, 50); // 50ms 防抖（快速响应）
  }

  function _scheduleSync(immediate = false) {
    _setSyncDirty(true);
    
    if (immediate) {
      // 立即同步
      clearTimeout(_syncTimer);
      _firstDirtyTime = 0;
      _doSync();
      return;
    }
    
    const now = Date.now();
    
    // 首次标记 dirty，记录时间
    if (_firstDirtyTime === 0) {
      _firstDirtyTime = now;
    }
    
    // 计算距离首次 dirty 的时间
    const timeSinceFirstDirty = now - _firstDirtyTime;
    
    // 节流：如果距离首次 dirty 已超过最大延迟，立即同步
    if (timeSinceFirstDirty >= MAX_SYNC_DELAY) {
      console.log('连续操作已达最大延迟，强制同步');
      clearTimeout(_syncTimer);
      _firstDirtyTime = 0;
      _doSync();
      return;
    }
    
    // 防抖：清除之前的定时器，重新计时
    clearTimeout(_syncTimer);
    
    // 计算剩余可延迟时间
    const remainingTime = MAX_SYNC_DELAY - timeSinceFirstDirty;
    const debounceTime = Math.min(DEBOUNCE_DELAY, remainingTime);
    
    _syncTimer = setTimeout(() => {
      _firstDirtyTime = 0;
      _doSync();
    }, debounceTime);
  }

  /** 开启后台自动同步（轮询）
   *  策略：轻量查询时间戳，开销小；只有服务器有新数据时才下载全量。 */
  function startPolling(intervalMs = 500) {
    if (_pollTimer) clearInterval(_pollTimer);
    let _isPollingJobRunning = false;
    
    // 启动同步健康检查
    _startSyncHealthCheck();
    
    _pollTimer = setInterval(async () => {
      if (_isPollingJobRunning) return;
      const token = getToken();
      if (!token) return;
      
      // 关键修复：如果本地有待同步数据，跳过轮询拉取，避免覆盖本地未同步的操作
      if (_getSyncDirty()) return;

      _isPollingJobRunning = true;
      try {
        const tsRes = await fetch(API + '?action=getTimestamp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (tsRes.status === 401) {
          const tsJson = await tsRes.json().catch(() => ({}));
          _handleKicked(tsJson.msg);
          return;
        }
        const tsJson = await tsRes.json().catch(() => ({}));
        if (tsJson.ok) {
          const serverVersion = Number(tsJson.version || 0);
          const serverTime = tsJson.updatedAt;
          const hasNewVersion = serverVersion > _dataVersion;
          const hasNewTimestamp = serverTime && serverTime !== _lastKnownServerTime;

          if (hasNewVersion || hasNewTimestamp) {
            _lastKnownServerTime = serverTime || _lastKnownServerTime;

            // 二次检查：拉取前再次确认本地无脏数据
            if (!_getSyncDirty()) {
              await loadFromServer(token, true);
            }
          }
        }
      } catch(e) { } finally {
        _isPollingJobRunning = false;
      }
    }, intervalMs);
  }

  function stopPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = null;
    if (_syncHealthCheckTimer) clearInterval(_syncHealthCheckTimer);
    _syncHealthCheckTimer = null;
  }
  
  /** 强制上传本地数据到服务器（用于首次同步或数据修复） */
  async function forceUploadLocalData() {
    const token = getToken();
    if (!token) {
      console.error('未登录，无法上传数据');
      return { ok: false, msg: '未登录' };
    }
    
    console.log('[强制上传] 开始上传本地所有数据到服务器...');
    const uploadMutation = _dataMutation;
    const uploadVersion = _dataVersion;
    
    try {
      const localData = _collectData();
      const recordsCount = localData[K.records] ? JSON.parse(localData[K.records]).length : 0;
      
      console.log(`[强制上传] 本地记录数: ${recordsCount}`);
      
      const res = await fetch(API + '?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          data: localData,
          version: uploadVersion,
          forceUpload: true // 标记为强制上传
        }),
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (res.ok && json.ok && _dataMutation === uploadMutation) {
        console.log('[强制上传] 成功！数据已同步到服务器');
        _setSyncDirty(false);
        if (json.version) {
          _dataVersion = json.version;
          localStorage.setItem('pets_data_version', _dataVersion.toString());
        }
        return { ok: true, recordsCount, version: json.version };
      } else {
        console.error('[强制上传] 失败:', json);
        return { ok: false, msg: json.msg || '上传失败' };
      }
    } catch (e) {
      console.error('[强制上传] 异常:', e);
      return { ok: false, msg: e.message };
    }
  }
  
  /** 同步健康检查：定期检测卡住的 dirty 状态并自动恢复 */
  function _startSyncHealthCheck() {
    if (_syncHealthCheckTimer) clearInterval(_syncHealthCheckTimer);
    
    _syncHealthCheckTimer = setInterval(() => {
      const isDirty = _getSyncDirty();
      if (!isDirty) return;
      
      const lastWrite = Number(localStorage.getItem('pets_last_write') || 0);
      const now = Date.now();
      const timeSinceDirty = now - lastWrite;
      
      // 如果 dirty 状态超过 10 秒未清除，说明同步可能卡住了
      if (timeSinceDirty > 10000) {
        console.error(`[健康检查] 检测到同步卡住 (${(timeSinceDirty/1000).toFixed(1)}秒)，强制恢复`);
        _logSync('warning', '检测到同步卡住，强制恢复', { timeSinceDirty });
        
        // 重置状态
        _firstDirtyTime = now;
        _syncRetryCount = 0;
        
        // 强制触发同步
        _scheduleSync(true);
      }
    }, 5000); // 每5秒检查一次
  }

  function _collectData() {
    const data = {};
    // 收集主要集合（跳过 session 和 teachers，它们由服务端管理）
    // 作业统计两个 key 特殊处理：只在本设备真的写过时才上传，避免"从来没用过作业统计"的设备
    // 把 hw_tasks: [] / hw_task_states: {} 上传覆盖掉另一台设备的真实数据（last-write-wins 反模式）
    const baseKeys = [K.classes, K.students, K.records, K.groups, K.shop];
    baseKeys.forEach(k => { data[k] = _get(k); });

    // 作业统计：localStorage 里 key 存在才上传（_get 会返回 []/{} 但 key 本身不存在说明从未初始化）
    if (localStorage.getItem(K.homeworkTasks) !== null) {
      data[K.homeworkTasks] = _get(K.homeworkTasks);
    }
    if (localStorage.getItem(K.homeworkStates) !== null) {
      data[K.homeworkStates] = _get(K.homeworkStates);
    }
    // 同步删除墓碑（让其他设备也能感知哪些班级已被删除）
    const tombstone = localStorage.getItem(K.deletedClasses);
    if (tombstone) data[K.deletedClasses] = tombstone;
    // 收集各班级等级设置、加分减分配置等
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(K.levels + '_') || k.startsWith('pets_scoreItems_') || k.startsWith('pets_hunger_') || k.startsWith(K.luckyWheel + '_'))) {
        data[k] = localStorage.getItem(k);
      }
    }
    // 加入写时钟，用于解决多设备竞争导致的数据倒退问题
    data.last_write = Number(localStorage.getItem('pets_last_write') || 0);
    return data;
  }

  /** 被踢出处理：清理认证状态，弹出明显提示 */
  function _handleKicked(msg) {
    // 如果正在退出登录，不显示提示
    if (_isLoggingOut) {
      console.log('[退出登录] 跳过"被挤掉线"提示，因为用户正在主动退出');
      return;
    }
    
    console.log('[被踢出] 检测到账号在其他设备登录，准备显示提示');
    
    // 尝试最后一次同步（同步方式，确保执行）
    if (_getSyncDirty()) {
      const token = getToken();
      if (token) {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', API + '?action=save', false); // 同步请求
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify({
            token,
            data: _collectData(),
            version: _dataVersion
          }));
          const result = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
            console.log('被踢出前成功保存数据');
          }
        } catch (e) {
          console.error('被踢出前保存数据失败:', e);
        }
      }
    }
    
    clearToken();
    session.clear();
    stopPolling();
    const kickMsg = '系统仅支持同时登录三个设备呦！';
    
    // 强制清理页面其他可能的干扰
    if (typeof UI !== 'undefined' && UI.openModal) {
      // 显示一个无法通过点击背景关闭的强力弹窗
      UI.openModal('⚠️ 系统通知', `
        <div style="text-align:center;padding:1.5rem 0">
          <div style="font-size:4rem;margin-bottom:1.2rem">📵</div>
          <p style="font-size:1.3rem;font-weight:600;color:#ef4444;margin-bottom:.8rem;line-height:1.4">${kickMsg}</p>
          <p style="color:var(--text-muted);font-size:1rem;margin-bottom:2rem">您的账号正在另一台设备上登录<br>当前连接已切断</p>
          <div class="modal-footer" style="margin:0;padding:0;border:none;display:flex!important">
            <button class="btn-primary" onclick="location.href='index.html'" style="width:100%;padding:1rem;font-size:1.1rem;border-radius:12px">确定</button>
          </div>
        </div>`, { narrow: true, noAutofocus: true });
        
      // 禁用背景关闭逻辑（如果 UI.js 支持的话，这里通过重写 overlay onclick 确保万无一失）
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.onclick = (e) => e.stopPropagation();
    } else {
      alert(kickMsg);
      location.href = 'index.html';
    }
  }

  function _parseSyncValue(value, fallback = []) {
    if (Array.isArray(value) || (value && typeof value === 'object')) return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value || JSON.stringify(fallback));
      } catch (e) {
        return fallback;
      }
    }
    return fallback;
  }

  async function _resolveSyncConflict(token, localPayload, serverVersion, syncMutation) {
    const res = await fetch(API + '?action=load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const latest = await res.json().catch(() => ({}));

    if (res.status === 401) {
      _handleKicked(latest.msg);
      return false;
    }
    if (!res.ok || !latest.ok || !latest.data) {
      throw new Error(latest.msg || '无法读取云端最新数据');
    }

    const serverData = latest.data;
    const localRecords = _parseSyncValue(localPayload[K.records], []);
    const serverRecords = _parseSyncValue(serverData[K.records], []);
    const serverRecordIds = new Set(serverRecords.map(record => record && record.id).filter(Boolean));
    const latestServerRecordTime = serverRecords.reduce((latestTime, record) => {
      const time = Date.parse(record && record.createdAt);
      return Number.isFinite(time) && time > latestTime ? time : latestTime;
    }, 0);
    const pendingRecords = localRecords.filter(record => {
      if (!record || !record.id || serverRecordIds.has(record.id)) return false;
      const recordTime = Date.parse(record.createdAt);
      return Number.isFinite(recordTime) && recordTime >= latestServerRecordTime;
    });

    if (pendingRecords.length === 0) {
      _setSyncDirty(true);
      _logSync('warning', '版本冲突但没有可安全合并的本地记录，保留本地数据', {
        localVersion: serverVersion,
        serverVersion: latest.version
      });
      return { merged: false, blocked: true };
    }

    const serverStudents = _parseSyncValue(serverData[K.students], []);
    const studentDeltas = new Map();
    pendingRecords.forEach(record => {
      if (!record.studentId) return;
      const current = studentDeltas.get(record.studentId) || { chicken: 0, fed: 0 };
      current.chicken += Number(record.legsDeltaChicken || 0);
      current.fed += Number(record.legsDeltaFed || 0);
      studentDeltas.set(record.studentId, current);
    });

    const mergedStudents = serverStudents.map(student => {
      const delta = studentDeltas.get(student.id);
      if (!delta) return student;
      return {
        ...student,
        chickenLegs: Number(student.chickenLegs || 0) + delta.chicken,
        fedLegs: Number(student.fedLegs || 0) + delta.fed
      };
    });

    const mergedData = { ...serverData };
    mergedData[K.students] = mergedStudents;
    mergedData[K.records] = [...serverRecords, ...pendingRecords].slice(-8000);

    _forceRestoreData(mergedData, latest.version);
    _setSyncDirty(true);

    const retryVersion = Number(latest.version || serverVersion || _dataVersion);
    const retryRes = await fetch(API + '?action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        data: _collectData(),
        version: retryVersion
      })
    });
    const retryJson = await retryRes.json().catch(() => ({}));

    if (retryRes.ok && retryJson.ok) {
      _dataVersion = Number(retryJson.version || retryVersion);
      localStorage.setItem('pets_data_version', String(_dataVersion));
      if (_dataMutation === syncMutation) {
        _setSyncDirty(false);
      } else {
        _scheduleSync(false);
      }
      _logSync('success', '版本冲突后已合并本地积分并重试成功', {
        localVersion: serverVersion,
        serverVersion: retryVersion,
        mergedRecords: pendingRecords.length,
        version: _dataVersion
      });
      return true;
    }

    _setSyncDirty(true);
    _logSync('error', '版本冲突合并后重试失败', {
      status: retryRes.status,
      message: retryJson.msg || '未知错误'
    });
    return false;
  }

  async function _doSync() {
    const token = getToken();
    if (!token) {
      console.error('[同步] 取消：未登录');
      return;
    }
    
    const isDirty = _getSyncDirty();
    if (!isDirty) {
      console.log('[同步] 取消：无待同步数据');
      return;
    }

    if (_syncInProgress) {
      _syncAgain = true;
      return;
    }

    _syncInProgress = true;
    _syncAbortController = new AbortController();
    _syncAgain = false;
    const syncMutation = _dataMutation;
    const payloadVersion = _dataVersion;
    const startTime = Date.now();
    _syncStatus.totalSyncs++;
    
    console.log(`[同步] 开始第 ${_syncStatus.totalSyncs} 次同步，当前版本: ${_dataVersion}`);
    
    try {
      const res = await fetch(API + '?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          data: _collectData(),
          version: payloadVersion // 携带当前版本号
        }),
        signal: _syncAbortController.signal
      });
      
      if (res.status === 401) {
        const json2 = await res.json().catch(() => ({}));
        _handleKicked(json2.msg);
        return;
      }
      
      const json = await res.json().catch(() => ({}));

      if (res.status === 409) {
        _syncStatus.conflictCount++;
        _logSync('conflict', '云端已有更新，放弃旧版本覆盖', {
          localVersion: payloadVersion,
          serverVersion: json.version
        });

        const localPayload = _collectData();
        try {
          const merged = await _resolveSyncConflict(
            token,
            localPayload,
            Number(json.version || _dataVersion),
            syncMutation
          );
          if (!merged && _dataMutation !== syncMutation) {
            _syncAgain = true;
          }
        } catch (conflictError) {
          console.error('[同步] 冲突合并失败:', conflictError);
          _setSyncDirty(true);
          _syncStatus.failedSyncs++;
          _logSync('error', '版本冲突处理失败，保留本地数据等待重试', {
            error: conflictError.message
          });
          _syncAgain = true;
        }
        return;
      }

      // 详细日志：记录响应状态
      console.log(`[同步] 响应状态: ${res.status}, res.ok: ${res.ok}, json.ok: ${json.ok}`);
      
      if (res.ok && json.ok) {
        // 只有本次请求快照之后没有新写入，才允许清除 dirty
        if (_dataMutation === syncMutation) {
          _setSyncDirty(false);
          _syncRetryCount = 0; // 重置重试计数器
          _firstDirtyTime = 0; // 重置首次 dirty 时间
          _syncStatus.lastSyncSuccess = true;
          _syncStatus.lastSyncTime = Date.now();
          
          // 更新本地版本号
          if (json.version) {
            _dataVersion = json.version;
            localStorage.setItem('pets_data_version', _dataVersion.toString());
          }
          
          _logSync('success', '数据同步成功', { version: _dataVersion });
          console.log(`[同步] 成功完成，新版本: ${_dataVersion}`);
        } else {
          // 同步期间有新的写入，需要再次同步，但后续请求必须使用本次成功后的版本。
          console.log('同步期间有新写入，重新调度同步');
          _syncRetryCount = 0; // 重置重试计数器
          if (json.version) {
            _dataVersion = Number(json.version);
            localStorage.setItem('pets_data_version', String(_dataVersion));
          }
          _firstDirtyTime = Date.now(); // 重置为当前时间，避免立即强制同步
          _scheduleSync(false); // 重新调度（使用防抖，不立即同步）
        }
      } else {
        _setSyncDirty(true);
        _syncStatus.failedSyncs++;
        _syncStatus.lastSyncSuccess = false;
        
        // 详细错误日志
        console.error(`[同步] 失败 - 状态码: ${res.status}, res.ok: ${res.ok}, json: `, json);
        _logSync('error', '同步失败：服务器响应错误', { 
          status: res.status, 
          resOk: res.ok,
          jsonOk: json.ok,
          message: json.msg || json.error || '未知错误'
        });
        
        _retrySyncIfNeeded();
      }
    } catch(e) {
      console.error('[同步] 异常:', e);
      _setSyncDirty(true);
      _syncStatus.failedSyncs++;
      _syncStatus.lastSyncSuccess = false;
      _logSync('error', '同步失败：网络错误', { error: e.message, stack: e.stack });
      _retrySyncIfNeeded();
    } finally {
      _syncInProgress = false;
      _syncAbortController = null;

      // 同步期间又发生了写入，当前请求的 payload 已经不是最新数据。
      // 清掉旧定时器后重新上传，避免新旧请求并发或遗漏最新写入。
      if (_syncAgain) {
        _syncAgain = false;
        clearTimeout(_syncTimer);
        _firstDirtyTime = Date.now();
        _syncTimer = setTimeout(_doSync, DEBOUNCE_DELAY);
      }
    }
  }

  /** 同步失败后的重试机制 */
  function _retrySyncIfNeeded() {
    // 重置首次 dirty 时间，避免重试时立即触发强制同步
    _firstDirtyTime = Date.now();
    
    if (_syncRetryCount < MAX_SYNC_RETRIES) {
      _syncRetryCount++;
      const retryDelay = Math.min(3000 * _syncRetryCount, 30000); // 3s, 6s, 9s... 最多30s
      console.log(`同步失败，将在 ${retryDelay/1000}s 后重试 (第${_syncRetryCount}次)`);
      clearTimeout(_syncTimer);
      _syncTimer = setTimeout(_doSync, retryDelay);
    } else {
      // 达到最大重试次数后，继续尝试但间隔更长（60秒）
      console.warn('同步失败已达最大重试次数，将每60秒继续尝试');
      clearTimeout(_syncTimer);
      _syncTimer = setTimeout(() => {
        _syncRetryCount = 0; // 重置重试计数
        _doSync();
      }, 60000); // 60秒后再试
      
      if (typeof UI !== 'undefined') {
        UI.toast('数据同步遇到问题，正在后台持续重试...', 'warning', 4000);
      }
    }
  }

  // 页面关闭前确保最后一次同步。
  // pagehide 和 beforeunload 可能同时触发，因此整个页面生命周期只执行一次。
  let _emergencySyncInProgress = false;
  let _pageExitSyncStarted = false;

  // 紧急同步：使用同步 XHR，只有收到服务端成功响应才清除 dirty。
  function _emergencySync() {
    if (_pageExitSyncStarted || _emergencySyncInProgress) return;
    if (!_getSyncDirty()) return;

    const token = getToken();
    if (!token) return;

    _pageExitSyncStarted = true;
    _emergencySyncInProgress = true;
    if (_syncAbortController) {
      _syncAbortController.abort();
      _syncAbortController = null;
    }
    const exitMutation = _dataMutation;
    console.warn('[紧急同步] 页面即将关闭，执行同步保存');

    const payload = JSON.stringify({
      token,
      data: _collectData(),
      version: _dataVersion
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API + '?action=save', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);

      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText || '{}');
        if (result.ok && _dataMutation === exitMutation) {
          console.log('[紧急同步] 同步 XHR 成功');
          _setSyncDirty(false);
          if (result.version) {
            _dataVersion = result.version;
            localStorage.setItem('pets_data_version', String(result.version));
          }
          return;
        }
      }

      console.error('[紧急同步] 服务端未确认保存', xhr.status);
    } catch (e) {
      console.error('[紧急同步] 失败:', e);
    } finally {
      _emergencySyncInProgress = false;
    }
  }
  
  // 监听页面可见性变化（切换标签页、最小化）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && _getSyncDirty()) {
      // 页面隐藏时，如果有未同步数据，立即同步
      console.log('[可见性] 页面隐藏，立即同步');
      clearTimeout(_syncTimer);
      _firstDirtyTime = 0;
      _doSync(); // 异步同步，因为页面还在
    } else if (!document.hidden) {
      // 页面重新可见时，立即检查服务器更新
      console.log('[可见性] 页面重新可见，立即检查更新');
      _checkServerUpdate();
    }
  });
  
  // 监听窗口焦点（补充保障，某些浏览器 visibilitychange 不可靠）
  window.addEventListener('focus', () => {
    console.log('[焦点] 窗口获得焦点，立即检查更新');
    _checkServerUpdate();
  });
  
  // 统一的服务器更新检查函数
  async function _checkServerUpdate() {
    const token = getToken();
    if (!token) return;
    
    try {
      const tsRes = await fetch(API + '?action=getTimestamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const tsJson = await tsRes.json().catch(() => ({}));
      if (tsJson.ok) {
        const serverVersion = Number(tsJson.version || 0);
        const serverTime = tsJson.updatedAt;
        const hasNewVersion = serverVersion > _dataVersion;
        const hasNewTimestamp = serverTime && serverTime !== _lastKnownServerTime;

        if (hasNewVersion || hasNewTimestamp) {
          console.log('[更新检查] 检测到服务器有更新，立即拉取');
          _lastKnownServerTime = serverTime || _lastKnownServerTime;
          if (!_getSyncDirty()) {
            await loadFromServer(token, true);
          }
        }
      }
    } catch(e) {
      console.error('[更新检查] 失败:', e);
    }
  }
  
  // 监听页面卸载（关闭、刷新）
  window.addEventListener('pagehide', () => {
    _emergencySync();
  });

  // 兼容旧浏览器；重复触发由 _pageExitSyncStarted 防止。
  window.addEventListener('beforeunload', () => {
    _emergencySync();
  });

  /* ══════════════════════════════════════════════════════
     服务端 API 调用
  ══════════════════════════════════════════════════════ */

  /** 从服务端加载数据并还原到 localStorage */
  async function loadFromServer(token, isPolling = false) {
    // 互斥锁保护：防止轮询拉取和本地写入的竞态冲突
    if (_restoreLock) {
      console.log('loadFromServer: 已有还原操作在进行中，跳过本次拉取');
      _logSync('warning', '拉取跳过：还原操作进行中', { isPolling });
      return { ok: false, msg: 'restore_in_progress' };
    }
    
    const isDirty = localStorage.getItem('pets_sync_dirty') === '1';
    if (isDirty) {
      console.log('loadFromServer: 本地有未同步数据，跳过拉取');
      return { ok: false, msg: 'local_dirty' };
    }
    
    _restoreLock = true; // 上锁
    try {
      const res = await fetch(API + '?action=load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      // 安全解析 JSON 响应
      let json = {};
      try {
        const text = await res.text();
        if (text && text.trim()) {
          json = JSON.parse(text);
        } else {
          console.error('服务器返回空响应');
          _logSync('error', '服务器返回空响应');
          return { ok: false, msg: 'empty_response' };
        }
      } catch (parseError) {
        console.error('检查服务器数据失败:', parseError);
        _logSync('error', 'JSON解析失败', { error: parseError.message });
        
        // 如果本地有数据，自动上传修复服务器
        const localRecords = _get(K.records) || [];
        if (localRecords.length > 0) {
          console.warn('[自动修复] 服务器响应解析失败，自动上传本地数据...');
          (async () => {
            try {
              const result = await forceUploadLocalData();
              if (result.ok) {
                console.log('[自动修复] 上传成功', result);
                setTimeout(() => location.reload(), 1500);
              } else {
                console.error('[自动修复] 上传失败', result);
              }
            } catch (error) {
              console.error('[自动修复] 异常', error);
            }
          })();
        }
        
        return { ok: false, msg: 'parse_error' };
      }
      
      if (res.status === 401) {
        _handleKicked(json.msg);
        return { ok: false, kicked: true, msg: json.msg };
      }
      if (json.ok && json.data) {
        // Final safeguard: check dirty state AGAIN before restoring
        if (localStorage.getItem('pets_sync_dirty') === '1') {
          console.log('loadFromServer: 网络延迟期间本地已产生新写入，放弃还原');
          _logSync('warning', '拉取放弃：网络延迟期间本地产生写入', { isPolling });
          return { ok: false, msg: 'local_dirty_late' };
        }
        
        // Version check: if server data has a 'last_write' timestamp, compare it
        const localLastWrite = Number(localStorage.getItem('pets_last_write') || 0);
        const serverLastWrite = Number(json.data.last_write || 0);
        if (serverLastWrite < localLastWrite) {
          // 关键修复：若服务器版本号 >= 本地，说明服务器数据更权威（本地的 last_write 是旧设备残留），不能拒绝
          const _svVer = Number(json.version || 0);
          if (_svVer > 0 && _svVer >= _dataVersion) {
            console.log('loadFromServer: 服务端时间戳较旧但版本更新(' + _svVer + ' >= ' + _dataVersion + ')，继续还原');
          } else {
            console.log('loadFromServer: 服务端数据时间戳较旧且版本未更新，跳过还原');
            return { ok: false, msg: 'stale_server_version' };
          }
        }

        const hasChanged = _restoreData(json.data, json.version);
        if (hasChanged && isPolling) {
          // 轮询检测到数据更新，触发事件通知 UI 实时更新（不刷新页面）
          _logSync('success', '轮询检测到数据更新，触发 UI 更新', { version: json.version });
          _triggerUIUpdate(); // 使用防抖函数
        }
        return { ok: true };
      }
    } catch(e) {
      console.error('loadFromServer error:', e);
      _logSync('error', '拉取失败：网络错误', { error: e.message, isPolling });
    } finally {
      _restoreLock = false; // 解锁
    }
    return { ok: false };
  }

  /** 将服务端返回的 data 对象还原到 localStorage。返回是否有实质性变更。 */
  function _restoreData(data, serverVersion) {
    if (!data) return false;
    
    // === 数据完整性保护：防止旧数据覆盖新数据 ===
    
    // 1. 检查 records 数量：如果服务器数据明显少于本地，拒绝还原
    const localRecords = _get(K.records) || [];
    let serverRecords = [];
    
    try {
      if (data[K.records]) {
        if (typeof data[K.records] === 'string') {
          // 尝试解析 JSON 字符串
          serverRecords = JSON.parse(data[K.records]);
        } else if (Array.isArray(data[K.records])) {
          serverRecords = data[K.records];
        } else {
          // 记录详细的错误信息用于诊断
          const typeInfo = typeof data[K.records];
          const valuePreview = String(data[K.records]).substring(0, 200);
          console.error('检查服务器数据失败: records 格式无效', {
            type: typeInfo,
            preview: valuePreview,
            constructor: data[K.records]?.constructor?.name
          });
          _logSync('error', '服务器数据格式错误', { 
            recordsType: typeInfo,
            recordsPreview: valuePreview
          });
          
          // 自动上传本地数据修复服务器，无需用户确认
          console.warn('[自动修复] 服务器数据格式错误，自动上传本地数据...');
          (async () => {
            try {
              const result = await forceUploadLocalData();
              if (result.ok) {
                console.log('[自动修复] 上传成功', result);
                setTimeout(() => location.reload(), 1500);
              } else {
                console.error('[自动修复] 上传失败', result);
              }
            } catch (error) {
              console.error('[自动修复] 异常', error);
            }
          })();
          
          return false;
        }
      }
    } catch (e) {
      console.error('检查服务器数据失败:', e);
      _logSync('error', 'JSON解析失败', { error: e.message });
      
      console.warn('[自动修复] 服务器数据解析失败，自动上传本地数据...');
      (async () => {
        try {
          const result = await forceUploadLocalData();
          if (result.ok) {
            console.log('[自动修复] 上传成功', result);
            setTimeout(() => location.reload(), 1500);
          } else {
            console.error('[自动修复] 上传失败', result);
          }
        } catch (error) {
          console.error('[自动修复] 异常', error);
        }
      })();
      
      return false;
    }
    
    // ── 学生数量守卫（最可靠的"哪台设备数据正确"信号）──
    // 学生名册稳定、几乎不会大幅减少。若本地学生数明显多于服务器，
    // 说明本台设备（A）数据更完整，服务器可能被旧设备覆盖损坏 → 自动上传本地数据修复，
    // 绝不用服务器的残缺数据覆盖本地。注意：此判断不看版本号，
    // 因为损坏服务器的旧设备上传时也会把版本号 +1，版本号不可信。
    const _localStuds = _get(K.students) || [];
    let _serverStuds = data[K.students];
    if (typeof _serverStuds === 'string') { try { _serverStuds = JSON.parse(_serverStuds || '[]'); } catch (e) { _serverStuds = []; } }
    if (!Array.isArray(_serverStuds)) _serverStuds = [];

    let _localCls = _get(K.classes) || [];
    let _serverCls = data[K.classes];
    if (typeof _serverCls === 'string') { try { _serverCls = JSON.parse(_serverCls || '[]'); } catch (e) { _serverCls = []; } }
    if (!Array.isArray(_serverCls)) _serverCls = [];

    const _studentsRicher = _localStuds.length >= 3 && _serverStuds.length < _localStuds.length * 0.7;
    // 班级守卫已移除：班级的"跨设备新增/删除"由 _forceRestoreData 的合并+墓碑机制处理，
    // 不再需要在此处用全量上传的方式保护。

    if (_studentsRicher) {
      console.warn('[自动修复] 本地数据比服务器完整，自动上传本地数据修复服务器', {
        localStudents: _localStuds.length, serverStudents: _serverStuds.length,
        localClasses: _localCls.length, serverClasses: _serverCls.length
      });
      _logSync('warning', '本地数据比服务器完整，自动上传修复', {
        localStudents: _localStuds.length, serverStudents: _serverStuds.length
      });

      // 自动上传本地数据到服务器（不还原服务器数据，避免错误数据覆盖本地）
      _setSyncDirty(true);
      (async () => {
        try {
          if (typeof UI !== 'undefined') {
            UI.toast('🔧 检测到云端数据异常，正在自动恢复您的数据...', 'info', 4000);
          }
          const result = await forceUploadLocalData();
          if (result.ok) {
            console.log('[自动修复] 上传成功', result);
            if (typeof UI !== 'undefined') {
              UI.toast(`✅ 数据已自动恢复（${result.recordsCount} 条记录已同步到云端）`, 'success', 4000);
            }
          } else {
            console.error('[自动修复] 上传失败', result);
            if (typeof UI !== 'undefined') {
              UI.toast(`⚠️ 自动恢复未完成：${result.msg || '网络异常'}，请保持网络畅通后刷新页面`, 'warning', 6000);
            }
          }
        } catch (error) {
          console.error('[自动修复] 异常', error);
          if (typeof UI !== 'undefined') {
            UI.toast('⚠️ 自动恢复异常，请保持网络畅通后刷新页面', 'warning', 6000);
          }
        }
      })();

      return false; // 不还原服务器数据
    }

    // 服务器数据更多（新设备登录或本地数据丢失）→ 标记需要刷新，继续走还原流程
    if (_serverStuds.length > _localStuds.length || serverRecords.length > localRecords.length * 1.5) {
      window._needReloadAfterRestore = true;
    }

    // 2. 检查最后写入时间：如果服务器数据更旧，拒绝还原
    const localLastWrite = Number(localStorage.getItem('pets_last_write') || 0);
    const serverLastWrite = Number(data.last_write || 0);
    
    if (localLastWrite > 0 && serverLastWrite > 0 && serverLastWrite < localLastWrite - 60000) {
      // 服务器数据比本地旧超过1分钟。
      // 但代码走到这里已通过"学生数量守卫"（服务器学生数不少于本地的70%），
      // 若服务器学生数 >= 本地，说明服务器是更完整的权威数据
      // （本地的 last_write 可能是旧设备残留时间戳），仍应还原。
      if (_serverStuds.length >= _localStuds.length) {
        console.log('[数据保护] 服务器时间戳较旧但学生数不少于本地，仍信任服务器，继续还原');
      } else {
        console.error('数据保护：拒绝还原，服务器数据时间戳过旧', {
          local: new Date(localLastWrite).toLocaleString(),
          server: new Date(serverLastWrite).toLocaleString()
        });
        _logSync('error', '拒绝还原：服务器数据时间戳过旧', {
          localTime: localLastWrite,
          serverTime: serverLastWrite
        });
        return false;
      }
    }
    
    // === 数据还原逻辑 ===
    return _forceRestoreData(data, serverVersion);
  }
  
  /** 强制还原数据（跳过保护检查） */
  function _forceRestoreData(data, serverVersion) {
    // 已移除备份功能，优先实现快速实时同步
    
    // 全量清空内存缓存，防止缓存与localStorage不一致
    _memCache = {};
    
    let changed = false;
    Object.entries(data).forEach(([k, v]) => {
      // 跳过内部元数据字段，这些不算作真实数据变化
      if (k === 'last_write' || k === 'version') {
        return;
      }

      // ── 班级列表特殊处理：合并而非覆盖，防止本地新建/未同步的班级丢失 ──
      if (k === K.classes) {
        try {
          let serverCls = (typeof v === 'string') ? JSON.parse(v || '[]') : (Array.isArray(v) ? v : []);
          const localCls  = _get(K.classes);

          // 合并服务器上的删除墓碑（服务器可能比本地有更多的墓碑）
          let serverTomb = [];
          try {
            const st = data[K.deletedClasses];
            if (st) serverTomb = typeof st === 'string' ? JSON.parse(st) : (Array.isArray(st) ? st : []);
          } catch(e) {}
          const localTomb = _get(K.deletedClasses);
          // 合并所有已知的墓碑
          const allTomb = Array.from(new Set([...localTomb, ...serverTomb]));
          if (allTomb.length !== localTomb.length) {
            localStorage.setItem(K.deletedClasses, JSON.stringify(allTomb));
            _memCache[K.deletedClasses] = allTomb;
          }

          // 找出本地有、服务器没有、且未被墓碑标记（即本地新建但尚未同步到服务器）的班级
          const serverClsIds = new Set(serverCls.map(c => c.id));
          const localOnlyCls = localCls.filter(c => !serverClsIds.has(c.id) && !allTomb.includes(c.id));

          // 同样，过滤掉服务器班级中已被本地墓碑标记为删除的班级
          const mergedCls = [...serverCls.filter(c => !allTomb.includes(c.id)), ...localOnlyCls];

          const mergedStr = JSON.stringify(mergedCls);
          const oldVal = localStorage.getItem(k);
          if (mergedStr !== oldVal) {
            localStorage.setItem(k, mergedStr);
            _memCache[k] = mergedCls;
            changed = true;
          }
        } catch(e) {
          console.error('[还原] 班级合并失败，回退到直接写入:', e);
          const newVal = (typeof v === 'string') ? v : JSON.stringify(v);
          const oldVal = localStorage.getItem(k);
          if (newVal !== oldVal) { localStorage.setItem(k, newVal); _memCache[k] = undefined; changed = true; }
        }
        return; // 已处理，跳过下方通用逻辑
      }

      let newVal = (typeof v === 'string') ? v : JSON.stringify(v);

      // 优化：只在必要时检查 records 长度，避免每次登录都解析大数组
      if (k === K.records && typeof UI !== 'undefined') {
        try {
          // 快速检查：只看字符串长度，避免解析整个数组
          const jsonStr = typeof v === 'string' ? v : JSON.stringify(v);
          const approxCount = (jsonStr.match(/\{/g) || []).length; // 粗略估计对象数量
          
          // 仅提醒，不自动删除数据（永久保存所有数据）
          if (approxCount > 10000) {
            const warned = sessionStorage.getItem('records_10000_warning_shown');
            if (!warned) {
              console.warn('积分记录已超过10000条，当前：' + approxCount + ' 条');
              if (typeof UI !== 'undefined') {
                UI.toast('📊 积分记录已超过10000条，系统将永久保存。建议定期导出备份。', 'info', 4000);
              }
              sessionStorage.setItem('records_10000_warning_shown', '1');
            }
          } else if (approxCount > 8000) {
            const warned = sessionStorage.getItem('records_8000_warning_shown');
            if (!warned) {
              console.info('积分记录较多：' + approxCount + ' 条');
              if (typeof UI !== 'undefined') {
                UI.toast('📊 积分记录较多，建议定期导出备份以防数据丢失', 'info', 3000);
              }
              sessionStorage.setItem('records_8000_warning_shown', '1');
            }
          }
        } catch (e) {
          console.error('检查 records 长度失败:', e);
        }
      }

      const oldVal = localStorage.getItem(k);
      if (newVal !== oldVal) {
        try {
          localStorage.setItem(k, newVal);
          changed = true; // 只有业务数据变化才标记为 changed
        } catch (e) {
          console.error('Restore setItem failed for', k, e);
          if (typeof UI !== 'undefined') UI.toast('由于本地存储空间不足，部分数据同步失败', 'error', 3000);
        }
      }
    });
    
    // 更新本地版本号（但不算作数据变化）
    if (serverVersion) {
      _dataVersion = serverVersion;
      localStorage.setItem('pets_data_version', serverVersion.toString());
    }
    
    // 注意：不在这里刷新页面，因为可能是登录流程中调用的
    // 刷新标志会被保存到 localStorage，由外部在合适的时机检查并刷新
    if (window._needReloadAfterRestore && changed) {
      localStorage.setItem('_needReloadAfterDataRestore', 'true');
      console.log('[数据同步] 服务器数据已拉取完成，标记需要刷新页面');
    }
    
    return changed;
  }

  /** 注册（带激活码） */
  async function apiRegister(username, name, password, activationCode = '') {
    try {
      const res = await fetch(API + '?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password, activationCode }),
      });
      return await res.json();
    } catch(e) {
      return { ok: false, msg: '无法连接到服务器，请检查网络或PHP服务是否启动' };
    }
  }

  /** 登录 */
  async function apiLogin(username, password) {
    try {
      const res = await fetch(API + '?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      // 如果服务端有存档数据，还原到 localStorage
      if (json.ok && json.data) {
        // ════════════════════════════════════════════════════════
        // 自动数据救援：登录前先判断"本地数据是否明显比服务器完整"。
        // 场景：A 设备（数据正确）此前因 bug 被另一台旧设备上传的数据覆盖了服务器，
        //       此时 A 设备本地仍保留正确数据，应自动把本地数据上传覆盖服务器，
        //       而不是反过来被服务器的错误数据覆盖。
        // 安全约束：只有"本地学生数明显多于服务器"时才自动上传，
        //       全新设备(本地为空)或正常少量删除都不会误触发。
        // ════════════════════════════════════════════════════════
        let _autoRecover = false;
        try {
          const localStudents = _get(K.students) || [];
          let serverStudents = json.data[K.students];
          if (typeof serverStudents === 'string') serverStudents = JSON.parse(serverStudents || '[]');
          if (!Array.isArray(serverStudents)) serverStudents = [];

          const localClasses = _get(K.classes) || [];
          let serverClasses = json.data[K.classes];
          if (typeof serverClasses === 'string') serverClasses = JSON.parse(serverClasses || '[]');
          if (!Array.isArray(serverClasses)) serverClasses = [];

          // 本地有实质数据，且服务器学生数 < 本地的 70%
          const studentsLost = localStudents.length >= 3 && serverStudents.length < localStudents.length * 0.7;
          // 班级守卫已移除：由 _forceRestoreData 的合并+墓碑机制处理跨设备班级同步
          if (studentsLost) {
            _autoRecover = true;
            console.warn('[自动救援] 检测到服务器数据少于本地，将自动上传本地数据修复', {
              localStudents: localStudents.length, serverStudents: serverStudents.length,
              localClasses: localClasses.length, serverClasses: serverClasses.length
            });
          }
        } catch (e) {
          console.error('[自动救援] 比较数据时出错（跳过救援，走正常还原）:', e);
        }

        if (_autoRecover) {
          // 不还原服务器数据（避免错误数据覆盖本地正确数据），改为自动上传本地数据修复服务器
          if (typeof UI !== 'undefined') {
            UI.toast('🔧 检测到云端数据异常，正在自动恢复您的数据，请稍候...', 'info', 4000);
          }
          // 标记脏数据并延迟上传，确保 token 已写入
          _setSyncDirty(true);
          setTimeout(async () => {
            const r = await forceUploadLocalData();
            if (typeof UI !== 'undefined') {
              if (r.ok) {
                UI.toast(`✅ 数据已自动恢复（${r.recordsCount} 条记录已同步到云端）`, 'success', 4000);
              } else {
                UI.toast(`⚠️ 自动恢复未完成：${r.msg || '网络异常'}，请保持网络畅通后刷新页面`, 'warning', 6000);
              }
            }
          }, 800);
        } else {
          // 正常流程：还原服务器数据到本地
          _restoreData(json.data, json.version);
          // 关键修复：登录后把本地写时钟同步为服务器的 last_write，
          // 否则 afterLogin 里的 loadFromServer 会因为"本地时间戳更新"而拒绝拉取，
          // 导致换设备登录看到空数据 / 数据不同步。
          const srvWrite = Number(json.data.last_write || 0);
          if (srvWrite > 0) {
            localStorage.setItem('pets_last_write', String(srvWrite));
          }
          // 同步本地版本号，保证后续版本号比较正确
          if (json.version) {
            _dataVersion = json.version;
            localStorage.setItem('pets_data_version', String(json.version));
          }
          // === 关键修复：防止登录后立即上传本地旧数据覆盖服务器 ===
          // 登录时从服务器拉取的数据是权威的，不应触发上传
          _setSyncDirty(false);
          // 清空同步定时器，防止登录前的本地操作残留定时器触发上传
          clearTimeout(_syncTimer);
          _syncTimer = null;
          _firstDirtyTime = 0;
          _syncRetryCount = 0;
          // 初始化轮询的时间戳基准，防止首次轮询立即触发冗余 loadFromServer
          _lastKnownServerTime = json.updatedAt || null;
        }
      }
      return json;
    } catch(e) {
      return { ok: false, msg: '无法连接到服务器，请检查网络或PHP服务是否启动' };
    }
  }

  /** 登出（先最终同步，再删 token） */
  async function apiLogout() {
    console.log('[退出登录] 开始退出流程');
    const token = getToken();
    clearTimeout(_syncTimer);
    stopPolling();
    
    // 设置退出标志，防止其他地方的 401 处理触发"被挤掉线"提示
    _isLoggingOut = true;
    console.log('[退出登录] 已设置退出标志 _isLoggingOut = true');
    
    if (token) {
      // 最终同步（尽力而为，失败也不阻止退出）
      try {
        console.log('[退出登录] 正在进行最终数据同步...');
        const logoutMutation = _dataMutation;
        const saveRes = await fetch(API + '?action=save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            data: _collectData(),
            version: _dataVersion
          }),
        });
        const saveJson = await saveRes.json().catch(() => ({}));
        if (saveRes.ok && saveJson.ok && _dataMutation === logoutMutation) {
          _setSyncDirty(false);
          if (saveJson.version) {
            _dataVersion = saveJson.version;
            localStorage.setItem('pets_data_version', String(saveJson.version));
          }
          console.log('[退出登录] 最终同步完成');
        } else {
          console.warn('[退出登录] 最终同步未确认保存', saveJson);
        }
      } catch(e) { 
        console.log('[退出登录] 最终同步失败（忽略）:', e.message);
      }
      
      // 删除服务器端的 token
      try {
        console.log('[退出登录] 正在删除服务器 token...');
        await fetch(API + '?action=logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        console.log('[退出登录] 服务器 token 已删除');
      } catch(e) { 
        console.log('[退出登录] 删除服务器 token 失败（忽略）:', e.message);
      }
    }
    
    // 清理本地状态
    console.log('[退出登录] 清理本地状态...');
    clearToken();
    session.clear();
    _isLoggingOut = false;
    console.log('[退出登录] 退出流程完成');
  }

  /** 修改教师姓名 */
  async function apiChangeName(name) {
    const token = getToken();
    if (!token) return { ok: false, msg: '未登录' };
    try {
      const res = await fetch(API + '?action=changeName', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name }),
      });
      const json = await res.json();
      if (res.status === 401) {
        clearToken();
        session.clear();
        return json;
      }
      return json;
    } catch(e) {
      return { ok: false, msg: '网络错误' };
    }
  }

  /** 验证 token 是否仍有效（页面刷新时调用） */
  async function apiVerify(token) {
    try {
      const res = await fetch(API + '?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return await res.json();
    } catch(e) {
      return { ok: false, msg: 'offline' };
    }
  }

  /** 创建班级概览分享链接（需已登录且服务端可用） */
  async function apiCreateClassShare(daysValid, snapshot) {
    const token = getToken();
    if (!token) return { ok: false, msg: '请先登录' };
    try {
      const res = await fetch(API + '?action=createClassShare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, daysValid, snapshot }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearToken();
        session.clear();
        if (typeof UI !== 'undefined') UI.toast('已有其他设备登录，请重新登录', 'warning');
        if (typeof App !== 'undefined' && App.goto) App.goto('auth');
        return json;
      }
      return json;
    } catch(e) {
      return { ok: false, msg: '网络错误，请确认已启动 PHP 服务' };
    }
  }

  /* ══════════════════════════════════════════════════════
     数据实体 CRUD（与原来完全相同，读写均操作 localStorage）
  ══════════════════════════════════════════════════════ */

  /* ── Session ── */
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(K.session)); } catch(e) { return null; } },
    set(t) { localStorage.setItem(K.session, JSON.stringify(t)); },
    clear() { localStorage.removeItem(K.session); },
  };

  /* ── Teachers（本地缓存，仅用于兼容；账号权威数据在服务端）── */
  const teachers = {
    all() { return _get(K.teachers); },
    find(id) { return this.all().find(t => t.id === id); },
    findByUsername(u) { return this.all().find(t => t.username === u); },
    upsert(teacher) {
      // 将服务端返回的 teacher 写入本地列表（不触发同步）
      const list = this.all();
      const idx = list.findIndex(t => t.id === teacher.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...teacher };
      else list.push(teacher);
      localStorage.setItem(K.teachers, JSON.stringify(list));
    },
  };

  /* ── Classes ── */
  const classes = {
    all() { return _get(K.classes); },
    byTeacher(tid) { return this.all().filter(c => c.teacherId === tid); },
    find(id) { return this.all().find(c => c.id === id); },
    create(data) {
      const list = this.all();
      const c = { id: genId(), createdAt: new Date().toISOString(), ...data };
      list.push(c);
      _set(K.classes, list, true); // 班级新建：立即同步，防止多设备竞争覆盖
      return c;
    },
    update(id, data) {
      _set(K.classes, this.all().map(c => c.id === id ? { ...c, ...data } : c), true); // 班级更新：立即同步
    },
    remove(id) {
      // 写入墓碑：记录此ID已被删除，防止其他设备把它重新上传回来
      const tomb = _get(K.deletedClasses);
      if (!tomb.includes(id)) {
        tomb.push(id);
        // 墓碑只保留最近200条，避免无限增长
        const trimmed = tomb.slice(-200);
        localStorage.setItem(K.deletedClasses, JSON.stringify(trimmed));
        _memCache[K.deletedClasses] = trimmed;
      }
      _set(K.classes, this.all().filter(c => c.id !== id), true); // 班级删除：立即同步
    },
  };

  /* ── Students ── */
  const students = {
    all() {
      const raw = _get(K.students);
      // Migration: convert legacy groupId to groupIds if not present
      return raw.map(s => {
        if (!s.groupIds) {
          s.groupIds = s.groupId ? [s.groupId] : [];
        }
        return s;
      });
    },
    byClass(cid) {
      const list = this.all().filter(s => s.classId === cid);
      // 应用本地座位顺序快照（不参与云端同步，避免多设备/刷新时被覆盖）
      try {
        const raw = localStorage.getItem('pets_seat_order_' + cid);
        if (raw) {
          const orderIds = JSON.parse(raw);
          if (Array.isArray(orderIds) && orderIds.length) {
            const idxMap = new Map();
            orderIds.forEach((id, i) => idxMap.set(id, i));
            list.sort((a, b) => {
              const ai = idxMap.has(a.id) ? idxMap.get(a.id) : Number.MAX_SAFE_INTEGER;
              const bi = idxMap.has(b.id) ? idxMap.get(b.id) : Number.MAX_SAFE_INTEGER;
              return ai - bi;
            });
          }
        }
      } catch(e) {}
      return list;
    },
    find(id) { return this.all().find(s => s.id === id); },
    create(data) {
      const list = this.all();
      const s = {
        id: genId(),
        createdAt: new Date().toISOString(),
        totalScore: 0,
        chickenLegs: 0,
        fedLegs: 0,
        groupIds: [], // Array of group IDs
        groupId: null, // Legacy: keep for compatibility during transition
        medals: [],
        badges: [],
        petStickers: [],  // 「养成成功」召唤神兽写入的满级萌宠贴纸 [{petType,petName,imgPath,date}]
        fullLevelPets: [],  // 满级宠物记录 [{petType,petName,imgPath,date}]
        cumulativeFedLegs: 0, // 历次召唤神兽前的 fedLegs 累计，仅用于展示「投喂总数」
        shopRedeemDebt: 0,   // 小卖部兑换已消耗的总积分（从福利榜积分中扣减，不动徽章 totalScore）
        lastPetFedAt: null, // ISO，上次投喂时间（手动投喂 / 加分联动投喂）
        ...data,
      };
      delete s.studentNo;
      list.push(s);
      _set(K.students, list);
      return s;
    },
    update(id, data, immediate = false) {
      const list = this.all().map((s) => {
        if (s.id !== id) return s;
        const merged = { ...s, ...data };
        delete merged.studentNo;
        return merged;
      });
      _set(K.students, list, immediate);
      return this.find(id);
    },
    remove(id) {
      _set(K.students, this.all().filter(s => s.id !== id));
    },
    /** 按班级重排学生顺序：orderedIds 为该班级学生 id 的新顺序 */
    reorderByClass(cid, orderedIds) {
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
      const list = this.all();
      const idSet = new Set(orderedIds);
      const idToStudent = new Map();
      list.forEach(s => { if (s.classId === cid && idSet.has(s.id)) idToStudent.set(s.id, s); });
      // 保留原顺序中非本班级的学生位置，本班级学生按 orderedIds 顺序插入
      const orderedForClass = orderedIds.map(id => idToStudent.get(id)).filter(Boolean);
      let idx = 0;
      const next = list.map(s => {
        if (s.classId === cid && idSet.has(s.id)) {
          const replacement = orderedForClass[idx];
          idx += 1;
          return replacement;
        }
        return s;
      });
      _set(K.students, next, true);
      // 同时保存本地座位顺序快照，避免刷新/多设备同步时被服务器旧顺序覆盖
      try { localStorage.setItem('pets_seat_order_' + cid, JSON.stringify(orderedIds)); } catch(e) {}
    },
    addScore(id, amount, reason, type) {
      const s = this.find(id);
      if (!s) return null;
      if (!s.petType) return null;
      const c0 = s.chickenLegs || 0;
      const f0 = s.fedLegs || 0;
      // 加分/扣分均须已有萌宠（与鸡腿关联）；徽章 totalScore 仅由满级召唤等单独入口变更
      // 规则：加减分直接作用于升级进度 fedLegs（与「还差 X 🍗」严格一致）。
      //   加 N 分 → fedLegs +N；扣 N 分 → fedLegs -N。
      //   chickenLegs 缓冲区只服务于「投喂宠物」机制，不参与加减分，故加减分时保持不变。
      //   福利积分 = fedLegs + chickenLegs − debt，仍随分值 ±N 变化，结果一致。
      const chickenLegs = c0;
      const fedLegs = f0 + amount;
      const legsDeltaChicken = chickenLegs - c0;
      const legsDeltaFed = fedLegs - f0;
      // 加分视为老师关注，刷新饥饿计时；扣分不刷新
      const feedClock = amount > 0 ? { lastPetFedAt: new Date().toISOString() } : {};
      // 先手动准备好所有数据（学生+记录），再统一触发同步，避免 update(immediate=true)
      // 先于 records.create 上传，导致同步 payload 缺少新记录的竞态问题
      const sList = this.all().map(s2 => s2.id === id
        ? { ...s2, chickenLegs, fedLegs, ...feedClock }
        : s2);
      _set(K.students, sList);
      const rList = records.all();
      rList.push({
        id: genId(),
        createdAt: new Date().toISOString(),
        studentId: id,
        studentName: s.name,
        classId: s.classId,
        type: amount >= 0 ? (type || 'add') : 'deduct',
        amount,
        reason: reason || (amount > 0 ? '加分' : '扣分'),
        legsDeltaChicken: legsDeltaChicken,
        legsDeltaFed: legsDeltaFed,
      });
      // 保留最近 8000 条记录，防止 localStorage 爆满
      if (rList.length > 8000) {
        const trimmed = rList.slice(rList.length - 8000);
        _set(K.records, trimmed, true); // immediate=true：学生已先写入，此时立即同步两者都在 payload 中
      } else {
        _set(K.records, rList, true); // immediate=true：保证多设备实时同步
      }
      return this.find(id);
    },
    batchAddScoreAndFeed(ids, amount, reason, feedReason) {
      if (!ids || ids.length === 0) return;
      const sList = this.all();
      const rList = records.all();
      let changedS = false;
      let changedR = false;
      const nowIso = new Date().toISOString();

      const newSList = sList.map(s => {
        if (!ids.includes(s.id)) return s;
        if (!s.petType) return s;

        const c0 = s.chickenLegs || 0;
        const f0 = s.fedLegs || 0;

        // 与 addScore 一致：加减分直接作用于升级进度 fedLegs，chickenLegs 缓冲不变。
        // feedReason 参数已不再触发额外投喂（升级进度已随分值变化）。
        const chickenLegs = c0;
        const fedLegs = f0 + amount;

        const legsDeltaChicken = chickenLegs - c0;
        const legsDeltaFed = fedLegs - f0;

        rList.push({
          id: genId(), createdAt: nowIso, studentId: s.id, studentName: s.name, classId: s.classId,
          type: amount >= 0 ? 'add' : 'deduct', amount, reason: reason || (amount > 0 ? '加分' : '扣分'),
          legsDeltaChicken, legsDeltaFed
        });
        changedR = true;

        let merged = { ...s, chickenLegs, fedLegs };
        if (amount > 0) merged.lastPetFedAt = nowIso;

        changedS = true;
        return merged;
      });

      if (changedS) _set(K.students, newSList);
      if (changedR) _set(K.records, rList);
    },
    feedChickenLeg(id, reason) {
      const s = this.find(id);
      if (!s) return { ok: false, msg: '找不到学生' };
      if (!s.petType) return { ok: false, msg: '暂无萌宠，请先完成领养' };
      if (s.chickenLegs < 1) return { ok: false, msg: '鸡腿不足，无法投喂！' };
      const fedLegs = (s.fedLegs || 0) + 1;
      const chickenLegs = s.chickenLegs - 1;
      const nowIso = new Date().toISOString();
      this.update(id, { fedLegs, chickenLegs, lastPetFedAt: nowIso });
      records.create({
        studentId: id,
        studentName: s.name,
        classId: s.classId,
        type: 'feed',
        amount: -1,
        fedAmount: 1,
        reason: reason || '投喂鸡腿',
      });
      return { ok: true, updated: this.find(id) };
    },

    /**
     * 一次投喂最多 count 根鸡腿（受当前 chickenLegs 限制），一次 update + 一条记录。
     * 用于批量加分后投喂，避免 N×val 次循环阻塞主线程。
     */
    feedChickenLegsCount(id, count, reason) {
      const s = this.find(id);
      if (!s) return { ok: false, fed: 0, msg: '找不到学生' };
      if (!s.petType) return { ok: false, fed: 0, msg: '暂无萌宠，请先完成领养' };
      const n = Math.max(0, Math.floor(Number(count) || 0));
      if (n < 1) return { ok: false, fed: 0, msg: '数量无效' };
      const available = Math.max(0, Math.floor(s.chickenLegs || 0));
      const toFeed = Math.min(n, available);
      if (toFeed < 1) return { ok: false, fed: 0, msg: '鸡腿不足' };
      const fedLegs = (s.fedLegs || 0) + toFeed;
      const chickenLegs = available - toFeed;
      const nowIso = new Date().toISOString();
      this.update(id, { fedLegs, chickenLegs, lastPetFedAt: nowIso });
      records.create({
        studentId: id,
        studentName: s.name,
        classId: s.classId,
        type: 'feed',
        amount: -toFeed,
        fedAmount: toFeed,
        reason: reason || '批量投喂',
      });
      return { ok: true, fed: toFeed, updated: this.find(id) };
    },

    // 一次性投喂该学生全部鸡腿，只生成一条记录
    feedAllLegs(id, reason) {
      const s = this.find(id);
      if (!s) return { ok: false, fed: 0, msg: '找不到学生' };
      if (!s.petType) return { ok: false, fed: 0, msg: '暂无萌宠，请先完成领养' };
      const count = s.chickenLegs || 0;
      if (count < 1) return { ok: false, fed: 0, msg: '鸡腿不足' };
      const fedLegs = (s.fedLegs || 0) + count;
      const nowIso = new Date().toISOString();
      this.update(id, { fedLegs, chickenLegs: 0, lastPetFedAt: nowIso });
      records.create({
        studentId: id,
        studentName: s.name,
        classId: s.classId,
        type: 'feed',
        amount: -count,
        fedAmount: count,
        reason: reason || '批量升级投喂',
      });
      return { ok: true, fed: count, updated: this.find(id) };
    },

    /** 召唤神兽：满级后召唤，徽章+1，记录满级宠物，进入领养状态 */
    summonMaxLevel(id) {
      const s = this.find(id);
      if (!s || !s.petType) return { ok: false, msg: '无宠物可召唤' };
      const levelCfg = Store.levels.get(s.classId) || DEFAULT_LEVELS;
      const maxLv = getMaxLevel(levelCfg);
      const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
      if (li.level !== maxLv.level) return { ok: false, msg: '宠物尚未满级' };

      const pet = getPet(s.petType);
      const prevFed = s.fedLegs || 0;
      const cumulativeFedLegs = (s.cumulativeFedLegs || 0) + prevFed;

      // 批量更新以减少写入次数
      const sList = this.all();
      const sIdx = sList.findIndex(item => item.id === id);
      if (sIdx !== -1) {
        sList[sIdx] = {
          ...sList[sIdx],
          petType: null,
          fedLegs: 0,
          cumulativeFedLegs,
          fullLevelPets: [...(sList[sIdx].fullLevelPets || []), {
            petType: s.petType,
            petName: pet.name,
            imgPath: getPetImg(s.petType, maxLv.stage),
            date: new Date().toISOString(),
          }],
          totalScore: (sList[sIdx].totalScore || 0) + 1
        };
      }

      const rList = records.all();
      rList.push({
        id: genId(),
        createdAt: new Date().toISOString(),
        studentId: id,
        studentName: s.name,
        classId: s.classId,
        type: 'summon',
        petType: s.petType,
        petName: pet.name,
        reason: '召唤神兽成功',
      });

      _set(K.students, sList);
      _set(K.records, rList, true); // 关键操作立即同步

      return { ok: true, updated: sList[sIdx] };
    },

    /** 领养新宠物 */
    adoptPet(id, petType) {
      const s = this.find(id);
      if (!s) return { ok: false, msg: '学生不存在' };
      const nowIso = new Date().toISOString();
      this.update(id, { petType, fedLegs: 0, chickenLegs: 0, lastPetFedAt: nowIso }, true);
      return { ok: true, updated: this.find(id) };
    },
  };

  /* ── Records ── */
  const records = {
    all() { return _get(K.records); },
    byClass(cid) { return this.all().filter(r => r.classId === cid); },
    byStudent(sid) { return this.all().filter(r => r.studentId === sid); },
    create(data) {
      let list = this.all();
      const r = { id: genId(), createdAt: new Date().toISOString(), ...data };
      list.push(r);
      // 防止 localStorage 爆满，保留最近 8000 条记录
      if (list.length > 8000) {
        list = list.slice(list.length - 8000);
      }
      _set(K.records, list, data.immediate || false);
      return r;
    },
    removeById(id) { _set(K.records, this.all().filter(r => r.id !== id)); },
    removeByStudent(sid) { _set(K.records, this.all().filter(r => r.studentId !== sid)); },
    removeByClass(cid) { _set(K.records, this.all().filter(r => r.classId !== cid)); },
    update(id, data) {
      _set(K.records, this.all().map(r => r.id === id ? { ...r, ...data } : r));
    },
  };

  /* ── Groups ── */
  const groups = {
    all() { return _get(K.groups); },
    byClass(cid) { return this.all().filter(g => g.classId === cid); },
    find(id) { return this.all().find(g => g.id === id); },
    create(data) {
      const list = this.all();
      const g = { id: genId(), createdAt: new Date().toISOString(), ...data };
      list.push(g);
      _set(K.groups, list);
      return g;
    },
    update(id, data) {
      _set(K.groups, this.all().map(g => g.id === id ? { ...g, ...data } : g));
    },
    remove(id) {
      _set(K.groups, this.all().filter(g => g.id !== id));
      const sList = students.all().map(s => {
        if (s.groupIds && s.groupIds.includes(id)) {
          return { ...s, groupIds: s.groupIds.filter(gid => gid !== id), groupId: (s.groupId === id ? null : s.groupId) };
        }
        return s;
      });
      _set(K.students, sList);
    },
  };

  /* ── Shop Items ── */
  const shop = {
    all() { return _get(K.shop); },
    byClass(cid) { return this.all().filter(i => i.classId === cid); },
    find(id) { return this.all().find(i => i.id === id); },
    create(data) {
      const list = this.all();
      const item = { id: genId(), createdAt: new Date().toISOString(), stock: -1, ...data };
      list.push(item);
      _set(K.shop, list);
      return item;
    },
    update(id, data) {
      _set(K.shop, this.all().map(i => i.id === id ? { ...i, ...data } : i));
    },
    remove(id) {
      _set(K.shop, this.all().filter(i => i.id !== id));
    },
    redeem(itemId, studentId) {
      const item = this.find(itemId);
      const student = students.find(studentId);
      if (!item || !student) return { ok: false, msg: '找不到商品或学生' };
      if (item.stock === 0) return { ok: false, msg: '商品已售罄' };
      const welfare = getLeaderboardWelfareScore(student);
      if (welfare < item.price) return { ok: false, msg: '积分不足' };
      students.update(studentId, {
        shopRedeemDebt: Math.max(0, (Number(student.shopRedeemDebt) || 0) + item.price),
      });
      if (item.stock > 0) this.update(itemId, { stock: item.stock - 1 });
      records.create({
        studentId,
        studentName: student.name,
        classId: student.classId,
        type: 'redeem',
        amount: -item.price,
        reason: `兑换商品：${item.name}（消耗${item.price}积分）`,
        immediate: true,
      });
      if (item.isMedal) {
        const updated = students.find(studentId);
        const medals = [...(updated.medals || []), {
          title: item.name,
          icon: item.icon || '🏅',
          date: new Date().toISOString(),
        }];
        students.update(studentId, { medals });
      }
      return { ok: true };
    },
  };

  /* ── Level Settings ── */
  const levels = {
    _key(cid) { return K.levels + '_' + cid; },
    get(cid) {
      try {
        const v = localStorage.getItem(this._key(cid));
        return v ? JSON.parse(v) : JSON.parse(JSON.stringify(DEFAULT_LEVELS));
      } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_LEVELS)); }
    },
    set(cid, cfg) {
      localStorage.setItem(this._key(cid), JSON.stringify(cfg));
      _scheduleSync();
    },
  };

  /* ── 加分/减分项目配置（单击卡片弹框） ── */
  /** 去掉无效项、控制字符与空名称，避免配置表出现多行空白或损坏条目 */
  function cleanScoreItemList(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const name = String(raw.name || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
      if (!name) continue;
      const py = String(raw.py || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
      const n = parseInt(raw.value, 10);
      const value = Math.max(1, Math.min(9999, Number.isFinite(n) && n > 0 ? n : 1));
      let icon = String(raw.icon || 'ri-star-line').trim();
      if (!icon || !/^ri-[\w-]+$/.test(icon)) icon = 'ri-star-line';
      out.push({ name, value, icon, py });
    }
    return out;
  }

  const scoreItems = {
    _key(cid) { return 'pets_scoreItems_' + cid; },
    get(cid) {
      const defaultAdd = typeof SCORE_ADD_ITEMS !== 'undefined' ? JSON.parse(JSON.stringify(SCORE_ADD_ITEMS)) : [];
      const defaultDeduct = typeof SCORE_DEDUCT_ITEMS !== 'undefined' ? JSON.parse(JSON.stringify(SCORE_DEDUCT_ITEMS)) : [];
      let add = defaultAdd;
      let deduct = defaultDeduct;
      try {
        const v = localStorage.getItem(this._key(cid));
        if (v) {
          const o = JSON.parse(v);
          if (o && typeof o === 'object') {
            if (Array.isArray(o.add) && o.add.length > 0) {
              const cleaned = cleanScoreItemList(o.add);
              if (cleaned.length > 0) add = cleaned;
            }
            if (Array.isArray(o.deduct) && o.deduct.length > 0) {
              const cleaned = cleanScoreItemList(o.deduct);
              if (cleaned.length > 0) deduct = cleaned;
            }
          }
        }
      } catch(e) { /* 解析失败则用默认 */ }
      return { add, deduct };
    },
    set(cid, cfg) {
      localStorage.setItem(this._key(cid), JSON.stringify(cfg));
      _scheduleSync();
    },
  };

  /* ── 宠物饥饿（按班级） ── */
  const hunger = {
    _key(cid) { return 'pets_hunger_' + cid; },
    get(cid) {
      try {
        const v = localStorage.getItem(this._key(cid));
        if (v) {
          const o = JSON.parse(v);
          const d = typeof getDefaultPetHungerConfig === 'function'
            ? getDefaultPetHungerConfig()
            : { enabled: true, vacationMode: false, hungryAfterDays: 3, criticalAfterDays: 7, starveAfterDays: 30 };
          return { ...d, ...o };
        }
      } catch(e) { }
      return typeof getDefaultPetHungerConfig === 'function'
        ? getDefaultPetHungerConfig()
        : { enabled: true, vacationMode: false, hungryAfterDays: 3, criticalAfterDays: 7, starveAfterDays: 30 };
    },
    set(cid, cfg) {
      localStorage.setItem(this._key(cid), JSON.stringify(cfg));
      _scheduleSync();
    },
  };

  /** 旧版小卖部扣的是徽章 totalScore；新版改扣总积分 shopRedeemDebt。对仍缺少 shopRedeemDebt 字段的学生：按兑换记录补记债务，并退回当时扣掉的徽章数。 */
  function migrateLegacyShopRedeemDebt() {
    const studs = _get(K.students);
    const redeemSumBySid = {};
    for (const r of _get(K.records)) {
      if (r.type !== 'redeem' || !r.studentId) continue;
      redeemSumBySid[r.studentId] = (redeemSumBySid[r.studentId] || 0) + Math.abs(r.amount || 0);
    }
    let changed = false;
    const next = studs.map(s => {
      if (Object.prototype.hasOwnProperty.call(s, 'shopRedeemDebt')) return s;
      changed = true;
      const debt = redeemSumBySid[s.id] || 0;
      return {
        ...s,
        shopRedeemDebt: debt,
        totalScore: Math.max(0, (s.totalScore || 0) + debt),
      };
    });
    if (changed) _set(K.students, next);
  }
  migrateLegacyShopRedeemDebt();

  /* ── 删除班级（级联） ── */
  function deleteClass(cid) {
    classes.remove(cid);
    _set(K.students, _get(K.students).filter(s => s.classId !== cid));
    records.removeByClass(cid);
    _set(K.groups, _get(K.groups).filter(g => g.classId !== cid));
    _set(K.shop, _get(K.shop).filter(i => i.classId !== cid));
    _remove(levels._key(cid));
    _remove(scoreItems._key(cid));
    _remove(hunger._key(cid));
  }

  /* ── 公开接口 ── */
  /* ── 渲染期学生→记录索引（避免每张卡片都全量扫描 records） ── */
  let _studentRecordsIndex = null; // Map<studentId, Record[]>，仅渲染期有效

  function setStudentRecordsIndex(map) { _studentRecordsIndex = map; }
  function clearStudentRecordsIndex() { _studentRecordsIndex = null; }
  /** 获取某学生的记录列表：渲染期使用预建索引（O(1)），其他时候直接过滤（O(n)）*/
  function getRecordsForStudent(sid) {
    if (_studentRecordsIndex) return _studentRecordsIndex.get(sid) || [];
    return records.byStudent(sid);
  }

  /** 数据健康检查 */
  function checkDataHealth() {
    const health = {
      ok: true,
      warnings: [],
      stats: {}
    };
    
    try {
      // 检查关键数据
      const records = _get(K.records) || [];
      const students = _get(K.students) || [];
      const classes = _get(K.classes) || [];
      
      health.stats = {
        recordCount: records.length,
        studentCount: students.length,
        classCount: classes.length,
        lastWrite: Number(localStorage.getItem('pets_last_write') || 0),
        version: _dataVersion
      };
      
      // 检查是否有备份
      const backupStr = localStorage.getItem('pets_data_backup');
      if (backupStr) {
        const backup = JSON.parse(backupStr);
        health.stats.backupTime = backup.timestamp;
        health.stats.backupRecordCount = backup.records?.length || 0;
        
        // 如果备份的记录数明显多于当前数据，发出警告
        if (backup.records && backup.records.length > records.length * 1.2) {
          health.ok = false;
          health.warnings.push(`警告：备份数据(${backup.records.length}条)多于当前数据(${records.length}条)，可能发生了数据丢失`);
        }
      }
      
      // 检查 records 是否有异常的时间跳跃
      if (records.length > 10) {
        const recent10 = records.slice(-10);
        const timestamps = recent10.map(r => new Date(r.timestamp).getTime()).filter(t => !isNaN(t));
        
        if (timestamps.length > 1) {
          const oldestRecent = Math.min(...timestamps);
          const newestRecent = Math.max(...timestamps);
          const daysDiff = (newestRecent - oldestRecent) / (1000 * 60 * 60 * 24);
          
          health.stats.recentDataSpan = `${daysDiff.toFixed(1)} 天`;
          
          // 如果最近10条记录的时间跨度超过30天，可能有问题
          if (daysDiff > 30) {
            health.warnings.push(`可疑：最近10条记录时间跨度达 ${daysDiff.toFixed(0)} 天，可能存在旧数据混入`);
          }
        }
      }
      
    } catch (e) {
      health.ok = false;
      health.warnings.push(`检查失败：${e.message}`);
    }
    
    return health;
  }

  /** 从备份恢复数据 */
  function restoreFromBackup() {
    try {
      const backupStr = localStorage.getItem('pets_data_backup');
      if (!backupStr) {
        console.error('没有找到备份数据');
        return { ok: false, msg: '没有找到备份数据' };
      }
      
      const backup = JSON.parse(backupStr);
      const backupTime = new Date(backup.timestamp).toLocaleString();
      const recordCount = backup.records?.length || 0;
      
      if (typeof UI !== 'undefined') {
        UI.confirm(
          `找到备份数据：\n时间：${backupTime}\n记录数：${recordCount} 条\n\n是否恢复此备份？`,
          () => {
            // 恢复数据
            if (backup.records) _set(K.records, backup.records);
            if (backup.students) _set(K.students, backup.students);
            if (backup.classes) _set(K.classes, backup.classes);
            
            console.log('数据恢复成功，正在同步到服务器...');
            _setSyncDirty(true);
            _scheduleSync(true); // 立即同步
            
            if (typeof UI !== 'undefined') {
              UI.toast('数据恢复成功！正在同步到服务器...', 'success', 3000);
            }
            
            setTimeout(() => location.reload(), 2000);
          },
          '恢复',
          true
        );
      }
      
      return { ok: true, backup };
    } catch (e) {
      console.error('恢复备份失败:', e);
      return { ok: false, msg: e.message };
    }
  }

  /* ─────────────── 作业统计 (Homework Stats) ───────────────
     数据通过 _get/_set 写入 localStorage，自动进入同步引擎：
     - _set 触发 pets_last_write + _scheduleSync 标记 dirty
     - _collectData 已把 K.homeworkTasks / K.homeworkStates 纳入 syncKeys
     - _forceRestoreData 遍历 data 对象还原时会自动写回这两个 key
  ────────────────────────────────────────────────────────── */
  const homework = {
    getTasks() {
      return _get(K.homeworkTasks);
    },
    saveTasks(tasks) {
      _set(K.homeworkTasks, tasks || []);
    },
    getStates() {
      const v = _get(K.homeworkStates);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    },
    saveStates(states) {
      _set(K.homeworkStates, states || {});
    },
  };

  return {
    K, // 导出 Key 映射，供外部使用
    get: _get, // 导出读取方法
    set: _set, // 导出写入方法
    API: 'backend/api.php',
    session, teachers, classes, students, records, groups, shop, levels, scoreItems, hunger,
    homework,
    deleteClass,
    // 同步相关
    getToken, setToken, clearToken,
    loadFromServer, apiRegister, apiLogin, apiLogout, apiVerify, apiChangeName,
    apiCreateClassShare,
    forceSync: _doSync,
    forceUploadLocalData, // 强制上传本地数据到服务器
    startPolling, stopPolling,
    // 渲染优化：per-render 学生记录索引
    setStudentRecordsIndex, clearStudentRecordsIndex, getRecordsForStudent,
    // 同步状态监控（用于调试和故障排查）
    getSyncStatus,
    getSyncLogs: () => JSON.parse(localStorage.getItem('pets_sync_logs') || '[]'),
    clearSyncLogs: () => localStorage.removeItem('pets_sync_logs'),
    restoreFromBackup,
    checkDataHealth,
    // 调试工具
    debugSync: () => {
      const isDirty = _getSyncDirty();
      const lastWrite = Number(localStorage.getItem('pets_last_write') || 0);
      const timeSinceDirty = Date.now() - lastWrite;
      console.log('=== 同步状态调试 ===');
      console.log('Dirty:', isDirty);
      console.log('首次Dirty时间:', _firstDirtyTime ? new Date(_firstDirtyTime).toLocaleTimeString() : '无');
      console.log('最后写入时间:', lastWrite ? new Date(lastWrite).toLocaleTimeString() : '无');
      console.log('距最后写入:', `${(timeSinceDirty/1000).toFixed(1)}秒`);
      console.log('重试次数:', _syncRetryCount);
      console.log('版本号:', _dataVersion);
      console.log('同步定时器:', _syncTimer ? '运行中' : '无');
      console.log('待服务器更新:', _pendingServerUpdate);
      return {
        isDirty,
        firstDirtyTime: _firstDirtyTime,
        lastWrite,
        timeSinceDirty,
        retryCount: _syncRetryCount,
        version: _dataVersion,
        hasTimer: !!_syncTimer,
        pendingUpdate: _pendingServerUpdate
      };
    }
  };
})();
