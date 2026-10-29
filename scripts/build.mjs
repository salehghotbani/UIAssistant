import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { crc32, generateIcons } from './generate-icons.mjs';
import { fileURLToPath } from 'node:url';
import { firefoxManifest } from './manifests.mjs';
const root = new URL('../', import.meta.url);
const sourceManifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
await generateIcons(new URL('scripts/generate-icons.mjs', root).href);
async function build(name, manifest = sourceManifest) {
  const out = new URL(`dist/${name}/`, root);
  await mkdir(out, { recursive: true });
  const files = [
    'manifest.json',
    'LICENSE',
    'LICENSE.fa.md',
    'THIRD_PARTY_NOTICES.md',
    'PRIVACY.md',
    'PRIVACY.fa.md',
    'popup.html',
    'popup.js',
    'styles.css',
    'background.js',
    'content.js',
    'offscreen.html',
    'offscreen.js',
    'lib',
    'icons',
    'vendor',
  ];
  for (const file of files) await cp(new URL(file, root), new URL(file, out), { recursive: true });
  await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2) + '\n');
  const entries = [];
  async function walk(prefix = '') {
    for (const e of await readdir(new URL(prefix, out), { withFileTypes: true })) {
      const p = prefix + e.name;
      if (e.isDirectory()) await walk(p + '/');
      else entries.push({ name: p, data: await readFile(new URL(p, out)) });
    }
  }
  await walk();
  const local = [],
    central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      crc = crc32(entry.data),
      header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12); // Valid deterministic DOS date: 1980-01-01.
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(entry.data.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, entry.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(33, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(entry.data.length, 20);
    c.writeUInt32LE(entry.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += header.length + name.length + entry.data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(new URL(`dist/${name}.zip`, root), Buffer.concat([...local, directory, end]));
  console.log(
    `Built ${entries.length} files. Load unpacked: ${fileURLToPath(out)}\nArchive: ${fileURLToPath(new URL(`dist/${name}.zip`, root))}`,
  );
}
await build('UIAssistant');
await build('UIAssistant-firefox', firefoxManifest(sourceManifest));
