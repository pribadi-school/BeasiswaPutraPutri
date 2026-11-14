/**
 * Titik masuk server. Di cPanel dijalankan oleh Passenger lewat server/app.cjs;
 * di komputer: `npm run server`.
 */
// .env di folder aplikasi (opsional; di cPanel boleh juga lewat Environment variables).
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.ts';
import { createPool, migrate } from './db.ts';
import { createApp } from './app.ts';

const here = dirname(fileURLToPath(import.meta.url));
// Mencari file relatif ke akar proyek, baik saat dijalankan dari server/ maupun server-dist/server/.
const root = [resolve(here, '..'), resolve(here, '../..')].find((d) => existsSync(join(d, 'server', 'schema.sql')))!;

const cfg = loadConfig();
if (!cfg.staticDir && existsSync(join(root, 'dist', 'index.html'))) cfg.staticDir = join(root, 'dist');

const pool = createPool(cfg.db);
await migrate(pool, join(root, 'server', 'schema.sql'));

const app = createApp({ pool, cfg });
app.listen(cfg.port, () => {
  console.log(`Beasiswa server: port ${cfg.port}${cfg.devLogin ? ' (DEV LOGIN AKTIF — hanya untuk uji)' : ''}`);
});
