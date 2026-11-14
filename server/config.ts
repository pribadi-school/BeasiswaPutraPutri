/**
 * Pengaturan server dari environment variable (di cPanel: Setup Node.js App →
 * Environment variables; di komputer: file .env). Rahasia TIDAK pernah dikirim ke browser.
 */
export type Config = {
  port: number;
  production: boolean;
  db: { host: string; port: number; user: string; password: string; database: string };
  /** Client ID OAuth Google (bukan rahasia). Kosong = login Google mati. */
  googleClientId: string | null;
  /** Hanya untuk uji di komputer: masuk tanpa Google dengan mengetik email. Ditolak di produksi. */
  devLogin: boolean;
  /** Folder berkas PDF, HARUS di luar public_html. */
  uploadDir: string;
  /** Folder hasil build tampilan (dist/). */
  staticDir: string | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const devLogin = env.ALLOW_DEV_LOGIN === '1';
  if (production && devLogin) {
    throw new Error('ALLOW_DEV_LOGIN tidak boleh aktif di produksi (NODE_ENV=production).');
  }
  const need = (k: string) => {
    const v = env[k]?.trim();
    if (!v) throw new Error(`Environment variable ${k} belum diisi.`);
    return v;
  };
  return {
    port: Number(env.PORT ?? 8787),
    production,
    db: {
      host: env.DB_HOST?.trim() || 'localhost',
      port: Number(env.DB_PORT ?? 3306),
      user: need('DB_USER'),
      password: env.DB_PASSWORD ?? '',
      database: need('DB_NAME'),
    },
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null,
    devLogin,
    uploadDir: need('UPLOAD_DIR'),
    staticDir: env.STATIC_DIR?.trim() || null,
  };
}
