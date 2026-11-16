# Beasiswa Putra-Putri Daerah — SMP–SMA Pribadi Depok

Aplikasi web pendaftaran beasiswa. Orang tua/wali **masuk dengan akun Google
(Gmail)**, lalu mengisi data anak. Dengan akun Google yang sama mereka bisa
masuk kapan saja untuk melengkapi atau mengubah data sampai batas waktu, dan
melihat hasil seleksi setelah waktu pengumuman tiba.

**Stack**
- Tampilan: React 19 + Vite + TypeScript, Tailwind v4 (design system sekolah
  ada di `design-system/`).
- Server: **Node.js (Express) + MySQL/MariaDB**, di-hosting di **cPanel**
  sekolah lewat *Setup Node.js App*.
- Bahasa antarmuka: Indonesia + Inggris.

## Alur

| Halaman | Isi |
|---|---|
| `/` | Penjelasan 3 langkah, batas pendaftaran, tanggal pengumuman |
| `/masuk` | Tombol resmi **Masuk dengan Google** |
| `/akun` (belum isi data) | Formulir 5 langkah: data anak, asal daerah, sekolah asal, orang tua/wali, keterangan tambahan + **berkas PDF** + persetujuan |
| `/akun` | Beranda: status, hitung mundur pengumuman, kelengkapan data, info penting |
| `/akun/data` | Data pendaftaran dan berkas PDF (bisa diubah/diganti sampai batas waktu) |
| `/akun/pengumuman` | Hasil seleksi setelah waktu pengumuman |
| `/admin` | Daftar pendaftar (cari, filter, detail, **lihat PDF**), tetapkan status, hapus, ekspor CSV; `/admin/pengaturan` untuk pendaftaran dan pengumuman |

- **Peserta**: SMP (sekarang kelas 6) atau SMA (sekarang kelas 9), dari
  provinsi **Jawa Barat** saja.
- **Isian wajib**: semua, kecuali penghasilan keluarga dan jumlah saudara
  kandung. NISN (10 angka), email orang tua, dan prestasi juga wajib. Prestasi
  boleh diisi "-" bila belum ada.
- **Berkas kelengkapan**: SATU PDF (maks 10 MB) berisi KTP orang tua/wali, KK,
  rapor, dan sertifikat lomba/olimpiade (bila ada). Server memeriksa isinya
  benar-benar PDF (diawali `%PDF-`).
- **Jadwal awal** (`src/lib/schedule.ts`, dipasang sekali ke database):

  | Tahap | Jadwal |
  |---|---|
  | Pendaftaran | dibuka sekarang, ditutup **26 Desember 2026, 23.59 WIB** |
  | Seleksi Administrasi | sesudah pendaftaran ditutup |
  | Tes Akademik & Tes IQ | **Sabtu, 9 Januari 2027** |
  | Interview | **Sabtu, 16 Januari 2027** |
  | Pengumuman akhir | **Rabu, 20 Januari 2027, 09.00 WIB** |

  Waktu umum hasil Seleksi Administrasi, Tes, dan Interview diisi panitia.
  Semua jadwal bisa diubah di **Admin → Pengaturan**.
- **Penutupan**: tidak ada tanggal pembukaan. Penutupan diatur panitia di
  **Admin → Pengaturan**, bersama saklar "Pendaftaran aktif" untuk menutup
  sementara. Waktu pengumuman harus sesudah penutupan.
- **Draf otomatis**: isian formulir tersimpan di HP. Draf dihapus setelah
  pendaftaran terkirim dan saat menekan Keluar. Berkas PDF tidak ikut
  disimpan sebagai draf.
- **Satu akun Google untuk satu anak.** Satu anak juga hanya bisa didaftarkan
  sekali (dilihat dari nama dan tanggal lahir).
