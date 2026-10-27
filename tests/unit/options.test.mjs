import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildMessages } from '../../scripts/gen-i18n.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const langSource = read('src/ui/lang.template.js').replace(
  '/* @inject:messages */ {}',
  JSON.stringify(buildMessages(root)),
);

const fixture = {
  enabled: true,
  visualWarning: true,
  blockSend: true,
  scanOnPaste: true,
  rules: [
    { id: 'r1', type: 'keyword', pattern: 'alpha', desc: 'A', severity: 'warn', enabled: true },
    { id: 'r2', type: 'keyword', pattern: 'beta', desc: 'B', severity: 'error', enabled: true },
    { id: 'r3', type: 'keyword', pattern: 'gamma', desc: 'C', severity: 'warn', enabled: true },
  ],
  sites: {
    builtin: true,
    custom: [{ id: 's1', host: 'example.com', inputSel: '', buttonSel: '' }],
  },
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pick(store, keys) {
  const list =
    typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
  const result = {};
  for (const key of list) {
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      // 模拟 chrome.storage 的结构化克隆：调用方拿到的是副本
      result[key] = JSON.parse(JSON.stringify(store[key]));
    }
  }
  return result;
}

function createStorage(initial) {
  const data = JSON.parse(JSON.stringify(initial || {}));
  return {
    data,
    local: {
      get(keys, callback) {
        const result = pick(data, keys);
        if (typeof callback === 'function') {
          callback(result);
          return undefined;
        }
        return Promise.resolve(result);
      },
      set(items, callback) {
        Object.assign(data, JSON.parse(JSON.stringify(items)));
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
    },
    onChanged: { addListener() {} },
  };
}

async function createPage(settings = fixture) {
  const dom = new JSDOM(read('src/ui/options.html'), {
    runScripts: 'outside-only',
    url: 'https://example.com/options.html',
  });
  const { window } = dom;
  const storage = createStorage({ settings: JSON.parse(JSON.stringify(settings)) });
  const alerts = [];

  window.chrome = {
    storage,
    runtime: { getManifest: () => ({ version: '1.0.0' }) },
    i18n: { getUILanguage: () => 'zh-CN' },
  };
  Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;

  window.eval(
    [
      read('src/core/defaults.js'),
      langSource,
      read('src/core/settings.js'),
      read('src/ui/options.js'),
    ].join('\n;\n'),
  );

  await wait(60);
  return { window, document: window.document, storage, alerts };
}

const ruleIds = () => fixture.rules.map((rule) => rule.id);

test('renders stored rules and persists toggle changes', async () => {
  const page = await createPage();
  const rows = page.document.querySelectorAll('#ruleList tr');
  assert.equal(rows.length, fixture.rules.length);

  const toggle = rows[0].querySelector('input[type="checkbox"]');
  toggle.checked = false;
  toggle.dispatchEvent(new page.window.Event('change'));
  await wait(30);

  assert.equal(page.storage.data.settings.rules[0].enabled, false);
  page.window.close();
});

test('restores a deleted rule before its successor', async () => {
  const page = await createPage();
  const buttons = page.document.querySelectorAll('#ruleList button.del');

  buttons[1].click();
  await wait(40);

  assert.deepEqual(
    page.storage.data.settings.rules.map((rule) => rule.id),
    ['r1', 'r3'],
  );

  const undo = page.document.querySelector('.toast-action');
  assert.ok(undo, 'undo button should be visible');
  undo.click();
  await wait(80);

  assert.deepEqual(
    page.storage.data.settings.rules.map((rule) => rule.id),
    ruleIds(),
  );
  assert.equal(page.document.querySelectorAll('#ruleList tr').length, fixture.rules.length);
  page.window.close();
});

test('restores a deleted custom site', async () => {
  const page = await createPage();
  page.document.querySelector('#siteList button.del').click();
  await wait(40);
  assert.equal(page.storage.data.settings.sites.custom.length, 0);

  page.document.querySelector('.toast-action').click();
  await wait(80);
  assert.deepEqual(
    page.storage.data.settings.sites.custom.map((site) => site.id),
    ['s1'],
  );
  page.window.close();
});

test('rejects an imported rule with an invalid regex and keeps settings', async () => {
  const page = await createPage();
  const input = page.document.getElementById('fileInput');
  const payload = JSON.stringify({
    rules: [
      { type: 'keyword', pattern: 'ok', severity: 'warn' },
      { type: 'regex', pattern: '[', severity: 'error' },
    ],
  });
  const file = new page.window.File([payload], 'bad.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });

  input.dispatchEvent(new page.window.Event('change'));
  await wait(120);

  assert.equal(page.alerts.length, 1);
  assert.match(page.alerts[0], /第 2 条规则的正则无效/);
  assert.deepEqual(
    page.storage.data.settings.rules.map((rule) => rule.id),
    ruleIds(),
  );
  page.window.close();
});

test('debounces text input saves', async () => {
  const page = await createPage();
  const pattern = page.document.querySelector('#ruleList input[type="text"]');
  pattern.value = 'alpha-updated';
  pattern.dispatchEvent(new page.window.Event('input'));

  await wait(120);
  assert.equal(
    page.storage.data.settings.rules[0].pattern,
    'alpha',
    'should not save before the debounce window',
  );

  await wait(360);
  assert.equal(page.storage.data.settings.rules[0].pattern, 'alpha-updated');
  page.window.close();
});
