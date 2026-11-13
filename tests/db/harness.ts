/**
 * Menyalakan server PostgreSQL sungguhan (embedded-postgres) sementara,
 * membuat role yang biasanya disediakan Supabase, lalu menjalankan migrasi.
 */
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sql = readFileSync(new URL('../../supabase/migrations/0001_schema.sql', import.meta.url), 'utf8');

export type Harness = { connect: () => Promise<pg.Client>; stop: () => Promise<void> };

export async function startDatabase(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'beasiswa-pg-'));
  const port = 55000 + Math.floor(Math.random() * 1000);
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false, onLog: () => {} });
  await server.initialise();
  await server.start();
  const connect = async () => {
    const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
    await c.connect();
    return c;
  };
  const admin = await connect();
  await admin.query(`create role anon nologin; create role authenticated nologin; grant anon, authenticated to postgres;`);
  // Tiruan minimal bagian Supabase yang dipakai migrasi: auth.users dan Storage
  // (tabel buckets/objects dengan RLS aktif, seperti di Supabase).
  await admin.query(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
      name text not null, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
      unique (bucket_id, name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await admin.query(sql);
  await admin.query(sql); // dijalankan dua kali: harus aman
  await admin.end();
  return {
    connect,
    stop: async () => {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
