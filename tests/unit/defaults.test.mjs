import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../src/core/defaults.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'defaults.js' });

const { DEFAULT_RULES, normalizeText, scanText } = sandbox.window.__AI_GUARD_DEFAULTS__;

const rule = (overrides = {}) => ({
  id: 'test-rule',
  type: 'keyword',
  pattern: 'secret',
  severity: 'warn',
  enabled: true,
  desc: 'test',
  ...overrides,
});

test('defaults are exposed on window', () => {
  assert.ok(Array.isArray(DEFAULT_RULES));
  assert.equal(typeof normalizeText, 'function');
  assert.equal(typeof scanText, 'function');
});

test('defaults mount to globalThis when window is absent', () => {
  const worker = {};
  vm.createContext(worker);
  vm.runInContext(source, worker, { filename: 'defaults.js' });
  assert.equal(typeof worker.__AI_GUARD_DEFAULTS__.scanText, 'function');
  assert.ok(Array.isArray(worker.__AI_GUARD_DEFAULTS__.DEFAULT_RULES));
});

test('normalizeText removes zero-width characters and converts full-width characters', () => {
  assert.equal(normalizeText('a\u200Bb\uFEFFc\u00ADd'), 'abcd');
  assert.equal(normalizeText('ＡＢＣ１２３'), 'ABC123');
  assert.equal(normalizeText('a\u3000b'), 'a b');
  assert.equal(normalizeText('！'), '!');
});

test('keyword matching is case-insensitive and reports every hit', () => {
  const hits = scanText('SeCrEt and secret', [rule()]);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].match, 'SeCrEt');
  assert.equal(hits[0].index, 0);
  assert.equal(hits[1].match, 'secret');
  assert.equal(hits[1].index, 11);
});

test('disabled rules and empty patterns are ignored', () => {
  assert.equal(scanText('secret', [rule({ enabled: false })]).length, 0);
  assert.equal(scanText('secret', [rule({ pattern: '' })]).length, 0);
});

test('regex rules match and report severity metadata', () => {
  const hits = scanText('key: sk-abcdefghijklmnopqrstuvwx end', [
    rule({ type: 'regex', pattern: 'sk-[A-Za-z0-9_-]{20,}', severity: 'error' }),
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].match, 'sk-abcdefghijklmnopqrstuvwx');
  assert.equal(hits[0].rule.severity, 'error');
});

test('invalid regex patterns are skipped without throwing', () => {
  assert.doesNotThrow(() => scanText('anything', [rule({ type: 'regex', pattern: '[' })]));
  assert.equal(scanText('anything', [rule({ type: 'regex', pattern: '[' })]).length, 0);
});

test('regex rules remain stateless across repeated scans', () => {
  const regexRule = rule({ type: 'regex', pattern: 'secret' });
  assert.equal(scanText('secret and secret', [regexRule]).length, 2);
  assert.equal(scanText('secret and secret', [regexRule]).length, 2);
});

test('full-width and zero-width bypasses still match the original text', () => {
  const fullWidth = scanText('ｓｅｃｒｅｔ', [rule()]);
  assert.equal(fullWidth.length, 1);
  assert.equal(fullWidth[0].match, 'ｓｅｃｒｅｔ');
  assert.equal(fullWidth[0].index, 0);

  const zeroWidth = scanText('sec\u200Bret', [rule()]);
  assert.equal(zeroWidth.length, 1);
  assert.equal(zeroWidth[0].match, 'sec\u200Bret');
  assert.equal(zeroWidth[0].index, 0);
});

test('invalid input is handled defensively', () => {
  assert.equal(scanText('', [rule()]).length, 0);
  assert.equal(scanText(null, [rule()]).length, 0);
  assert.equal(scanText('secret', null).length, 0);
  assert.equal(scanText('secret', []).length, 0);
});

test('default rules are well-formed', () => {
  const ids = new Set();
  for (const item of DEFAULT_RULES) {
    assert.ok(item.id, 'rule id');
    assert.ok(!ids.has(item.id), `duplicate rule id: ${item.id}`);
    ids.add(item.id);
    assert.ok(['keyword', 'regex'].includes(item.type), `${item.id}: type`);
    assert.ok(['error', 'warn'].includes(item.severity), `${item.id}: severity`);
    assert.equal(typeof item.desc, 'string', `${item.id}: desc`);
    if (item.type === 'regex') {
      assert.doesNotThrow(() => new RegExp(item.pattern), `${item.id}: invalid regex`);
    }
  }
});

test('default rules detect representative secrets', () => {
  const cases = [
    'sk-' + 'a'.repeat(24),
    'AKIA' + 'A'.repeat(16),
    '-----BEGIN RSA PRIVATE KEY-----',
    'password=super-secret',
  ];

  for (const sample of cases) {
    assert.ok(scanText(sample, DEFAULT_RULES).length > 0, `not detected: ${sample}`);
  }
});

test('disabled default keyword rules stay inactive', () => {
  const text = '生产数据库 核心算法';
  assert.equal(scanText(text, DEFAULT_RULES).length, 0);
});
