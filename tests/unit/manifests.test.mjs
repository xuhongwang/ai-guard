import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const exists = (name) => existsSync(new URL(name, root));

const packageJson = readJson('package.json');
const manifests = {
  base: readJson('manifest.json'),
  chrome: readJson('manifest.chrome.json'),
  firefox: readJson('manifest.firefox.json'),
};

test('all manifests are MV3 with matching metadata', () => {
  for (const [name, manifest] of Object.entries(manifests)) {
    assert.equal(manifest.manifest_version, 3, `${name}: manifest_version`);
    assert.equal(manifest.version, packageJson.version, `${name}: version`);
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
  assert.equal(manifests.base.background.service_worker, 'background.js');
  assert.equal(manifests.chrome.background.service_worker, 'background.js');
  assert.deepEqual(manifests.firefox.background.scripts, ['background.js']);
  assert.equal(manifests.firefox.browser_specific_settings.gecko.id, 'ai-guard@extension.local');
});

test('base manifest and chrome manifest stay in sync', () => {
  assert.deepEqual(manifests.base, manifests.chrome);
});

test('all files referenced by manifests exist', () => {
  const referenced = new Set();
  for (const manifest of Object.values(manifests)) {
    if (manifest.action?.default_popup) referenced.add(manifest.action.default_popup);
    if (manifest.options_page) referenced.add(manifest.options_page);
    if (manifest.background?.service_worker) referenced.add(manifest.background.service_worker);
    for (const script of manifest.background?.scripts || []) referenced.add(script);
    for (const script of manifest.content_scripts[0].js) referenced.add(script);
    for (const style of manifest.content_scripts[0].css) referenced.add(style);
    for (const icon of Object.values(manifest.icons)) referenced.add(icon);
    for (const icon of Object.values(manifest.action.default_icon)) referenced.add(icon);
  }

  for (const file of referenced) {
    assert.ok(exists(file), `missing manifest resource: ${file}`);
  }
});