- **Alur seleksi**: Pendaftaran → Seleksi Administrasi → Tes Akademik & Tes IQ →
  Interview → Pengumuman. Di **Admin → Pengaturan**, setiap tahap punya:
  - waktu umum hasil;
  - info/jadwal, misalnya waktu dan tempat tes;
  - pesan untuk yang lolos dan yang tidak lolos.

  Panitia mengisi hasil per tahap di tabel pendaftar: pilih tahap, pilih
  hasil, lalu **Terapkan**. Orang tua melihat alurnya di Beranda (✓ lolos, ✗
  tidak lolos, tahap saat ini). Begitu hasil sebuah tahap diumumkan, muncul
  **pemberitahuan** berisi pesan panitia dan info tahap berikutnya. Anak yang
  tidak lolos di satu tahap melihat tahap-tahap berikutnya sebagai "Tidak
  dilanjutkan". Hasil tahap tidak dikirim ke orang tua sebelum waktu umumnya.
  Waktu umum harus urut, dan tahap terakhir tidak boleh sesudah pengumuman akhir.
- **Status**: Diterima, Cadangan, Tidak diterima, atau Diproses. Panitia bisa
  menetapkannya kapan saja, tetapi peserta baru melihatnya setelah **waktu
  pengumuman**. Setelah waktu itu, data dikunci.
- **Panitia (admin)** masuk dengan email + password yang dibuat lewat
  `npm run admin:set`, bukan dengan Google.

## Cara kerja

```
Browser (HP orang tua)  ──HTTPS──▶  Server Node.js di cPanel  ──▶  MySQL (cPanel)
   tampilan React                     server/app.ts                  tabel di server/schema.sql
                                      └─ berkas PDF di folder privat (UPLOAD_DIR)
```

Browser **tidak pernah** terhubung ke database. Semua aturan dijaga di server
(`server/app.ts`). Satu server melayani tampilan (`dist/`) dan API (`/api/...`)
dari alamat yang sama.

## Menjalankan di komputer

```bash
npm install
```

**Mode demo**, hanya tampilan. Data tersimpan di browser, admin bisa masuk
dengan email apa saja dan password `demo`:

```bash
npm run dev
```

**Uji lengkap seperti di cPanel**. Ini menjalankan MySQL sementara (data
hilang saat dihentikan) dan server sungguhan. Peserta bisa masuk tanpa Google
dengan mengetik email apa saja. Akun panitia uji: `panitia@local.test` /
`uji-lokal-123`. Perlu `mysqld` (`brew install mysql`).

```bash
npm run build && npm run local
```

Buka http://localhost:8787.

## Deploy ke cPanel (Niagahoster, akun `pribadisch`)

### 1. Google Client ID (sekali)

1. Buka **Google Cloud Console** dengan akun sekolah, lalu buat project (mis.
   "Beasiswa Pribadi").
2. Di **APIs & Services → OAuth consent screen**:
   - Pilih *External*.
   - Isi nama aplikasi, email dukungan, dan domain `pribadidepok.sch.id`.
   - Setelah siap dipakai umum, klik **Publish app**. Selama masih *Testing*,
     hanya akun *test user* yang bisa masuk.
3. Di **Credentials → Create credentials → OAuth client ID**, pilih jenis
   *Web application*.
   - *Authorized JavaScript origins*: `https://beasiswa.pribadidepok.sch.id`
   - *Redirect URI* tidak perlu diisi.
4. Salin **Client ID**. Client ID bukan rahasia, dan client secret tidak
   dipakai.

### 2. Subdomain dan database (sekali)

1. **cPanel → Domains/Subdomains**: buat `beasiswa.pribadidepok.sch.id`.
2. **cPanel → MySQL® Databases**:
   - Buat database, mis. `pribadisch_beasiswa`.
   - Buat user, mis. `pribadisch_beasiswa`, dengan password panjang.
   - Tambahkan user itu ke database dengan hak **SELECT, INSERT, UPDATE,
     DELETE, CREATE, ALTER, INDEX, REFERENCES**. Hak lain tidak perlu.
3. **SSL/TLS Status** (AutoSSL): pastikan subdomain memakai HTTPS.

