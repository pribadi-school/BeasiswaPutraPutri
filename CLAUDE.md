# Beasiswa Putra-Putri Daerah — catatan proyek

Baca README.md dulu. Proyek ini TERPISAH dari aplikasi janji temu
(`../appointment app`); jangan mencampur commit keduanya. Design system
`design-system/sekolah-pribadi-depok/` adalah salinan. Jika merek berubah,
perbarui semua salinannya.

Arsitektur: React (dist/) + server Node.js/Express (`server/`) + MySQL/MariaDB,
di-hosting di cPanel lewat Setup Node.js App (startup file `server/app.cjs`,
yang memuat ESM `server-dist/server/index.js`). Tidak ada Supabase lagi.

Aturan yang mudah terlewat:
- Semua aturan keamanan ada di `server/app.ts`. Jangan memindahkannya ke
  browser, dan jangan menerima id peserta dari browser untuk data peserta:
  selalu pakai user_id dari sesi.
- Sesi = token acak di cookie HttpOnly (`bpd_user`, `bpd_admin`, Path=/api).
  DB hanya menyimpan hash-nya. Permintaan non-GET wajib membawa header
  `X-Requested-With: beasiswa` (CSRF).
- Login Google: server memverifikasi ID token (jose + JWKS Google, audience =
  GOOGLE_CLIENT_ID, email_verified). `ALLOW_DEV_LOGIN` hanya untuk lokal dan
  ditolak bila NODE_ENV=production.
- Status hasil hanya dikirim ke peserta setelah `announce_at` (`released()`).
- Satu akun Google = satu pendaftaran (`applicants_user`); satu anak = satu
  pendaftaran (`applicants_child` = nama dinormalkan + tanggal lahir).
- PDF di `UPLOAD_DIR/<applicant_id>.pdf`, di luar public_html. Dikirim hanya
  lewat `/api/me/document` (pemilik) atau `/api/admin/applicants/:id/document`.
- `server/schema.sql` dijalankan setiap server mulai. Harus aman diulang dan
  cocok untuk MySQL 8 dan MariaDB: tanpa tipe JSON (pakai TEXT) dan tanpa
  `CREATE INDEX IF NOT EXISTS`. Waktu disimpan dalam UTC.
- Aturan isian: SATU sumber di `src/lib/validate.ts` (formulir + server). Server
  ikut di-build dari file itu (`tsconfig.server.json`). Import antarfile di
  `src/lib` yang dipakai server memakai ekstensi `.ts`.
- Setiap fitur di `httpApi.ts`/`server/app.ts` juga harus ada di `demoApi.ts`.
- Teks UI di `src/lib/i18n.tsx`, ID dan EN.
- Setelah mengubah server atau validasi, jalankan `npm run test:server`. Tes
  ini menyalakan mysqld sementara dan butuh `mysqld` (Homebrew).
- Fungsi yang dipakai sebagai dependency effect (mis. `useErrorText`) harus
  stabil (`useCallback`). Jika tidak, data dimuat ulang terus dan isian formulir ter-reset.
