import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n, type TKey } from '../../lib/i18n';
import { fromInputWib, toInputWib } from '../../lib/time';
import { AppError, emptyStages, STAGES, type AdminSettings, type Localized, type StageKey, type StageSettings, type Status } from '../../lib/types';
import { AlertCircle, CheckCircle2, Mail, Send } from 'lucide-react';
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, useErrorText } from '../../components/ui';
import { useAdmin } from './AdminPage';

const RESULT_STATUSES = ['lulus', 'cadangan', 'tidak_lulus'] as const;

function LocalizedInput({ idp, label, value, onChange, rows }: { idp: string; label: string; value: Localized; onChange: (v: Localized) => void; rows?: number }) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-foreground">{label}</legend>
      {(['id', 'en'] as const).map((l) => (
        <Field key={l} id={`${idp}-${l}`} label={t(`set.${l}` as TKey)}>
          {rows ? (
            <textarea id={`${idp}-${l}`} rows={rows} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={`${inputCls} py-2`} />
          ) : (
            <input id={`${idp}-${l}`} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={inputCls} />
          )}
        </Field>
      ))}
    </fieldset>
  );
}

/** Status email pemberitahuan + tombol kirim sekarang. */
function MailPanel() {
  const { t } = useI18n();
  const errText = useErrorText();
  const [st, setSt] = useState<{ configured: boolean; pending: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => api.adminNotifyStatus().then(setSt).catch((e) => setErr(errText(e)));
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setBusy(true); setErr(null); setMsg(null);
    try { const r = await api.adminNotifyRun(); setMsg(t('mail.result', r)); await refresh(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Mail size={20} className="text-action" aria-hidden /> {t('mail.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('mail.lead')}</p>
      {st && (
        <p className={`flex items-center gap-2 text-sm font-semibold ${st.configured ? 'text-foreground' : 'text-accent-text'}`}>
          {st.configured ? <CheckCircle2 size={18} className="text-success" aria-hidden /> : <AlertCircle size={18} aria-hidden />}
          {st.configured ? t('mail.on') : t('mail.off')} {st.configured && t('mail.pending', { n: st.pending })}
        </p>
      )}
      {st?.configured && (
        <button type="button" onClick={() => void run()} disabled={busy || st.pending === 0} className={btnSecondary}>
          <Send size={18} aria-hidden /> {busy ? t('mail.sending') : t('mail.send')}
        </button>
      )}
      {msg && <p role="status" className="text-sm font-medium text-foreground">{msg}</p>}
      {err && <ErrorBox>{err}</ErrorBox>}
    </Card>
  );
}

export function SettingsTab() {
  const { onExpired } = useAdmin();
  const { t } = useI18n();
  const errText = useErrorText();
  const [s, setS] = useState<AdminSettings | null>(null);
  const [deadline, setDeadline] = useState('');
  const [announce, setAnnounce] = useState('');
  const [stageTimes, setStageTimes] = useState<Record<StageKey, string>>({ admin: '', test: '', interview: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminGetSettings().then((r) => {
      const stages = { ...emptyStages(), ...(r.stages ?? {}) };
      setS({ ...r, stages }); setDeadline(toInputWib(r.regDeadline)); setAnnounce(toInputWib(r.announceAt));
      setStageTimes({ admin: toInputWib(stages.admin.publishAt), test: toInputWib(stages.test.publishAt), interview: toInputWib(stages.interview.publishAt) });
    }).catch((e) => { if (e instanceof AppError && e.code === 'UNAUTHORIZED') onExpired(); else setError(errText(e)); });
  }, [onExpired, errText]);

  if (error && !s) return <ErrorBox>{error}</ErrorBox>;
  if (!s) return <p className="text-muted-foreground">{t('common.loading')}</p>;

  const empty: Localized = { id: '', en: '' };
  async function save() {
    if (!s) return;
    setError(null); setSaved(false);
    const regDeadline = fromInputWib(deadline);
    const announceAt = fromInputWib(announce);
    if (announceAt && regDeadline && Date.parse(announceAt) < Date.parse(regDeadline)) { setError(t('set.badAnnounce')); return; }
    const stages = Object.fromEntries(STAGES.map((k) => [k, { ...s.stages[k], publishAt: fromInputWib(stageTimes[k]) }])) as Record<StageKey, StageSettings>;
    // Waktu umum harus urut: Administrasi ≤ Tes ≤ Interview ≤ Pengumuman akhir.
    const times = [...STAGES.map((k) => stages[k].publishAt), announceAt].filter((x): x is string => !!x).map(Date.parse);
    if (times.some((v, i) => i > 0 && v < times[i - 1])) { setError(t('set.badOrder')); return; }
    try {
      await api.adminSaveSettings({ ...s, regDeadline, announceAt, stages });
      setSaved(true);
    } catch (e) {
      if (e instanceof AppError && e.code === 'UNAUTHORIZED') onExpired(); else setError(errText(e));
    }
  }

  const setStage = (k: StageKey, patch: Partial<StageSettings>) => setS({ ...s, stages: { ...s.stages, [k]: { ...s.stages[k], ...patch } } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t('adm.tab.settings')}</h1>
      <MailPanel />
      <Card className="space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.regOpen} onChange={(e) => setS({ ...s, regOpen: e.target.checked })} className="size-6 accent-action" />
          <span className="font-semibold text-foreground">{t('set.regOpen')}</span>
        </label>
        <Field id="deadline" label={t('set.regDeadline')}>
          <input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('set.stages')}</h2>
        <p className="text-sm text-muted-foreground">{t('set.stagesLead')}</p>
        {STAGES.map((k, i) => (
          <Card key={k} className="space-y-4">
            <h3 className="text-lg font-bold text-action">{i + 2}. {t(`stage.${k}` as TKey)}</h3>
            <Field id={`stage-${k}-at`} label={t('set.stagePublish')}>
              <input id={`stage-${k}-at`} type="datetime-local" value={stageTimes[k]} className={inputCls}
                onChange={(e) => setStageTimes({ ...stageTimes, [k]: e.target.value })} />
            </Field>
            <LocalizedInput idp={`stage-${k}-info`} label={t('set.stageInfo')} rows={2} value={s.stages[k].info} onChange={(info) => setStage(k, { info })} />
            <LocalizedInput idp={`stage-${k}-pass`} label={t('set.stagePass')} rows={2} value={s.stages[k].pass} onChange={(pass) => setStage(k, { pass })} />
            <LocalizedInput idp={`stage-${k}-fail`} label={t('set.stageFail')} rows={2} value={s.stages[k].fail} onChange={(fail) => setStage(k, { fail })} />
          </Card>
        ))}
      </section>

      <h2 className="pt-2 text-xl font-bold">5. {t('stage.final')}</h2>
      <Card className="space-y-4">
        <Field id="announce" label={t('set.announceAt')} hint={t('set.hintTime')}>
          <input id="announce" type="datetime-local" value={announce} onChange={(e) => setAnnounce(e.target.value)} className={inputCls} />
        </Field>
        <LocalizedInput idp="title" label={t('set.title')} value={s.title} onChange={(title) => setS({ ...s, title })} />
        <LocalizedInput idp="body" label={t('set.body')} value={s.body} rows={4} onChange={(body) => setS({ ...s, body })} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t('set.messages')}</h2>
        {RESULT_STATUSES.map((st: Exclude<Status, 'pending'>) => (
          <LocalizedInput key={st} idp={`msg-${st}`} label={t(`status.short.${st}` as TKey)} rows={3}
            value={s.resultMessages[st] ?? empty}
            onChange={(v) => setS({ ...s, resultMessages: { ...s.resultMessages, [st]: v } })} />
        ))}
      </Card>

      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && <div role="status" className="rounded-md border border-success bg-success-tint p-3 text-sm font-medium">{t('set.saved')}</div>}
      <button onClick={() => void save()} className={`${btnPrimary} w-full sm:w-auto`}>{t('set.save')}</button>
    </div>
  );
}
