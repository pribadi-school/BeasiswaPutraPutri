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
const serverDeps = ['express', 'mysql2', 'bcryptjs', 'jose', 'dotenv'];
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
  },
  dependencies: Object.fromEntries(serverDeps.map((d) => [d, pkg.dependencies[d]])),
}, null, 2) + '\n');

cpSync(p('dist'), p('deploy/dist'), { recursive: true });
cpSync(p('server-dist'), p('deploy/server-dist'), { recursive: true });
cpSync(p('server/app.cjs'), p('deploy/server/app.cjs'));
cpSync(p('server/schema.sql'), p('deploy/server/schema.sql'));
// .htaccess dari public/ hanya untuk hosting statis; server Node.js tidak memerlukannya.
rmSync(p('deploy/dist/.htaccess'), { force: true });

rmSync(p('beasiswa-deploy.zip'), { force: true });
execFileSync('zip', ['-qr', '../beasiswa-deploy.zip', '.'], { cwd: out });
console.log('Siap: beasiswa-deploy.zip (lihat README → "Deploy ke cPanel").');
