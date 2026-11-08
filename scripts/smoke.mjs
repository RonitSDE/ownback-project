// Quick deploy check: node scripts/smoke.mjs  (SMOKE_URL defaults to http://localhost:3000)
const url = process.env.SMOKE_URL || 'http://localhost:3000';
for (const path of ['/', '/shop', '/merchant', '/demo', '/api/health', '/api/prices']) {
  try {
    const r = await fetch(url + path, { redirect: 'manual' });
    console.log(path.padEnd(14), r.status, r.ok ? 'OK' : 'CHECK');
    if (!r.ok) process.exitCode = 1;
  } catch (e) {
    console.error(path, e.message);
    process.exitCode = 1;
  }
}
