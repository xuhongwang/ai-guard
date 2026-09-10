const STORAGE_KEY = 'settings';

function getDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const merged = Object.assign(getDefaults(), res.settings || {});
    if (!Array.isArray(merged.rules)) merged.rules = getDefaults().rules;
    if (!merged.sites) merged.sites = getDefaults().sites;
    if (!Array.isArray(merged.sites.custom)) merged.sites.custom = [];
    cb(merged);
  });
}

function save(s, cb) {
  chrome.storage.local.set({ [STORAGE_KEY]: s }, () => {
    notifyContentScripts();
    cb && cb();
    showToast(L.t('toastSaved'));
  });
}

function notifyContentScripts() {
  try {
    chrome.runtime.sendMessage({ type: 'AI_GUARD_CONFIG_UPDATED' }).catch(() => {});
  } catch (e) {}
}

function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2100);
}

// =================== 规则列表渲染 ===================
function render(state) {
  const tbody = document.getElementById('ruleList');
  tbody.replaceChildren();
  state.rules.forEach((rule, idx) => {
    const tr = document.createElement('tr');

    const tdOn = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = rule.enabled;
    chk.addEventListener('change', () => { rule.enabled = chk.checked; save(state); renderTest(); });
    tdOn.appendChild(chk);

    const tdType = document.createElement('td');
    const selType = document.createElement('select');
    ['keyword', 'regex'].forEach((t) => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t === 'keyword' ? L.t('typeKeyword') : L.t('typeRegex');
      if (rule.type === t) o.selected = true;
      selType.appendChild(o);
    });
    selType.addEventListener('change', () => { rule.type = selType.value; save(state); renderTest(); });
    tdType.appendChild(selType);

    const tdPat = document.createElement('td');
    const inpPat = document.createElement('input');
    inpPat.type = 'text'; inpPat.value = rule.pattern;
    inpPat.placeholder = L.t('placeholderPattern');
    inpPat.addEventListener('input', () => { rule.pattern = inpPat.value; save(state); renderTest(); });
    tdPat.appendChild(inpPat);

    const tdDesc = document.createElement('td');
    const inpDesc = document.createElement('input');
    inpDesc.type = 'text'; inpDesc.value = rule.desc || '';
    inpDesc.placeholder = L.t('placeholderDesc'); inpDesc.addEventListener('input', () => { rule.desc = inpDesc.value; save(state); });
    tdDesc.appendChild(inpDesc);

    const tdSev = document.createElement('td');
    const selSev = document.createElement('select');
    ['error', 'warn'].forEach((s) => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s === 'error' ? L.t('severityError') : L.t('severityWarn');
      if (rule.severity === s) o.selected = true;
      selSev.appendChild(o);
    });
    selSev.addEventListener('change', () => { rule.severity = selSev.value; save(state); renderTest(); });
    tdSev.appendChild(selSev);

    const tdDel = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'del'; btnDel.textContent = L.t('btnDelete');
    btnDel.addEventListener('click', () => {
      state.rules.splice(idx, 1);
      save(state, () => { render(state); renderSites(state); renderTest(); });
    });
    tdDel.appendChild(btnDel);

    tr.append(tdOn, tdType, tdPat, tdDesc, tdSev, tdDel);
    tbody.appendChild(tr);
  });

  document.getElementById('scanOnPaste').checked = !!state.scanOnPaste;
  renderSites(state);
}

// =================== 站点配置渲染 ===================
function renderSites(state) {
  const builtin = document.getElementById('builtinToggle');
  if (builtin) builtin.checked = !!state.sites.builtin;

  const tbody = document.getElementById('siteList');
  tbody.replaceChildren();
  state.sites.custom.forEach((site, idx) => {
    const tr = document.createElement('tr');

    const tdOn = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = site.enabled;
    chk.addEventListener('change', () => { site.enabled = chk.checked; save(state); });
    tdOn.appendChild(chk);

    const mkInp = (field, placeholder) => {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = site[field] || ''; inp.placeholder = placeholder;
      inp.addEventListener('input', () => { site[field] = inp.value; save(state); });
      return inp;
    };
    const tdHost = document.createElement('td'); tdHost.appendChild(mkInp('host', L.t('placeholderHost')));
    const tdInp  = document.createElement('td'); tdInp.appendChild(mkInp('inputSel', L.t('placeholderInputSel')));
    const tdBtn  = document.createElement('td'); tdBtn.appendChild(mkInp('buttonSel', L.t('placeholderButtonSel')));

    const tdDel = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'del'; btnDel.textContent = L.t('btnDelete');
    btnDel.addEventListener('click', () => {
      state.sites.custom.splice(idx, 1);
      save(state, () => renderSites(state));
    });
    tdDel.appendChild(btnDel);

    tr.append(tdOn, tdHost, tdInp, tdBtn, tdDel);
    tbody.appendChild(tr);
  });
}

