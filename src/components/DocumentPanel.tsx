import { useRef, useState } from 'react';
import { CheckCircle2, FileText, FileWarning, Upload } from 'lucide-react';
import { checkPdf, formatSize } from '../lib/document';
import { useI18n, type TKey } from '../lib/i18n';
import { formatWib } from '../lib/time';
import { AppError, type DocumentInfo } from '../lib/types';
import { btnPill, btnSecondary, ErrorBox, useErrorText } from './ui';

export const DOC_ITEMS: TKey[] = ['doc.item.ktp', 'doc.item.kk', 'doc.item.rapor', 'doc.item.cert'];

/**
 * Membuka tautan sementara di tab baru. Tab dibuka lebih dulu (sinkron, saat
 * diklik) agar tidak diblokir pemblokir pop-up, lalu diarahkan ke tautannya.
 */
export async function openInNewTab(getUrl: () => Promise<string>): Promise<void> {
  const w = window.open('', '_blank');
  try {
    const url = await getUrl();
    if (w) w.location.href = url; else window.location.href = url;
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Daftar isi PDF yang diminta. */
export function DocChecklist() {
  const { t } = useI18n();
  return (
    <div className="space-y-2 text-sm">
      <p className="text-foreground">{t('doc.lead')}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {DOC_ITEMS.map((k) => (
          <li key={k} className="flex items-center gap-2 text-foreground">
            <CheckCircle2 size={16} className="shrink-0 text-action" aria-hidden /> {t(k)}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">{t('doc.tip')}</p>
    </div>
  );
}

/** Kotak pilih file PDF (dipakai di formulir pendaftaran dan panel berkas). */
export function PdfPicker({ id, file, onFile, invalid, label }: {
  id: string; file: File | null; onFile: (f: File | null) => void; invalid?: boolean; label?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} id={id} type="file" accept="application/pdf,.pdf" className="sr-only"
        aria-invalid={invalid || undefined} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <label htmlFor={id}
        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-sm border-2 border-dashed px-4 py-3 ${invalid ? 'border-destructive bg-destructive-tint' : 'border-border-strong bg-surface-portal hover:bg-action-tint'}`}>
        <Upload size={22} className="shrink-0 text-action" aria-hidden />
        <span className="min-w-0 text-sm">
          <span className="block font-semibold text-action">{label ?? t('doc.choose')}</span>
          {file && <span className="block truncate text-foreground">{t('doc.selected', { name: file.name, size: formatSize(file.size) })}</span>}
        </span>
      </label>
    </div>
  );
}

/** Status berkas + lihat + unggah/ganti (halaman Data saya). */
export function DocumentPanel({ doc, canEdit, upload, getUrl }: {
  doc: DocumentInfo | null; canEdit: boolean; upload: (f: File) => Promise<void>; getUrl: () => Promise<string>;
}) {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (!file) return;
    setError(null); setSaved(false);
    const bad = await checkPdf(file);
    if (bad) { setError(t(`e.${bad}` as TKey)); return; }
    setBusy(true);
    try {
      await upload(file);
      setFile(null); setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    setError(null); setOpening(true);
    try { await openInNewTab(getUrl); } catch (e) { setError(e instanceof AppError ? errText(e) : t('e.UNKNOWN')); } finally { setOpening(false); }
  }

  return (
    <section className="space-y-4 rounded-lg bg-surface p-5 shadow-e2" aria-labelledby="doc-title">
      <h2 id="doc-title" className="font-bold text-action">{t('doc.title')}</h2>
      <div className={`flex flex-wrap items-center gap-3 rounded-sm border p-3 ${doc ? 'border-success bg-success-tint' : 'border-accent bg-accent-tint'}`}>
        {doc ? <FileText size={24} className="shrink-0 text-foreground" aria-hidden /> : <FileWarning size={24} className="shrink-0 text-foreground" aria-hidden />}
        <div className="min-w-0 flex-1 basis-48 text-sm font-semibold text-foreground">
          {doc ? t('doc.uploaded', { size: formatSize(doc.size), date: formatWib(doc.uploadedAt, lang) }) : t('doc.none')}
        </div>
        {doc && <button type="button" onClick={() => void view()} disabled={opening} className={`${btnPill} shrink-0`}>{opening ? t('doc.opening') : t('doc.view')}</button>}
      </div>
      <DocChecklist />
      {canEdit ? (
        <div className="space-y-3">
          <PdfPicker id="doc-file" file={file} onFile={(f) => { setFile(f); setSaved(false); setError(null); }} label={doc ? t('doc.replace') : t('doc.choose')} />
          {file && (
            <button type="button" onClick={() => void submit()} disabled={busy} className={`${btnSecondary} w-full sm:w-auto`}>
              <Upload size={18} aria-hidden /> {busy ? t('doc.uploading') : t('doc.upload')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('doc.locked')}</p>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && <div role="status" className="rounded-sm border border-success bg-success-tint p-3 text-sm font-medium text-foreground">{t('doc.saved')}</div>}
    </section>
  );
}
