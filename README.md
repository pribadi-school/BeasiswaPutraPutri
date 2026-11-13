# Beasiswa Putra-Putri Daerah — SD–SMP–SMA Pribadi Depok

Aplikasi web pendaftaran beasiswa. Orang tua/wali **masuk dengan akun Google
(Gmail)**, lalu mengisi data anak. Dengan akun Google yang sama mereka bisa
masuk kapan saja untuk melengkapi atau mengubah data sampai batas waktu, dan
melihat hasil seleksi setelah waktu pengumuman tiba.

Stack: React 19 + Vite + TypeScript, Tailwind v4 (design system sekolah di
`design-system/`), Supabase (Postgres + Auth Google + Storage). Bahasa antarmuka:
Indonesia + Inggris.

## Alur

| Halaman | Isi |
|---|---|
| `/` | Penjelasan 3 langkah, batas pendaftaran, tanggal pengumuman |
| `/masuk` | Tombol **Masuk dengan Google** |
| `/akun` (belum isi data) | Formulir: data anak, asal daerah, sekolah asal, orang tua/wali, keterangan tambahan, **berkas PDF**, persetujuan |
| `/akun` | Beranda: status, hitung mundur pengumuman, kelengkapan data, info penting |
| `/akun/data` | Data pendaftaran dan berkas PDF (bisa diubah/diganti sampai batas waktu) |
| `/akun/pengumuman` | Hasil seleksi setelah waktu pengumuman |
| `/admin` | Daftar pendaftar (cari, filter, detail, **lihat PDF**), tetapkan status, hapus, ekspor CSV; `/admin/pengaturan` untuk pendaftaran dan pengumuman |

- Peserta: **SMP** (sekarang kelas 6) atau **SMA** (sekarang kelas 9), dari
  provinsi **Jawa Barat** saja. Aturan ini dijaga juga di database
  (`private.clean_profile` dan constraint `applicants_scope_check`).
- Semua isian wajib, kecuali **penghasilan keluarga** dan **jumlah saudara
  kandung**. NISN (10 angka), email orang tua, dan prestasi juga wajib. Prestasi
  boleh diisi "-" bila belum ada.
- **Berkas kelengkapan**: SATU file PDF (maks 10 MB) berisi KTP orang
  tua/wali, KK, rapor, dan sertifikat lomba/olimpiade (bila ada). Diminta saat
  mendaftar dan bisa diganti di *Data saya* sampai batas waktu. Aplikasi
  memeriksa isinya benar-benar PDF (diawali `%PDF-`). Supabase Storage
  menolak file selain PDF dan file di atas 10 MB.
- **Jadwal pendaftaran**: dibuka **20 November 2026, 00.00 WIB** dan ditutup
  **26 Desember 2026, 23.59 WIB**. Sebelum dibuka, orang tua bisa masuk
  tetapi formulir belum tampil. Sesudah ditutup, data dan berkas tidak bisa
  diubah. Jadwal ini dipasang sekali oleh migrasi, lalu diatur panitia di
  **Admin → Pengaturan** (migrasi berikutnya tidak menimpanya). Waktu
  pengumuman harus sesudah penutupan.
- Satu akun Google untuk satu anak. Untuk mendaftarkan anak lain, gunakan
  akun Google lain.
- Satu anak hanya bisa didaftarkan sekali, dilihat dari nama dan tanggal lahir.
- Status hasil: **Diterima**, **Cadangan**, **Tidak diterima**, atau
  **Diproses** (belum diputuskan). Admin bisa menetapkan status kapan saja,
  tetapi peserta baru melihatnya setelah *waktu pengumuman*. Setelah waktu
  itu, data dikunci.
- Admin (panitia) masuk dengan **email + password** akun Supabase yang
  didaftarkan sekolah (lihat langkah 3), bukan akun Google.

## Menjalankan di komputer (mode demo)

```bash
npm install
```

```bash
npm run dev
```

Buka http://localhost:5173. Jika `.env` tidak ada atau kosong, aplikasi
berjalan dalam **mode demo**:

