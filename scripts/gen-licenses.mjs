// Writes src/generated/licenses.json: every package shipped in the app (production
// dependencies and their dependencies), with its license text, read from node_modules.
// Runs before every dev server start and build, so the Licenses screen is always current.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const entries = [];
for (const [path, info] of Object.entries(lock.packages)) {
  // Optional packages are pdf.js's Node-only canvas, never part of the browser bundle.
  if (!path || info.dev || info.devOptional || info.optional) continue;
  const dir = join(root, path);
  if (!existsSync(join(dir, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying)(\.|-|$)/i.test(name));
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'See package',
    homepage: typeof pkg.homepage === 'string' ? pkg.homepage : undefined,
    text: file ? readFileSync(join(dir, file), 'utf8').trim() : undefined,
  });
}
const unique = [...new Map(entries.map((e) => [`${e.name}@${e.version}`, e])).values()].sort((a, b) => a.name.localeCompare(b.name));
const out = join(root, 'src/generated/licenses.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(unique, null, 1) + '\n');
console.log(`Wrote ${unique.length} third-party licenses`);
