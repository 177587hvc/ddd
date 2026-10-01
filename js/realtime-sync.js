/**
 * 实时同步客户端 - 使用长轮询实现准实时多设备同步
 */

const RealtimeSync = (() => {
  const API = 'backend/realtime-sync.php';

  let token = null;
  let localVersion = 0;
  let isPolling = false;
  let pollAbortController = null;
  let isSyncing = false;
  let pollRetryCount = 0;
  let isActive = false;

  const callbacks = { onUpdate: null, onSyncSuccess: null, onError: null };

  function start(userToken, initialVersion = 0, cbs = {}) {
    if (isActive) return;
    token = userToken; localVersion = initialVersion;
    Object.assign(callbacks, cbs); isActive = true;
    startLongPolling();
  }

  function stop() {
    isActive = false; isPolling = false;
    if (pollAbortController) { pollAbortController.abort(); pollAbortController = null; }
  }

  async function startLongPolling() {
    if (!isActive || isPolling) return;
    isPolling = true; pollRetryCount = 0;
    while (isActive) {
      try {
        pollAbortController = new AbortController();
        const response = await fetch(API + '?action=waitForUpdate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, version: localVersion, timeout: 25 }),
          signal: pollAbortController.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.ok && result.hasUpdate) {
          pollRetryCount = 0; localVersion = result.version;
          if (callbacks.onUpdate) callbacks.onUpdate(result.data, result.version);
        }
        if (isActive) await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        if (error.name === 'AbortError') break;
        pollRetryCount++;
        const retryDelay = Math.min(1000 * Math.pow(2, pollRetryCount - 1), 10000);
        if (callbacks.onError && pollRetryCount === 1) callbacks.onError(error);
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
    isPolling = false;
  }

  async function syncData(data, version = 0) {
    if (isSyncing) return { ok: false, msg: 'syncing' };
    isSyncing = true;
    try {
      const response = await fetch(API + '?action=save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, data, version: version || localVersion })
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        localVersion = result.version;
        if (callbacks.onSyncSuccess) callbacks.onSyncSuccess(result.version);
        return { ok: true, version: result.version };
      }
      if (callbacks.onError) callbacks.onError(new Error(result.msg || '同步失败'));
      return { ok: false, msg: result.msg };
    } catch (error) {
      if (callbacks.onError) callbacks.onError(error);
      return { ok: false, msg: error.message };
    } finally { isSyncing = false; }
  }

  async function pullData() {
    try {
      const response = await fetch(API + '?action=load', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const result = await response.json();
      if (response.ok && result.ok) { localVersion = result.version; return { ok: true, data: result.data, version: result.version }; }
      return { ok: false, msg: result.msg };
    } catch (error) { return { ok: false, msg: error.message }; }
  }

  function getStatus() { return { active: isActive, polling: isPolling, syncing: isSyncing, version: localVersion, retryCount: pollRetryCount }; }

  return { start, stop, syncData, pullData, getStatus };
})();