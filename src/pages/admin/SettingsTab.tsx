import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n, type TKey } from '../../lib/i18n';
import { fromInputWib, toInputWib } from '../../lib/time';
import { AppError, type AdminSettings, type Localized, type Status } from '../../lib/types';
import { btnPrimary, Card, ErrorBox, Field, inputCls, useErrorText } from '../../components/ui';
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

export function SettingsTab() {
  const { onExpired } = useAdmin();
  const { t } = useI18n();
  const errText = useErrorText();
  const [s, setS] = useState<AdminSettings | null>(null);
  const [start, setStart] = useState('');
  const [deadline, setDeadline] = useState('');
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminGetSettings().then((r) => {
      setS(r); setStart(toInputWib(r.regStart)); setDeadline(toInputWib(r.regDeadline)); setAnnounce(toInputWib(r.announceAt));
    }).catch((e) => { if (e instanceof AppError && e.code === 'UNAUTHORIZED') onExpired(); else setError(errText(e)); });
  }, [onExpired, errText]);

  if (error && !s) return <ErrorBox>{error}</ErrorBox>;
  if (!s) return <p className="text-muted-foreground">{t('common.loading')}</p>;

  const empty: Localized = { id: '', en: '' };
  async function save() {
    if (!s) return;
    setError(null); setSaved(false);
    const regStart = fromInputWib(start);
    const regDeadline = fromInputWib(deadline);
    const announceAt = fromInputWib(announce);
    if (regStart && regDeadline && Date.parse(regDeadline) <= Date.parse(regStart)) { setError(t('set.badRange')); return; }
    if (announceAt && regDeadline && Date.parse(announceAt) < Date.parse(regDeadline)) { setError(t('set.badAnnounce')); return; }
    try {
      await api.adminSaveSettings({ ...s, regStart, regDeadline, announceAt });
      setSaved(true);
    } catch (e) {
      if (e instanceof AppError && e.code === 'UNAUTHORIZED') onExpired(); else setError(errText(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t('adm.tab.settings')}</h1>
      <Card className="space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.regOpen} onChange={(e) => setS({ ...s, regOpen: e.target.checked })} className="size-6 accent-action" />
          <span className="font-semibold text-foreground">{t('set.regOpen')}</span>
        </label>
        <Field id="start" label={t('set.regStart')}>
          <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field id="deadline" label={t('set.regDeadline')}>
          <input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
        </Field>
        <Field id="announce" label={t('set.announceAt')} hint={t('set.hintTime')}>
          <input id="announce" type="datetime-local" value={announce} onChange={(e) => setAnnounce(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <Card className="space-y-4">
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
