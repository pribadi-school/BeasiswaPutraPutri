/** Tipe data bersama. */

export type Lang = 'id' | 'en';
/** Jenjang yang dituju. SD tidak dibuka untuk beasiswa ini. */
export type Level = 'smp' | 'sma';
/** Hasil akhir (tahap Pengumuman). */
export type Status = 'pending' | 'lulus' | 'cadangan' | 'tidak_lulus';
export const STATUSES: Status[] = ['pending', 'lulus', 'cadangan', 'tidak_lulus'];

/**
 * Alur seleksi: Pendaftaran → Seleksi Administrasi → Tes Akademik & Tes IQ →
 * Interview → Pengumuman. Tiga tahap di tengah punya hasil lolos/tidak lolos
 * sendiri yang baru terlihat peserta setelah waktu umumnya (publishAt).
 */
export type StageKey = 'admin' | 'test' | 'interview';
export const STAGES: StageKey[] = ['admin', 'test', 'interview'];
export type StageResult = 'pending' | 'lulus' | 'tidak_lulus';
export const STAGE_RESULTS: StageResult[] = ['pending', 'lulus', 'tidak_lulus'];

/** Pengaturan satu tahap (diatur panitia). */
export type StageSettings = {
  /** Kapan hasil tahap ini terlihat peserta (null = belum dijadwalkan). */
  publishAt: string | null;
  /** Info/jadwal tahap, mis. "Sabtu 10 Jan 2027, 08.00 WIB, di SMP Pribadi Depok". */
  info: Localized;
  /** Pesan untuk yang lolos / tidak lolos tahap ini. */
  pass: Localized;
  fail: Localized;
};

/** Yang dilihat peserta untuk satu tahap. */
export type StageView = {
  key: StageKey;
  publishAt: string | null;
  /** Hasil sudah diumumkan (publishAt sudah lewat). */
  released: boolean;
  /** Hasil (hanya bila released). */
  result: StageResult | null;
  info: Localized;
  /** Pesan lolos/tidak lolos (hanya bila released dan sudah ada hasil). */
  message: Localized | null;
};

/** Isian formulir (semua string agar mudah dipakai di <input>). */
export type Profile = {
  level: Level | '';
  fullName: string;
  gender: 'L' | 'P' | '';
  birthPlace: string;
  birthDate: string; // yyyy-mm-dd
  nisn: string;
  province: string;
  regency: string;
  district: string;
  address: string;
  originSchool: string;
  originClass: string;
  parentName: string;
  parentRelation: 'ayah' | 'ibu' | 'wali' | '';
  parentPhone: string;
  parentEmail: string;
  parentJob: string;
  incomeBand: 'lt1' | '1to3' | '3to5' | 'gt5' | '';
  siblings: string;
  achievements: string;
  motivation: string;
};

/** Berkas kelengkapan (PDF) di Storage. */
export type DocumentInfo = { size: number; uploadedAt: string };

export type Applicant = Profile & {
  /** Hanya untuk admin: id akun (lokasi berkas), info berkas. */
  userId?: string;
  document?: DocumentInfo | null;
  id: string;
  /** Email akun Google yang dipakai mendaftar. */
  email: string;
  lang: Lang;
  status: Status;
  createdAt: string;
  updatedAt: string;
  /** Hanya untuk admin: hasil tiap tahap. */
  stages?: Record<StageKey, StageResult>;
};

export type Localized = { id: string; en: string };

export type PublicSettings = {
  now: string;
  regOpen: boolean;
  regDeadline: string | null;
  announceAt: string | null;
  released: boolean;
  title: Localized | null;
  body: Localized | null;
};

/** Akun Google yang sedang masuk. */
export type AuthUser = { email: string; name: string | null };

export type Me = {
  /** null = sudah masuk tapi belum mengisi data. */
  applicant: Applicant | null;
  canEdit: boolean;
  released: boolean;
  announceAt: string | null;
  regDeadline: string | null;
  now: string;
  title: Localized | null;
  body: Localized | null;
  resultMessage: Localized | null;
  /** Berkas kelengkapan milik sendiri (null = belum diunggah). */
  document: DocumentInfo | null;
  /** Tahap Seleksi Administrasi, Tes, Interview (urut). */
  stages: StageView[];
};

export type AdminSettings = {
  regOpen: boolean;
  regDeadline: string | null;
  announceAt: string | null;
  title: Localized;
  body: Localized;
  resultMessages: Partial<Record<Exclude<Status, 'pending'>, Localized>>;
  stages: Record<StageKey, StageSettings>;
};

const blank = (): Localized => ({ id: '', en: '' });
export const emptyStageSettings = (): StageSettings => ({ publishAt: null, info: blank(), pass: blank(), fail: blank() });
export const emptyStages = (): Record<StageKey, StageSettings> =>
  ({ admin: emptyStageSettings(), test: emptyStageSettings(), interview: emptyStageSettings() });

/** Kesalahan yang bisa ditampilkan ke pengguna. `code` dipetakan ke teks di i18n. */
export class AppError extends Error {
  code: string;
  field?: string;
  constructor(code: string, field?: string) {
    super(code);
    this.code = code;
    this.field = field;
  }
}

export const emptyProfile = (): Profile => ({
  level: '', fullName: '', gender: '', birthPlace: '', birthDate: '', nisn: '',
  province: 'Jawa Barat', regency: '', district: '', address: '', originSchool: '', originClass: '',
  parentName: '', parentRelation: '', parentPhone: '', parentEmail: '', parentJob: '',
  incomeBand: '', siblings: '', achievements: '', motivation: '',
});
