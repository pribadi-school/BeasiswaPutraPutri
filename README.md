# Beasiswa Putra-Putri Daerah — SD–SMP–SMA Pribadi Depok

Aplikasi web pendaftaran beasiswa. Orang tua/wali **masuk dengan akun Google
(Gmail)**, lalu mengisi data anak. Dengan akun Google yang sama mereka bisa
masuk kapan saja untuk melengkapi atau mengubah data sampai batas waktu, dan
melihat hasil seleksi setelah waktu pengumuman tiba.

Stack: React 19 + Vite + TypeScript, Tailwind v4 (design system sekolah di
`design-system/`), Supabase (Postgres + Auth Google). Bahasa antarmuka:
Indonesia + Inggris.

## Alur

| Halaman | Isi |
|---|---|
| `/` | Penjelasan 3 langkah, batas pendaftaran, tanggal pengumuman |
| `/masuk` | Tombol **Masuk dengan Google** |
| `/akun` (belum isi data) | Formulir: data anak, asal daerah, sekolah asal, orang tua/wali, keterangan tambahan, persetujuan |
| `/akun` (sudah isi data) | Status, hitung mundur pengumuman, data pendaftaran (bisa diubah sampai batas waktu), lalu hasil |
| `/admin` | Daftar pendaftar (cari, filter, detail), tetapkan status, hapus, ekspor CSV; atur pendaftaran dan pengumuman |

- Peserta: **SMP** (sekarang kelas 6) atau **SMA** (sekarang kelas 9), dari
  provinsi **Jawa Barat** saja. Aturan ini dijaga juga di database
  (`private.clean_profile` dan constraint `applicants_scope_check`).
- Semua isian wajib, kecuali **penghasilan keluarga** dan **jumlah saudara
  kandung**. NISN (10 angka), email orang tua, dan prestasi juga wajib. Prestasi
  boleh diisi "-" bila belum ada.
- Satu akun Google untuk satu anak. Untuk mendaftarkan anak lain, gunakan
  akun Google lain.
- Satu anak hanya bisa didaftarkan sekali, dilihat dari nama dan tanggal lahir.
- Status hasil: **Diterima**, **Cadangan**, **Tidak diterima**, atau
  **Diproses** (belum diputuskan). Admin bisa menetapkan status kapan saja,
  tetapi peserta baru melihatnya setelah *waktu pengumuman*. Setelah waktu
  itu, data dikunci.
- Admin masuk dengan password, bukan akun Google.

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
- Password admin: `demo`.

## Memakai Supabase + Google (data sungguhan)

### 1. Supabase

1. Buat project baru di supabase.com (region Singapore).
2. Salin `.env.example` menjadi `.env`, lalu isi:
   - `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`: Project Settings → API.
     **Anon key, bukan service_role.**
   - `SUPABASE_DB_URL`: Connect → *Session pooler* connection string.
   - `ADMIN_PASSWORD`: minimal 8 karakter, sebaiknya panjang.
3. Siapkan database (aman diulang, tidak menghapus pendaftar):
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

### 3. Password admin

Untuk mengganti password admin: ubah `ADMIN_PASSWORD` di `.env`, lalu jalankan
`npm run db:admin-password`. Semua sesi admin akan keluar.

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
- Password admin disimpan sebagai hash bcrypt. Token sesi admin disimpan
  sebagai hash, berlaku 8 jam. Admin terkunci 15 menit setelah 10 kali salah.
- Hasil (status dan pesan) tidak dikirim ke peserta sebelum `announce_at`.
- Ekspor CSV berisi data pribadi. Sel yang bisa dibaca sebagai rumus Excel
  diberi petik di depannya. Simpan file ekspor dengan aman.
- Hanya gunakan data uji selama pengembangan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | server lokal |
| `npm run build` | type-check + build produksi |
| `npm run test:db` | uji database dengan Postgres sungguhan (embedded): pendaftaran per akun, isolasi antar akun, pengumuman, hak akses |
| `npm run db:setup` | siapkan/perbarui database Supabase |

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
