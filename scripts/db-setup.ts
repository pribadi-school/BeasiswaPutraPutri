/**
 * Menyiapkan database Supabase (aman diulang, tidak menghapus data pendaftar):
 *   npm run db:setup   → membuat tabel/fungsi, bucket `berkas` + policy, lalu daftar admin
 *   npm run db:admins  → hanya memperbarui daftar admin (panitia)
 *
 * Membaca dari .env:
 *   SUPABASE_DB_URL  – connection string (Session pooler)
 *   ADMIN_EMAILS     – email akun panitia, dipisah koma. Akunnya dibuat dulu di
 *                      Supabase → Authentication → Users → Add user (centang Auto Confirm).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
const emails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
const adminsOnly = process.argv.includes('--admins-only');

if (!url) { console.error('SUPABASE_DB_URL belum diisi di .env.'); process.exit(1); }
if (emails.length === 0) { console.error('Isi ADMIN_EMAILS di .env (email akun panitia, dipisah koma).'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  if (!adminsOnly) {
    console.log('Menjalankan supabase/migrations/0001_schema.sql …');
    await client.query(readFileSync(new URL('../supabase/migrations/0001_schema.sql', import.meta.url), 'utf8'));
  }
  const { rows } = await client.query('select public.set_admins($1) as missing', [emails]);
  const missing: string[] = rows[0].missing;
  const ok = emails.filter((e) => !missing.includes(e));
  if (ok.length) console.log(`Admin: ${ok.join(', ')}`);
  if (missing.length) {
    console.warn(`Belum ada/belum terkonfirmasi di Supabase Auth: ${missing.join(', ')}`);
    console.warn('Buat akunnya di Authentication → Users → Add user (Auto Confirm), lalu jalankan npm run db:admins.');
  }
  console.log('Selesai ✔');
} catch (e) {
  console.error('Gagal:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
