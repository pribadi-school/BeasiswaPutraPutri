import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { ErrorBox, Field, inputCls, useErrorText } from '../components/ui';
import { HeroArt } from '../components/HeroArt';
import { GoogleButton } from '../components/GoogleButton';

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const errText = useErrorText();
  const [demoEmail, setDemoEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(location.state?.expired ? t('sess.expired') : null);

  // Sudah masuk? Langsung ke akun.
  useEffect(() => {
    api.getUser().then((u) => { if (u) navigate('/akun', { replace: true }); }).catch(() => {});
  }, [navigate]);

  async function signIn() {
    setBusy(true); setError(null);
    try {
      await api.signInWithGoogle(demoEmail);
      // Mode Supabase: browser sudah pindah ke Google. Mode demo: langsung lanjut.
      if (api.mode === 'demo') navigate('/akun', { replace: true });
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="overflow-hidden rounded-lg bg-surface shadow-e2">
      <div className="bg-brand-gradient flex items-center justify-between gap-2 px-5 py-4 text-white">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-on-action-muted">{t('login.lead')}</p>
        </div>
        <div className="hidden min-[400px]:block"><HeroArt compact /></div>
      </div>
      <div className="space-y-4 p-5">
        {api.mode === 'demo' && (
          <Field id="demo-email" label={t('login.demoEmail')} hint={t('login.demoHint')}>
            <input id="demo-email" type="email" inputMode="email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)}
              className={inputCls} placeholder="nama@gmail.com" autoComplete="email" />
          </Field>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <GoogleButton label={busy ? t('login.entering') : t('login.google')} busy={busy} onClick={() => void signIn()}
          disabled={api.mode === 'demo' && !demoEmail.trim()} />
        <p className="text-sm text-muted-foreground">{t('login.privacy')}</p>
      </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('login.help')}</p>
    </div>
  );
}
