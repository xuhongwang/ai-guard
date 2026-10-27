(function () {
  if (window.__AI_GUARD_INSTALLED__) return;
  window.__AI_GUARD_INSTALLED__ = true;

  const DEFAULTS = window.__AI_GUARD_DEFAULTS__;
  if (!DEFAULTS) return;
  const { DEFAULT_RULES, DEFAULT_SETTINGS, scanText } = DEFAULTS;

  // ============ Site Adapters ============
  const BUILTIN = {
    'chat.openai.com': {
      input: () => document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]'),
    },
    'chatgpt.com': {
      input: () => document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]'),
    },
    'claude.ai': {
      input: () => document.querySelector('[contenteditable="true"]'),
      button: () => document.querySelector('button[aria-label*="Send"]'),
    },
    'copilot.microsoft.com': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector('button[aria-label*="Submit"], button[aria-label*="Send"]'),
    },
    'm365.cloud.microsoft': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector('button[aria-label*="Submit"], button[aria-label*="Send"]'),
    },
    'gemini.google.com': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () => document.querySelector('button.send-button, button[aria-label*="Send"]'),
    },
    'www.doubao.com': {
      input: () =>
        document.querySelector('[data-slate-editor="true"], textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector(
          '[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"]',
        ),
    },
    'yuanbao.tencent.com': {
      input: () =>
        document.querySelector('textarea, [contenteditable="true"], [data-slate-editor="true"]'),
      button: () =>
        document.querySelector(
          '#yuanbao-send-btn, button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"], div[aria-label*="发送"]',
        ),
    },
    'kimi.moonshot.cn': {
      input: () => document.querySelector('textarea, [contenteditable="true"]'),
      button: () =>
        document.querySelector(
          'button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"]',
        ),
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
    return document.querySelector(
      'textarea, [contenteditable="true"], [data-slate-editor="true"], input[type="text"]',
    );
  }
  function fallbackButton() {
    return document.querySelector(
      'button[data-testid="send-button"], ' +
        'button[aria-label*="Send"], button[aria-label*="发送"], ' +
        'button[aria-label*="提交"], button[aria-label*="Submit"], ' +
        'button[aria-label*="回复"], button[aria-label*="Reply"], ' +
        'div[aria-label*="发送"], div[aria-label*="Send"], ' +
        '[id*="send-btn"], [id*="send-button"]',
    );
  }

  // ---- context validity check ----
  let _dead = false;
  let _observer = null;
  let _recheckTimer = null;
  function isContextValid() {
    if (_dead) return false;
    try {
      chrome.runtime.getManifest();
      return true;
    } catch {
      _dead = true;
      if (_observer) {
        _observer.disconnect();
        _observer = null;
      }
      if (_recheckTimer) {
        clearTimeout(_recheckTimer);
        _recheckTimer = null;
      }
      return false;
    }
  }

  // ============ Main ============
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let adapter = buildAdapter(settings.sites);
  let currentHits = [];
  let _lastScannedInput = null;
  let _lastScannedText = null;

  // ---- 统一配置应用 ----
  function applyConfig(cfg) {
    settings = Object.assign(settings, cfg || {});
    if (!Array.isArray(settings.rules)) settings.rules = DEFAULT_RULES;
    if (!settings.sites) settings.sites = { builtin: true, custom: [] };
    adapter = buildAdapter(settings.sites);
    clearWarning();
    recheck(true);
  }

  // ---- 从 storage 加载配置 ----
  function loadSettings(cb) {
    if (!isContextValid()) {
      cb && cb();
      return;
    }
    try {
      chrome.storage.local.get(['settings'], (res) => {
        try {
          if (res.settings) applyConfig(res.settings);
          cb && cb();
        } catch {}
      });
    } catch {
      cb && cb();
    }
  }

  // ---- 配置更新：storage.onChanged（area=local） ----
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      try {
        if (!isContextValid()) return;
        if (area === 'local') {
          if (changes.settings) {
            applyConfig(changes.settings.newValue);
          }
          if (changes.ai_guard_lang) {
            L.init().then(() => {
              clearWarning();
              recheck(true);
            });
          }
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

  // 元素是否可见（排除被隐藏的旧编辑器，避免跳转后仍扫描到旧内容）
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) return true;
    return false;
  }

  // 在当前页面中查找第一个可见的输入框（适配器命中隐藏元素时兜底）
  function findVisibleInput() {
    const list = document.querySelectorAll(
      'textarea, [contenteditable="true"], [data-slate-editor="true"], input[type="text"]',
    );
    for (const el of list) {
      if (isVisible(el)) return el;
    }
    return null;
  }

  function clearWarning() {
    document
      .querySelectorAll('.__ai-guard-danger')
      .forEach((el) => el.classList.remove('__ai-guard-danger'));
    const bar = document.getElementById('__ai-guard-bar');
    if (bar) bar.remove();
  }

  function applyWarning(el) {
    if (!settings.visualWarning) return;
    el.classList.add('__ai-guard-danger');
  }

  // 悬停警告条时在顶部 / 底部之间切换
  function toggleBarPosition(bar) {
    bar.classList.toggle('__ai-guard-bottom');
  }

  function showWarningBar(hits) {
    if (!isContextValid()) return;
    let bar = document.getElementById('__ai-guard-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__ai-guard-bar';
      bar.addEventListener('mouseenter', () => toggleBarPosition(bar));
      document.body.prepend(bar);
    }
    const rules = [];
    const seen = new Set();
    for (const hit of hits) {
      const rule = hit.rule;
      if (!rule) continue;
      const key = rule.id || rule.pattern;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(rule);
    }
    const errors = rules.filter((rule) => rule.severity === 'error').length;
    const warns = rules.length - errors;
    const hasError = errors > 0;
    const blocked = settings.blockSend && hasError;
    const summary = L.t('warningBarSummary', { total: rules.length, errors, warns });
    const blockedText = blocked ? L.t('warningBlocked') : L.t('warningAllowed');
    const descList = rules
      .map((rule) => rule.desc || rule.pattern)
      .filter(Boolean)
      .join(', ');
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

  function scheduleRecheck(delay = 150) {
    if (_recheckTimer) clearTimeout(_recheckTimer);
    _recheckTimer = setTimeout(() => {
      _recheckTimer = null;
      recheck();
    }, delay);
  }

  function recheck(force = false) {
    if (!isContextValid()) return;
    if (!settings.enabled) {
      currentHits = [];
      _lastScannedInput = null;
      _lastScannedText = null;
      clearWarning();
      return;
    }
    const found = adapter.input();
    const el = found && isVisible(found) ? found : findVisibleInput();
    if (!el) {
      // 当前页面没有可用的输入框（页面跳转 / 编辑器卸载）时清理残留警告
      currentHits = [];
      _lastScannedInput = null;
      _lastScannedText = null;
      clearWarning();
      return;
    }
    const text = getText(el);
    if (!force && el === _lastScannedInput && text === _lastScannedText) {
      if (
        currentHits.length === 0 ||
        !settings.visualWarning ||
        document.getElementById('__ai-guard-bar')
      ) {
        return;
      }
    }
    _lastScannedInput = el;
    _lastScannedText = text;
    currentHits = scanText(text, settings.rules);
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

  function hasBlockingHit() {
    return currentHits.some((hit) => hit.rule && hit.rule.severity === 'error');
  }

  function classNameOf(el) {
    const value = el && el.className;
    if (typeof value === 'string') return value.toLowerCase();
    return (value && value.baseVal ? value.baseVal : '').toLowerCase();
  }

  function elementFromEvent(e) {
    return e.target && e.target.nodeType === 1 ? e.target : null;
  }

  // ---- 事件监听器（只注册一次，运行时读 settings 控制行为） ----
  document.addEventListener(
    'input',
    (e) => {
      if (!settings.enabled) return;
      if (isMyInput(e.target)) recheck();
    },
    true,
  );

  // paste 监听器：始终注册，运行时检查 scanOnPaste
  document.addEventListener(
    'paste',
    () => {
      if (settings.enabled && settings.scanOnPaste) setTimeout(recheck, 0);
    },
    true,
  );

  // 拦截 Enter 键（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener(
    'keydown',
    (e) => {
      if (!settings.enabled || !settings.blockSend) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (!hasBlockingHit()) return;
      const el = adapter.input();
      if (!el) return;
      if (el === e.target || el.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        showBlockToast();
      }
    },
    true,
  );

  // 拦截所有按钮/可点击元素（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener(
    'click',
    (e) => {
      if (!settings.enabled || !settings.blockSend) return;
      if (!hasBlockingHit()) return;
      const target = elementFromEvent(e);
      if (!target) return;
      const btn = target.closest(
        'button, [role="button"], [type="submit"], input[type="submit"], ' +
          'div[aria-label], span[aria-label], a[aria-label], ' +
          '[id*="send"], [id*="submit"]',
      );
      if (!btn) return;
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const id = (btn.id || '').toLowerCase();
      const cls = classNameOf(btn);
      const isSendBtn = /send|发送|提交|submit|回复|reply/.test(label + id + cls);
      if (isSendBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showBlockToast();
      }
    },
    true,
  );

  // 拦截 SVG 图标按钮点击（很多 AI 网站用 div > svg 做发送按钮）
  document.addEventListener(
    'click',
    (e) => {
      if (!settings.enabled || !settings.blockSend) return;
      if (!hasBlockingHit()) return;
      const target = elementFromEvent(e);
      if (!target) return;
      const svg = target.closest('svg');
      if (!svg) return;
      const parent = svg.parentElement;
      if (!parent) return;
      const label = (
        parent.getAttribute('aria-label') ||
        parent.getAttribute('id') ||
        ''
      ).toLowerCase();
      const cls = classNameOf(parent);
      if (/send|发送|提交|submit/.test(label + cls)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showBlockToast();
      }
    },
    true,
  );

  // 拦截表单提交（仅当 blockSend 开启且有 error 级别命中时）
  document.addEventListener(
    'submit',
    (e) => {
      if (!settings.enabled || !settings.blockSend) return;
      if (!hasBlockingHit()) return;
      const inputEl = adapter.input();
      if (!inputEl) return;
      const form = e.target;
      if (form.contains && form.contains(inputEl)) {
        e.preventDefault();
        e.stopPropagation();
        showBlockToast();
      }
    },
    true,
  );

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

  // ---- 路由 / 页面跳转：清理残留警告并重新检测 ----
  let _lastUrl = location.href;
  function onNavigate() {
    if (location.href === _lastUrl) return false;
    _lastUrl = location.href;
    currentHits = [];
    _lastScannedInput = null;
    _lastScannedText = null;
    clearWarning();
    // 等待新页面 DOM 渲染后再检测，避免扫到跳转前的旧编辑器
    scheduleRecheck(200);
    return true;
  }
  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);
  window.addEventListener('pageshow', onNavigate);

  function startWatching() {
    if (_observer) return;
    _observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target;
        if (
          target &&
          target.nodeType === 1 &&
          target.closest('#__ai-guard-bar, #__ai-guard-toast')
        ) {
          continue;
        }
        scheduleRecheck();
        return;
      }
    });
    _observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('focusin', () => scheduleRecheck(0), true);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) scheduleRecheck(0);
      },
      true,
    );
  }

  L.init().then(() => {
    loadSettings(() => {
      startWatching();
      recheck(true);
    });
  });
})();
