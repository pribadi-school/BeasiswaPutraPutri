import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
export function createPool(cfg) {
    return mysql.createPool({
        ...cfg,
        connectionLimit: 5, // hosting bersama: batas koneksi kecil
        timezone: 'Z', // semua DATETIME dibaca/ditulis sebagai UTC
        dateStrings: ['DATE'], // tanggal lahir tetap "YYYY-MM-DD"
        charset: 'utf8mb4',
        multipleStatements: false,
    });
}
/** Menjalankan server/schema.sql (aman diulang). */
export async function migrate(pool, schemaPath) {
    const sql = readFileSync(schemaPath, 'utf8')
        .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    const conn = await pool.getConnection();
    try {
        await conn.query(`SET time_zone = '+00:00'`);
        for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
            await conn.query(stmt);
        }
    }
    finally {
        conn.release();
    }
}
