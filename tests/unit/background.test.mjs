import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const defaultsSource = readFileSync(new URL('../../src/core/defaults.js', import.meta.url), 'utf8');
const backgroundSource = readFileSync(
  new URL('../../src/background/background.js', import.meta.url),
  'utf8',
);

function boot({ firefox }) {
  let listener = null;
  const writes = [];
  const sandbox = {
    chrome: {
      runtime: {
        onInstalled: {
          addListener: (fn) => {
            listener = fn;
          },
        },
      },
      storage: {
        local: {
          get: (_keys, cb) => cb({}),
          set: (value, cb) => {
            writes.push(value);
            if (cb) cb();
          },
        },
        sync: {
          get: (_keys, cb) => cb({}),
        },
      },
    },
  };

  vm.createContext(sandbox);
  if (firefox) {
    sandbox.window = sandbox;
    vm.runInContext(defaultsSource, sandbox, { filename: 'defaults.js' });
  } else {
    sandbox.importScripts = (file) => {
      assert.equal(file, 'defaults.js');
      vm.runInContext(defaultsSource, sandbox, { filename: 'defaults.js' });
    };
  }
  vm.runInContext(backgroundSource, sandbox, { filename: 'background.js' });

  assert.equal(typeof listener, 'function');
  listener();

  return writes;
}

test('Chrome service worker loads shared defaults and seeds storage', () => {
  const writes = boot({ firefox: false });
  assert.equal(writes.length, 1);
  assert.ok(Array.isArray(writes[0].settings.rules));
  assert.ok(writes[0].settings.rules.length > 0);
});

test('Firefox background page loads shared defaults and seeds storage', () => {
  const writes = boot({ firefox: true });
  assert.equal(writes.length, 1);
  assert.ok(Array.isArray(writes[0].settings.rules));
  assert.ok(writes[0].settings.rules.length > 0);
});
