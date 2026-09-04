const defaultSettings = {
  enabled: true,
  visualWarning: true,
  blockSend: true,
  scanOnPaste: true,
  rules: (window.__AI_GUARD_DEFAULTS__ && window.__AI_GUARD_DEFAULTS__.DEFAULT_RULES) || [],
  sites: (window.__AI_GUARD_DEFAULTS__ && window.__AI_GUARD_DEFAULTS__.DEFAULT_SITES) || { builtin: true, custom: [] },
};

function loadSettings(cb) {
  chrome.storage.local.get(['settings'], (res) => {
    cb(Object.assign({}, defaultSettings, res.settings || {}));
  });
}

function saveSettings(s, cb) {
  chrome.storage.local.set({ settings: s }, () => {
    notifyContentScripts();
    cb && cb();
  });
}

function notifyContentScripts() {
  try {
    chrome.runtime.sendMessage({ type: 'AI_GUARD_CONFIG_UPDATED' }).catch(() => {});
  } catch (e) {}
}

function updateSubToggles(enabled) {
  const visual = document.getElementById('toggleVisual');
  const block = document.getElementById('toggleBlockSend');
  visual.classList.toggle('disabled', !enabled);
  block.classList.toggle('disabled', !enabled);
}

function bindToggle(id, key) {
  const el = document.getElementById(id);
  loadSettings((s) => {
    el.classList.toggle('on', !!s[key]);
    if (key === 'enabled') updateSubToggles(s.enabled);
    el.addEventListener('click', () => {
      loadSettings((cur) => {
        cur[key] = !cur[key];
        saveSettings(cur, () => {
          el.classList.toggle('on', cur[key]);
          if (key === 'enabled') updateSubToggles(cur[key]);
        });
      });
    });
  });
}

function updateRuleStat() {
  loadSettings((s) => {
    const rules = (s.rules || []).filter((r) => r.enabled).length;
    document.getElementById('ruleStat').textContent = L.t('ruleStat', { count: rules });
  });
}

async function initI18n() {
  await L.init();
  const langBtn = document.getElementById('langToggle');
  langBtn.textContent = L.t('langLabel');
  langBtn.addEventListener('click', async () => {
    await L.toggleLang();
    langBtn.textContent = L.t('langLabel');
    updateRuleStat();
  });
  updateRuleStat();
}

initI18n();

bindToggle('toggleEnabled', 'enabled');
bindToggle('toggleVisual', 'visualWarning');
bindToggle('toggleBlockSend', 'blockSend');

document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
