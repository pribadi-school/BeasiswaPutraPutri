import { useRef, useState, type FormEvent } from 'react';
import { PROVINCES, useI18n, type TKey } from '../lib/i18n';
import type { Profile } from '../lib/types';
import { maxBirthDate, validateProfile } from '../lib/validate';
import { btnPrimary, Card, ErrorBox, Field, inputCls } from './ui';

type Props = {
  initial: Profile;
  submitLabel: string;
  busyLabel: string;
  withConsent?: boolean;
  serverError?: string | null;
  serverField?: string | null;
  onSubmit: (p: Profile) => Promise<void>;
  onCancel?: () => void;
};

export function ProfileForm({ initial, submitLabel, busyLabel, withConsent, serverError, serverField, onSubmit, onCancel }: Props) {
  const { t } = useI18n();
  const [p, setP] = useState<Profile>(initial);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(!withConsent);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const errs = new Set([...bad, ...(serverField ? [serverField] : [])]);

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
    try { await onSubmit(p); } finally { setBusy(false); }
  }

  const text = (k: keyof Profile, label: TKey, opts: { type?: string; hint?: TKey; optional?: boolean; mode?: 'numeric' | 'tel' | 'email'; auto?: string } = {}) => (
    <Field id={k} label={t(label)} hint={opts.hint && t(opts.hint)} optional={opts.optional} error={msg(k)}>
      <input
        {...common(k)} type={opts.type ?? 'text'} inputMode={opts.mode} autoComplete={opts.auto ?? 'off'}
        value={p[k]} onChange={(e) => set(k, e.target.value as never)} className={inputCls}
      />
    </Field>
  );

  const select = (k: keyof Profile, label: TKey, options: { v: string; l: string }[], optional?: boolean) => (
    <Field id={k} label={t(label)} optional={optional} error={msg(k)}>
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
        {select('level', 'f.level', [{ v: 'sd', l: t('level.sd') }, { v: 'smp', l: t('level.smp') }, { v: 'sma', l: t('level.sma') }])}
        {text('fullName', 'f.fullName', { auto: 'off' })}
        {select('gender', 'f.gender', [{ v: 'L', l: t('gender.L') }, { v: 'P', l: t('gender.P') }])}
        {text('birthPlace', 'f.birthPlace')}
        <Field id="birthDate" label={t('f.birthDate')} error={msg('birthDate')}>
          <input {...common('birthDate')} type="date" min="1995-01-01" max={maxBirthDate()} value={p.birthDate}
            onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
        </Field>
        {text('nisn', 'f.nisn', { hint: 'h.nisn', optional: true, mode: 'numeric' })}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.origin')}</h2>
        {select('province', 'f.province', PROVINCES.map((x) => ({ v: x, l: x })))}
        {text('regency', 'f.regency')}
        {text('district', 'f.district')}
        {area('address', 'f.address', null, 2)}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.school')}</h2>
        {text('originSchool', 'f.originSchool')}
        {text('originClass', 'f.originClass', { hint: 'h.originClass' })}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.parent')}</h2>
        {text('parentName', 'f.parentName', { auto: 'name' })}
        {select('parentRelation', 'f.parentRelation', [{ v: 'ayah', l: t('rel.ayah') }, { v: 'ibu', l: t('rel.ibu') }, { v: 'wali', l: t('rel.wali') }])}
        {text('parentPhone', 'f.parentPhone', { type: 'tel', mode: 'tel', hint: 'h.parentPhone', auto: 'tel' })}
        {text('parentEmail', 'f.parentEmail', { type: 'email', mode: 'email', optional: true, auto: 'email' })}
        {text('parentJob', 'f.parentJob')}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('sec.extra')}</h2>
        {select('incomeBand', 'f.incomeBand', ['lt1', '1to3', '3to5', 'gt5'].map((v) => ({ v, l: t(`income.${v}` as TKey) })), true)}
        {text('siblings', 'f.siblings', { optional: true, mode: 'numeric' })}
        {area('achievements', 'f.achievements', 'h.achievements', 3, true)}
        {area('motivation', 'f.motivation', 'h.motivation', 5)}
      </Card>

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
