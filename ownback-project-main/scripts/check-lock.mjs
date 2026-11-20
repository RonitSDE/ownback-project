/** Offline lock graph audit; does NOT substitute for an actual npm ci. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.equal(lock.lockfileVersion, 3);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
for (const group of ['dependencies', 'devDependencies'])
  for (const [name, range] of Object.entries(pkg[group] || {})) {
    assert.equal(lock.packages[''][group][name], range, `root lock mismatch for ${name}`);
    assert.ok(lock.packages[`node_modules/${name}`], `missing ${name} from lock`);
  }
const required = [
  'pg',
  '@types/pg',
  'pg-cloudflare',
  'pg-connection-string',
  'pg-pool',
  'pg-protocol',
  'pg-types',
  'pg/node_modules/pg-types',
  'pg/node_modules/postgres-array',
  'pg/node_modules/postgres-bytea',
  'pg/node_modules/postgres-date',
  'pg/node_modules/postgres-interval',
  'pg-int8',
  'pgpass',
  'postgres-array',
  'postgres-bytea',
  'postgres-date',
  'postgres-interval',
  'split2',
  'xtend',
];
for (const name of required) {
  // npm may hoist or nest a package; accept it at any location in the tree.
  const leaf = name.split('/node_modules/').pop();
  const r =
    lock.packages[`node_modules/${name}`] ||
    Object.entries(lock.packages).find(([k]) => k.endsWith(`node_modules/${leaf}`))?.[1];
  assert.ok(r, `missing pg dependency ${name}`);
  assert.match(r.resolved, /^https:\/\/registry\.npmjs\.org\//);
  assert.match(r.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
}
for (const [name, entry] of Object.entries(lock.packages)) {
  if (!name || !entry.version) continue;
  // Verify closure for the PostgreSQL dependency tree where npm resolutions were repaired.
  if (name.startsWith('node_modules/pg') || name.startsWith('node_modules/postgres-'))
    for (const dep of Object.keys(entry.dependencies || {})) {
      const normalized = name.slice('node_modules/'.length);
      const candidate = 'node_modules/' + normalized + '/node_modules/' + dep;
      assert.ok(
        lock.packages[candidate] || lock.packages['node_modules/' + dep],
        `missing ${dep} required by ${name}`,
      );
    }
}
console.log(
  `Lock graph: ${Object.keys(lock.packages).length} package entries, PostgreSQL closure and integrity metadata present. npm ci still required.`,
);
