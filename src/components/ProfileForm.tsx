import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, FileText, Save } from 'lucide-react';
import { useI18n, type TKey } from '../lib/i18n';
import type { Profile } from '../lib/types';
import { CLASS_FOR_LEVEL, maxBirthDate, PROVINCE, validateProfile } from '../lib/validate';
import { checkPdf } from '../lib/document';
import { loadDraft, saveDraft } from '../lib/draft';
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls } from './ui';
import { DocChecklist, PdfPicker } from './DocumentPanel';

type Props = {
  initial: Profile;
  submitLabel: string;
  busyLabel: string;
  withConsent?: boolean;
  /** Pendaftaran baru: minta berkas PDF kelengkapan sekaligus. */
  withDocument?: boolean;
  /** Tampilkan per langkah (1–5) dengan penanda kemajuan. */
  stepped?: boolean;
  /** Simpan isian otomatis di perangkat ini dengan kunci ini (null = tidak). */
  draftKey?: string | null;
  serverError?: string | null;
  serverField?: string | null;
  onSubmit: (p: Profile, document: File | null) => Promise<void>;
  onCancel?: () => void;
};

/** Langkah formulir dan isian di tiap langkah (berkas + persetujuan ada di langkah terakhir). */
const STEPS: { title: TKey; fields: (keyof Profile)[] }[] = [
  { title: 'sec.child', fields: ['level', 'fullName', 'gender', 'birthPlace', 'birthDate', 'nisn'] },
  { title: 'sec.origin', fields: ['province', 'regency', 'district', 'address'] },
  { title: 'sec.school', fields: ['originSchool', 'originClass'] },
  { title: 'sec.parent', fields: ['parentName', 'parentRelation', 'parentPhone', 'parentEmail', 'parentJob'] },
  { title: 'sec.extra', fields: ['incomeBand', 'siblings', 'achievements', 'motivation'] },
];
const LAST = STEPS.length - 1;

