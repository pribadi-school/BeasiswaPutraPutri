/**
 * Draf formulir pendaftaran, disimpan di perangkat ini (localStorage) agar isian
 * tidak hilang bila tab tertutup atau sinyal putus. Berkas PDF tidak disimpan.
 *
 * Privasi: draf berisi data anak, jadi dihapus begitu pendaftaran terkirim dan
 * setiap kali pengguna menekan Keluar (penting di HP yang dipakai bersama).
 */
import type { Profile } from './types';

const PREFIX = 'bpd-draft:';
export type Draft = { profile: Partial<Profile>; step: number };

export const draftKeyFor = (email: string) => PREFIX + email.toLowerCase();

export function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d !== 'object' || !d.profile) return null;
    // Draf kosong (belum ada isian selain provinsi bawaan) tidak dianggap draf.
    const filled = Object.entries(d.profile).some(([k, v]) => k !== 'province' && String(v ?? '').trim() !== '');
    return filled ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, d: Draft) {
  try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* penyimpanan penuh/diblokir: abaikan */ }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* abaikan */ }
}

/** Hapus semua draf di perangkat ini (dipanggil saat Keluar). */
export function clearAllDrafts() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* abaikan */ }
}
