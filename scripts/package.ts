/**
 * Membuat paket untuk diunggah ke cPanel: beasiswa-deploy.zip
 *
 *   npm run build && npm run package
 *
 * Isi paket (diekstrak ke folder aplikasi, mis. ~/beasiswa-app, DI LUAR public_html):
 *   package.json      – hanya dependensi server (express, mysql2, bcryptjs, jose, dotenv)
 *   server/app.cjs    – "Application startup file" di Setup Node.js App
 *   server/schema.sql – dijalankan otomatis saat server mulai
 *   server-dist/      – kode server hasil build
 *   dist/             – tampilan (React) hasil build, dilayani oleh server yang sama
 * Tidak ada rahasia di dalam paket: DB_*, GOOGLE_CLIENT_ID, UPLOAD_DIR diisi di cPanel.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const p = (rel: string) => new URL(rel, root).pathname.replace(/%20/g, ' ');

for (const need of ['dist/index.html', 'server-dist/server/index.js']) {
  if (!existsSync(p(need))) {
    console.error(`${need} belum ada. Jalankan dulu: npm run build`);
    process.exit(1);
  }
}

const pkg = JSON.parse(readFileSync(p('package.json'), 'utf8'));
const serverDeps = ['express', 'mysql2', 'bcryptjs', 'jose', 'dotenv', 'nodemailer'];
const out = p('deploy/');
rmSync(out, { recursive: true, force: true });
mkdirSync(p('deploy/server'), { recursive: true });

writeFileSync(p('deploy/package.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  private: true,
  type: 'module',
  description: 'Server Beasiswa Putra-Putri Daerah (paket deploy cPanel)',
  main: 'server/app.cjs',
  engines: { node: '>=20' },
  scripts: {
    start: 'node server/app.cjs',
    'admin:set': 'node server-dist/server/admin-cli.js set',
    'admin:remove': 'node server-dist/server/admin-cli.js remove',
    'admin:list': 'node server-dist/server/admin-cli.js list',
    'notify': 'node server-dist/server/notify-cli.js',
  },
  dependencies: Object.fromEntries(serverDeps.map((d) => [d, pkg.dependencies[d]])),
}, null, 2) + '\n');

cpSync(p('dist'), p('deploy/dist'), { recursive: true });
cpSync(p('server-dist'), p('deploy/server-dist'), { recursive: true });
cpSync(p('server/app.cjs'), p('deploy/server/app.cjs'));
cpSync(p('server/schema.sql'), p('deploy/server/schema.sql'));

// Dijalankan di server setiap kali memperbarui: cd ~/repositories/beasiswa && git pull && bash deploy.sh
writeFileSync(p('deploy/deploy.sh'), `#!/bin/bash
# Dibuat oleh scripts/package.ts — jangan diubah di server.
# Memperbarui aplikasi: cd ~/repositories/beasiswa && git pull && bash deploy.sh
set -e
cd "$(dirname "$0")"
APP_ROOT="\${PWD#$HOME/}"

# Lingkungan Node.js milik aplikasi (dibuat oleh cPanel → Setup Node.js App).
VENV=$(ls -d "$HOME/nodevenv/$APP_ROOT"/*/ 2>/dev/null | sort -V | tail -1)
if [ -z "$VENV" ]; then
  echo "✗ Aplikasi Node.js belum dibuat. cPanel → Setup Node.js App → Create Application,"
  echo "  Application root: $APP_ROOT, startup file: server/app.cjs (lihat README)."
  exit 1
fi
source "\${VENV}bin/activate"

npm install --omit=dev --no-audit --no-fund
[ -f .env ] || echo "⚠ File .env belum ada. Buat dulu (lihat README), lalu jalankan deploy.sh lagi."
mkdir -p "$HOME/beasiswa-data/berkas" && chmod 700 "$HOME/beasiswa-data" "$HOME/beasiswa-data/berkas"

# Mulai ulang server (Passenger membaca tmp/restart.txt).
mkdir -p tmp && touch tmp/restart.txt
echo "✓ Diperbarui ke: $(git log -1 --format=%s 2>/dev/null || echo build)"
echo "  Server dimulai ulang. Cek: https://beasiswa.pribadidepok.sch.id/api/settings"
`, { mode: 0o755 });
writeFileSync(p('deploy/.gitignore'), 'node_modules\n.env\ntmp/\npackage-lock.json\nstderr.log\n');

rmSync(p('beasiswa-deploy.zip'), { force: true });
execFileSync('zip', ['-qr', '../beasiswa-deploy.zip', '.'], { cwd: out });
console.log('Siap: beasiswa-deploy.zip (lihat README → "Deploy ke cPanel").');
