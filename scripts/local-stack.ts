/**
 * Uji lengkap di komputer, mirip cPanel: MySQL sementara + server Node.js yang
 * melayani hasil build (dist/) di http://localhost:8787.
 *
 *   npm run build && npm run local
 *
 * - Data MySQL sementara di folder tmp (hilang saat dihentikan). MySQL milik
 *   komputer ini tidak disentuh.
 * - Login peserta tanpa Google (ALLOW_DEV_LOGIN): ketik email apa saja.
 * - Akun panitia uji: panitia@local.test / uji-lokal-123 (HANYA lokal).
 * Butuh `mysqld` (brew install mysql).
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const LOCAL_ADMIN = { email: 'panitia@local.test', password: 'uji-lokal-123' };
const dir = mkdtempSync(join(tmpdir(), 'bpdlocal-'));
const port = 33317;

execFileSync('mysqld', ['--initialize-insecure', `--datadir=${dir}/data`], { stdio: 'ignore' });
const db = spawn('mysqld', [`--datadir=${dir}/data`, `--port=${port}`, `--socket=${dir}/s.sock`, '--mysqlx=OFF',
  `--pid-file=${dir}/p.pid`, `--log-error=${dir}/err.log`, '--bind-address=127.0.0.1'], { stdio: 'ignore' });

let conn: mysql.Connection | null = null;
for (let i = 0; i < 60 && !conn; i++) {
  try { conn = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root' }); } catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!conn) throw new Error('mysqld tidak bisa dijalankan');
await conn.query('CREATE DATABASE beasiswa CHARACTER SET utf8mb4');
await conn.query(`CREATE USER 'app'@'127.0.0.1' IDENTIFIED BY 'app-local'`);
await conn.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON beasiswa.* TO 'app'@'127.0.0.1'`);

const env = {
  ...process.env, PORT: '8787', DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'app', DB_PASSWORD: 'app-local',
  DB_NAME: 'beasiswa', UPLOAD_DIR: join(dir, 'berkas'), ALLOW_DEV_LOGIN: '1', NODE_ENV: 'development',
};
// Server dijalankan persis seperti di cPanel: startup file server/app.cjs.
const app = spawn('node', [new URL('../server/app.cjs', import.meta.url).pathname.replace(/%20/g, ' ')], { env, stdio: 'inherit' });

// Akun panitia uji (setelah server membuat tabel).
for (let i = 0; i < 40; i++) {
  try {
    await conn.query('INSERT IGNORE INTO beasiswa.admins (id, email, password_hash, created_at) VALUES (UUID(), ?, ?, NOW())',
      [LOCAL_ADMIN.email, await bcrypt.hash(LOCAL_ADMIN.password, 10)]);
    break;
  } catch { await new Promise((r) => setTimeout(r, 250)); }
}
await conn.end();
console.log(`Uji lokal: http://localhost:8787  (panitia: ${LOCAL_ADMIN.email})`);

const stop = () => { app.kill(); db.kill(); setTimeout(() => { rmSync(dir, { recursive: true, force: true }); process.exit(0); }, 1500); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', stop);
