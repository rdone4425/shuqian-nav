// 全局变量
let apiUrl = '';
let apiToken = '';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStatus();
  await loadLastSyncTime();
  bindEvents();
});

// 绑定事件
function bindEvents() {
  document.getElementById('syncBtn').addEventListener('click', performSync);
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('testBtn').addEventListener('click', testConnection);

  // 设置面板相关事件
  document.getElementById('settingsToggle').addEventListener('click', toggleSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);

  // 点击面板外部关闭设置
  document.getElementById('settingsPanel').addEventListener('click', (e) => {
    if (e.target.id === 'settingsPanel') {
      closeSettings();
    }
  });
}

// 设置面板控制
function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('hidden');
}

function closeSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.add('hidden');
}

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['apiUrl', 'apiToken']);
    
    if (result.apiUrl) {
      apiUrl = result.apiUrl;
      document.getElementById('apiUrl').value = apiUrl;
    }
    
    if (result.apiToken) {
      apiToken = result.apiToken;
      document.getElementById('apiToken').value = apiToken;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings() {
  try {
    const urlInput = document.getElementById('apiUrl').value.trim();
    const tokenInput = document.getElementById('apiToken').value.trim();
    
    if (!urlInput || !tokenInput) {
      showMessage('请填写完整的服务器地址和访问令牌', 'error');
      return;
    }
    
    apiUrl = urlInput;
    apiToken = tokenInput;
    
    await chrome.storage.local.set({
      apiUrl: apiUrl,
      apiToken: apiToken
    });
    
    showMessage('设置保存成功', 'success');
    closeSettings();
    await loadStatus();
  } catch (error) {
    console.error('保存设置失败:', error);
    showMessage('保存失败: ' + error.message, 'error');
  }
}

// 测试连接
async function testConnection() {
  if (!apiUrl) {
    showMessage('请先填写服务器地址', 'error');
    return;
  }

  console.log('🧪 开始测试连接...');
  console.log('服务器地址:', apiUrl);

  try {
    // 先测试不需要认证的健康检查
    const healthUrl = apiUrl + '/api/health';
    console.log('测试URL:', healthUrl);

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors'
    });

    console.log('响应状态:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('响应数据:', data);

      // 如果健康检查成功，再测试书签API
      if (apiToken) {
        console.log('🧪 测试书签API...');
        const bookmarksUrl = apiUrl + '/api/bookmarks/sync';
        console.log('书签API URL:', bookmarksUrl);

        const bookmarksResponse = await fetch(bookmarksUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-API-Token': apiToken
          },
          mode: 'cors',
          body: JSON.stringify({ bookmarks: [] })
        });

        console.log('书签API响应状态:', bookmarksResponse.status, bookmarksResponse.statusText);

        if (bookmarksResponse.ok) {
          showMessage('连接测试成功！健康检查和书签API都正常', 'success');
        } else {
          const errorText = await bookmarksResponse.text();
          console.error('书签API响应错误:', errorText);
          showMessage(`健康检查成功，但书签API失败: HTTP ${bookmarksResponse.status}`, 'error');
        }
      } else {
        showMessage('健康检查成功！请设置访问令牌以测试书签API', 'success');
      }
    } else {
      const errorText = await response.text();
      console.error('响应错误:', errorText);
      showMessage(`连接失败: HTTP ${response.status}`, 'error');
    }
  } catch (error) {
    console.error('🚨 连接测试失败:', error);

    // 提供具体的错误诊断
    let errorMessage = '连接测试失败: ';

    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMessage += '无法连接到服务器。请检查：\n';
      errorMessage += '1. 服务器地址是否正确\n';
      errorMessage += '2. 服务器是否正在运行\n';
      errorMessage += '3. 网络连接是否正常';
    } else {
      errorMessage += error.message;
    }

    showMessage(errorMessage, 'error');
  }
}

