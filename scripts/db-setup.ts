/**
 * Menyiapkan database Supabase (sekali, aman diulang):
 *   npm run db:setup           → membuat tabel/fungsi + mengatur password admin
 *   npm run db:admin-password  → hanya mengatur ulang password admin
 * Membaca SUPABASE_DB_URL dan ADMIN_PASSWORD dari .env. Tidak pernah menghapus data pendaftar.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
const password = process.env.ADMIN_PASSWORD;
const passwordOnly = process.argv.includes('--password-only');

if (!url) { console.error('SUPABASE_DB_URL belum diisi di .env.'); process.exit(1); }
if (!password || password.length < 8) { console.error('Isi ADMIN_PASSWORD di .env (minimal 8 karakter).'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  if (!passwordOnly) {
    console.log('Menjalankan supabase/migrations/0001_schema.sql …');
    await client.query(readFileSync(new URL('../supabase/migrations/0001_schema.sql', import.meta.url), 'utf8'));
  }
  await client.query('select public.set_admin_password($1)', [password]);
  console.log('Password admin diatur. Selesai ✔');
} catch (e) {
  console.error('Gagal:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
