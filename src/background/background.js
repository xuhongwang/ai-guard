// background.js — service worker / background page

// Chrome MV3 service worker 没有 window，需要显式加载默认值；
// Firefox 的 background.scripts 已在清单中先加载 defaults.js。
if (typeof window === 'undefined' && typeof importScripts === 'function') {
  importScripts('defaults.js');
}

const DEFAULTS = globalThis.__AI_GUARD_DEFAULTS__;
const INITIAL_SETTINGS = DEFAULTS && DEFAULTS.DEFAULT_SETTINGS;

// ---- 一次性迁移：chrome.storage.sync → chrome.storage.local ----
chrome.runtime.onInstalled.addListener(() => {
  if (!INITIAL_SETTINGS) return;
  chrome.storage.local.get(['settings'], (localRes) => {
    if (localRes.settings && Object.keys(localRes.settings).length > 0) return;
    chrome.storage.sync.get(['settings'], (syncRes) => {
      const old = syncRes.settings;
      if (old && Object.keys(old).length > 0) {
        chrome.storage.local.set({ settings: old });
      } else {
        chrome.storage.local.set({ settings: JSON.parse(JSON.stringify(INITIAL_SETTINGS)) });
      }
    });
  });
});
