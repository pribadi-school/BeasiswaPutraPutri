import type { Applicant } from './types';

/** Sel yang diawali = + - @ bisa dijalankan sebagai rumus di Excel: beri tanda petik di depan. */
const cell = (v: unknown): string => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

const COLS: [string, (a: Applicant) => unknown][] = [
  ['Username', (a) => a.username], ['Status', (a) => a.status], ['Terdaftar', (a) => a.createdAt],
  ['Jenjang', (a) => a.level.toUpperCase()], ['Nama anak', (a) => a.fullName], ['L/P', (a) => a.gender],
  ['Tempat lahir', (a) => a.birthPlace], ['Tanggal lahir', (a) => a.birthDate], ['NISN', (a) => a.nisn],
  ['Provinsi', (a) => a.province], ['Kab/Kota', (a) => a.regency], ['Kecamatan', (a) => a.district], ['Alamat', (a) => a.address],
  ['Sekolah asal', (a) => a.originSchool], ['Kelas', (a) => a.originClass],
  ['Orang tua/wali', (a) => a.parentName], ['Hubungan', (a) => a.parentRelation], ['HP', (a) => a.parentPhone],
  ['Email', (a) => a.parentEmail], ['Pekerjaan', (a) => a.parentJob], ['Penghasilan', (a) => a.incomeBand],
  ['Saudara', (a) => a.siblings], ['Prestasi', (a) => a.achievements], ['Motivasi', (a) => a.motivation],
];

/** CSV dengan BOM agar Excel membaca UTF-8, tanpa PIN apa pun. */
export function applicantsCsv(list: Applicant[]): string {
  const head = COLS.map(([h]) => cell(h)).join(',');
  const rows = list.map((a) => COLS.map(([, f]) => cell(f(a))).join(','));
  return '﻿' + [head, ...rows].join('\r\n');
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
