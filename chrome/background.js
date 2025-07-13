// Chrome扩展后台脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log('书签同步助手已安装');
});

// 处理扩展图标点击
chrome.action.onClicked.addListener((tab) => {
  // 打开popup（这个在manifest.json中已经配置了）
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    console.log('存储设置已更新:', changes);
  }
});
