import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateLang } from './gen-i18n.mjs';
import { buildManifest } from './gen-manifests.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const TARGETS = ['chrome', 'firefox'];

const COPY = [
  ['src/core/defaults.js', 'defaults.js'],
  ['src/background/background.js', 'background.js'],
  ['src/content/content-script.js', 'content-script.js'],
  ['src/content/content-style.css', 'content-style.css'],
  ['src/ui/options.html', 'options.html'],
  ['src/ui/options.css', 'options.css'],
  ['src/ui/options.js', 'options.js'],
  ['src/ui/popup.html', 'popup.html'],
  ['src/ui/popup.js', 'popup.js'],
  ['_locales', '_locales'],
  ['icons', 'icons'],
  ['privacy.html', 'privacy.html'],
  ['LICENSE', 'LICENSE'],
];

export async function build({ rootDir = root, outRoot = path.join(rootDir, 'dist') } = {}) {
  const langFile = await generateLang({ rootDir });

  rmSync(outRoot, { recursive: true, force: true });

  for (const target of TARGETS) {
    const targetDir = path.join(outRoot, target);
    mkdirSync(targetDir, { recursive: true });

    for (const [from, to] of COPY) {
      cpSync(path.join(rootDir, from), path.join(targetDir, to), { recursive: true });
    }

    cpSync(langFile, path.join(targetDir, 'lang.js'));
    writeFileSync(
      path.join(targetDir, 'manifest.json'),
      `${JSON.stringify(buildManifest(target, { rootDir }), null, 2)}\n`,
    );
  }

  return outRoot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  build()
    .then((outRoot) => console.log(`built ${path.relative(root, outRoot)}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
