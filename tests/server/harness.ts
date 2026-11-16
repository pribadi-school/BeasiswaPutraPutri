/**
 * Menyalakan server MySQL sungguhan yang sementara (folder data sendiri, port acak),
 * lalu server API di atasnya. MySQL milik komputer ini tidak disentuh.
 * Butuh `mysqld` (Homebrew: brew install mysql).
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { createApp, type GoogleIdentity } from '../../server/app.ts';
import type { Config } from '../../server/config.ts';
import { createPool, migrate, type Pool } from '../../server/db.ts';
import type { Mail } from '../../server/notify.ts';

const schema = fileURLToPath(new URL('../../server/schema.sql', import.meta.url));

export type Harness = {
  base: string; pool: Pool; uploadDir: string; cfg: Config; stop: () => Promise<void>;
  /** Email yang "terkirim" lewat pengirim palsu. `failNext` = gagalkan email berikutnya. */
  mails: Mail[]; mailer: { failNext: boolean };
};

/** Token Google palsu untuk tes: "fake:<sub>:<email>". */
export async function fakeGoogle(credential: string): Promise<GoogleIdentity> {
  const [tag, sub, email] = credential.split(':');
  if (tag !== 'fake' || !sub || !email) throw new Error('bad token');
  return { sub, email, name: 'Tes' };
}

export async function startServer(): Promise<Harness> {
  // Path pendek: socket Unix MySQL dibatasi ±100 karakter.
  const dir = mkdtempSync(join(tmpdir(), 'bpdmy-'));
  const port = 34000 + Math.floor(Math.random() * 2000);
  execFileSync('mysqld', ['--initialize-insecure', `--datadir=${dir}/data`], { stdio: 'ignore' });
  const proc: ChildProcess = spawn('mysqld', [
    `--datadir=${dir}/data`, `--port=${port}`, `--socket=${dir}/s.sock`, '--mysqlx=OFF',
    `--pid-file=${dir}/p.pid`, `--log-error=${dir}/err.log`, '--bind-address=127.0.0.1',
  ], { stdio: 'ignore' });

  let admin: mysql.Connection | null = null;
  for (let i = 0; i < 60 && !admin; i++) {
    try { admin = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root' }); } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!admin) throw new Error('mysqld tidak bisa dijalankan');
  await admin.query('CREATE DATABASE beasiswa CHARACTER SET utf8mb4');
  // User aplikasi dengan hak terbatas, seperti di cPanel.
  await admin.query(`CREATE USER 'app'@'127.0.0.1' IDENTIFIED BY 'app-pass'`);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON beasiswa.* TO 'app'@'127.0.0.1'`);
  await admin.end();

  const uploadDir = join(dir, 'berkas');
  const cfg: Config = {
    port: 0, production: false, googleClientId: 'tes', devLogin: false, uploadDir, staticDir: null,
    smtp: null, appUrl: 'https://beasiswa.test', notifyMaxPerRun: 100,
    db: { host: '127.0.0.1', port, user: 'app', password: 'app-pass', database: 'beasiswa' },
  };
  const pool = createPool(cfg.db);
  await migrate(pool, schema);
  await migrate(pool, schema); // dijalankan dua kali: harus aman

  const mails: Mail[] = [];
  const mailer = { failNext: false };
  const app = createApp({
    pool, cfg, verifyGoogle: fakeGoogle,
    mailer: async (m) => {
      if (mailer.failNext) { mailer.failNext = false; throw new Error('SMTP palsu gagal'); }
      mails.push(m);
    },
  });
  const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base, pool, uploadDir, cfg, mails, mailer,
    stop: async () => {
      await new Promise((r) => server.close(r));
      await pool.end();
      proc.kill('SIGTERM');
      await new Promise((r) => proc.once('exit', r));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** "Browser" kecil: menyimpan cookie, mengirim header CSRF, membaca JSON. */
export class Client {
  cookies = new Map<string, string>();
  constructor(private base: string, private csrf = true) {}

  async req(method: string, path: string, body?: unknown, type = 'application/json') {
    const headers: Record<string, string> = {};
    if (this.csrf) headers['X-Requested-With'] = 'beasiswa';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload: BodyInit | undefined;
    if (body instanceof Uint8Array) { payload = body as unknown as BodyInit; headers['Content-Type'] = type; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    const res = await fetch(this.base + path, { method, headers, body: payload });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const v = pair.slice(i + 1);
      if (v) this.cookies.set(pair.slice(0, i), v); else this.cookies.delete(pair.slice(0, i));
    }
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  put = (p: string, b?: unknown) => this.req('PUT', p, b ?? {});
  del = (p: string) => this.req('DELETE', p);
}
