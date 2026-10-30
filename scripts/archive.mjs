import { readFile, readdir, writeFile } from 'node:fs/promises';
import { crc32 } from './generate-icons.mjs';

// Explicit inputs only: never walk a checkout, profile, .git, or dist implicitly.
export async function collectFiles(root, paths) {
  const entries = [];
  async function walk(path) {
    for (const file of await readdir(new URL(path, root), { withFileTypes: true })) {
      if (file.isSymbolicLink()) throw Error('Archive inputs must not contain symlinks.');
      const name = path + file.name;
      if (file.isDirectory()) await walk(name + '/');
      else entries.push({ name, data: await readFile(new URL(name, root)) });
    }
  }
  for (const path of paths) {
    if (path.endsWith('/')) await walk(path);
    else entries.push({ name: path, data: await readFile(new URL(path, root)) });
  }
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function writeArchive(path, entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      crc = crc32(entry.data),
      header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12); // Deterministic DOS date: 1980-01-01.
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
  await writeFile(path, Buffer.concat([...local, directory, end]));
}
