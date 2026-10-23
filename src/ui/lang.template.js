/**
 * lang.js — Lightweight i18n helper for AI Guard
 *
 * 说明：翻译直接内嵌于本文件，不依赖 fetch / defaults.js，
 *       确保 content script / popup / options 均可直接使用。
 *
 * Usage:
 *   await L.init()           // load messages, apply lang, render DOM
 *   L.t(key)                 // translate a single key (with {placeholder} support)
 *   L.applyToDOM(root)       // translate all [data-i18n] elements inside root
 *   L.getLang()              // current language: 'en' | 'zh_CN'
 *   L.toggleLang()           // switch language, persist, re-render
 */
/* exported L */
const L = (() => {
  let _messages = {};
  let _lang = 'en';
  let _observer = null;
  let _applying = false;

  const STORAGE_KEY = 'ai_guard_lang';

  const MESSAGES = /* @inject:messages */ {};

  function loadMessages(lang) {
    return MESSAGES[lang] || MESSAGES.en;
  }

  async function init() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      _lang = stored[STORAGE_KEY] || navigator.language || 'en';
    } catch {
      _lang = navigator.language || 'en';
    }
    if (_lang !== 'en' && _lang !== 'zh_CN') _lang = 'en';
    _messages = loadMessages(_lang);
    applyToDOM(document);
    watchDOM(document);
  }

  function t(key, params = {}) {
    let msg = _messages[key] || key;
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return msg;
  }

  function applyToDOM(root) {
    if (_applying) return;
    _applying = true;
    try {
      root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key && key in _messages) {
          el.textContent = _messages[key];
        }
      });
      root.querySelectorAll('[data-i18n-html]').forEach((el) => {
        const key = el.getAttribute('data-i18n-html');
        if (key && key in _messages) {
          el.textContent = _messages[key];
        }
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && key in _messages) {
          el.placeholder = _messages[key];
        }
      });
    } finally {
      _applying = false;
    }
  }

  function watchDOM(root) {
    if (_observer) _observer.disconnect();
    _observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) applyToDOM(node);
        }
      }
    });
    _observer.observe(root, { childList: true, subtree: true });
  }

  function getLang() {
    return _lang;
  }

  async function toggleLang() {
    _lang = _lang === 'en' ? 'zh_CN' : 'en';
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _lang });
    } catch {}
    _messages = loadMessages(_lang);
    applyToDOM(document);
    return _lang;
  }

  return { init, t, applyToDOM, watchDOM, getLang, toggleLang };
})();