// 加载状态
async function loadStatus() {
  try {
    // 获取本地书签数量
    const localBookmarks = await getChromeBookmarks();
    document.getElementById('localCount').textContent = localBookmarks.length;
    
    if (!apiUrl || !apiToken) {
      document.getElementById('serverCount').textContent = '-';
      document.getElementById('needSyncCount').textContent = '-';
      updateConnectionStatus('未配置', 'disconnected');
      return;
    }

    // 获取服务器书签数量
    try {
      const serverBookmarks = await getServerBookmarks();
      document.getElementById('serverCount').textContent = serverBookmarks.length;

      // 计算需要同步的数量
      const needSync = calculateNeedSync(localBookmarks, serverBookmarks);
      document.getElementById('needSyncCount').textContent = needSync;

      updateConnectionStatus('已连接', 'connected');
    } catch (error) {
      document.getElementById('serverCount').textContent = '错误';
      document.getElementById('needSyncCount').textContent = '-';
      updateConnectionStatus('连接失败', 'disconnected');
    }
  } catch (error) {
    console.error('加载状态失败:', error);
  }
}

// 加载最后同步时间
async function loadLastSyncTime() {
  try {
    const result = await chrome.storage.local.get(['lastSyncTime']);
    const lastSyncElement = document.getElementById('lastSyncTime');

    if (result.lastSyncTime) {
      const syncTime = new Date(result.lastSyncTime);
      const now = new Date();
      const diffMinutes = Math.floor((now - syncTime) / (1000 * 60));

      if (diffMinutes < 1) {
        lastSyncElement.textContent = '刚刚';
      } else if (diffMinutes < 60) {
        lastSyncElement.textContent = `${diffMinutes}分钟前`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        lastSyncElement.textContent = `${hours}小时前`;
      } else {
        const days = Math.floor(diffMinutes / 1440);
        lastSyncElement.textContent = `${days}天前`;
      }
    } else {
      lastSyncElement.textContent = '从未同步';
    }
  } catch (error) {
    console.error('加载同步时间失败:', error);
  }
}

// 保存最后同步时间
async function saveLastSyncTime() {
  try {
    await chrome.storage.local.set({
      lastSyncTime: new Date().toISOString()
    });
    await loadLastSyncTime();
  } catch (error) {
    console.error('保存同步时间失败:', error);
  }
}

// 更新连接状态
function updateConnectionStatus(text, status) {
  const statusElement = document.getElementById('connectionStatus');
  statusElement.textContent = text;
  statusElement.className = `status-badge ${status}`;
}

// 执行同步
async function performSync() {
  const syncBtn = document.getElementById('syncBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  
  if (!apiUrl || !apiToken) {
    showMessage('请先配置服务器地址和访问令牌', 'error');
    return;
  }
  
  try {
    // 禁用按钮，显示进度
    syncBtn.disabled = true;
    syncBtn.classList.add('syncing');
    syncBtn.querySelector('.btn-text').textContent = '同步中...';
    progressContainer.classList.remove('hidden');
    
    // 第一步：获取本地书签
    updateProgress(10, '获取本地书签...');
    const localBookmarks = await getChromeBookmarks();
    
    // 第二步：获取服务器书签
    updateProgress(30, '获取服务器书签...');
    const serverBookmarks = await getServerBookmarks();
    
    // 第三步：计算差异
    updateProgress(50, '计算同步差异...');
    const newBookmarks = filterNewBookmarks(localBookmarks, serverBookmarks);
    
    if (newBookmarks.length === 0) {
      updateProgress(100, '无需同步');
      showMessage('所有书签都已同步', 'info');
      return;
    }
    
    // 第四步：分批上传
    updateProgress(70, `准备上传 ${newBookmarks.length} 个新书签...`);
    await uploadBookmarks(newBookmarks, updateProgress);
    
    // 完成
    updateProgress(100, '同步完成');
    showMessage(`同步成功！新增 ${newBookmarks.length} 个书签`, 'success');

    // 保存同步时间并刷新状态
    await saveLastSyncTime();
    await loadStatus();
    
  } catch (error) {
    console.error('同步失败:', error);
    showMessage('同步失败: ' + error.message, 'error');
  } finally {
    // 恢复按钮状态
    syncBtn.disabled = false;
    syncBtn.classList.remove('syncing');
    syncBtn.querySelector('.btn-text').textContent = '开始同步';
    setTimeout(() => {
      progressContainer.classList.add('hidden');
    }, 2000);
  }

  function updateProgress(percentage, message) {
    progressFill.style.width = percentage + '%';
    progressText.textContent = message;
    progressPercent.textContent = `${percentage}%`;
  }
}

// 获取Chrome书签
async function getChromeBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const bookmarks = [];

      function extractBookmarks(nodes, folder = '') {
        for (const node of nodes) {
          if (node.children) {
            // 这是一个文件夹
            const folderName = node.title || '书签栏';
            extractBookmarks(node.children, folderName);
          } else if (node.url) {
            // 这是一个书签
            bookmarks.push({
              title: node.title,
              url: node.url,
              category: folder,
              dateAdded: node.dateAdded
            });
          }
        }
      }

      extractBookmarks(bookmarkTreeNodes);
      resolve(bookmarks);
    });
  });
}

