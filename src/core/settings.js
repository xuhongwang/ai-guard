(function () {
  const RULE_TYPES = ['keyword', 'regex'];
  const SEVERITIES = ['error', 'warn'];
  const BOOLEAN_KEYS = ['enabled', 'visualWarning', 'blockSend', 'scanOnPaste'];

  function normalizeRule(rule, index) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error(`rule:${index}`);
    }
    if (!RULE_TYPES.includes(rule.type)) throw new Error(`rule:${index}`);
    if (typeof rule.pattern !== 'string') throw new Error(`rule:${index}`);
    if (!SEVERITIES.includes(rule.severity)) throw new Error(`rule:${index}`);
    if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
      throw new Error(`rule:${index}`);
    }
    if (rule.desc !== undefined && typeof rule.desc !== 'string') {
      throw new Error(`rule:${index}`);
    }
    if (rule.type === 'regex') {
      try {
        new RegExp(rule.pattern);
      } catch {
        throw new Error(`regex:${index}`);
      }
    }
    return {
      id: typeof rule.id === 'string' && rule.id ? rule.id : `import-rule-${index}`,
      type: rule.type,
      pattern: rule.pattern,
      severity: rule.severity,
      enabled: rule.enabled !== false,
      desc: typeof rule.desc === 'string' ? rule.desc : '',
    };
  }

  function normalizeSite(site, index) {
    if (!site || typeof site !== 'object' || Array.isArray(site)) {
      throw new Error(`site:${index}`);
    }
    for (const key of ['host', 'inputSel', 'buttonSel']) {
      if (site[key] !== undefined && typeof site[key] !== 'string') {
        throw new Error(`site:${index}`);
      }
    }
    if (site.enabled !== undefined && typeof site.enabled !== 'boolean') {
      throw new Error(`site:${index}`);
    }
    return {
      id: typeof site.id === 'string' && site.id ? site.id : `import-site-${index}`,
      host: typeof site.host === 'string' ? site.host : '',
      inputSel: typeof site.inputSel === 'string' ? site.inputSel : '',
      buttonSel: typeof site.buttonSel === 'string' ? site.buttonSel : '',
      enabled: site.enabled !== false,
    };
  }

  function normalizeSites(sites) {
    if (!sites || typeof sites !== 'object' || Array.isArray(sites)) {
      throw new Error('format');
    }
    if (sites.builtin !== undefined && typeof sites.builtin !== 'boolean') {
      throw new Error('format');
    }
    if (sites.custom !== undefined && !Array.isArray(sites.custom)) {
      throw new Error('format');
    }
    return {
      builtin: sites.builtin !== false,
      custom: (sites.custom || []).map(normalizeSite),
    };
  }

  function normalizeSettings(input, base) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('format');
    }
    if (!Array.isArray(input.rules)) throw new Error('rules');

    const result = {
      enabled: base.enabled,
      visualWarning: base.visualWarning,
      blockSend: base.blockSend,
      scanOnPaste: base.scanOnPaste,
      rules: input.rules.map(normalizeRule),
      sites: base.sites,
    };

    for (const key of BOOLEAN_KEYS) {
      if (typeof input[key] === 'boolean') result[key] = input[key];
    }
    if (input.sites !== undefined) result.sites = normalizeSites(input.sites);
    return result;
  }

  /**
   * 把被删除的条目放回原位置：优先插到原来后一个条目之前，
   * 找不到锚点或缺少 id 时追加到末尾。已存在同 id 条目不重复插入。
   */
  function restoreRemoved(items, item, nextId) {
    const list = Array.isArray(items) ? items.slice() : [];
    if (!item || typeof item !== 'object') return list;
    const id = typeof item.id === 'string' ? item.id : '';
    if (id && list.some((entry) => entry && entry.id === id)) return list;
    let at = -1;
    if (nextId) {
      at = list.findIndex((entry) => entry && entry.id === nextId);
    }
    list.splice(at === -1 ? list.length : at, 0, item);
    return list;
  }

  try {
    (typeof window !== 'undefined' ? window : globalThis).__AI_GUARD_SETTINGS__ = {
      normalizeSettings,
      restoreRemoved,
    };
  } catch (e) {}
})();
