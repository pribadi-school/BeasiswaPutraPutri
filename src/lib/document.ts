/** Aturan berkas kelengkapan: satu PDF gabungan, maks 10 MB (sama dengan bucket Storage). */
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

/** Kode kesalahan i18n (`e.NOT_PDF`, `e.TOO_LARGE`) atau null bila lolos. */
export async function checkPdf(file: File): Promise<'NOT_PDF' | 'TOO_LARGE' | null> {
  if (file.size > MAX_DOC_BYTES) return 'TOO_LARGE';
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) return 'NOT_PDF';
  // Isi file harus benar-benar PDF (diawali "%PDF-"), bukan foto yang diganti namanya.
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-' ? null : 'NOT_PDF';
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
