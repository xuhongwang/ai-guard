import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../scripts/build.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

test('build produces loadable Chrome and Firefox packages', async () => {
  const outRoot = path.join(root, 'tests', '.tmp', 'dist');

  try {
    await build({ rootDir: root, outRoot });

    for (const target of ['chrome', 'firefox']) {
      const dir = path.join(outRoot, target);
      const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

      assert.equal(manifest.version, pkg.version, `${target}: version`);
      assert.equal(manifest.manifest_version, 3, `${target}: manifest_version`);

      for (const file of [
        'defaults.js',
        'settings.js',
        'background.js',
        'content-script.js',
        'content-style.css',
        'lang.js',
        'options.html',
        'options.css',
        'options.js',
        'popup.html',
        'popup.js',
        'privacy.html',
        'LICENSE',
        '_locales/en/messages.json',
        '_locales/zh_CN/messages.json',
        'icons/icon16.png',
      ]) {
        assert.ok(existsSync(path.join(dir, file)), `${target}: missing ${file}`);
      }
    }

    const chromeManifest = JSON.parse(
      readFileSync(path.join(outRoot, 'chrome', 'manifest.json'), 'utf8'),
    );
    const firefoxManifest = JSON.parse(
      readFileSync(path.join(outRoot, 'firefox', 'manifest.json'), 'utf8'),
    );

    assert.equal(chromeManifest.background.service_worker, 'background.js');
    assert.deepEqual(firefoxManifest.background.scripts, ['defaults.js', 'background.js']);

    const generated = readFileSync(path.join(outRoot, 'chrome', 'lang.js'), 'utf8');
    assert.match(generated, /const MESSAGES = \{/);
    assert.match(generated, /warningBarTitle/);
    assert.ok(!generated.includes('@inject:messages'), 'generated lang.js still has token');
  } finally {
    rmSync(path.join(root, 'tests', '.tmp'), { recursive: true, force: true });
  }
});
