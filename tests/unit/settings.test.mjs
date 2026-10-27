import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../src/core/settings.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'settings.js' });
const { normalizeSettings, restoreRemoved } = sandbox.window.__AI_GUARD_SETTINGS__;

const base = {
  enabled: true,
  visualWarning: true,
  blockSend: true,
  scanOnPaste: true,
  rules: [],
  sites: { builtin: true, custom: [] },
};

const validRule = {
  id: 'r1',
  type: 'keyword',
  pattern: 'secret',
  severity: 'warn',
  enabled: true,
  desc: 'test',
};

test('normalizes imported settings and drops unknown fields', () => {
  const result = normalizeSettings(
    {
      rules: [validRule],
      sites: {
        builtin: false,
        custom: [{ host: '*.example.com', inputSel: 'textarea', enabled: true }],
      },
      blockSend: false,
      extra: 'ignored',
    },
    base,
  );

  assert.equal(result.blockSend, false);
  assert.equal(result.visualWarning, true);
  assert.equal(result.rules[0].id, 'r1');
  assert.equal(result.rules[0].enabled, true);
  assert.equal(result.sites.builtin, false);
  assert.equal(result.sites.custom[0].host, '*.example.com');
  assert.equal(result.sites.custom[0].buttonSel, '');
  assert.equal('extra' in result, false);
});

test('fills missing optional values and preserves disabled flags', () => {
  const result = normalizeSettings(
    {
      rules: [{ type: 'regex', pattern: 'sk-\\w+', severity: 'error', enabled: false }],
      sites: { custom: [{ host: 'example.com', enabled: false }] },
    },
    base,
  );

  assert.match(result.rules[0].id, /^import-rule-0$/);
  assert.equal(result.rules[0].enabled, false);
  assert.equal(result.rules[0].desc, '');
  assert.equal(result.sites.builtin, true);
  assert.equal(result.sites.custom[0].enabled, false);
});

test('rejects malformed settings', () => {
  assert.throws(() => normalizeSettings(null, base), /format/);
  assert.throws(() => normalizeSettings([], base), /format/);
  assert.throws(() => normalizeSettings({}, base), /rules/);
  assert.throws(() => normalizeSettings({ rules: [validRule], sites: [] }, base), /format/);
  assert.throws(
    () => normalizeSettings({ rules: [validRule], sites: { custom: {} } }, base),
    /format/,
  );
});

test('rejects malformed rules and invalid regex', () => {
  assert.throws(
    () => normalizeSettings({ rules: [{ ...validRule, type: 'glob' }] }, base),
    /rule:0/,
  );
  assert.throws(
    () => normalizeSettings({ rules: [{ ...validRule, severity: 'fatal' }] }, base),
    /rule:0/,
  );
  assert.throws(
    () => normalizeSettings({ rules: [{ ...validRule, enabled: 'yes' }] }, base),
    /rule:0/,
  );
  assert.throws(() => normalizeSettings({ rules: [{ ...validRule, desc: 1 }] }, base), /rule:0/);
  assert.throws(
    () => normalizeSettings({ rules: [{ ...validRule, type: 'regex', pattern: '[' }] }, base),
    /regex:0/,
  );
});

test('rejects malformed sites', () => {
  assert.throws(
    () => normalizeSettings({ rules: [validRule], sites: { custom: [{ host: 1 }] } }, base),
    /site:0/,
  );
  assert.throws(
    () =>
      normalizeSettings(
        { rules: [validRule], sites: { custom: [{ host: 'a', enabled: 'yes' }] } },
        base,
      ),
    /site:0/,
  );
});

test('restores a removed item before its former successor', () => {
  const list = [{ id: 'a' }, { id: 'c' }];
  const restored = restoreRemoved(list, { id: 'b' }, 'c');
  assert.deepEqual(
    restored.map((item) => item.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    list.map((item) => item.id),
    ['a', 'c'],
    'input list must not be mutated',
  );
});

test('restores a removed item at the end when the anchor is gone', () => {
  const restored = restoreRemoved([{ id: 'a' }], { id: 'b' }, 'missing');
  assert.deepEqual(
    restored.map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    restoreRemoved([{ id: 'a' }], { id: 'b' }, null).map((item) => item.id),
    ['a', 'b'],
  );
});

test('restoreRemoved ignores duplicates and invalid input', () => {
  const list = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(
    restoreRemoved(list, { id: 'b' }, 'a').map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    restoreRemoved(list, null, 'a').map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    [...restoreRemoved(null, { id: 'x' })].map((item) => item.id),
    ['x'],
  );
});