- Semua data hanya tersimpan di browser itu.
- "Masuk dengan Google" disimulasikan: ketik email apa saja.
- Admin: email apa saja, password `demo`.
- PDF hanya disimpan di memori tab, jadi hilang saat halaman dimuat ulang.
  Yang tetap tersimpan hanya ukuran dan waktunya.

## Memakai Supabase + Google (data sungguhan)

### 1. Supabase

1. Buat project baru di supabase.com (region Singapore).
2. Salin `.env.example` menjadi `.env`, lalu isi:
   - `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`: Project Settings → API.
     **Anon key, bukan service_role.**
   - `SUPABASE_DB_URL`: Connect → *Session pooler* connection string.
   - `ADMIN_EMAILS`: email akun panitia, dipisah koma (lihat langkah 3).
3. Siapkan database, bucket `berkas`, dan policy Storage (aman diulang, tidak
   menghapus pendaftar):
   ```bash
   npm run db:setup
   ```

### 2. Login Google

1. Buka **Google Cloud Console** dengan akun sekolah, lalu buat project
   (mis. "Beasiswa Pribadi").
2. **APIs & Services → OAuth consent screen**: pilih *External*, lalu isi
   nama aplikasi, email dukungan, dan domain sekolah. Setelah siap dipakai
   umum, klik *Publish app*. Selama masih *Testing*, hanya akun yang
   didaftarkan sebagai test user yang bisa masuk.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   jenis *Web application*:
   - *Authorized JavaScript origins*: alamat situs (mis.
     `https://beasiswa.pribadidepok.sch.id`) dan `http://localhost:5173`.
   - *Authorized redirect URIs*:
     `https://<ID-PROJECT>.supabase.co/auth/v1/callback`
4. Salin *Client ID* dan *Client secret*.
5. Di **Supabase → Authentication → Sign In / Providers → Google**: aktifkan,
   lalu tempel Client ID dan secret.
6. Di **Supabase → Authentication → URL Configuration**:
   - *Site URL*: alamat situs.
   - *Redirect URLs*: tambahkan `https://<alamat-situs>/akun` dan
     `http://localhost:5173/akun`.
7. Disarankan: di **Providers → Email**, matikan pendaftaran email, sehingga
   satu-satunya cara masuk adalah Google.

Client secret hanya disimpan di dashboard Supabase. Jangan menaruhnya di
`.env` yang berawalan `VITE_`, di kode, atau di git.

### 3. Akun panitia (admin)

1. **Supabase → Authentication → Users → Add user → Create new user**:
   isi email + password panitia, lalu centang *Auto Confirm User*. Ulangi
   untuk tiap panitia.
2. **Providers → Email** tetap aktif (untuk login panitia), tetapi matikan
   *Allow new users to sign up*, sehingga orang lain tidak bisa membuat akun.
3. Tulis email-email itu di `ADMIN_EMAILS` (`.env`), lalu jalankan:
   ```bash
   npm run db:admins
   ```
   Hanya akun yang terdaftar di sini yang bisa membuka `/admin` dan PDF
   peserta. Akun ini dicocokkan berdasarkan id akun, bukan email saja. Untuk
   mencabut akses, hapus emailnya dari `ADMIN_EMAILS`, lalu jalankan lagi.
4. Ganti password panitia di **Authentication → Users**.

### 4. Kapasitas penyimpanan

Supabase gratis menyediakan sekitar 1 GB untuk Storage. Dengan file maksimal
10 MB, kapasitas itu cukup untuk kira-kira 100 pendaftar bila semua
mengunggah file terbesar (umumnya file PDF hasil pindai 1–3 MB). Pantau di
**Storage** pada dashboard. Bila pendaftar banyak, naikkan paket Supabase.

`.env` tidak boleh di-commit (sudah ada di `.gitignore`). Variabel tanpa
awalan `VITE_` tidak boleh diberi awalan itu, karena isinya akan ikut terkirim
ke browser setiap pengunjung.

