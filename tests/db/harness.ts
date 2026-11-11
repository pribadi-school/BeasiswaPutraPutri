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
