import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Card, ErrorBox, Field, inputCls, useErrorText } from '../components/ui';
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
      <div>
        <h1 className="text-2xl font-extrabold">{t('login.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('login.lead')}</p>
      </div>
      <Card className="space-y-4">
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
      </Card>
      <p className="text-sm text-muted-foreground">{t('login.help')}</p>
    </div>
  );
}
