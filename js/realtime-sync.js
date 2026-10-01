/**
 * 实时同步客户端 - 使用长轮询实现准实时多设备同步
 * 无需 WebSocket，兼容性更好
 *
 * 工作原理：
 * 1. 写入数据后立即保存到服务器（版本号+1）
 * 2. 后台持续运行长轮询，等待服务器通知有新版本
 * 3. 收到通知后立即拉取最新数据并更新本地
 * 4. 实现延迟：通常 < 1秒（取决于服务器响应）
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

  // 回调函数
  const callbacks = {
    onUpdate: null,      // 收到更新时调用
    onSyncSuccess: null, // 同步成功时调用
    onError: null        // 错误时调用
  };

  /**
   * 启动实时同步
   * @param {string} userToken - 用户token
   * @param {number} initialVersion - 初始版本号
   * @param {object} cbs - 回调函数
   */
  function start(userToken, initialVersion = 0, cbs = {}) {
    if (isActive) {
      console.log('[实时同步] 已在运行');
      return;
    }

    token = userToken;
    localVersion = initialVersion;
    Object.assign(callbacks, cbs);
    isActive = true;

    console.log('[实时同步] 启动，初始版本:', localVersion);

    // 启动长轮询
    startLongPolling();
  }

  /**
   * 停止实时同步
   */
  function stop() {
    console.log('[实时同步] 停止');
    isActive = false;
    isPolling = false;

    if (pollAbortController) {
      pollAbortController.abort();
      pollAbortController = null;
    }
  }

  /**
   * 长轮询：持续等待服务器更新通知
   */
  async function startLongPolling() {
    if (!isActive || isPolling) return;

    isPolling = true;
    pollRetryCount = 0;

    while (isActive) {
      try {
        pollAbortController = new AbortController();

        // 发起长轮询请求（服务器会等待最多25秒）
        const response = await fetch(API + '?action=waitForUpdate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            version: localVersion,
            timeout: 25
          }),
          signal: pollAbortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.ok && result.hasUpdate) {
          // 收到更新通知
          pollRetryCount = 0;
          localVersion = result.version;

          console.log('[实时同步] 收到更新，版本:', localVersion);

          // 触发更新回调
          if (callbacks.onUpdate) {
            callbacks.onUpdate(result.data, result.version);
          }
        }

        // 继续下一次轮询（无延迟，立即重连）
        if (isActive) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟避免过于频繁
          continue;
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          // 手动中止，正常退出
          break;
        }

        // 网络错误或其他异常
        pollRetryCount++;
        const retryDelay = Math.min(1000 * Math.pow(2, pollRetryCount - 1), 10000);

        console.warn(`[实时同步] 轮询失败，${retryDelay/1000}秒后重试 (第${pollRetryCount}次):`, error.message);

        if (callbacks.onError && pollRetryCount === 1) {
          callbacks.onError(error);
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    isPolling = false;
  }

  /**
   * 同步数据到服务器
   * @param {object} data - 要同步的数据
   * @param {number} version - 当前版本号
   */
  async function syncData(data, version = 0) {
    if (isSyncing) {
      console.log('[实时同步] 同步中，跳过');
      return { ok: false, msg: 'syncing' };
    }

    isSyncing = true;

    try {
      const response = await fetch(API + '?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          data: data,
          version: version || localVersion
        })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        localVersion = result.version;
        console.log('[实时同步] 同步成功，新版本:', localVersion);

        if (callbacks.onSyncSuccess) {
          callbacks.onSyncSuccess(result.version);
        }

        return { ok: true, version: result.version };
      } else {
        console.error('[实时同步] 同步失败:', result.msg);
        if (callbacks.onError) {
          callbacks.onError(new Error(result.msg || '同步失败'));
        }
        return { ok: false, msg: result.msg };
      }

    } catch (error) {
      console.error('[实时同步] 同步异常:', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
      return { ok: false, msg: error.message };
    } finally {
      isSyncing = false;
    }
  }

  /**
   * 立即拉取最新数据（不等待）
   */
  async function pullData() {
    try {
      const response = await fetch(API + '?action=load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        localVersion = result.version;
        console.log('[实时同步] 拉取数据成功，版本:', localVersion);
        return { ok: true, data: result.data, version: result.version };
      } else {
        return { ok: false, msg: result.msg };
      }

    } catch (error) {
      console.error('[实时同步] 拉取数据异常:', error);
      return { ok: false, msg: error.message };
    }
  }

  /**
   * 获取当前状态
   */
  function getStatus() {
    return {
      active: isActive,
      polling: isPolling,
      syncing: isSyncing,
      version: localVersion,
      retryCount: pollRetryCount
    };
  }

  return {
    start,
    stop,
    syncData,
    pullData,
    getStatus
  };
})();
