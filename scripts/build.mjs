import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generateIcons } from './generate-icons.mjs';
import { fileURLToPath } from 'node:url';
import { firefoxManifest } from './manifests.mjs';
import { collectFiles, writeArchive } from './archive.mjs';
import { runtimeFiles } from './package-files.mjs';
const root = new URL('../', import.meta.url);
const sourceManifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
await generateIcons(new URL('scripts/generate-icons.mjs', root).href);
async function build(name, manifest = sourceManifest) {
  const out = new URL(`dist/${name}/`, root);
  await mkdir(out, { recursive: true });
  const entries = await collectFiles(root, runtimeFiles);
  for (const entry of entries) {
    if (entry.name === 'manifest.json')
      entry.data = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    const destination = new URL(entry.name, out);
    await mkdir(new URL('./', destination), { recursive: true });
    await writeFile(destination, entry.data);
  }
  await writeArchive(new URL(`dist/${name}.zip`, root), entries);
  console.log(
    `Built ${entries.length} files. Load unpacked: ${fileURLToPath(out)}\nArchive: ${fileURLToPath(new URL(`dist/${name}.zip`, root))}`,
  );
}
await build('UIAssistant'); // Backwards-compatible Chrome/Edge developer package.
await build('UIAssistant-chrome');
await build('UIAssistant-edge');
await build('UIAssistant-firefox', firefoxManifest(sourceManifest));
