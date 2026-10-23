import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const template = readFileSync(new URL('../../src/ui/lang.template.js', import.meta.url), 'utf8');
const messages = {
  en: { optionsDesc: 'Use <b>error</b> for blocking rules.' },
  zh_CN: { optionsDesc: '使用 <b>error</b> 级别拦截。' },
};
const source = template.replace('/* @inject:messages */ {}', JSON.stringify(messages));

const sandbox = {
  navigator: { language: 'zh-CN' },
  chrome: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
    },
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  document: { querySelectorAll: () => [] },
};

vm.createContext(sandbox);
vm.runInContext(`${source}\n;globalThis.__L = L;`, sandbox, { filename: 'lang.template.js' });
const L = sandbox.__L;

test('normalizes supported language variants', () => {
  for (const value of ['zh', 'zh-CN', 'zh_CN', 'zh-TW', 'ZH']) {
    assert.equal(L.normalizeLang(value), 'zh_CN', value);
  }
  for (const value of ['en', 'en-US', 'fr', '', null]) {
    assert.equal(L.normalizeLang(value), 'en', String(value));
  }
});

test('renders HTML translations and selects zh_CN for zh-CN', async () => {
  await L.init();
  assert.equal(L.getLang(), 'zh_CN');

  const attributes = { 'data-i18n-html': 'optionsDesc' };
  const element = {
    innerHTML: '',
    textContent: '',
    getAttribute: (name) => attributes[name] || null,
  };
  const root = {
    querySelectorAll: (selector) => (selector === '[data-i18n-html]' ? [element] : []),
  };

  L.applyToDOM(root);

  assert.match(element.innerHTML, /<b>error<\/b>/);
  assert.equal(element.textContent, '');
});
