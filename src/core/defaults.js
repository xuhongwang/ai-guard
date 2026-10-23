/**
 * 默认内置规则库
 * type: 'keyword' 精确/大小写不敏感匹配；'regex' 正则匹配
 * severity: 'error' 拦截发送 + 高亮警告；'warn' 仅高亮警告
 */
const DEFAULT_RULES = [
  // ---------- 密钥 / Token ----------
  {
    id: 'r-key-openai',
    type: 'regex',
    pattern: 'sk-[A-Za-z0-9_-]{20,}',
    severity: 'error',
    enabled: true,
    desc: 'OpenAI API Key',
  },
  {
    id: 'r-key-github',
    type: 'regex',
    pattern: 'ghp_[a-zA-Z0-9]{36}',
    severity: 'error',
    enabled: true,
    desc: 'GitHub Personal Token',
  },
  {
    id: 'r-key-aws',
    type: 'regex',
    pattern: 'AKIA[0-9A-Z]{16}',
    severity: 'error',
    enabled: true,
    desc: 'AWS Access Key',
  },
  {
    id: 'r-key-google',
    type: 'regex',
    pattern: 'AIza[0-9A-Za-z_-]{35}',
    severity: 'error',
    enabled: true,
    desc: 'Google API Key',
  },
  {
    id: 'r-key-private',
    type: 'regex',
    pattern: '-----BEGIN (RSA |EC |DSA |)?PRIVATE KEY-----',
    severity: 'error',
    enabled: true,
    desc: '私钥',
  },
  {
    id: 'r-key-password',
    type: 'regex',
    pattern: '(password|passwd|pwd)\\s*[:=]\\s*\\S+',
    severity: 'warn',
    enabled: true,
    desc: '明文密码',
  },

  // ---------- 内部域名 ----------
  {
    id: 'r-domain',
    type: 'regex',
    pattern: '(^|[^a-z0-9-])([a-z0-9-]+\\.(internal|corp|local|lan)(\\.[a-z0-9-]+)*)([^a-z0-9-]|$)',
    severity: 'error',
    enabled: true,
    desc: '内网域名',
  },

  // ---------- 可自定义的业务关键字（默认留空，演示几个） ----------
  {
    id: 'k-db',
    type: 'keyword',
    pattern: '生产数据库',
    severity: 'error',
    enabled: false,
    desc: '业务关键字示例',
  },
  {
    id: 'k-algo',
    type: 'keyword',
    pattern: '核心算法',
    severity: 'warn',
    enabled: false,
    desc: '业务关键字示例',
  },
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
  enabled: true, // 总开关
  visualWarning: true, // 是否高亮背景 + 警告条
  blockSend: true, // 是否拦截发送（仅 error 级别命中时拦截）
  scanOnPaste: true, // 是否监听粘贴
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
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
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
          let from = 0,
            pos;
          while ((pos = lower.indexOf(needle.toLowerCase(), from)) !== -1) {
            hits.push({ rule, match: text.slice(pos, pos + needle.length), index: pos });
            from = pos + Math.max(needle.length, 1);
          }
        }
      } catch (e) {
        /* 非法规则跳过 */
      }
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
        let from = 0,
          pos;
        while ((pos = nLower.indexOf(nNeedle, from)) !== -1) {
          const origStart = normToOrig[pos] || 0;
          let origEnd = origStart;
          while (origEnd < text.length && origToNorm[origEnd] === -1) origEnd++;
          if (origEnd < text.length) origEnd = (normToOrig[pos + nNeedle.length - 1] || 0) + 1;
          hits.push({ rule, match: text.slice(origStart, origEnd), index: origStart });
          from = pos + Math.max(nNeedle.length, 1);
        }
      }
    } catch (e) {
      /* 非法规则跳过 */
    }
  }
  return hits;
}

// 挂载到 window：当本文件作为 content script 注入时，供 content-script.js 复用同一份 DEFAULT_RULES，
// 避免"测试面板"与"真实拦截"规则分叉。options.html 直引时也兼容（window 已存在即可）。
try {
  window.__AI_GUARD_DEFAULTS__ = {
    DEFAULT_RULES,
    DEFAULT_SITES,
    DEFAULT_SETTINGS,
    normalizeText,
    scanText,
  };
} catch (e) {}
