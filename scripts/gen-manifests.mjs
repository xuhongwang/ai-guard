import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TARGETS = ['chrome', 'firefox'];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function mergeManifest(base, override) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    result[key] =
      isPlainObject(value) && isPlainObject(base[key]) ? mergeManifest(base[key], value) : value;
  }

  return result;
}

export function buildManifest(target, { rootDir = root, version } = {}) {
  if (!TARGETS.includes(target)) throw new Error(`unknown manifest target: ${target}`);

  const pkg = readJson(path.join(rootDir, 'package.json'));
  const base = readJson(path.join(rootDir, 'manifests', 'base.json'));
  const variant = readJson(path.join(rootDir, 'manifests', `${target}.json`));
  return { ...mergeManifest(base, variant), version: version || pkg.version };
}

export function writeManifest(target, outDir, options = {}) {
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'manifest.json');
  writeFileSync(file, `${JSON.stringify(buildManifest(target, options), null, 2)}\n`);
  return file;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    for (const target of TARGETS) {
      const file = writeManifest(target, path.join(root, 'dist', target));
      console.log(`generated ${path.relative(root, file)}`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
