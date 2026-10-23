import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../../scripts/gen-manifests.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifests = {
  chrome: buildManifest('chrome', { rootDir: root }),
  firefox: buildManifest('firefox', { rootDir: root }),
};

const SOURCE_MAP = {
  'defaults.js': 'src/core/defaults.js',
  'background.js': 'src/background/background.js',
  'content-script.js': 'src/content/content-script.js',
  'content-style.css': 'src/content/content-style.css',
  'options.html': 'src/ui/options.html',
  'options.css': 'src/ui/options.css',
  'options.js': 'src/ui/options.js',
  'popup.html': 'src/ui/popup.html',
  'popup.js': 'src/ui/popup.js',
  'lang.js': 'src/ui/lang.template.js',
  'privacy.html': 'privacy.html',
  'icons/icon16.png': 'icons/icon16.png',
  'icons/icon48.png': 'icons/icon48.png',
  'icons/icon128.png': 'icons/icon128.png',
};

test('generated manifests are MV3 with package version', () => {
  for (const [name, manifest] of Object.entries(manifests)) {
    assert.equal(manifest.manifest_version, 3, `${name}: manifest_version`);
    assert.equal(manifest.version, pkg.version, `${name}: version`);
    assert.equal(manifest.default_locale, 'en', `${name}: default_locale`);
    assert.ok(manifest.name, `${name}: name`);
    assert.ok(manifest.description, `${name}: description`);
  }
});

test('permissions and content scripts are consistent', () => {
  for (const [name, manifest] of Object.entries(manifests)) {
    assert.ok(manifest.permissions.includes('storage'), `${name}: storage permission`);
    assert.ok(manifest.permissions.includes('tabs'), `${name}: tabs permission`);

    const contentScript = manifest.content_scripts[0];
    assert.deepEqual(
      contentScript.js,
      ['defaults.js', 'lang.js', 'content-script.js'],
      `${name}: content script order`,
    );
    assert.deepEqual(contentScript.css, ['content-style.css'], `${name}: content css`);
    assert.deepEqual(contentScript.matches, ['<all_urls>'], `${name}: content matches`);
  }
});

test('browser-specific background declarations are present', () => {
  assert.equal(manifests.chrome.background.service_worker, 'background.js');
  assert.equal(manifests.chrome.background.scripts, undefined);
  assert.deepEqual(manifests.firefox.background.scripts, ['background.js']);
  assert.equal(manifests.firefox.background.service_worker, undefined);
  assert.equal(manifests.firefox.browser_specific_settings.gecko.id, 'ai-guard@extension.local');
  assert.equal(manifests.chrome.browser_specific_settings, undefined);
});

test('generated manifests only contain expected fields', () => {
  const base = JSON.parse(readFileSync(path.join(root, 'manifests', 'base.json'), 'utf8'));
  assert.equal(base.version, undefined, 'version must come from package.json');
  assert.equal(base.background, undefined, 'background must come from target manifest');
});

test('all referenced runtime files have a source file', () => {
  const referenced = new Set();

  for (const manifest of Object.values(manifests)) {
    referenced.add(manifest.action.default_popup);
    referenced.add(manifest.options_page);
    if (manifest.background.service_worker) referenced.add(manifest.background.service_worker);
    for (const script of manifest.background.scripts || []) referenced.add(script);
    for (const script of manifest.content_scripts[0].js) referenced.add(script);
    for (const style of manifest.content_scripts[0].css) referenced.add(style);
    for (const icon of Object.values(manifest.icons)) referenced.add(icon);
    for (const icon of Object.values(manifest.action.default_icon)) referenced.add(icon);
  }

  for (const file of referenced) {
    const source = SOURCE_MAP[file];
    assert.ok(source, `no source mapping for ${file}`);
    assert.ok(existsSync(path.join(root, source)), `missing source for ${file}: ${source}`);
  }
});

test('locale and icon directories are present', () => {
  for (const file of [
    '_locales/en/messages.json',
    '_locales/zh_CN/messages.json',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
  ]) {
    assert.ok(existsSync(path.join(root, file)), `missing ${file}`);
  }
});
