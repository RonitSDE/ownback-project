import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

/** Verify both listed file contents and completeness of the packaged source tree.
 * Ignore local dependencies, build outputs and secrets that are not release source. */
const excludedDirs = new Set([
  '.git',
  'node_modules',
  '.next',
  'out',
  'test-results',
  'playwright-report',
  'contracts/lib',
  'contracts/out',
  'contracts/cache',
  'contracts/broadcast',
  'contracts/deployments',
]);
const excludedFiles = new Set([
  'SOURCE_MANIFEST.sha256',
  '.env',
  '.env.local',
  'next-env.generated.d.ts',
  'next-env.d.ts',
]);
function sourceFiles(dir = '.') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const rel = relative('.', path).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (!excludedDirs.has(rel)) found.push(...sourceFiles(path));
    } else if (entry.isFile()) {
      if (excludedFiles.has(rel) || rel.endsWith('.tsbuildinfo') || entry.name === '.DS_Store') continue;
      if (rel.startsWith('.env.') && rel !== '.env.example') continue;
      found.push(rel);
    }
  }
  return found;
}
const data = readFileSync('SOURCE_MANIFEST.sha256', 'utf8');
const seen = new Set();
const errors = [];
for (const line of data.split('\n')) {
  if (!line.trim()) continue;
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  if (!match) {
    errors.push(`Invalid record: ${line}`);
    continue;
  }
  const [, expected, path] = match;
  if (path.startsWith('/') || path.split('/').includes('..') || seen.has(path)) {
    errors.push(`Invalid or duplicate source path: ${path}`);
    continue;
  }
  seen.add(path);
  try {
    const got = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (got !== expected) errors.push(`Changed: ${path}`);
  } catch {
    errors.push(`Missing: ${path}`);
  }
}
for (const path of sourceFiles()) if (!seen.has(path)) errors.push(`Unlisted: ${path}`);
if (errors.length) {
  console.error('Integrity FAILED', errors.slice(0, 30));
  process.exitCode = 1;
} else console.log(`Integrity OK: ${seen.size} files match SOURCE_MANIFEST.sha256; no unlisted source files`);
