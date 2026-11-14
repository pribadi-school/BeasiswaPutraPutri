/**
 * Mengelola akun panitia (admin) di MySQL.
 *
 *   npm run admin:set -- panitia@pribadidepok.sch.id   → buat / ganti password (diminta di layar)
 *   npm run admin:remove -- panitia@pribadidepok.sch.id → hapus akun (sesinya ikut berakhir)
 *   npm run admin:list
 *
 * Membaca DB_* dari environment (.env di komputer; di cPanel jalankan dari Terminal
 * setelah `source` virtualenv Node aplikasi). Password TIDAK pernah ditulis ke file atau log.
 */
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void });
    write._writeToOutput = (s: string) => { if (s.startsWith(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

// .env di akar aplikasi (sama dengan yang dibaca server).
const here = dirname(fileURLToPath(import.meta.url));
const root = [resolve(here, '..'), resolve(here, '../..')].find((d) => existsSync(join(d, 'server', 'schema.sql'))) ?? process.cwd();
dotenv.config({ path: join(root, '.env'), quiet: true });

const [cmd, emailArg] = process.argv.slice(2);
const cfg = loadConfig({ ...process.env, UPLOAD_DIR: process.env.UPLOAD_DIR || '-' });
const pool = createPool(cfg.db);

try {
  if (cmd === 'list') {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT email, created_at FROM admins ORDER BY email');
    if (!rows.length) console.log('Belum ada admin.');
    for (const r of rows) console.log(`- ${r.email}`);
  } else if (cmd === 'set' || cmd === 'remove') {
    const email = (emailArg ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Tulis email admin, mis.: npm run admin:set -- nama@pribadidepok.sch.id');
    if (cmd === 'remove') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM admins WHERE email = ?', [email]);
      if (!rows[0]) throw new Error('Admin tidak ditemukan.');
      await pool.query('DELETE FROM sessions WHERE kind = ? AND subject_id = ?', ['admin', rows[0].id]);
      await pool.query('DELETE FROM admins WHERE id = ?', [rows[0].id]);
      console.log(`Admin ${email} dihapus.`);
    } else {
      const pw = process.env.NEW_ADMIN_PASSWORD ?? await askHidden('Password baru (min. 10 karakter): ');
      if (pw.length < 10) throw new Error('Password minimal 10 karakter.');
      if (!process.env.NEW_ADMIN_PASSWORD) {
        const again = await askHidden('Ulangi password: ');
        if (again !== pw) throw new Error('Password tidak sama.');
      }
      const hash = await bcrypt.hash(pw, 12);
      const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM admins WHERE email = ?', [email]);
      if (rows[0]) {
        await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, rows[0].id]);
        await pool.query('DELETE FROM sessions WHERE kind = ? AND subject_id = ?', ['admin', rows[0].id]);
        console.log(`Password ${email} diganti. Sesi lamanya sudah keluar.`);
      } else {
        await pool.query('INSERT INTO admins (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
          [randomUUID(), email, hash, new Date()]);
        console.log(`Admin ${email} dibuat.`);
      }
    }
  } else {
    console.log('Pakai: admin:set -- <email> | admin:remove -- <email> | admin:list');
  }
} catch (e) {
  console.error('Gagal:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