### 3. Clone ke `~/repositories` (sekali)

**cPanel → Terminal**:

```bash
mkdir -p ~/repositories ~/beasiswa-data/berkas && chmod 700 ~/beasiswa-data ~/beasiswa-data/berkas
```

```bash
cd ~/repositories && git clone --branch deploy --single-branch https://github.com/pribadi-school/BeasiswaPutraPutri.git beasiswa
```

Branch `deploy` berisi aplikasi yang **sudah di-build** oleh GitHub Actions
setiap kali ada push ke `main`. Isinya tanpa rahasia apa pun. PDF peserta
disimpan di `~/beasiswa-data/berkas`, di luar repo dan di luar `public_html`.

### 4. File `.env` (sekali)

Semua rahasia hanya ada di file ini, di server:

```bash
cd ~/repositories/beasiswa && cat > .env <<'EOF'
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_NAME=pribadisch_beasiswa
DB_USER=pribadisch_beasiswa
DB_PASSWORD=GANTI_DENGAN_PASSWORD_DATABASE
GOOGLE_CLIENT_ID=GANTI_DENGAN_CLIENT_ID.apps.googleusercontent.com
UPLOAD_DIR=/home/pribadisch/beasiswa-data/berkas
APP_URL=https://beasiswa.pribadidepok.sch.id
# Email pemberitahuan (lihat langkah 8). Kosongkan SMTP_HOST bila belum dipakai.
SMTP_HOST=mail.pribadidepok.sch.id
SMTP_PORT=465
SMTP_USER=beasiswa@pribadidepok.sch.id
SMTP_PASS=GANTI_DENGAN_PASSWORD_EMAIL
MAIL_FROM=Panitia Beasiswa Putra-Putri Daerah <beasiswa@pribadidepok.sch.id>
NOTIFY_MAX_PER_RUN=40
EOF
chmod 600 .env
```

Lalu ganti dua nilai `GANTI_...` (dan nama database/user bila berbeda):

```bash
nano ~/repositories/beasiswa/.env
```

File `.env` diabaikan git, jadi tidak ikut tertimpa saat `git pull`.

### 5. Setup Node.js App (sekali)

**cPanel → Setup Node.js App → Create Application**:

| Isian | Nilai |
|---|---|
| Node.js version | versi tertinggi yang tersedia (minimal 20) |
| Application mode | Production |
| Application root | `repositories/beasiswa` |
| Application URL | `beasiswa.pribadidepok.sch.id` |
| Application startup file | `server/app.cjs` |

Environment variables tidak perlu diisi, karena sudah ada di `.env`. Klik
**Create**.

Kalau lebih suka lewat Terminal, perintah CloudLinux ini melakukan hal yang
sama. Sesuaikan `--version` dengan versi Node yang tersedia di server:

```bash
cloudlinux-selector create --json --interpreter nodejs --version 22 --app-root repositories/beasiswa --domain beasiswa.pribadidepok.sch.id --app-uri / --app-mode production --startup-file server/app.cjs
```

Sesudah aplikasi dibuat, pasang paket dan jalankan server:

```bash
cd ~/repositories/beasiswa && bash deploy.sh
```

`deploy.sh` mengerjakan beberapa hal:
1. memakai Node milik aplikasi;
2. menjalankan `npm install` (hanya paket server);
3. memastikan folder PDF ada;
4. memulai ulang server.

Tabel database dibuat otomatis saat server mulai.

### 6. Buat akun panitia

```bash
source "$(ls -d ~/nodevenv/repositories/beasiswa/*/ | sort -V | tail -1)bin/activate" && cd ~/repositories/beasiswa && npm run admin:set -- panitia@pribadidepok.sch.id
```

Password diminta di layar (minimal 10 karakter) dan tidak tersimpan di
riwayat terminal. Ulangi untuk setiap panitia. Perintah lain (setelah
`source` di atas):
- `npm run admin:set -- <email>`: mengganti password.
- `npm run admin:remove -- <email>`: mencabut akses.
- `npm run admin:list`: melihat daftar panitia.

