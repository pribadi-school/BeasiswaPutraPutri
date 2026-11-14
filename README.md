# Beasiswa Putra-Putri Daerah — SD–SMP–SMA Pribadi Depok

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
- **Jadwal**: tidak ada tanggal pembukaan; pendaftaran langsung dibuka.
  Ditutup **26 Desember 2026, 23.59 WIB**. Penutupan diatur panitia di
  **Admin → Pengaturan**, bersama saklar "Pendaftaran aktif" untuk menutup
  sementara. Waktu pengumuman harus sesudah penutupan.
- **Draf otomatis**: isian formulir tersimpan di HP. Draf dihapus setelah
  pendaftaran terkirim dan saat menekan Keluar. Berkas PDF tidak ikut
  disimpan sebagai draf.
- **Satu akun Google untuk satu anak.** Satu anak juga hanya bisa didaftarkan
  sekali (dilihat dari nama dan tanggal lahir).
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

### 3. Unggah aplikasi

1. Di komputer:
   ```bash
   npm run build && npm run package
   ```
   Hasilnya `beasiswa-deploy.zip`. Paket ini tidak berisi rahasia apa pun.
2. **cPanel → File Manager**:
   - Buat folder `beasiswa-app` di home, **di luar `public_html`**.
   - Unggah zip ke folder itu, lalu pilih **Extract**.
   - Buat juga folder **`beasiswa-data/berkas`** di home untuk PDF peserta,
     juga di luar `public_html`.

### 4. Setup Node.js App

**cPanel → Setup Node.js App → Create Application**:

| Isian | Nilai |
|---|---|
| Node.js version | versi tertinggi yang tersedia (minimal 20) |
| Application mode | Production |
| Application root | `beasiswa-app` |
| Application URL | `beasiswa.pribadidepok.sch.id` |
| Application startup file | `server/app.cjs` |

Lalu tambahkan **Environment variables** berikut:

| Nama | Isi |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | `localhost` |
| `DB_NAME` | nama database dari langkah 2 |
| `DB_USER` | user database dari langkah 2 |
| `DB_PASSWORD` | password user database |
| `GOOGLE_CLIENT_ID` | Client ID dari langkah 1 |
| `UPLOAD_DIR` | `/home/pribadisch/beasiswa-data/berkas` |

Klik **Save**, lalu **Run NPM Install**, lalu **Restart**. Tabel database
dibuat otomatis saat server pertama kali berjalan.

### 5. Buat akun panitia

Buka **cPanel → Terminal**. Perintah untuk masuk ke lingkungan Node aplikasi
ditampilkan di bagian atas halaman Setup Node.js App, mirip ini:

```bash
source /home/pribadisch/nodevenv/beasiswa-app/22/bin/activate && cd /home/pribadisch/beasiswa-app
```

Perintah admin membaca pengaturan database dari file `.env` di folder
aplikasi. Isinya `DB_HOST`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD`, sama
dengan langkah 4. Buat file itu sekali, lalu batasi aksesnya:

```bash
nano .env && chmod 600 .env
```

Sesudah itu:

```bash
npm run admin:set -- panitia@pribadidepok.sch.id
```

Password diminta di layar (minimal 10 karakter). Ulangi untuk setiap panitia.
Perintah lain:
- `npm run admin:set -- <email>`: mengganti password.
- `npm run admin:remove -- <email>`: mencabut akses.
- `npm run admin:list`: melihat daftar panitia.

### 6. Selesai

Buka `https://beasiswa.pribadidepok.sch.id`, lalu coba masuk dengan Google
dan masuk ke `/admin`.

### Memperbarui aplikasi

1. Jalankan `npm run build && npm run package`.
2. Unggah zip baru ke `beasiswa-app`, lalu Extract dan timpa file lama.
3. Di Setup Node.js App, klik **Restart**.

Data MySQL dan PDF di `beasiswa-data` tidak tersentuh.

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
| `npm run package` | membuat `beasiswa-deploy.zip` untuk cPanel |
| `npm run admin:set -- <email>` | membuat panitia / mengganti password |

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
