/**
 * 默认内置规则库
 * type: 'keyword' 精确/大小写不敏感匹配；'regex' 正则匹配
 * severity: 'error' 拦截发送 + 高亮警告；'warn' 仅高亮警告
 */
const DEFAULT_RULES = [
  // ---------- 密钥 / Token ----------
  { id: 'r-key-openai',  type: 'regex',  pattern: 'sk-[A-Za-z0-9_-]{20,}',           severity: 'error', enabled: true,  desc: 'OpenAI API Key' },
  { id: 'r-key-github',  type: 'regex',  pattern: 'ghp_[a-zA-Z0-9]{36}',           severity: 'error', enabled: true,  desc: 'GitHub Personal Token' },
  { id: 'r-key-aws',     type: 'regex',  pattern: 'AKIA[0-9A-Z]{16}',              severity: 'error', enabled: true,  desc: 'AWS Access Key' },
  { id: 'r-key-google',  type: 'regex',  pattern: 'AIza[0-9A-Za-z_-]{35}',         severity: 'error', enabled: true,  desc: 'Google API Key' },
  { id: 'r-key-private', type: 'regex',  pattern: '-----BEGIN (RSA |EC |DSA |)?PRIVATE KEY-----', severity: 'error', enabled: true, desc: '私钥' },
  { id: 'r-key-password',type: 'regex',  pattern: '(password|passwd|pwd)\\s*[:=]\\s*\\S+', severity: 'warn', enabled: true, desc: '明文密码' },

  // ---------- 内部域名 ----------
  { id: 'r-domain',      type: 'regex',  pattern: '(^|[^a-z0-9-])([a-z0-9-]+\\.(internal|corp|local|lan)(\\.[a-z0-9-]+)*)([^a-z0-9-]|$)', severity: 'error', enabled: true, desc: '内网域名' },

  // ---------- 可自定义的业务关键字（默认留空，演示几个） ----------
  { id: 'k-db',          type: 'keyword', pattern: '生产数据库',                    severity: 'error', enabled: false, desc: '业务关键字示例' },
  { id: 'k-algo',        type: 'keyword', pattern: '核心算法',                      severity: 'warn',  enabled: false, desc: '业务关键字示例' },
];

/**
 * 默认站点配置
 * builtin: 是否启用内置适配器（ChatGPT/Claude/Copilot/Gemini/豆包/元宝/Kimi）
 * custom:  用户自定义的任意站点列表
 *   - host:        匹配 hostname（支持子域通配，如 *.example.com）
 *   - inputSel:    该站点输入框 CSS 选择器
 *   - buttonSel:   该站点发送按钮 CSS 选择器（留空走通用兜底）
 *   - enabled:     是否启用本项
 */
const DEFAULT_SITES = {
  builtin: true, // 为 false 时仅 custom 生效
  custom: [
    // 示例（默认空数组，用户自行添加任意站点）：
    // { id:'s-1', host: '*.example.com', inputSel: 'textarea#editor', buttonSel: 'button.submit', enabled: true },
  ],
};

const DEFAULT_SETTINGS = {
  enabled: true,           // 总开关
  visualWarning: true,     // 是否高亮背景 + 警告条
  blockSend: true,         // 是否拦截发送（仅 error 级别命中时拦截）
  scanOnPaste: true,       // 是否监听粘贴
  rules: DEFAULT_RULES,
  sites: DEFAULT_SITES,
};

/**
 * 文本归一化：去除零宽字符、全角转半角，用于抗变形匹配。
 * 仅用于扫描比对，不改变用户实际输入。
 */
function normalizeText(text) {
  return text
    .replace(/[\u200B-\u200F\uFEFF\u2060\u00AD]/g, '')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

/**
 * 纯函数：对一段文本跑规则，返回命中列表。
 * 内部先归一化文本再匹配（抗变形），返回的 match 和 index 对应原始文本。
 */
function scanText(text, rules) {
  const hits = [];
  if (!text || !Array.isArray(rules)) return hits;

  const normalized = normalizeText(text);
  if (normalized === text) {
    for (const rule of rules) {
      if (!rule || !rule.enabled) continue;
      try {
        if (rule.type === 'regex') {
          const re = new RegExp(rule.pattern, 'g');
          let m;
          while ((m = re.exec(text)) !== null) {
            hits.push({ rule, match: m[0], index: m.index });
            if (m.index === re.lastIndex) re.lastIndex++;
          }
        } else {
          const needle = String(rule.pattern);
          if (!needle) continue;
          const lower = text.toLowerCase();
          let from = 0, pos;
          while ((pos = lower.indexOf(needle.toLowerCase(), from)) !== -1) {
            hits.push({ rule, match: text.slice(pos, pos + needle.length), index: pos });
            from = pos + Math.max(needle.length, 1);
          }
        }
      } catch (e) { /* 非法规则跳过 */ }
    }
    return hits;
  }

  const normToOrig = [];
  const origToNorm = [];
  let ni = 0;
  for (let oi = 0; oi < text.length; oi++) {
    const nc = normalizeText(text[oi]);
    if (nc.length > 0) {
      normToOrig[ni] = oi;
      origToNorm[oi] = ni;
      ni++;
    } else {
      origToNorm[oi] = -1;
    }
  }

  for (const rule of rules) {
    if (!rule || !rule.enabled) continue;
    try {
      if (rule.type === 'regex') {
        const re = new RegExp(rule.pattern, 'g');
        let m;
        while ((m = re.exec(normalized)) !== null) {
          const nStart = m.index;
          const nEnd = nStart + m[0].length;
          const origStart = normToOrig[nStart] || 0;
          let origEnd = origStart;
          while (origEnd < text.length && origToNorm[origEnd] === -1) origEnd++;
          if (origEnd < text.length) origEnd = (normToOrig[nEnd - 1] || 0) + 1;
          hits.push({ rule, match: text.slice(origStart, origEnd), index: origStart });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        const needle = String(rule.pattern);
        if (!needle) continue;
        const nLower = normalized.toLowerCase();
        const nNeedle = needle.toLowerCase();
        let from = 0, pos;
        while ((pos = nLower.indexOf(nNeedle, from)) !== -1) {
          const origStart = normToOrig[pos] || 0;
          let origEnd = origStart;
          while (origEnd < text.length && origToNorm[origEnd] === -1) origEnd++;
          if (origEnd < text.length) origEnd = (normToOrig[pos + nNeedle.length - 1] || 0) + 1;
          hits.push({ rule, match: text.slice(origStart, origEnd), index: origStart });
          from = pos + Math.max(nNeedle.length, 1);
        }
      }
    } catch (e) { /* 非法规则跳过 */ }
  }
  return hits;
}

// ---- 内嵌 i18n 翻译（content script 无法 fetch chrome-extension:// 资源，需在 JS 中内联） ----
const I18N_MESSAGES = {
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

// 挂载到 window：当本文件作为 content script 注入时，供 content-script.js 复用同一份 DEFAULT_RULES，
// 避免"测试面板"与"真实拦截"规则分叉。options.html 直引时也兼容（window 已存在即可）。
try { window.__AI_GUARD_DEFAULTS__ = { DEFAULT_RULES, DEFAULT_SITES, DEFAULT_SETTINGS, normalizeText, scanText, I18N_MESSAGES }; } catch (e) {}
