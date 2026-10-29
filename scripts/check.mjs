import { readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url),
  manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
for (const path of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  'content.js',
  'offscreen.html',
])
  await access(new URL(path, root));
async function check(dir) {
  for (const file of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (
      ['node_modules', 'dist', '.git', 'artifacts', '.browser-profile', 'test-results'].includes(
        file.name,
      )
    )
      continue;
    const path = dir + file.name;
    if (file.isDirectory()) await check(path + '/');
    else if (/\.(?:js|mjs)$/.test(file.name)) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(path, root))], {
        encoding: 'utf8',
      });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
}
await check('');
if (manifest.host_permissions || manifest.content_scripts)
  throw new Error('Do not add persistent site access without documenting it.');
console.log('Manifest, bundled files and JavaScript syntax verified.');
