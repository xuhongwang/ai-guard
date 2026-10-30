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

const rules = [
  { id: 'r-error', type: 'keyword', pattern: 'secret-token', severity: 'error', enabled: true },
  { id: 'r-warn', type: 'keyword', pattern: 'note', severity: 'warn', enabled: true },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createStorage(initial) {
  const data = JSON.parse(JSON.stringify(initial || {}));
  return {
    data,
    local: {
      get(keys, callback) {
        const list =
          typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
        const result = {};
        for (const key of list) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            result[key] = JSON.parse(JSON.stringify(data[key]));
          }
        }
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

function createSettings({ sites, blockSend = true }) {
  return {
    enabled: true,
    visualWarning: true,
    blockSend,
    scanOnPaste: true,
    rules,
    sites,
  };
}

async function createPage({ sites, blockSend = true, text = '' } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="search-input-box"><textarea></textarea></div>
      <div class="enter is-main-chat"><div class="enter-icon-container"><img class="enter_icon" /></div></div>
    </body></html>`,
    { runScripts: 'outside-only', url: 'https://chatglm.cn/main/alltoolsdetail' },
  );
  const { window } = dom;
  // jsdom 没有布局，让 isVisible 认为元素可见
  window.Element.prototype.getClientRects = function () {
    return [{ width: 10, height: 10 }];
  };

  const settings = createSettings({ sites, blockSend });
  const storage = createStorage({ settings });
  window.chrome = {
    storage,
    runtime: { getManifest: () => ({ version: '1.1.0' }) },
    i18n: { getUILanguage: () => 'zh-CN' },
  };
  Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });

  window.eval(
    [read('src/core/defaults.js'), langSource, read('src/content/content-script.js')].join('\n;\n'),
  );
  await wait(60);

  const textarea = window.document.querySelector('textarea');
  textarea.value = text;
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));

  const target = window.document.querySelector('img.enter_icon');
  const dispatchClick = () => {
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    return target.dispatchEvent(event);
  };
  return { window, document: window.document, storage, dispatchClick };
}

const chatglmSites = { builtin: true, custom: [] };

test('blocks clicks on a configured custom send button', async () => {
  const page = await createPage({
    sites: {
      builtin: false,
      custom: [{ id: 's1', host: 'chatglm.cn', inputSel: '', buttonSel: '.enter', enabled: true }],
    },
    text: 'secret-token',
  });

  assert.equal(page.dispatchClick(), false, 'click should be cancelled');
  page.window.close();
});

test('custom site without buttonSel does not fall back to generic buttons', async () => {
  const page = await createPage({
    sites: {
      builtin: false,
      custom: [{ id: 's1', host: 'chatglm.cn', inputSel: '', buttonSel: '', enabled: true }],
    },
    text: 'secret-token',
  });

  assert.equal(page.dispatchClick(), true, 'click should not be cancelled');
  page.window.close();
});

test('blocks clicks on the built-in chatglm send button', async () => {
  const page = await createPage({ sites: chatglmSites, text: 'secret-token' });
  assert.equal(page.dispatchClick(), false, 'click should be cancelled');
  page.window.close();
});

test('does not block clicks for warn-level hits', async () => {
  const page = await createPage({ sites: chatglmSites, text: 'note' });
  assert.equal(page.dispatchClick(), true, 'click should not be cancelled');
  page.window.close();
});

test('does not block clicks when blockSend is disabled', async () => {
  const page = await createPage({ sites: chatglmSites, blockSend: false, text: 'secret-token' });
  assert.equal(page.dispatchClick(), true, 'click should not be cancelled');
  page.window.close();
});
