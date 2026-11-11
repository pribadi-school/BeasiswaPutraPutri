# Beasiswa Putra-Putri Daerah — SD–SMP–SMA Pribadi Depok

Aplikasi web pendaftaran beasiswa. Orang tua/wali mengisi data anak dari HP,
lalu mendapat **username + PIN 6 angka**. Dengan itu mereka bisa masuk kapan
saja untuk melengkapi atau mengubah data, sampai hari pengumuman. Hasil
seleksi baru bisa dilihat setelah waktu pengumuman tiba.

Stack: React 19 + Vite + TypeScript, Tailwind v4 (design system sekolah di
`design-system/`), Supabase (Postgres). Bahasa antarmuka: Indonesia + Inggris.

## Alur

| Halaman | Isi |
|---|---|
| `/` | Penjelasan 3 langkah, batas pendaftaran, tanggal pengumuman |
| `/daftar` | Formulir: data anak, asal daerah, sekolah asal, orang tua/wali, keterangan tambahan, persetujuan |
| (setelah kirim) | Username (mis. `bpd-k7m2qx`) dan PIN ditampilkan **sekali** |
| `/masuk` | Masuk dengan username + PIN |
| `/akun` | Status, hitung mundur pengumuman, data pendaftaran (bisa diubah sampai batas waktu), lalu hasil |
| `/admin` | Daftar pendaftar (cari, filter, detail), tetapkan status, buat PIN baru, hapus, ekspor CSV; atur pendaftaran dan pengumuman |

Status hasil: **Diterima**, **Cadangan**, **Tidak diterima**, atau **Diproses**
(belum diputuskan). Admin bisa menetapkan status kapan saja. Peserta baru
melihatnya setelah *waktu pengumuman*. Setelah waktu itu, data dikunci.

## Menjalankan di komputer (mode demo)

```bash
npm install
```

```bash
npm run dev
```

Buka http://localhost:5173. Jika `.env` tidak ada atau kosong, aplikasi
berjalan dalam **mode demo**: semua data hanya tersimpan di browser itu,
dan password admin-nya `demo`. Mode ini cocok untuk mencoba tampilan tanpa
menyentuh data sungguhan.

## Memakai Supabase (data sungguhan)

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
4. Ganti password admin kapan saja: ubah `ADMIN_PASSWORD`, lalu jalankan
   `npm run db:admin-password`. Semua sesi admin akan keluar.

`.env` tidak boleh di-commit (sudah ada di `.gitignore`). Variabel tanpa
awalan `VITE_` tidak boleh diberi awalan itu, karena isinya akan ikut terkirim
ke browser setiap pengunjung.

## Hosting (cPanel)

`npm run build` menghasilkan folder `dist/`. Unggah isinya ke folder subdomain.
File `.htaccess` di dalamnya mengarahkan semua alamat (`/daftar`, `/akun`, …)
ke `index.html`. Build harus dibuat dengan `.env` yang berisi URL dan anon key
Supabase. Tanpa keduanya, situs akan berjalan dalam mode demo.

Project Supabase gratis berhenti sementara setelah 7 hari tanpa aktivitas.
Buka dashboard Supabase secara berkala selama masa pendaftaran.

## Privasi dan keamanan

Data pendaftar adalah data pribadi anak di bawah umur. Perlindungannya
dijalankan oleh **database**, bukan oleh tampilan:

- Semua data ada di schema `private`, dengan RLS aktif dan tanpa policy.
  Browser tidak bisa membaca tabel apa pun secara langsung, hanya memanggil
  fungsi Postgres yang memeriksa input dan sesi (`supabase/migrations/0001_schema.sql`).
- PIN dan password admin disimpan sebagai hash bcrypt. Token sesi disimpan
  sebagai hash SHA-256, berlaku 12 jam (admin 8 jam), dan disimpan di
  `sessionStorage` sehingga hilang saat tab ditutup.
- 5 kali salah PIN mengunci username itu selama 15 menit. Kunci ini per
  username, jadi satu orang tidak bisa mengunci semua peserta. Admin
  terkunci setelah 10 kali salah.
- Hasil (status dan pesan) tidak dikirim ke peserta sebelum `announce_at`.
- Satu anak hanya bisa terdaftar sekali (nama + tanggal lahir).
- Lupa PIN: admin membuat PIN baru, yang tampil sekali. PIN lama dan sesi
  peserta langsung tidak berlaku.
- Ekspor CSV berisi data pribadi dan tidak memuat PIN. Sel yang bisa dibaca
  sebagai rumus Excel diberi petik di depannya. Simpan file ekspor dengan aman.
- Hanya gunakan data uji selama pengembangan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | server lokal |
| `npm run build` | type-check + build produksi |
| `npm run test:db` | uji database dengan Postgres sungguhan (embedded): pendaftaran, login, penguncian, pengumuman, hak akses |
| `npm run db:setup` | siapkan/perbarui database Supabase |

## Mengubah aplikasi

- Semua teks ada di `src/lib/i18n.tsx`, dalam **dua** bahasa.
- Fitur baru di `supabaseApi.ts` juga harus ditambahkan di `demoApi.ts`.
- Aturan isian ada di dua tempat: `src/lib/validate.ts` (pesan cepat) dan
  `private.clean_profile` di SQL (penjaga sebenarnya). Ubah keduanya.
- Waktu selalu WIB (Asia/Jakarta). Gunakan helper di `src/lib/time.ts`.
- Warna hanya dari token di `src/index.css`. Tombol dan teks biru memakai
  `action`. Status ditandai dengan ikon + teks, tidak hanya warna.
- Cek setiap perubahan pada lebar 360px.
