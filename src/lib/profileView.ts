import type { TKey } from './i18n';
import { formatDateOnly } from './time';
import type { Applicant, Lang } from './types';

type T = (k: TKey, v?: Record<string, string | number>) => string;
export type Group = { title: TKey; rows: [TKey, string][] };

/** Data pendaftar dikelompokkan seperti bagian formulir. */
export function profileGroups(a: Applicant, t: T, lang: Lang): Group[] {
  const none = t('common.none');
  return [
    { title: 'sec.child', rows: [
      ['f.level', t(`level.${a.level}` as TKey)], ['f.fullName', a.fullName], ['f.gender', t(`gender.${a.gender}` as TKey)],
      ['f.birthPlace', a.birthPlace], ['f.birthDate', formatDateOnly(a.birthDate, lang)], ['f.nisn', a.nisn || none],
    ] },
    { title: 'sec.origin', rows: [
      ['f.province', a.province], ['f.regency', a.regency], ['f.district', a.district], ['f.address', a.address],
    ] },
    { title: 'sec.school', rows: [['f.originSchool', a.originSchool], ['f.originClass', classLabel(a.originClass, t)]] },
    { title: 'sec.parent', rows: [
      ['f.parentName', a.parentName], ['f.parentRelation', t(`rel.${a.parentRelation}` as TKey)],
      ['f.parentPhone', '+' + a.parentPhone], ['f.parentEmail', a.parentEmail || none], ['f.parentJob', a.parentJob],
    ] },
    { title: 'sec.extra', rows: [
      ['f.incomeBand', a.incomeBand ? t(`income.${a.incomeBand}` as TKey) : none], ['f.siblings', a.siblings || none],
      ['f.achievements', a.achievements || none], ['f.motivation', a.motivation],
    ] },
  ];
}

/** "6" → "Kelas 6 SD" / "Grade 6 (SD)". */
export function classLabel(c: string, t: T): string {
  return c === '6' || c === '9' ? t(`class.${c}` as TKey) : c;
}

/**
 * Persentase kelengkapan: 19 isian wajib (selalu terisi), berkas PDF (wajib,
 * bisa menyusul), serta penghasilan dan saudara kandung (opsional).
 */
export function completeness(a: Applicant, hasDocument: boolean): number {
  const optional = [a.incomeBand, a.siblings];
  const required = 19;
  const filled = required + (hasDocument ? 1 : 0) + optional.filter((v) => String(v ?? '').trim() !== '').length;
  return Math.round((filled / (required + 1 + optional.length)) * 100);
}
