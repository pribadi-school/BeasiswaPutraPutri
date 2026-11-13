# Beasiswa Putra-Putri Daerah — catatan proyek

Baca README.md dulu. Proyek ini TERPISAH dari aplikasi janji temu
(`../appointment app`); jangan mencampur commit keduanya. Design system
`design-system/sekolah-pribadi-depok/` adalah salinan. Jika merek berubah,
perbarui semua salinannya.

Aturan yang mudah terlewat:
- Peserta masuk dengan Google (Supabase Auth). Fungsi peserta memakai
  `private.uid()` (claim `sub` dari JWT), dan hanya role `authenticated` yang
  boleh memanggilnya. Admin masuk dengan password + token sesi (hash).
- Keamanan dijaga di database (`supabase/migrations/0001_schema.sql`):
  schema `private` + RLS tanpa policy, semua akses lewat fungsi SECURITY
  DEFINER. Jangan dilemahkan dan jangan pernah memakai service_role key di browser.
- Status hasil hanya keluar ke peserta setelah `announce_at` (`private.released()`).
- Satu akun Google = satu pendaftaran (`user_id` unik); satu anak = satu pendaftaran.
- Setiap fitur di `supabaseApi.ts` juga harus ada di `demoApi.ts`.
- Teks UI di `src/lib/i18n.tsx`, ID dan EN.
- Setelah mengubah SQL, jalankan `npm run test:db`.
- Fungsi yang dipakai sebagai dependency effect (mis. `useErrorText`) harus
  stabil (`useCallback`). Jika tidak, data dimuat ulang terus dan isian formulir ter-reset.
