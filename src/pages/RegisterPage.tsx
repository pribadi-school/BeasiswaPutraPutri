import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, Copy } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { AppError, emptyProfile, type Credentials, type PublicSettings } from '../lib/types';
import { ProfileForm } from '../components/ProfileForm';
import { btnPrimary, Card, ErrorBox, useErrorText } from '../components/ui';

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border-strong bg-surface-page p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="break-all font-mono text-2xl font-bold tracking-wider text-foreground">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }).catch(() => {}); }}
        className="no-print inline-flex min-h-11 items-center gap-1 rounded-md border border-border-strong bg-surface px-3 text-sm font-semibold text-action"
      >
        {ok ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {ok ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}

export function RegisterPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const errText = useErrorText();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  useEffect(() => { api.getSettings().then(setSettings).catch(() => setSettings(null)); }, []);

  if (creds) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">{t('done.title')}</h1>
        <p className="text-muted-foreground">{t('done.lead')}</p>
        <Card className="space-y-3">
          <CopyRow label={t('done.username')} value={creds.username} />
          <CopyRow label={t('done.pin')} value={creds.pin} />
        </Card>
        <ErrorBox>{t('done.warn')}</ErrorBox>
        <label className="no-print flex items-start gap-3 rounded-md border border-border bg-surface p-4">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-action" />
          <span>{t('done.saved')}</span>
        </label>
        <button type="button" disabled={!saved} onClick={() => navigate('/masuk', { replace: true })} className={`${btnPrimary} no-print w-full`}>
          {t('done.continue')}
        </button>
      </div>
    );
  }

  if (settings && !settings.regOpen) {
    return (
      <div className="space-y-4">
        <ErrorBox>{t('e.CLOSED')}</ErrorBox>
        <Link to="/masuk" className={btnPrimary}>{t('nav.login')}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t('reg.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('reg.lead')}</p>
      </div>
      <ProfileForm
        initial={emptyProfile()} withConsent submitLabel={t('reg.submit')} busyLabel={t('reg.sending')}
        serverError={error} serverField={field}
        onSubmit={async (p) => {
          setError(null); setField(null);
          try {
            setCreds(await api.register(p, lang));
            window.scrollTo({ top: 0 });
          } catch (e) {
            setError(errText(e));
            if (e instanceof AppError && e.field) setField(e.field);
          }
        }}
      />
    </div>
  );
}
