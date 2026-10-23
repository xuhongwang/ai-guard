import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const root = fileURLToPath(new URL('..', import.meta.url));
const LOCALES = ['en', 'zh_CN'];
const MANIFEST_ONLY = new Set(['extName', 'extDesc']);

export function buildMessages(rootDir = root) {
  const messages = {};

  for (const locale of LOCALES) {
    const file = path.join(rootDir, '_locales', locale, 'messages.json');
    const entries = JSON.parse(readFileSync(file, 'utf8'));

    messages[locale] = Object.fromEntries(
      Object.entries(entries)
        .filter(([key]) => !MANIFEST_ONLY.has(key))
        .map(([key, entry]) => {
          if (typeof entry.message !== 'string' || entry.message.length === 0) {
            throw new Error(`empty message: ${locale}.${key}`);
          }
          return [key, entry.message];
        }),
    );
  }

  return messages;
}

export async function generateLang({ rootDir = root, outFile } = {}) {
  const templatePath = path.join(rootDir, 'src', 'ui', 'lang.template.js');
  const outputPath = outFile || path.join(rootDir, 'src', 'generated', 'lang.js');
  const template = readFileSync(templatePath, 'utf8');
  const token = '/* @inject:messages */ {}';

  if (!template.includes(token)) {
    throw new Error(`missing i18n injection token in ${templatePath}`);
  }

  const source = template.replace(token, JSON.stringify(buildMessages(rootDir), null, 2));
  const config = (await prettier.resolveConfig(outputPath)) || {};
  const formatted = await prettier.format(source, { ...config, parser: 'babel' });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatted);
  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateLang()
    .then((file) => console.log(`generated ${path.relative(root, file)}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
