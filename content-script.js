/* eslint-disable */
(function () {
  if (window.__AI_GUARD_INSTALLED__) return;
  window.__AI_GUARD_INSTALLED__ = true;

  // ============ Scanner ============
  class Scanner {
    constructor(rules) { this.rules = rules || []; }
    setRules(rules) { this.rules = rules || []; }
    scan(text) {
      if (!text) return [];
      const normalized = _norm(text);
      const hits = [];
      for (const rule of this.rules) {
        if (!rule || !rule.enabled) continue;
        try {
          if (rule.type === 'regex') {
            const re = new RegExp(rule.pattern, 'g');
            if (re.test(normalized)) hits.push(rule);
            re.lastIndex = 0;
          } else {
            const haystack = normalized.toLowerCase();
            const needle = String(rule.pattern).toLowerCase();
            if (needle && haystack.includes(needle)) hits.push(rule);
          }
        } catch (e) { /* 非法规则跳过 */ }
      }
      return hits;
    }
  }

  // ============ Site Adapters ============
  const BUILTIN = {
    'chat.openai.com': {
      input: () => document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]'),
    },
    'chatgpt.com': {
      input: () => document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]'),
    },
    'claude.ai': {
      input: () => document.querySelector('[contenteditable="true"]'),
      button: () => document.querySelector('button[aria-label*="Send"]'),
    },
    'copilot.microsoft.com': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button[aria-label*="Submit"], button[aria-label*="Send"]'),
    },
    'm365.cloud.microsoft': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button[aria-label*="Submit"], button[aria-label*="Send"]'),
    },
    'gemini.google.com': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button.send-button, button[aria-label*="Send"]'),
    },
    'www.doubao.com': {
      input: () => document.querySelector('[data-slate-editor="true"], textarea, [contenteditable="true"]'),
      button: () => document.querySelector('[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"]'),
    },
    'yuanbao.tencent.com': {
      input: () => document.querySelector('textarea, [contenteditable="true"], [data-slate-editor="true"]'),
      button: () => document.querySelector('#yuanbao-send-btn, button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"], div[aria-label*="发送"]'),
    },
    'kimi.moonshot.cn': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"]'),
    },
  };

  // 通配符 host 匹配：*.example.com 匹配 any.example.com / a.b.example.com
  function hostMatches(pattern, hostname) {
    pattern = pattern.trim().toLowerCase();
    hostname = hostname.toLowerCase();
    if (!pattern) return false;
    if (pattern === '*' || pattern === hostname) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname.includes(pattern);
  }

  // 依据 settings.sites 动态构建适配器（input + button）
  function buildAdapter(sites) {
    const conf = sites || { builtin: true, custom: [] };
    // 1) 先看自定义站点是否命中当前 host
    if (Array.isArray(conf.custom)) {
      for (const site of conf.custom) {
        if (!site || !site.enabled) continue;
        if (hostMatches(site.host, location.hostname)) {
          const inputSel = site.inputSel && site.inputSel.trim();
          const buttonSel = site.buttonSel && site.buttonSel.trim();
          return {
            input: () => {
              if (inputSel) {
                const el = document.querySelector(inputSel);
                if (el) return el;
              }
              return fallbackInput();
            },
            button: () => {
              if (buttonSel) {
                const el = document.querySelector(buttonSel);
                if (el) return el;
              }
              return fallbackButton();
            },
            custom: true,
          };
        }
      }
    }
    // 2) 再走内置适配器
    if (conf.builtin !== false) {
      for (const host in BUILTIN) {
        if (location.hostname.includes(host)) {
          const adapter = BUILTIN[host];
          return {
            input: () => adapter.input() || fallbackInput(),
            button: () => adapter.button() || fallbackButton(),
          };
        }
      }
    }
    // 3) 兜底：使用通用选择器适配其他网站
    return {
      input: () => fallbackInput(),
      button: () => fallbackButton(),
    };
  }
  function fallbackInput() {
    return document.querySelector('textarea, [contenteditable="true"], [data-slate-editor="true"], input[type="text"]');
  }
  function fallbackButton() {
    return document.querySelector(
      'button[data-testid="send-button"], ' +
      'button[aria-label*="Send"], button[aria-label*="发送"], ' +
      'button[aria-label*="提交"], button[aria-label*="Submit"], ' +
      'button[aria-label*="回复"], button[aria-label*="Reply"], ' +
      'div[aria-label*="发送"], div[aria-label*="Send"], ' +
      '[id*="send-btn"], [id*="send-button"]'
    );
  }

  // ---- context validity check ----
  let _dead = false;
  let _pollId = null;
  function isContextValid() {
    if (_dead) return false;
    try { chrome.runtime.getManifest(); return true; } catch { _dead = true; if (_pollId) { clearInterval(_pollId); _pollId = null; } return false; }
  }

  // ============ Main ============
  // 默认规则以 defaults.js（已通过 manifest 在 content-script 之前注入）的 DEFAULT_RULES 为唯一来源，
  // 保证与"测试规则"面板逻辑完全一致；若取不到则降级为内联副本（兼容直接单文件运行/测试）。
  const FALLBACK_RULES = [
    { type: 'regex', pattern: 'sk-[A-Za-z0-9_-]{20,}', severity: 'error', enabled: true, desc: 'OpenAI API Key' },
    { type: 'regex', pattern: 'ghp_[a-zA-Z0-9]{36}', severity: 'error', enabled: true, desc: 'GitHub Token' },
    { type: 'regex', pattern: 'AKIA[0-9A-Z]{16}', severity: 'error', enabled: true, desc: 'AWS Access Key' },
    { type: 'regex', pattern: 'AIza[0-9A-Za-z_-]{35}', severity: 'error', enabled: true, desc: 'Google API Key' },
    { type: 'regex', pattern: '-----BEGIN (RSA |EC |DSA |)?PRIVATE KEY-----', severity: 'error', enabled: true, desc: '私钥' },
    { type: 'regex', pattern: '(password|passwd|pwd)\\s*[:=]\\s*\\S+', severity: 'warn', enabled: true, desc: '明文密码' },
    { type: 'regex', pattern: '(^|[^a-z0-9-])([a-z0-9-]+\\.(internal|corp|local|lan)(\\.[a-z0-9-]+)*)([^a-z0-9-]|$)', severity: 'error', enabled: true, desc: '内网域名' },
  ];
  const DEFAULT_RULES = (window.__AI_GUARD_DEFAULTS__ && window.__AI_GUARD_DEFAULTS__.DEFAULT_RULES) || FALLBACK_RULES;

  const _norm = (window.__AI_GUARD_DEFAULTS__ && window.__AI_GUARD_DEFAULTS__.normalizeText) || function (t) {
    return t.replace(/[\u200B-\u200F\uFEFF\u2060\u00AD]/g, '').replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
  };

  let settings = { enabled: true, visualWarning: true, blockSend: true, scanOnPaste: true, rules: DEFAULT_RULES, sites: { builtin: true, custom: [] } };
  const scanner = new Scanner(settings.rules);
  let adapter = buildAdapter(settings.sites);
  let currentHits = [];

  // ---- 统一配置应用 ----
  function applyConfig(cfg) {
    settings = Object.assign(settings, cfg || {});
    if (!Array.isArray(settings.rules)) settings.rules = DEFAULT_RULES;
    if (!settings.sites) settings.sites = { builtin: true, custom: [] };
    scanner.setRules(settings.rules);
    adapter = buildAdapter(settings.sites);
    clearWarning();
    recheck();
  }

  // ---- 从 storage 加载配置 ----
  function loadSettings(cb) {
    if (!isContextValid()) { cb && cb(); return; }
    try {
      chrome.storage.local.get(['settings'], (res) => {
        try {
          if (res.settings) applyConfig(res.settings);
          cb && cb();
        } catch {}
      });
    } catch { cb && cb(); }
  }

  // ---- 路径 1: storage.onChanged（area=local） ----
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      try {
        if (!isContextValid()) return;
        if (area === 'local') {
          if (changes.settings) {
            applyConfig(changes.settings.newValue);
          }
          if (changes.ai_guard_lang) {
            L.init().then(() => { clearWarning(); recheck(); });
          }
        }
      } catch {}
    });
  } catch {}

  // ---- 路径 2: runtime.onMessage（background 广播） ----
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      try {
        if (!isContextValid()) return;
        if (msg && msg.type === 'AI_GUARD_CONFIG_CHANGED') {
          loadSettings(() => { clearWarning(); recheck(); });
        }
      } catch {}
    });
  } catch {}

  // ---- DOM 工具函数 ----
  function getText(el) {
    if (!el) return '';
    if (el.isContentEditable) return el.innerText || '';
    return el.value || el.textContent || '';
  }

  function clearWarning() {
    document.querySelectorAll('.__ai-guard-danger').forEach((el) => el.classList.remove('__ai-guard-danger'));
    const bar = document.getElementById('__ai-guard-bar');
    if (bar) bar.remove();
  }

  function applyWarning(el) {
    if (!settings.visualWarning) return;
    el.classList.add('__ai-guard-danger');
  }

  function showWarningBar(hits) {
    if (!isContextValid()) return;
    let bar = document.getElementById('__ai-guard-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__ai-guard-bar';
      document.body.prepend(bar);
    }
    const errors = hits.filter((h) => h.severity === 'error').length;
    const warns = hits.length - errors;
    const hasError = errors > 0;
    const blocked = settings.blockSend && hasError;
    const summary = L.t('warningBarSummary', { total: hits.length, errors, warns });
    const blockedText = blocked ? L.t('warningBlocked') : L.t('warningAllowed');
    const descList = hits.map((h) => h.desc || h.pattern).filter(Boolean).join(', ');
    bar.replaceChildren();
    const b = document.createElement('b');
    b.textContent = `🚨 ${L.t('warningBarTitle')}`;
    bar.appendChild(b);
    bar.appendChild(document.createTextNode(` ${summary}`));
    bar.appendChild(document.createElement('br'));
    const detail = document.createElement('span');
    detail.style.cssText = 'font-size:12px;opacity:.9';
    detail.textContent = `${descList}（${blockedText}）`;
    bar.appendChild(detail);
  }

  function recheck() {
    if (!isContextValid()) return;
    if (!settings.enabled) {
      clearWarning();
      return;
    }
    const el = adapter.input();
    if (!el) return;
    const text = getText(el);
    currentHits = scanner.scan(text);
    if (currentHits.length > 0) {
      applyWarning(el);
      showWarningBar(currentHits);
    } else {
      clearWarning();
    }
  }

  function isMyInput(target) {
    const el = adapter.input();
    return el && (el === target || el.contains(target));
  }

  // ---- 事件监听器（只注册一次，运行时读 settings 控制行为） ----
  document.addEventListener('input', (e) => {
    if (!settings.enabled) return;
    if (isMyInput(e.target)) recheck();
  }, true);

  // paste 监听器：始终注册，运行时检查 scanOnPaste
  document.addEventListener('paste', () => {
    if (settings.enabled && settings.scanOnPaste) setTimeout(recheck, 0);
  }, true);

  // 拦截 Enter 键（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener('keydown', (e) => {
    if (!settings.enabled || !settings.blockSend) return;
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const hasError = currentHits.some(h => h.severity === 'error');
    if (!hasError) return;
    const el = adapter.input();
    if (!el) return;
    if (el === e.target || el.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      showBlockToast();
    }
  }, true);

  // 拦截所有按钮/可点击元素（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener('click', (e) => {
    if (!settings.enabled || !settings.blockSend) return;
    const hasError = currentHits.some(h => h.severity === 'error');
    if (!hasError) return;
    const btn = e.target.closest(
      'button, [role="button"], [type="submit"], input[type="submit"], ' +
      'div[aria-label], span[aria-label], a[aria-label], ' +
      '[id*="send"], [id*="submit"]'
    );
    if (!btn) return;
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const cls = (btn.className || '').toLowerCase();
    const isSendBtn = /send|发送|提交|submit|回复|reply/.test(label + id + cls);
    if (isSendBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showBlockToast();
    }
  }, true);

  // 拦截 SVG 图标按钮点击（很多 AI 网站用 div > svg 做发送按钮）
  document.addEventListener('click', (e) => {
    if (!settings.enabled || !settings.blockSend) return;
    const hasError = currentHits.some(h => h.severity === 'error');
    if (!hasError) return;
    const svg = e.target.closest('svg');
    if (!svg) return;
    const parent = svg.parentElement;
    if (!parent) return;
    const label = (parent.getAttribute('aria-label') || parent.getAttribute('id') || '').toLowerCase();
    const cls = (parent.className || '').toLowerCase();
    if (/send|发送|提交|submit/.test(label + cls)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showBlockToast();
    }
  }, true);

  // 拦截表单提交（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener('submit', (e) => {
    if (!settings.enabled || !settings.blockSend) return;
    const hasError = currentHits.some(h => h.severity === 'error');
    if (!hasError) return;
    const inputEl = adapter.input();
    if (!inputEl) return;
    const form = e.target;
    if (form.contains && form.contains(inputEl)) {
      e.preventDefault();
      e.stopPropagation();
      showBlockToast();
    }
  }, true);

  // 显示拦截提示
  function showBlockToast() {
    if (!isContextValid()) return;
    const old = document.getElementById('__ai-guard-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = '__ai-guard-toast';
    toast.textContent = '🚫 ' + L.t('toastBlocked');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: __ai-guard-fadeout 2.5s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // 兜底轮询（应对动态挂载输入框），需等 i18n + 设置加载后再启动
  L.init().then(() => {
    loadSettings(() => {
      recheck();
      setTimeout(recheck, 500);
      _pollId = setInterval(recheck, 1500);
    });
  });
})();
