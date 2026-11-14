/**
 * Aturan isian pendaftaran — SATU sumber untuk browser dan server.
 * Browser memakainya untuk pesan cepat; server (server/) memakainya sebagai
 * penjaga sebenarnya sebelum menyimpan ke MySQL. Mode demo juga memakainya.
 */
import { emptyProfile } from './types.js';
const LIMITS = {
    fullName: 120, birthPlace: 80, province: 60, regency: 80, district: 80, address: 300,
    originSchool: 120, originClass: 2, parentName: 120, parentJob: 80, motivation: 1500,
    achievements: 1000, parentEmail: 120,
};
/** Semua isian wajib, kecuali penghasilan dan jumlah saudara kandung. */
const REQUIRED_TEXT = [
    'fullName', 'birthPlace', 'province', 'regency', 'district', 'address',
    'originSchool', 'originClass', 'parentName', 'parentJob', 'achievements', 'motivation',
];
/** Program ini hanya untuk Jawa Barat. */
export const PROVINCE = 'Jawa Barat';
/** Kelas saat ini yang boleh mendaftar, sesuai jenjang tujuan. */
export const CLASS_FOR_LEVEL = { smp: '6', sma: '9' };
const GENDERS = ['L', 'P'];
const RELATIONS = ['ayah', 'ibu', 'wali'];
const INCOME = ['lt1', '1to3', '3to5', 'gt5'];
/** 08…, 62… atau +62… → "62…". Mengembalikan null bila tidak valid. */
export function normalizePhone(raw) {
    const s = raw.replace(/[\s\-().]/g, '');
    if (!/^(\+?62|0)[0-9]{8,13}$/.test(s))
        return null;
    return '62' + s.replace(/^(\+?62|0)/, '');
}
export function maxBirthDate(now = Date.now()) {
    return new Date(now - 3 * 365 * 86400_000).toISOString().slice(0, 10);
}
const isRealDate = (ymd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd))
        return false;
    const d = new Date(ymd + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
};
/** Daftar nama kolom yang tidak valid (kosong = lolos). */
export function validateProfile(p) {
    const bad = [];
    for (const k of REQUIRED_TEXT) {
        const v = p[k].trim();
        if (!v || v.length > (LIMITS[k] ?? 200))
            bad.push(k);
    }
    if (p.level !== 'smp' && p.level !== 'sma')
        bad.push('level');
    if (!GENDERS.includes(p.gender))
        bad.push('gender');
    if (!RELATIONS.includes(p.parentRelation))
        bad.push('parentRelation');
    if (!isRealDate(p.birthDate) || p.birthDate < '1995-01-01' || p.birthDate > maxBirthDate())
        bad.push('birthDate');
    if (!normalizePhone(p.parentPhone))
        bad.push('parentPhone');
    if (p.province.trim() && p.province.trim() !== PROVINCE)
        bad.push('province');
    if (p.originClass && (!p.level || p.originClass !== CLASS_FOR_LEVEL[p.level]))
        bad.push('originClass');
    if (!/^\d{10}$/.test(p.nisn.trim()))
        bad.push('nisn');
    const email = p.parentEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120)
        bad.push('parentEmail');
    if (p.incomeBand && !INCOME.includes(p.incomeBand))
        bad.push('incomeBand');
    const sib = p.siblings.trim();
    if (sib && (!/^\d{1,2}$/.test(sib) || Number(sib) > 20))
        bad.push('siblings');
    return [...new Set(bad)];
}
/**
 * Dari JSON apa pun (mis. kiriman browser) → Profile berisi string saja.
 * Kolom yang tidak dikenal diabaikan; kolom yang bukan teks dianggap kosong.
 */
export function coerceProfile(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = emptyProfile();
    for (const k of Object.keys(out)) {
        const v = src[k];
        out[k] = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
    }
    return out;
}
/** Profile yang sudah lolos validateProfile → nilai rapi untuk disimpan. */
export function cleanProfile(p) {
    // Karakter kontrol (tab, baris baru di isian satu baris, dll.) diganti spasi.
    const t = (s) => s.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
    return {
        level: p.level, gender: p.gender, parentRelation: p.parentRelation, incomeBand: p.incomeBand,
        birthDate: p.birthDate, province: PROVINCE,
        fullName: t(p.fullName), birthPlace: t(p.birthPlace), nisn: p.nisn.trim(),
        regency: t(p.regency), district: t(p.district), address: t(p.address),
        originSchool: t(p.originSchool), originClass: p.originClass,
        parentName: t(p.parentName), parentPhone: normalizePhone(p.parentPhone) ?? '',
        parentEmail: p.parentEmail.trim(), parentJob: t(p.parentJob),
        siblings: p.siblings.trim(), achievements: t(p.achievements), motivation: t(p.motivation),
    };
}
