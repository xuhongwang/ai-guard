// background.js — service worker

// ---- 默认值（用于迁移和初始化） ----
const DEFAULT_RULES = [
  { type: 'regex', pattern: 'sk-[A-Za-z0-9_-]{20,}', severity: 'error', enabled: true, desc: 'OpenAI API Key' },
  { type: 'regex', pattern: 'ghp_[a-zA-Z0-9]{36}', severity: 'error', enabled: true, desc: 'GitHub Token' },
  { type: 'regex', pattern: 'AKIA[0-9A-Z]{16}', severity: 'error', enabled: true, desc: 'AWS Access Key' },
  { type: 'regex', pattern: 'AIza[0-9A-Za-z_-]{35}', severity: 'error', enabled: true, desc: 'Google API Key' },
  { type: 'regex', pattern: '-----BEGIN (RSA |EC |DSA |)?PRIVATE KEY-----', severity: 'error', enabled: true, desc: '私钥' },
  { type: 'regex', pattern: '(password|passwd|pwd)\\s*[:=]\\s*\\S+', severity: 'warn', enabled: true, desc: '明文密码' },
  { type: 'regex', pattern: '(^|[^a-z0-9-])([a-z0-9-]+\\.(internal|corp|local|lan)(\\.[a-z0-9-]+)*)([^a-z0-9-]|$)', severity: 'error', enabled: true, desc: '内网域名' },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  visualWarning: true,
  blockSend: true,
  scanOnPaste: true,
  rules: DEFAULT_RULES,
  sites: { builtin: true, custom: [] },
};

// ---- 一次性迁移：chrome.storage.sync → chrome.storage.local ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings'], (localRes) => {
    if (localRes.settings && Object.keys(localRes.settings).length > 0) return;
    chrome.storage.sync.get(['settings'], (syncRes) => {
      const old = syncRes.settings;
      if (old && Object.keys(old).length > 0) {
        chrome.storage.local.set({ settings: old });
      } else {
        chrome.storage.local.set({ settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) });
      }
    });
  });
});

// ---- 广播函数：通知所有已注入 content script 的标签页 ----
function notifyAllContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) return;
      if (/^(chrome|chrome-extension|about|devtools):/.test(tab.url)) return;
      chrome.tabs.sendMessage(tab.id, { type: 'AI_GUARD_CONFIG_CHANGED' }).catch(() => {});
    });
  });
}

// ---- 监听 storage 变更（主路径） ----
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    notifyAllContentScripts();
  }
});

// ---- 监听来自 popup / options 的消息（备用路径） ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'AI_GUARD_CONFIG_UPDATED') {
    notifyAllContentScripts();
  }
});
