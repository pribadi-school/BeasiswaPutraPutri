/**
 * Aturan isian — cermin dari private.clean_profile() di database.
 * Database tetap penjaga utamanya; ini untuk pesan kesalahan yang cepat dan
 * dipakai juga oleh mode demo.
 */
import type { Profile } from './types';

const LIMITS: Partial<Record<keyof Profile, number>> = {
  fullName: 120, birthPlace: 80, province: 60, regency: 80, district: 80, address: 300,
  originSchool: 120, originClass: 30, parentName: 120, parentJob: 80, motivation: 1500,
  achievements: 1000, parentEmail: 120,
};

const REQUIRED_TEXT: (keyof Profile)[] = [
  'fullName', 'birthPlace', 'province', 'regency', 'district', 'address',
  'originSchool', 'originClass', 'parentName', 'parentJob', 'motivation',
];

/** 08…, 62… atau +62… → "62…". Mengembalikan null bila tidak valid. */
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, '');
  if (!/^(\+?62|0)[0-9]{8,13}$/.test(s)) return null;
  return '62' + s.replace(/^(\+?62|0)/, '');
}

export function maxBirthDate(): string {
  const d = new Date(Date.now() - 3 * 365 * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Daftar nama kolom yang tidak valid (kosong = lolos). */
export function validateProfile(p: Profile): (keyof Profile)[] {
  const bad: (keyof Profile)[] = [];
  for (const k of REQUIRED_TEXT) {
    const v = p[k].trim();
    if (!v || v.length > (LIMITS[k] ?? 200)) bad.push(k);
  }
  if (!p.level) bad.push('level');
  if (!p.gender) bad.push('gender');
  if (!p.parentRelation) bad.push('parentRelation');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) || p.birthDate < '1995-01-01' || p.birthDate > maxBirthDate()) bad.push('birthDate');
  if (!normalizePhone(p.parentPhone)) bad.push('parentPhone');
  if (p.nisn.trim() && !/^\d{10}$/.test(p.nisn.trim())) bad.push('nisn');
  const email = p.parentEmail.trim();
  if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120)) bad.push('parentEmail');
  if (p.siblings.trim() && !/^\d{1,2}$/.test(p.siblings.trim())) bad.push('siblings');
  if (p.achievements.trim().length > 1000) bad.push('achievements');
  return bad;
}

/** Bentuk yang dikirim ke database (snake_case, sudah dirapikan). */
export function toPayload(p: Profile): Record<string, unknown> {
  return {
    level: p.level, full_name: p.fullName.trim(), gender: p.gender,
    birth_place: p.birthPlace.trim(), birth_date: p.birthDate, nisn: p.nisn.trim(),
    province: p.province.trim(), regency: p.regency.trim(), district: p.district.trim(), address: p.address.trim(),
    origin_school: p.originSchool.trim(), origin_class: p.originClass.trim(),
    parent_name: p.parentName.trim(), parent_relation: p.parentRelation, parent_phone: p.parentPhone.trim(),
    parent_email: p.parentEmail.trim(), parent_job: p.parentJob.trim(),
    income_band: p.incomeBand, siblings: p.siblings.trim(),
    achievements: p.achievements.trim(), motivation: p.motivation.trim(),
  };
}
