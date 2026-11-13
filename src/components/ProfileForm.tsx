import { useRef, useState, type FormEvent } from 'react';
import { useI18n, type TKey } from '../lib/i18n';
import type { Profile } from '../lib/types';
import { CLASS_FOR_LEVEL, maxBirthDate, PROVINCE, validateProfile } from '../lib/validate';
import { btnPrimary, Card, ErrorBox, Field, inputCls } from './ui';
import { checkPdf } from '../lib/document';
import { DocChecklist, PdfPicker } from './DocumentPanel';

type Props = {
  initial: Profile;
  submitLabel: string;
  busyLabel: string;
  withConsent?: boolean;
  /** Pendaftaran baru: minta berkas PDF kelengkapan sekaligus. */
  withDocument?: boolean;
  serverError?: string | null;
  serverField?: string | null;
  onSubmit: (p: Profile, document: File | null) => Promise<void>;
  onCancel?: () => void;
};

export function ProfileForm({ initial, submitLabel, busyLabel, withConsent, withDocument, serverError, serverField, onSubmit, onCancel }: Props) {
  const { t } = useI18n();
  const [p, setP] = useState<Profile>({ ...initial, province: PROVINCE });
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(!withConsent);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  // Database melaporkan nama kolom snake_case (origin_class) → kunci formulir camelCase (originClass).
  const serverKey = serverField?.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const errs = new Set([...bad, ...(serverKey ? [serverKey] : [])]);

  const msg = (k: keyof Profile): string | undefined => {
    if (!errs.has(k)) return undefined;
    const specific = `err.${k}` as TKey;
    const text = t(specific);
    if (text) return text;
    return p[k] === '' ? t('err.required') : t('err.generic');
  };
  const common = (k: keyof Profile) => ({
    id: k as string,
    'aria-invalid': errs.has(k) ? (true as const) : undefined,
    'aria-describedby': errs.has(k) ? `${k}-err` : undefined,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = new Set<string>(validateProfile(p));
    if (!consent) found.add('consent');
    if (withDocument) {
      const problem = doc ? await checkPdf(doc) : 'MISSING';
      setDocError(problem === 'MISSING' ? t('err.document') : problem ? t(`e.${problem}` as TKey) : null);
      if (problem) found.add('document');
    }
    setBad(found);
    if (found.size) {
      const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      queueMicrotask(() => {
        const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? first;
        el?.focus();
        el?.scrollIntoView({ block: 'center' });
      });
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

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.child')}</h2>
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
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.origin')}</h2>
        <Field id="province" label={t('f.province')} hint={t('h.province')} error={msg('province')}>
          <select {...common('province')} value={PROVINCE} onChange={() => set('province', PROVINCE)} className={inputCls}>
            <option value={PROVINCE}>{PROVINCE}</option>
          </select>
        </Field>
        {text('regency', 'f.regency')}
        {text('district', 'f.district')}
        {area('address', 'f.address', null, 2)}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.school')}</h2>
        {text('originSchool', 'f.originSchool')}
        {select('originClass', 'f.originClass', [{ v: '6', l: t('class.6') }, { v: '9', l: t('class.9') }], false, 'h.originClass')}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.parent')}</h2>
        {text('parentName', 'f.parentName', { auto: 'name' })}
        {select('parentRelation', 'f.parentRelation', [{ v: 'ayah', l: t('rel.ayah') }, { v: 'ibu', l: t('rel.ibu') }, { v: 'wali', l: t('rel.wali') }])}
        {text('parentPhone', 'f.parentPhone', { type: 'tel', mode: 'tel', hint: 'h.parentPhone', auto: 'tel' })}
        {text('parentEmail', 'f.parentEmail', { type: 'email', mode: 'email', auto: 'email' })}
        {text('parentJob', 'f.parentJob')}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.extra')}</h2>
        {select('incomeBand', 'f.incomeBand', ['lt1', '1to3', '3to5', 'gt5'].map((v) => ({ v, l: t(`income.${v}` as TKey) })), true)}
        {text('siblings', 'f.siblings', { optional: true, mode: 'numeric' })}
        {area('achievements', 'f.achievements', 'h.achievements', 3)}
        {area('motivation', 'f.motivation', 'h.motivation', 5)}
      </Card>

      {withDocument && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">{t('doc.title')}</h2>
          <DocChecklist />
          <PdfPicker id="document" file={doc} invalid={!!docError} onFile={(f) => { setDoc(f); setDocError(null); }} />
          {docError && <p id="document-err" role="alert" className="text-sm font-medium text-destructive">{docError}</p>}
        </Card>
      )}

      {withConsent && (
        <div>
          <label className="flex items-start gap-3 rounded-md border border-border bg-surface p-4">
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={busy} className={`${btnPrimary} sm:flex-1`}>{busy ? busyLabel : submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-12 rounded-md border border-border-strong px-5 font-semibold text-foreground">
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