## Hosting (cPanel)

`npm run build` menghasilkan folder `dist/`. Unggah isinya ke folder subdomain.
File `.htaccess` di dalamnya mengarahkan semua alamat (`/masuk`, `/akun`, …)
ke `index.html`.

- Build harus dibuat dengan `.env` yang berisi URL dan anon key Supabase.
  Tanpa keduanya, situs akan berjalan dalam mode demo.
- Alamat situs harus terdaftar di Google (*JavaScript origins*) dan di
  Supabase (*Site URL* / *Redirect URLs*).
- Project Supabase gratis berhenti sementara setelah 7 hari tanpa aktivitas.
  Buka dashboard Supabase secara berkala selama masa pendaftaran.

## Privasi dan keamanan

Data pendaftar adalah data pribadi anak di bawah umur. Perlindungannya
dijalankan oleh **database**, bukan oleh tampilan:

- Semua data ada di schema `private`, dengan RLS aktif dan tanpa policy.
  Browser tidak bisa membaca tabel apa pun secara langsung, hanya memanggil
  fungsi Postgres yang memeriksa input (`supabase/migrations/0001_schema.sql`).
- Fungsi peserta (`register`, `me`, `update_profile`) hanya bisa dipanggil
  pengguna yang sudah masuk. Fungsi itu mengenali pemiliknya dari token login
  Supabase (`sub`), sehingga satu akun Google hanya bisa melihat dan mengubah
  datanya sendiri. Email akun diambil dari token, bukan dari isian.
- Sesi Google disimpan di `sessionStorage`, sehingga hilang saat tab
  ditutup. Ini lebih aman untuk HP yang dipakai bersama.
- Aplikasi hanya memakai nama dan email akun Google.
- Berkas PDF (KTP, KK, rapor) adalah data paling sensitif. Berkas ada di
  bucket Storage **privat** `berkas`, di `<id-akun>/kelengkapan.pdf`. Policy
  Storage (di file migrasi) mengatur aksesnya:
  - Peserta hanya bisa mengunggah dan membaca berkasnya sendiri, dan hanya
    selama pendaftaran dibuka.
  - Admin bisa membaca dan menghapus.
  - File dibuka lewat tautan sementara yang berlaku 60 detik, tidak pernah
    lewat tautan publik.
- Admin adalah akun Supabase Auth yang terdaftar di `private.admins`.
  Password panitia dikelola Supabase dan tidak pernah tersimpan di kode atau
  `.env`.
- Hasil (status dan pesan) tidak dikirim ke peserta sebelum `announce_at`.
- Ekspor CSV berisi data pribadi. Sel yang bisa dibaca sebagai rumus Excel
  diberi petik di depannya. Simpan file ekspor dengan aman.
- Hanya gunakan data uji selama pengembangan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | server lokal |
| `npm run build` | type-check + build produksi |
| `npm run test:db` | uji database dengan Postgres sungguhan (embedded): pendaftaran per akun, isolasi antar akun, policy Storage berkas, pengumuman, hak admin |
| `npm run db:setup` | siapkan/perbarui database, bucket, dan policy Supabase |
| `npm run db:admins` | perbarui daftar akun panitia dari `ADMIN_EMAILS` |

## Mengubah aplikasi

- Semua teks ada di `src/lib/i18n.tsx`, dalam **dua** bahasa.
- Fitur baru di `supabaseApi.ts` juga harus ditambahkan di `demoApi.ts`.
- Aturan isian ada di dua tempat: `src/lib/validate.ts` (pesan cepat) dan
  `private.clean_profile` di SQL (penjaga sebenarnya). Ubah keduanya.
- Waktu selalu WIB (Asia/Jakarta). Gunakan helper di `src/lib/time.ts`.
- Warna hanya dari token di `src/index.css`, kecuali logo Google di
  `GoogleButton.tsx`. Tombol dan teks biru memakai `action`. Status ditandai
  dengan ikon + teks, tidak hanya warna.
- Cek setiap perubahan pada lebar 360px.