// =================== 测试规则面板 ===================
let lastState = null;
function renderTest() {
  if (!lastState) return;
  const el = document.getElementById('testInput');
  const out = document.getElementById('testResult');
  if (!el || !out) return;
  const text = el.value;
  if (!text) {
    out.replaceChildren();
    const hint = document.createElement('span');
    hint.className = 'muted';
    hint.textContent = L.t('testHint');
    out.appendChild(hint);
    return;
  }

  const hits = scanText(text, lastState.rules);
  const ranges = hits
    .map((h) => ({ start: h.index, end: h.index + h.match.length, hit: h }))
    .sort((a, b) => a.start - b.start);

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let errors = 0, warns = 0;

  if (hits.length === 0) {
    const noHits = document.createElement('span');
    noHits.className = 'muted';
    noHits.textContent = `✅ ${L.t('testNoHits')}`;
    fragment.appendChild(noHits);
  } else {
    const summary = document.createElement('span');
    summary.className = 'summary tag-error';
    summary.textContent = L.t('testSummary', { errors, warns: hits.length, total: hits.length });
    fragment.appendChild(summary);

    ranges.forEach((r) => {
      if (r.start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, r.start)));
      }
      const mark = document.createElement('span');
      mark.className = 'hit-mark';
      mark.title = r.hit.rule.desc || r.hit.rule.pattern;
      mark.textContent = text.slice(r.start, r.end);
      fragment.appendChild(mark);
      cursor = Math.max(cursor, r.end);
      if (r.hit.rule.severity === 'error') errors++; else warns++;
    });
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    summary.textContent = L.t('testSummary', { errors, warns, total: hits.length });

    hits.forEach((h) => {
      fragment.appendChild(document.createTextNode('\n'));
      const span = document.createElement('span');
      span.className = h.rule.severity === 'error' ? 'tag-error' : 'tag-warn';
      span.textContent = `• [${h.rule.severity}] ${h.rule.desc || h.rule.pattern} → "${h.match}"`;
      fragment.appendChild(span);
    });
  }

  out.replaceChildren();
  out.appendChild(fragment);
}

// =================== 交互绑定 ===================
document.getElementById('btnAdd').addEventListener('click', () => {
  load((state) => {
    state.rules.push({ id: 'k-' + Date.now(), type: 'keyword', pattern: '', desc: '', severity: 'warn', enabled: true });
    lastState = state;
    save(state, () => { render(state); renderTest(); });
  });
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm(L.t('confirmReset'))) return;
  const fresh = getDefaults();
  lastState = fresh;
  save(fresh, () => { render(fresh); renderTest(); });
});

document.getElementById('btnExport').addEventListener('click', () => {
  load((state) => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-guard-rules.json';
    a.click();
  });
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.rules)) throw new Error(L.t('importFormatError'));
      load((cur) => {
        const fresh = getDefaults();
        const merged = Object.assign(fresh, data, { rules: data.rules });
        if (data.sites) merged.sites = data.sites;
        lastState = merged;
        save(merged, () => { render(merged); renderTest(); });
      });
    } catch (err) { alert(L.t('importError', { error: err.message })); }
  };
  reader.readAsText(file);
});

document.getElementById('scanOnPaste').addEventListener('change', (e) => {
  load((state) => { state.scanOnPaste = e.target.checked; save(state); });
});

// ---- 站点配置交互 ----
document.getElementById('builtinToggle').addEventListener('change', (e) => {
  load((state) => { state.sites.builtin = e.target.checked; save(state); });
});

document.getElementById('btnAddSite').addEventListener('click', () => {
  load((state) => {
    state.sites.custom.push({ id: 's-' + Date.now(), host: '', inputSel: '', buttonSel: '', enabled: true });
    lastState = state;
    save(state, () => renderSites(state));
  });
});

// ---- 测试面板交互 ----
document.getElementById('testInput').addEventListener('input', renderTest);

document.getElementById('btnFillDemo').addEventListener('click', () => {
  const el = document.getElementById('testInput');
  el.value =
`数据库连接：mysql://root:MyS3cret@db.internal.corp:3306/prod
调用大模型：sk-1234567890abcdefghijKLMN
内网地址：https://gitlab.internal/api/v4
普通文本：这里是一段正常的业务描述，不含敏感信息。
AWS 密钥：AKIAIOSFODNN7EXAMPLE`;
  renderTest();
});

document.getElementById('btnClearTest').addEventListener('click', () => {
  document.getElementById('testInput').value = '';
  renderTest();
});

// =================== i18n 初始化 ===================
async function initI18n() {
  await L.init();
  const langBtn = document.getElementById('langToggle');
  langBtn.textContent = L.t('langLabel');
  langBtn.addEventListener('click', async () => {
    await L.toggleLang();
    langBtn.textContent = L.t('langLabel');
    // Re-render dynamic content with new language
    load((state) => {
      lastState = state;
      render(state);
      renderTest();
    });
  });
}

initI18n().then(() => {
  load((state) => {
    lastState = state;
    render(state);
    renderTest();
  });
});
