import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectFiles, writeArchive } from './archive.mjs';
import { runtimeFiles } from './package-files.mjs';
const root = new URL('../', import.meta.url),
  dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
const names = [
  'UIAssistant.zip',
  'UIAssistant-chrome.zip',
  'UIAssistant-edge.zip',
  'UIAssistant-firefox.zip',
];
for (const name of names) {
  const folder = name.slice(0, -4);
  const packaged = JSON.parse(await readFile(new URL(`dist/${folder}/manifest.json`, root)));
  if (packaged.version !== manifest.version) throw Error('Run npm run build first.');
}
const source = await collectFiles(root, [
  ...runtimeFiles,
  'package.json',
  'package-lock.json',
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'README.md',
  'README.fa.md',
  'CONTRIBUTING.md',
  'CONTRIBUTING.fa.md',
  'scripts/',
  'tests/',
  'docs/',
]);
const vendor = JSON.parse(await readFile(new URL('node_modules/dompurify/package.json', root)));
if (vendor.version !== '3.4.17')
  throw Error('Review the pinned DOMPurify source before packaging.');
for (const name of ['purify.es.mjs', 'purify.min.js']) {
  const original = await readFile(new URL(`node_modules/dompurify/dist/${name}`, root));
  if (!original.equals(await readFile(new URL(`vendor/${name}`, root))))
    throw Error('Vendored DOMPurify differs from the locked upstream package.');
}
const upstream = await collectFiles(new URL('node_modules/dompurify/', root), [
  'src/',
  'dist/purify.js',
  'package.json',
  'LICENSE',
  'LICENSE-MPL',
]);
source.push(...upstream.map((entry) => ({ ...entry, name: 'review/DOMPurify/' + entry.name })));
source.push({
  name: 'README-SOURCE.txt',
  data: Buffer.from(
    'UIAssistant source review\nPublisher: saleh ghotbani\nRead docs/publishing/REVIEWER.md.\nNode.js 24 recommended; build uses built-in Node modules only.\nRun: node scripts/build.mjs\nThe output is byte-reproducible and requires no npm install or network.\nFor optional tests/validation: npm ci, npm test, npm run lint:firefox.\nDOMPurify upstream sources are under review/DOMPurify; packaged builds are unmodified npm files.\n',
  ),
});
source.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
await writeArchive(new URL('UIAssistant-source.zip', dist), source);
names.push('UIAssistant-source.zip');
await writeArchive(
  new URL('UIAssistant-publish-kit.zip', dist),
  await collectFiles(root, [
    'docs/publishing/',
    'docs/images/',
    'README.md',
    'README.fa.md',
    'CONTRIBUTING.md',
    'CONTRIBUTING.fa.md',
    'THIRD_PARTY_NOTICES.md',
    'vendor/README.txt',
    'vendor/DOMPurify-LICENSE',
    'PRIVACY.md',
    'PRIVACY.fa.md',
    'SECURITY.md',
    'SECURITY.fa.md',
    'LICENSE',
    'LICENSE.fa.md',
  ]),
);
names.push('UIAssistant-publish-kit.zip');
const sums = [];
for (const name of names)
  sums.push(
    createHash('sha256')
      .update(await readFile(new URL(name, dist)))
      .digest('hex') +
      '  ' +
      name,
  );
await writeFile(new URL('SHA256SUMS.txt', dist), sums.join('\n') + '\n');
console.log(`Prepared ${names.length} archives and SHA256SUMS.txt. No store upload was performed.`);
