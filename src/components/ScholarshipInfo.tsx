import { BadgeCheck, CalendarDays, ChevronDown, FileStack, Info, ListChecks, Scale, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * Informasi program (dari dokumen "Beasiswa Putra-Putri Daerah — Pribadi School Depok"):
 * pendahuluan, jadwal, persyaratan, dokumen, pengumuman & ketentuan.
 * Dalam bentuk lipat (<details>) agar Beranda tetap ringkas di HP.
 */
type Lang = 'id' | 'en';
const C = {
  id: {
    title: 'Informasi Beasiswa',
    introT: 'Pendahuluan',
    intro: 'Beasiswa Putra-Putri Daerah memberi kesempatan bagi siswa berprestasi yang berdomisili di Jawa Barat untuk belajar di SMP dan SMA Pribadi Depok.',
    pillars: [
      ['Jenjang', 'SMP dan SMA', 'Berlaku bagi calon siswa SMP dan SMA Pribadi Depok.'],
      ['Sasaran', 'Domisili Jawa Barat', 'Siswa aktif dengan prestasi akademik yang baik dan kemampuan luar biasa di bidang akademik.'],
      ['Prinsip', 'Transparan, adil, objektif', 'Seleksi dijalankan panitia beasiswa melalui tahapan yang terukur.'],
    ],
    scheduleT: 'Jadwal & tahapan seleksi',
    schedule: [
      ['Pendaftaran', 'Sampai 26 Desember 2026', 'Formulir dan dokumen diserahkan lewat situs ini. Panitia memeriksa formulir dan kelengkapan dokumen (seleksi administrasi).'],
      ['Tes akademik', '9 Januari 2027', 'Bahasa Inggris, Matematika, dan tes IQ dengan nilai minimum.'],
      ['Wawancara', '16 Januari 2027', 'Siswa yang lulus tes akademik akan diwawancarai oleh pihak sekolah di Pribadi School.'],
      ['Pengumuman', '20 Januari 2027', 'Lewat situs ini, website resmi, dan media sosial sekolah.'],
    ],
    reqT: 'Persyaratan pendaftar',
    req: [
      'Berdomisili di Jawa Barat.',
      'Terdaftar sebagai siswa aktif pada tahun ajaran berjalan.',
      'Rata-rata nilai rapor 90: kelas 4 dan 5 untuk calon siswa SMP; kelas 7 dan 8 untuk calon siswa SMA.',
      'Memiliki prestasi akademik yang baik dan kemampuan luar biasa di bidang akademik.',
      'Mengisi formulir pendaftaran dari website resmi sekolah atau bagian administrasi.',
    ],
    docsT: 'Dokumen pendaftaran',
    docs: [
      'Formulir pendaftaran terisi lengkap (diisi di situs ini).',
      'Fotokopi rapor semester terakhir.',
      'Fotokopi KTP orang tua atau wali.',
      'Pas foto terbaru ukuran 3×4.',
      'Sertifikat prestasi terkurasi Puspresnas, minimal bintang 2.',
    ],
    docsNote: 'Dokumen nomor 2–5 digabung menjadi satu PDF (maks 10 MB) dan diunggah di formulir. Berkas lengkap diperiksa panitia, lalu siswa yang memenuhi syarat lanjut ke tes.',
    rulesT: 'Pengumuman & ketentuan',
    announce: [
      'Hasil diumumkan lewat website dan media sosial sekolah, serta di akun Anda di situs ini.',
      'Semua peserta menerima pengumuman, terpilih maupun tidak.',
      'Calon penerima yang lolos dihubungi untuk melengkapi administrasi dan mengikuti orientasi beasiswa.',
    ],
    rules: [
      'Keputusan panitia seleksi bersifat final dan tidak dapat diganggu gugat.',
      'Penerima beasiswa diharapkan menjaga prestasi akademik dan mengikuti aturan yang berlaku di sekolah.',
    ],
    announceH: 'Pengumuman', rulesH: 'Ketentuan lain',
  },
  en: {
    title: 'Scholarship information',
    introT: 'Introduction',
    intro: 'The Beasiswa Putra-Putri Daerah scholarship gives high-achieving students living in West Java (Jawa Barat) the chance to study at SMP and SMA Pribadi Depok.',
    pillars: [
      ['Levels', 'SMP and SMA', 'For prospective SMP and SMA Pribadi Depok students.'],
      ['Target', 'West Java residents', 'Active students with strong academic achievement and outstanding academic ability.'],
      ['Principles', 'Transparent, fair, objective', 'The selection is run by the scholarship committee through measurable stages.'],
    ],
    scheduleT: 'Schedule & selection stages',
    schedule: [
      ['Registration', 'Until 26 December 2026', 'Submit the form and documents on this site. The committee checks the form and documents (administrative selection).'],
      ['Academic test', '9 January 2027', 'English, Mathematics and an IQ test with minimum scores.'],
      ['Interview', '16 January 2027', 'Students who pass the academic test will be interviewed by the school at Pribadi School.'],
      ['Announcement', '20 January 2027', 'On this site, the official website and the school’s social media.'],
    ],
    reqT: 'Applicant requirements',
    req: [
      'Living in West Java (Jawa Barat).',
      'Registered as an active student in the current school year.',
      'Report-card average of 90: grades 4 and 5 for SMP applicants; grades 7 and 8 for SMA applicants.',
      'Strong academic achievement and outstanding academic ability.',
      'Fill in the registration form from the official school website or the administration office.',
    ],
    docsT: 'Registration documents',
    docs: [
      'Completed registration form (filled in on this site).',
      'Copy of the latest semester report card.',
      'Copy of the parent’s or guardian’s ID card (KTP).',
      'Recent 3×4 photo.',
      'Achievement certificates curated by Puspresnas, at least 2 stars.',
    ],
    docsNote: 'Documents 2–5 are combined into one PDF (max 10 MB) and uploaded in the form. The committee checks complete files, and eligible students continue to the test.',
    rulesT: 'Announcement & terms',
    announce: [
      'Results are announced on the school website and social media, and in your account on this site.',
      'All applicants receive the announcement, selected or not.',
      'Selected applicants are contacted to complete the administration and attend the scholarship orientation.',
    ],
    rules: [
      'The selection committee’s decision is final and cannot be contested.',
      'Scholarship recipients are expected to maintain their academic achievement and follow the school rules.',
    ],
    announceH: 'Announcement', rulesH: 'Other terms',
  },
} as const;

/** Daftar isi PDF unggahan (sama dengan Juknis: dokumen nomor 2–5). */
export const docChecklist = (lang: Lang) => C[lang].docs.slice(1);

function Fold({ Icon, title, open, children }: { Icon: LucideIcon; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-lg bg-surface shadow-e2 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-bold text-foreground">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-action-tint text-action"><Icon size={20} aria-hidden /></span>
        <span className="flex-1">{title}</span>
        <ChevronDown size={20} aria-hidden className="shrink-0 text-action transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm text-foreground">{children}</div>
    </details>
  );
}

const Numbered = ({ items }: { items: readonly string[] }) => (
  <ol className="space-y-2">
    {items.map((x, i) => (
      <li key={x} className="flex gap-3">
        <span className="w-5 shrink-0 text-right font-extrabold text-action">{i + 1}</span><span>{x}</span>
      </li>
    ))}
  </ol>
);
const Bullets = ({ items }: { items: readonly string[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
);

export function ScholarshipInfo({ openFirst = true }: { openFirst?: boolean }) {
  const { lang } = useI18n();
  const c = C[lang];
  return (
    <section aria-labelledby="info-title" className="space-y-3">
      <h2 id="info-title" className="text-lg font-bold text-foreground">{c.title}</h2>

      <Fold Icon={Info} title={c.introT} open={openFirst}>
        <p className="text-base font-semibold">{c.intro}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {c.pillars.map(([k, h, d]) => (
            <div key={k} className="rounded-sm bg-surface-portal p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-action">{k}</div>
              <div className="font-bold">{h}</div>
              <div className="text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </Fold>

      <Fold Icon={CalendarDays} title={c.scheduleT}>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {c.schedule.map(([name, date, d], i) => (
            <li key={name} className="rounded-sm bg-surface-portal p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-action">{lang === 'id' ? 'Tahap' : 'Stage'} {i + 1}</div>
              <div className="font-bold">{name}</div>
              <div className="font-semibold text-success-text">{date}</div>
              <div className="text-muted-foreground">{d}</div>
            </li>
          ))}
        </ol>
      </Fold>

      <Fold Icon={ListChecks} title={c.reqT}><Numbered items={c.req} /></Fold>

      <Fold Icon={FileStack} title={c.docsT}>
        <Numbered items={c.docs} />
        <p className="flex gap-2 rounded-sm bg-action-tint p-3"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-action" aria-hidden />{c.docsNote}</p>
      </Fold>

      <Fold Icon={Scale} title={c.rulesT}>
        <h3 className="font-bold text-action">{c.announceH}</h3>
        <Bullets items={c.announce} />
        <h3 className="font-bold text-action">{c.rulesH}</h3>
        <Bullets items={c.rules} />
      </Fold>
    </section>
  );
}
