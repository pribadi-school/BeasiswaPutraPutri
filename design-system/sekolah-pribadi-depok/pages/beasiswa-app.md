# Beasiswa Putra-Putri Daerah — tambahan untuk aplikasi ini

Mengikuti MASTER.md (elevation e1–e4, sudut membulat, tombol pil). Tidak
memakai gaya datar milik aplikasi janji temu (`appointment-app.md`). Tata
letak portal diambil dari referensi UI yang diberikan pengguna (dashboard
portal siswa), dengan warna merek sekolah, bukan ungu.

- **Kerangka setelah masuk** (`AppShell`): sidebar biru di kiri pada layar
  `lg`. Isinya ubin logo, menu pil (aktif = pil putih + teks `action`), dan
  Keluar di bawah. Bar atas memuat tombol bahasa + avatar (huruf awal), nama,
  dan keterangan. Di HP: bar atas ringkas + menu bawah tetap.
- **Banner sambutan** (`WelcomeBanner`): gradasi `action` → `gradient-end`
  (115°, biru sampai 45%). Teks putih hanya di sisi biru agar kontras AA.
  Ilustrasi (`HeroArt`) dibuat dari ubin ikon, tidak memakai gambar.
- **Kartu angka** (`StatCard`): ubin ikon bergradasi lembut, angka tebal, dan
  label. Kartu utama diberi `ring-2 ring-action`. Di HP kartu menjadi baris
  ringkas (ikon di kiri).
- **Kartu data**: kartu pertama putih + ring biru, kartu berikutnya
  `action-tint`. Tombol pil kecil (`btnPill`).
- **Panel "Info penting"**: kartu putih berisi daftar ikon + judul + teks.
- Latar halaman: `surface-portal` (biru sangat muda).
- Gerak melayang pada ilustrasi dimatikan saat `prefers-reduced-motion`
  (aturan global di `index.css`).
