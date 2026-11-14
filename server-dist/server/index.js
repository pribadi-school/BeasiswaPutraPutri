/**
 * Titik masuk server. Di cPanel dijalankan oleh Passenger lewat server/app.cjs;
 * di komputer: `npm run server`.
 */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';
import { createApp } from './app.js';
const here = dirname(fileURLToPath(import.meta.url));
// Mencari file relatif ke akar proyek, baik saat dijalankan dari server/ maupun server-dist/server/.
const root = [resolve(here, '..'), resolve(here, '../..')].find((d) => existsSync(join(d, 'server', 'schema.sql')));
// Pengaturan dari .env di folder aplikasi (chmod 600). Variabel yang sudah diisi di
// cPanel (Setup Node.js App → Environment variables) tidak ditimpa.
dotenv.config({ path: join(root, '.env'), quiet: true });
const cfg = loadConfig();
if (!cfg.staticDir && existsSync(join(root, 'dist', 'index.html')))
    cfg.staticDir = join(root, 'dist');
const pool = createPool(cfg.db);
await migrate(pool, join(root, 'server', 'schema.sql'));
const app = createApp({ pool, cfg });
app.listen(cfg.port, () => {
    console.log(`Beasiswa server: port ${cfg.port}${cfg.devLogin ? ' (DEV LOGIN AKTIF — hanya untuk uji)' : ''}`);
});
