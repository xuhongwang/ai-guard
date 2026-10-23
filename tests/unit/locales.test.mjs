import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const readLocale = (locale) =>
  JSON.parse(readFileSync(new URL(`_locales/${locale}/messages.json`, root), 'utf8'));

const locales = {
  en: readLocale('en'),
  zh_CN: readLocale('zh_CN'),
};

const placeholders = (message) =>
  [...message.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();

test('locales expose the same keys', () => {
  assert.deepEqual(
    Object.keys(locales.en).sort(),
    Object.keys(locales.zh_CN).sort(),
    'en and zh_CN keys differ',
  );
});

test('every locale entry has a non-empty message', () => {
  for (const [locale, messages] of Object.entries(locales)) {
    for (const [key, entry] of Object.entries(messages)) {
      assert.equal(typeof entry.message, 'string', `${locale}.${key}: message type`);
      assert.ok(entry.message.trim().length > 0, `${locale}.${key}: empty message`);
    }
  }
});

test('placeholders match across locales', () => {
  for (const key of Object.keys(locales.en)) {
    assert.deepEqual(
      placeholders(locales.en[key].message),
      placeholders(locales.zh_CN[key].message),
      `${key}: placeholder mismatch`,
    );
  }
});

test('manifest message keys exist', () => {
  for (const locale of Object.keys(locales)) {
    assert.ok(locales[locale].extName?.message, `${locale}: extName`);
    assert.ok(locales[locale].extDesc?.message, `${locale}: extDesc`);
  }
});
