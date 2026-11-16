/**
 * Pengaturan server dari environment variable (di cPanel: file .env di folder
 * aplikasi, chmod 600; di komputer: .env). Rahasia TIDAK pernah dikirim ke browser.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  /** true = SSL langsung (port 465); false = STARTTLS (port 587). */
  secure: boolean;
  user: string;
  pass: string;
  /** Pengirim, mis. "Panitia Beasiswa <beasiswa@pribadidepok.sch.id>". */
  from: string;
};

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
  /** Email pemberitahuan. null = tidak mengirim email. */
  smtp: SmtpConfig | null;
  /** Alamat situs untuk tautan di email. */
  appUrl: string;
  /** Batas email per putaran (sesuaikan dengan batas kirim hosting). */
  notifyMaxPerRun: number;
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
  const smtpHost = env.SMTP_HOST?.trim();
  const smtpPort = Number(env.SMTP_PORT ?? 465);
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
    smtp: smtpHost ? {
      host: smtpHost,
      port: smtpPort,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE !== 'false' : smtpPort === 465,
      user: need('SMTP_USER'),
      pass: env.SMTP_PASS ?? '',
      from: env.MAIL_FROM?.trim() || `Panitia Beasiswa Putra-Putri Daerah <${env.SMTP_USER?.trim()}>`,
    } : null,
    appUrl: (env.APP_URL?.trim() || 'https://beasiswa.pribadidepok.sch.id').replace(/\/+$/, ''),
    notifyMaxPerRun: Math.max(1, Number(env.NOTIFY_MAX_PER_RUN ?? 40)),
  };
}
