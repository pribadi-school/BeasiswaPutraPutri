# Beasiswa Putra-Putri Daerah — catatan proyek

Baca README.md dulu. Proyek ini TERPISAH dari aplikasi janji temu
(`../appointment app`); jangan mencampur commit keduanya. Design system
`design-system/sekolah-pribadi-depok/` adalah salinan. Jika merek berubah,
perbarui semua salinannya.

Aturan yang mudah terlewat:
- Keamanan dijaga di database (`supabase/migrations/0001_schema.sql`):
  schema `private` + RLS tanpa policy, semua akses lewat fungsi SECURITY
  DEFINER, PIN/password memakai bcrypt, token sesi disimpan sebagai hash.
  Jangan dilemahkan dan jangan pernah memakai service_role key di browser.
- Status hasil hanya keluar ke peserta setelah `announce_at` (`private.released()`).
- Lockout per username (`u:<username>`), bukan global.
- Setiap fitur di `supabaseApi.ts` juga harus ada di `demoApi.ts`.
- Teks UI di `src/lib/i18n.tsx`, ID dan EN.
- Setelah mengubah SQL, jalankan `npm run test:db`.
- Fungsi yang dipakai sebagai dependency effect (mis. `useErrorText`) harus
  stabil (`useCallback`). Jika tidak, data dimuat ulang terus dan isian formulir ter-reset.
