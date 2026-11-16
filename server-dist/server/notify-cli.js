/**
 * Mengirim email pemberitahuan yang sudah waktunya. Untuk Cron Job cPanel, mis. tiap 15 menit:
 *   cd ~/repositories/beasiswa && $HOME/nodevenv/repositories/beasiswa/22/bin/node server-dist/server/notify-cli.js
 * Membaca .env di akar aplikasi (DB_* dan SMTP_*). Aman dijalankan berulang/bersamaan.
 */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { runNotifications, smtpMailer } from './notify.js';
const here = dirname(fileURLToPath(import.meta.url));
const root = [resolve(here, '..'), resolve(here, '../..')].find((d) => existsSync(join(d, 'server', 'schema.sql'))) ?? process.cwd();
dotenv.config({ path: join(root, '.env'), quiet: true });
const cfg = loadConfig(process.env);
if (!cfg.smtp) {
    console.log('SMTP belum diatur di .env (SMTP_HOST, SMTP_USER, SMTP_PASS) — tidak ada email dikirim.');
    process.exit(0);
}
const pool = createPool(cfg.db);
try {
    const r = await runNotifications(pool, cfg, smtpMailer(cfg.smtp));
    console.log(`${new Date().toISOString()} email terkirim: ${r.sent}, gagal: ${r.failed}, masih antre: ${r.remaining}`);
    if (r.failed)
        process.exitCode = 1;
}
catch (e) {
    console.error('Gagal:', e.message);
    process.exitCode = 1;
}
finally {
    await pool.end();
}