### 7. Cek

```bash
curl -s https://beasiswa.pribadidepok.sch.id/api/settings
```

Perintah di atas harus menampilkan JSON yang memuat `"regOpen"`. Lalu buka
`https://beasiswa.pribadidepok.sch.id`, coba masuk dengan Google, dan buka
`/admin`.

Kalau server tidak mau jalan, lihat log-nya:

```bash
tail -n 50 ~/repositories/beasiswa/stderr.log
```

### 8. Email pemberitahuan

Aplikasi mengirim email otomatis ke orang tua: ke email akun Google dan ke
email orang tua di formulir, bila berbeda. Isinya ID/EN, mengikuti bahasa saat
mendaftar. Email dikirim untuk:
- pendaftaran diterima, termasuk pengingat bila PDF belum diunggah;
- hasil setiap tahap (lolos/tidak lolos), **setelah** waktu umum tahap itu,
  berisi pesan panitia dan info tahap berikutnya;
- pengumuman akhir.

Setiap email hanya terkirim **sekali** (dicatat di tabel `notifications`).

1. **cPanel → Email Accounts → Create**: buat `beasiswa@pribadidepok.sch.id`
   dengan password panjang.
2. Isi `SMTP_PASS` di `.env` dengan password itu, lalu mulai ulang server:
   ```bash
   nano ~/repositories/beasiswa/.env && touch ~/repositories/beasiswa/tmp/restart.txt
   ```
3. **cPanel → Email Deliverability**: pastikan **SPF** dan **DKIM** untuk
   `pribadidepok.sch.id` berstatus *Valid*. Tanpa itu, email mudah masuk spam.
4. **cPanel → Cron Jobs → Add New Cron Job**, setiap 15 menit
   (*/15 * * * *). Command:
   ```bash
   cd /home/pribadisch/repositories/beasiswa && $(ls -d /home/pribadisch/nodevenv/repositories/beasiswa/*/ | sort -V | tail -1)bin/node server-dist/server/notify-cli.js >> /home/pribadisch/beasiswa-data/notify.log 2>&1
   ```
5. Cek di **Admin → Pengaturan → Email pemberitahuan**. Bagian ini
   menampilkan apakah email aktif dan berapa email yang antre. Tombol **Kirim
   sekarang** mengirim tanpa menunggu cron. Riwayat cron tercatat di:
   ```bash
   tail -n 20 ~/beasiswa-data/notify.log
   ```

`NOTIFY_MAX_PER_RUN` membatasi jumlah email per putaran: 40 email tiap 15
menit = 160 per jam. Turunkan angkanya bila batas kirim per jam paket hosting
lebih kecil. Email yang belum terkirim akan dikirim di putaran berikutnya.

### Memperbarui aplikasi

1. Push perubahan ke `main`. GitHub Actions akan mem-build dan mengirimkannya
   ke branch `deploy` dalam sekitar 1–2 menit (lihat tab **Actions** di
   GitHub).
2. Di **cPanel → Terminal**:

```bash
cd ~/repositories/beasiswa && git pull && bash deploy.sh
```

Data MySQL, `.env`, dan PDF di `~/beasiswa-data` tidak tersentuh.

Cara manual tanpa GitHub Actions: jalankan `npm run deploy` di komputer. Ini
juga mem-build dan mengirim ke branch `deploy`. Untuk paket zip (unggah lewat
File Manager), jalankan `npm run build && npm run package`.

### Cadangan (backup)

Simpan secara berkala, terutama sebelum pengumuman:
- database, lewat **cPanel → Backup → MySQL Databases**;
- folder `~/beasiswa-data`.

Keduanya berisi data pribadi anak, jadi simpan di tempat yang aman.

## Privasi dan keamanan

Data pendaftar adalah data pribadi anak di bawah umur. Semua aturan dijaga di
**server** (`server/app.ts`) dan diuji oleh `npm run test:server` dengan MySQL
sungguhan.

