import type { AdminSettings, Applicant, AuthUser, Lang, Me, Profile, PublicSettings, Status } from '../types';

/** Cara masuk yang tersedia. */
export type AuthConfig = {
  /** Client ID Google (tombol "Masuk dengan Google" resmi). null = tidak tersedia. */
  googleClientId: string | null;
  /** Masuk dengan mengetik email saja — hanya mode demo / uji di komputer. */
  devLogin: boolean;
};
export type SignIn = { credential: string } | { devEmail: string };

/** Antarmuka backend. Dipenuhi oleh httpApi.ts (server Node.js + MySQL) dan demoApi.ts — keduanya harus selalu sama. */
export interface Api {
  mode: 'server' | 'demo';
  getSettings(): Promise<PublicSettings>;

  authConfig(): Promise<AuthConfig>;
  /** Akun yang sedang masuk, atau null. */
  getUser(): Promise<AuthUser | null>;
  /** Masuk dengan token Google (dari tombol Google) atau — uji/demo — email saja. */
  signIn(input: SignIn): Promise<void>;
  /** Keluar (peserta dan admin). */
  signOut(): Promise<void>;

  /** Melempar AppError('UNAUTHORIZED') bila belum masuk. */
  me(): Promise<Me>;
  register(profile: Profile, lang: Lang): Promise<void>;
  updateProfile(profile: Profile): Promise<void>;

  /** Berkas kelengkapan (PDF maks 10 MB). Mengganti berkas lama bila sudah ada. */
  uploadDocument(file: File): Promise<void>;
  /** Alamat untuk membuka berkas sendiri. */
  documentUrl(): Promise<string>;

  /** Admin = akun panitia (email + password). Melempar BAD_LOGIN / LOCKED. */
  adminSignIn(email: string, password: string): Promise<void>;
  isAdmin(): Promise<boolean>;
  adminList(): Promise<Applicant[]>;
  adminGetSettings(): Promise<AdminSettings>;
  adminSaveSettings(s: AdminSettings): Promise<void>;
  adminSetStatus(ids: string[], status: Status): Promise<number>;
  /** Alamat berkas seorang pendaftar (hanya bisa dibuka admin). */
  adminDocumentUrl(a: Applicant): Promise<string>;
  /** Menghapus pendaftar beserta berkasnya. */
  adminDelete(a: Applicant): Promise<void>;
}
