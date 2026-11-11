import type { AdminSettings, Applicant, Lang, Me, Profile, PublicSettings, Status, Credentials } from '../types';

/** Antarmuka backend. Dipenuhi oleh supabaseApi.ts dan demoApi.ts — keduanya harus selalu sama. */
export interface Api {
  mode: 'supabase' | 'demo';
  getSettings(): Promise<PublicSettings>;
  register(profile: Profile, lang: Lang): Promise<Credentials>;
  /** Mengembalikan token sesi. Melempar AppError('BAD_LOGIN' | 'LOCKED'). */
  login(username: string, pin: string): Promise<string>;
  logout(token: string): Promise<void>;
  me(token: string): Promise<Me>;
  updateProfile(token: string, profile: Profile): Promise<void>;

  adminLogin(password: string): Promise<string>;
  adminList(token: string): Promise<Applicant[]>;
  adminGetSettings(token: string): Promise<AdminSettings>;
  adminSaveSettings(token: string, s: AdminSettings): Promise<void>;
  adminSetStatus(token: string, ids: string[], status: Status): Promise<number>;
  adminResetPin(token: string, id: string): Promise<Credentials>;
  adminDelete(token: string, id: string): Promise<void>;
}