- **Akses ke database**: hanya server Node.js. Kredensial DB disimpan di
  environment cPanel, tidak di kode, tidak di paket, dan tidak di browser.
  Semua query memakai parameter, jadi teks seperti `'; DROP TABLE` disimpan
  apa adanya.
- **Login Google**: token Google diperiksa server (tanda tangan, Client ID, dan
  email terverifikasi). Aplikasi hanya menyimpan id Google, email, dan nama.
- **Sesi**: token acak di cookie **HttpOnly**, **SameSite=Lax**, dan **Secure**
  di HTTPS. Cookie ini hilang saat browser ditutup dan berlaku paling lama
  12 jam (admin 8 jam). Database hanya menyimpan hash SHA-256 token itu, dan
  sesi langsung batal saat Keluar.
- **Kepemilikan data**: setiap permintaan peserta memakai id dari sesi, bukan
  dari isian browser. Akibatnya, satu akun hanya bisa melihat dan mengubah
  datanya sendiri.
- **CSRF**: permintaan yang mengubah data wajib membawa header khusus.
- **Header keamanan**: *Content-Security-Policy*, `X-Frame-Options: DENY`,
  dan `nosniff`.
- **Hasil seleksi**: status dan pesan tidak dikirim ke peserta sebelum waktu
  pengumuman.
- **Berkas PDF**: disimpan di `UPLOAD_DIR` di luar `public_html` dengan izin
  file 600, sehingga tidak bisa dibuka lewat alamat web langsung. PDF hanya
  dikirim oleh server ke pemiliknya atau ke panitia.
- **Panitia**: password disimpan dengan bcrypt. Sepuluh kali salah password
  mengunci email itu selama 15 menit.
- **Ekspor CSV**: berisi data pribadi. Sel yang bisa dibaca Excel sebagai
  rumus diberi tanda petik di depannya.
- **Login uji tanpa Google** (`ALLOW_DEV_LOGIN`) **ditolak** server bila
  `NODE_ENV=production`.
- Hanya gunakan data uji selama pengembangan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | mode demo (tampilan saja) |
| `npm run build` | type-check + build tampilan (`dist/`) dan server (`server-dist/`) |
| `npm run local` | uji lengkap: MySQL sementara + server di http://localhost:8787 |
| `npm run test:server` | uji server dengan MySQL sungguhan: login, kepemilikan data, validasi, PDF, jadwal, pengumuman, admin, CSRF |
| `npm run deploy` | build + kirim ke branch `deploy` (otomatis lewat GitHub Actions setiap push ke `main`) |
| `npm run package` | membuat folder `deploy/` dan `beasiswa-deploy.zip` |
| `npm run admin:set -- <email>` | membuat panitia / mengganti password |
| `npm run notify` | kirim email pemberitahuan yang sudah waktunya (di server: lewat Cron Job) |

## Mengubah aplikasi

- **Teks**: semua ada di `src/lib/i18n.tsx`, dalam **dua** bahasa.
- **Aturan isian**: satu sumber di `src/lib/validate.ts`, dipakai formulir dan
  server. Ubah di sana, lalu jalankan `npm run test:server`.
- **Fitur baru**: tambahkan di `httpApi.ts` + `server/app.ts`, dan juga di
  `demoApi.ts` agar mode demo tetap jalan.
- **Perubahan tabel**: tulis di `server/schema.sql`. File ini dijalankan
  ulang setiap server mulai, jadi tambahan kolom harus aman diulang dan cocok
  untuk MySQL 8 maupun MariaDB.
- **Waktu**: selalu WIB (Asia/Jakarta) di tampilan dan UTC di database.
  Gunakan helper di `src/lib/time.ts`.
- **Warna**: hanya dari token di `src/index.css`. Tombol dan teks biru memakai
  `action`. Status ditandai dengan ikon + teks, tidak hanya warna.
- **Cek tampilan**: setiap perubahan di lebar 360px.
