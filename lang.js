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
const L = (() => {
  let _messages = {};
  let _lang = 'en';
  let _observer = null;
  let _applying = false;

  const STORAGE_KEY = 'ai_guard_lang';

  const MESSAGES = {
    en: {
      popupSubtitle: "Sensitive content detection & alert",
      toggleEnabled: "Enable Detection",
      toggleVisual: "Highlight + Warning Bar",
      toggleBlockSend: "Block Send",
      openOptions: "Customize Rules (Options Page)",
      ruleStat: "Active rules: {count}",
      optionsTitle: "AI Guard — Rule Configuration",
      optionsDesc: "Configure sensitive content detection rules. Error level will block sending, warn level will only alert.",
      btnAddRule: "Add Rule",
      btnReset: "Reset to Default",
      btnExport: "Export",
      btnImport: "Import",
      thEnabled: "On",
      thType: "Type",
      thPattern: "Pattern (keyword or regex)",
      thDesc: "Description",
      thSeverity: "Severity",
      thAction: "Action",
      typeKeyword: "Keyword",
      typeRegex: "Regex",
      severityError: "Block",
      severityWarn: "Warn",
      btnDelete: "Delete",
      placeholderPattern: "Keyword or regex, e.g. sk-[A-Za-z0-9_-]{20,}",
      placeholderDesc: "Description",
      testTitle: "Test Rules",
      testDesc: "(Enter sample text to see real-time match results)",
      testPlaceholder: "Paste or type test text here...",
      btnFillDemo: "Load demo text",
      btnClearTest: "Clear",
      testHint: "Enter text above to see matching rules and highlighted results in real time.",
      testNoHits: "No rules matched.",
      testSummary: "{errors} blocked, {warns} warned — {total} match(es):",
      sitesTitle: "Site Configuration",
      sitesDesc: "(Built-in site adapters cover most AI sites; you can also add custom sites)",
      builtinToggle: "Enable built-in sites (ChatGPT / Claude / Copilot / Gemini / Doubao / Yuanbao / Kimi)",
      builtinHint: "When disabled, only custom sites below will be active.",
      btnAddSite: "Add Custom Site",
      thSiteHost: "Match Domain (host / supports *.subdomain)",
      thInputSelector: "Input Selector",
      thButtonSelector: "Send Button Selector",
      placeholderHost: "e.g. chat.example.com or *.example.com",
      placeholderInputSel: 'textarea, [contenteditable="true"]',
      placeholderButtonSel: 'button[data-testid="send-button"]',
      sitesTip: "Tip: Input and send button selectors are CSS selectors. Press F12 in the target page to inspect elements.",
      sitesNote: "Note: This extension detects sensitive content and can block sending (only on error-level matches).",
      footerScanOnPaste: "Scan on paste",
      footerSyncHint: "Rules and site configs sync in real time to all open tabs.",
      toastSaved: "Saved and synced",
      confirmReset: "Reset to default built-in rules? Your custom rules will be overwritten.",
      importError: "Import failed: {error}",
      importFormatError: "Format error: missing rules array",
      warningBarTitle: "AI Guard:",
      warningBarSummary: "{total} sensitive item(s) detected ({errors} blocked / {warns} warned)",
      warningBlocked: "Send blocked",
      warningAllowed: "Warning only, send not blocked",
      toastBlocked: "Send blocked — sensitive content detected (error level). Please remove and retry.",
      langLabel: "中",
    },
    zh_CN: {
      popupSubtitle: "敏感内容检测与提醒",
      toggleEnabled: "启用检测",
      toggleVisual: "高亮 + 警告条",
      toggleBlockSend: "拦截发送",
      openOptions: "自定义规则（配置页）",
      ruleStat: "已启用规则：{count} 条",
      optionsTitle: "AI Guard · 规则配置",
      optionsDesc: "配置敏感内容检测规则。命中 <b>error</b> 级别将拦截发送，<b>warn</b> 级别仅警告。",
      btnAddRule: "新增规则",
      btnReset: "恢复默认",
      btnExport: "导出",
      btnImport: "导入",
      thEnabled: "启用",
      thType: "类型",
      thPattern: "匹配内容（关键字或正则）",
      thDesc: "说明",
      thSeverity: "级别",
      thAction: "操作",
      typeKeyword: "关键字",
      typeRegex: "正则",
      severityError: "拦截",
      severityWarn: "警告",
      btnDelete: "删除",
      placeholderPattern: "关键字或正则，如 sk-[A-Za-z0-9_-]{20,}",
      placeholderDesc: "描述",
      testTitle: "测试规则",
      testDesc: "（输入样例文本，实时查看命中效果）",
      testPlaceholder: "在此粘贴或输入测试文本…",
      btnFillDemo: "载入示例",
      btnClearTest: "清空",
      testHint: "在上方输入文本后，命中的规则和高亮片段会实时显示。",
      testNoHits: "未命中任何规则。",
      testSummary: "{errors} 拦截、{warns} 警告 — 共 {total} 处命中：",
      sitesTitle: "站点配置",
      sitesDesc: "（内置站点适配器可覆盖大多数 AI 站点，你也可以添加自定义站点）",
      builtinToggle: "启用内置站点（ChatGPT / Claude / Copilot / Gemini / 豆包 / 元宝 / Kimi）",
      builtinHint: "关闭后仅下方自定义站点生效。",
      btnAddSite: "添加自定义站点",
      thSiteHost: "匹配域名（host / 支持 *.子域）",
      thInputSelector: "输入框选择器",
      thButtonSelector: "发送按钮选择器",
      placeholderHost: "如 chat.example.com 或 *.example.com",
      placeholderInputSel: 'textarea, [contenteditable="true"]',
      placeholderButtonSel: 'button[data-testid="send-button"]',
      sitesTip: "提示：输入框和发送按钮选择器均为 CSS 选择器。可按 F12 在目标网页审查元素获取。留空则走通用兜底。",
      sitesNote: "注：本插件可检测敏感内容并拦截发送（仅 error 级别命中时）。建议配置发送按钮选择器以确保拦截生效。",
      footerScanOnPaste: "粘贴时扫描",
      footerSyncHint: "规则与站点配置实时同步到所有已打开的标签页。",
      toastSaved: "已保存并同步",
      confirmReset: "恢复默认内置规则？当前自定义规则将被覆盖。",
      importError: "导入失败：{error}",
      importFormatError: "格式错误：缺少 rules 数组",
      warningBarTitle: "AI Guard：",
      warningBarSummary: "检测到 {total} 项敏感内容（{errors} 拦截 / {warns} 警告）",
      warningBlocked: "已拦截发送",
      warningAllowed: "仅提醒，不会拦截发送",
      toastBlocked: "发送已拦截 — 检测到敏感内容（error 级别），请清除后重试",
      langLabel: "EN",
    },
  };

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
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && key in _messages) {
          el.textContent = _messages[key];
        }
      });
      root.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key && key in _messages) {
          el.innerHTML = _messages[key];
        }
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
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
    _observer = new MutationObserver(mutations => {
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
