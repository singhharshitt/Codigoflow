/**
 * Copy SQL migration assets next to compiled JS.
 * `tsc` only emits .js/.d.ts — without this step, production `node dist/index.js`
 * fails with "no such table: repositories" because migrations never run.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
const destDir = path.join(__dirname, '..', 'dist', 'database', 'migrations');

if (!fs.existsSync(srcDir)) {
  console.error(`Migration source missing: ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.sql'));
if (files.length === 0) {
  console.error(`No .sql migrations in ${srcDir}`);
  process.exit(1);
}

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log(`Copied ${files.length} SQL migration(s) to ${destDir}`);