// 获取服务器书签
async function getServerBookmarks() {
  const bookmarks = [];
  let page = 1;

  while (true) {
    const response = await apiRequest(`/api/bookmarks?page=${page}&limit=100`);
    const data = await response.json();

    if (!data.success || !data.data.bookmarks.length) {
      break;
    }

    bookmarks.push(...data.data.bookmarks);

    if (data.data.bookmarks.length < 100) {
      break;
    }

    page++;
  }

  return bookmarks;
}

// 计算需要同步的数量
function calculateNeedSync(localBookmarks, serverBookmarks) {
  const serverUrls = new Set(serverBookmarks.map(b => b.url));
  return localBookmarks.filter(b => !serverUrls.has(b.url)).length;
}

// 过滤新书签
function filterNewBookmarks(localBookmarks, serverBookmarks) {
  const serverUrls = new Set(serverBookmarks.map(b => b.url));
  return localBookmarks.filter(b => !serverUrls.has(b.url));
}

// 上传书签
async function uploadBookmarks(bookmarks, updateProgress) {
  const batchSize = 100; // 增加批次大小
  let uploaded = 0;
  const totalBatches = Math.ceil(bookmarks.length / batchSize);

  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const progress = 70 + Math.round((i / bookmarks.length) * 25);

    updateProgress(progress, `上传第 ${batchNumber}/${totalBatches} 批 (${batch.length} 个)...`);

    const response = await apiRequest('/api/bookmarks/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookmarks: batch })
    });

    const data = await response.json();
    if (data.success) {
      uploaded += data.data.successCount || 0;
    }

    // 减少批次间延迟，提高速度
    if (i + batchSize < bookmarks.length) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 从500ms减少到200ms
    }
  }

  return uploaded;
}

// API请求
async function apiRequest(endpoint, options = {}) {
  const url = apiUrl + endpoint;

  console.log(`🌐 API请求: ${options.method || 'GET'} ${url}`);

  const defaultOptions = {
    headers: {
      'X-API-Token': apiToken,
      'Accept': 'application/json'
    }
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  console.log('请求选项:', finalOptions);

  try {
    const response = await fetch(url, {
      ...finalOptions,
      mode: 'cors'
    });

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('响应错误内容:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('🚨 API请求失败:', error);

    // 提供更友好的错误信息
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败，请检查服务器地址是否正确，或者服务器是否支持跨域请求');
    }

    throw error;
  }
}

// 显示消息
function showMessage(text, type = 'info') {
  const container = document.getElementById('messageContainer');
  const messageText = document.getElementById('messageText');

  // 支持多行文本
  messageText.innerHTML = text.replace(/\n/g, '<br>');
  messageText.className = `message-text ${type}`;
  container.classList.remove('hidden');

  // 错误消息显示更长时间
  const timeout = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    container.classList.add('hidden');
  }, timeout);
}
