import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import type { Config } from './config.ts';
import { DEFAULT_ANNOUNCE_AT, defaultStages } from '../src/lib/schedule.ts';

export type Pool = mysql.Pool;

export function createPool(cfg: Config['db']): Pool {
  return mysql.createPool({
    ...cfg,
    connectionLimit: 5, // hosting bersama: batas koneksi kecil
    timezone: 'Z', // semua DATETIME dibaca/ditulis sebagai UTC
    dateStrings: ['DATE'], // tanggal lahir tetap "YYYY-MM-DD"
    charset: 'utf8mb4',
    multipleStatements: false,
  });
}

/**
 * Kolom yang ditambahkan setelah tabel pertama kali dibuat. MySQL 8 tidak punya
 * `ADD COLUMN IF NOT EXISTS`, jadi diperiksa lewat information_schema (aman diulang,
 * cocok untuk MySQL dan MariaDB). Tambahan kolom baru: tulis di sini.
 */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  // Hasil per tahap seleksi (lihat STAGES di src/lib/types.ts).
  ['applicants', 'res_admin', `ENUM('pending','lulus','tidak_lulus') NOT NULL DEFAULT 'pending'`],
  ['applicants', 'res_test', `ENUM('pending','lulus','tidak_lulus') NOT NULL DEFAULT 'pending'`],
  ['applicants', 'res_interview', `ENUM('pending','lulus','tidak_lulus') NOT NULL DEFAULT 'pending'`],
  // Pengaturan per tahap (JSON): waktu umum, info/jadwal, pesan lolos/tidak lolos.
  ['settings', 'stages', 'TEXT NULL'],
  // Jadwal tahapan awal sudah dipasang (lihat src/lib/schedule.ts).
  ['settings', 'stages_seeded', 'TINYINT(1) NOT NULL DEFAULT 0'],
];

/** Menjalankan server/schema.sql lalu menambah kolom yang belum ada (aman diulang). */
export async function migrate(pool: Pool, schemaPath: string): Promise<void> {
  const sql = readFileSync(schemaPath, 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const conn = await pool.getConnection();
  try {
    await conn.query(`SET time_zone = '+00:00'`);
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
    for (const [table, column, ddl] of ADDED_COLUMNS) {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [table, column]);
      if (!rows.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
    }
    // Jadwal tahapan awal: sekali saja, dan hanya mengisi yang masih kosong
    // (tidak menimpa yang sudah diatur panitia).
    await conn.query(
      `UPDATE settings SET announce_at = COALESCE(announce_at, ?), stages = COALESCE(stages, ?), stages_seeded = 1
        WHERE id = 1 AND stages_seeded = 0`,
      [new Date(DEFAULT_ANNOUNCE_AT), JSON.stringify(defaultStages())]);
  } finally {
    conn.release();
  }
}