export function ProfileForm({
  initial, submitLabel, busyLabel, withConsent, withDocument, stepped, draftKey,
  serverError, serverField, onSubmit, onCancel,
}: Props) {
  const { t } = useI18n();
  const [draft] = useState(() => (draftKey ? loadDraft(draftKey) : null));
  const [p, setP] = useState<Profile>(() => ({ ...initial, ...(draft?.profile ?? {}), province: PROVINCE }));
  const [step, setStep] = useState(() => (stepped ? Math.min(draft?.step ?? 0, LAST) : 0));
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(!withConsent);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Simpan draf otomatis (berkas PDF tidak ikut disimpan).
  useEffect(() => {
    if (!draftKey) return;
    const h = setTimeout(() => saveDraft(draftKey, { profile: p, step }), 400);
    return () => clearTimeout(h);
  }, [draftKey, p, step]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  // Database melaporkan nama kolom snake_case (origin_class) → kunci formulir camelCase (originClass).
  const serverKey = serverField?.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const errs = new Set([...bad, ...(serverKey ? [serverKey] : [])]);

  // Kesalahan dari server pada isian di langkah lain: pindah ke langkah itu.
  useEffect(() => {
    if (!stepped || !serverKey) return;
    const i = STEPS.findIndex((s) => s.fields.includes(serverKey as keyof Profile));
    if (i >= 0) setStep(i);
  }, [stepped, serverKey]);

  const msg = (k: keyof Profile): string | undefined => {
    if (!errs.has(k)) return undefined;
    const text = t(`err.${k}` as TKey);
    if (text) return text;
    return p[k] === '' ? t('err.required') : t('err.generic');
  };
  const common = (k: keyof Profile) => ({
    id: k as string,
    'aria-invalid': errs.has(k) ? (true as const) : undefined,
    'aria-describedby': errs.has(k) ? `${k}-err` : undefined,
  });

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      el?.scrollIntoView({ block: 'center' });
    });
  };
  const goTo = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  function next() {
    const found = new Set<string>(validateProfile(p).filter((k) => STEPS[step].fields.includes(k)));
    setBad(found);
    if (found.size) { focusFirstError(); return; }
    goTo(step + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (stepped && step < LAST) { next(); return; }
    const found = new Set<string>(validateProfile(p));
    if (!consent) found.add('consent');
    if (withDocument) {
      const problem = doc ? await checkPdf(doc) : 'MISSING';
      setDocError(problem === 'MISSING' ? t('err.document') : problem ? t(`e.${problem}` as TKey) : null);
      if (problem) found.add('document');
    }
    setBad(found);
    if (found.size) {
      // Ada isian salah di langkah sebelumnya: kembali ke langkah itu.
      const earlier = stepped ? STEPS.findIndex((s) => s.fields.some((f) => found.has(f))) : -1;
      if (earlier >= 0 && earlier < LAST) setStep(earlier);
      focusFirstError();
      return;
    }
    setBusy(true);
    try { await onSubmit(p, doc); } finally { setBusy(false); }
  }

  const text = (k: keyof Profile, label: TKey, opts: { type?: string; hint?: TKey; optional?: boolean; mode?: 'numeric' | 'tel' | 'email'; auto?: string } = {}) => (
    <Field id={k} label={t(label)} hint={opts.hint && t(opts.hint)} optional={opts.optional} error={msg(k)}>
      <input
        {...common(k)} type={opts.type ?? 'text'} inputMode={opts.mode} autoComplete={opts.auto ?? 'off'}
        value={p[k]} onChange={(e) => set(k, e.target.value as never)} className={inputCls}
      />
    </Field>
  );

  const select = (k: keyof Profile, label: TKey, options: { v: string; l: string }[], optional?: boolean, hint?: TKey) => (
    <Field id={k} label={t(label)} optional={optional} hint={hint && t(hint)} error={msg(k)}>
      <select {...common(k)} value={p[k]} onChange={(e) => set(k, e.target.value as never)} className={inputCls}>
        <option value="">{t('common.choose')}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </Field>
  );

  const area = (k: keyof Profile, label: TKey, hint: TKey | null, rows: number, optional?: boolean) => (
    <Field id={k} label={t(label)} hint={hint ? t(hint) : undefined} optional={optional} error={msg(k)}>
      <textarea {...common(k)} rows={rows} value={p[k]} onChange={(e) => set(k, e.target.value as never)} className={`${inputCls} py-2`} />
    </Field>
  );

  const sections: ReactNode[] = [
    <>
      <Field id="level" label={t('f.level')} error={msg('level')}>
        <select {...common('level')} value={p.level} className={inputCls}
          onChange={(e) => {
            const level = e.target.value as Profile['level'];
            // Kelas saat ini mengikuti jenjang: SMP ← kelas 6, SMA ← kelas 9.
            setP((x) => ({ ...x, level, originClass: level ? CLASS_FOR_LEVEL[level] : '' }));
          }}>
          <option value="">{t('common.choose')}</option>
          <option value="smp">{t('level.smp')}</option>
          <option value="sma">{t('level.sma')}</option>
        </select>
      </Field>
      {text('fullName', 'f.fullName', { auto: 'off' })}
      {select('gender', 'f.gender', [{ v: 'L', l: t('gender.L') }, { v: 'P', l: t('gender.P') }])}
      {text('birthPlace', 'f.birthPlace')}
      <Field id="birthDate" label={t('f.birthDate')} error={msg('birthDate')}>
        <input {...common('birthDate')} type="date" min="1995-01-01" max={maxBirthDate()} value={p.birthDate}
          onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
      </Field>
      {text('nisn', 'f.nisn', { hint: 'h.nisn', mode: 'numeric' })}
    </>,
    <>
      <Field id="province" label={t('f.province')} hint={t('h.province')} error={msg('province')}>
        <select {...common('province')} value={PROVINCE} onChange={() => set('province', PROVINCE)} className={inputCls}>
          <option value={PROVINCE}>{PROVINCE}</option>
        </select>
      </Field>
      {text('regency', 'f.regency')}
      {text('district', 'f.district')}
      {area('address', 'f.address', null, 2)}
    </>,
    <>
      {text('originSchool', 'f.originSchool')}
      {select('originClass', 'f.originClass', [{ v: '6', l: t('class.6') }, { v: '9', l: t('class.9') }], false, 'h.originClass')}
    </>,
    <>
      {text('parentName', 'f.parentName', { auto: 'name' })}
      {select('parentRelation', 'f.parentRelation', [{ v: 'ayah', l: t('rel.ayah') }, { v: 'ibu', l: t('rel.ibu') }, { v: 'wali', l: t('rel.wali') }])}
      {text('parentPhone', 'f.parentPhone', { type: 'tel', mode: 'tel', hint: 'h.parentPhone', auto: 'tel' })}
      {text('parentEmail', 'f.parentEmail', { type: 'email', mode: 'email', auto: 'email' })}
      {text('parentJob', 'f.parentJob')}
    </>,
    <>
      {select('incomeBand', 'f.incomeBand', ['lt1', '1to3', '3to5', 'gt5'].map((v) => ({ v, l: t(`income.${v}` as TKey) })), true)}
      {text('siblings', 'f.siblings', { optional: true, mode: 'numeric' })}
      {area('achievements', 'f.achievements', 'h.achievements', 3)}
      {area('motivation', 'f.motivation', 'h.motivation', 5)}
    </>,
  ];

  const visible = stepped ? [step] : STEPS.map((_, i) => i);
  const onLast = !stepped || step === LAST;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="scroll-mt-4 space-y-4">
      {withDocument && step === 0 && (
        <div className="flex gap-3 rounded-sm border border-action bg-action-tint p-4">
          <FileText size={22} className="mt-0.5 shrink-0 text-action" aria-hidden />
          <div className="text-sm text-foreground">
            <p className="font-bold">{t('prep.title')}</p>
            <p>{t('prep.body')}</p>
          </div>
        </div>
      )}

      {stepped && (
        <div className="rounded-lg bg-surface p-4 shadow-e2">
          <p className="text-sm font-semibold text-action">{t('step.of', { n: step + 1, total: STEPS.length })}</p>
          <p className="text-lg font-bold text-foreground">{t(STEPS[step].title)}</p>
          <ol className="mt-3 grid grid-cols-5 gap-1.5" aria-label={t('step.progress')}>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button type="button" disabled={i >= step} onClick={() => goTo(i)}
                  aria-label={`${i + 1}. ${t(s.title)}`} aria-current={i === step ? 'step' : undefined}
                  className={`block h-2 w-full rounded-full ${i < step ? 'bg-action' : i === step ? 'bg-gradient-end' : 'bg-surface-muted'}`} />
              </li>
            ))}
          </ol>
          {draftKey && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Save size={14} aria-hidden /> {t('draft.auto')}
            </p>
          )}
        </div>
      )}

      {draft && stepped && (
        <p role="status" className="text-sm text-muted-foreground">{t('draft.restored')}</p>
      )}

      {visible.map((i) => (
        <Card key={STEPS[i].title} className="space-y-4">
          {!stepped && <h2 className="text-lg font-bold">{t(STEPS[i].title)}</h2>}
          {sections[i]}
        </Card>
      ))}

      {onLast && withDocument && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('doc.title')}</h2>
          <DocChecklist />
          <PdfPicker id="document" file={doc} invalid={!!docError} onFile={(f) => { setDoc(f); setDocError(null); }} />
          {docError && <p id="document-err" role="alert" className="text-sm font-medium text-destructive">{docError}</p>}
        </Card>
      )}

      {onLast && withConsent && (
        <div>
          <label className="flex items-start gap-3 rounded-md bg-surface p-4 shadow-e2">
            <input
              type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={bad.has('consent') && !consent ? true : undefined}
              className="mt-0.5 size-6 shrink-0 accent-action"
            />
            <span className="text-base text-foreground">{t('consent.text')}</span>
          </label>
          {bad.has('consent') && !consent && <p role="alert" className="mt-1 text-sm font-medium text-destructive">{t('consent.err')}</p>}
        </div>
      )}

      {bad.size > 0 && <ErrorBox>{t('err.fix')}</ErrorBox>}
      {serverError && <ErrorBox>{serverError}</ErrorBox>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {stepped && step > 0 && (
          <button type="button" onClick={() => { setBad(new Set()); goTo(step - 1); }} className={`${btnSecondary} sm:w-40`}>
            <ChevronLeft size={18} aria-hidden /> {t('step.back')}
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btnSecondary} text-foreground sm:w-40`}>
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" disabled={busy} className={`${btnPrimary} sm:flex-1`}>
          {onLast ? (busy ? busyLabel : submitLabel) : <>{t('step.next')} <ChevronRight size={18} aria-hidden /></>}
        </button>
      </div>
    </form>
  );
}
