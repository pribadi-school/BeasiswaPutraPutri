import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import type { AuthConfig, SignIn } from '../lib/api/api';
import { useI18n } from '../lib/i18n';
import { ErrorBox, Field, inputCls, useErrorText } from '../components/ui';
import { HeroArt } from '../components/HeroArt';
import { GoogleButton } from '../components/GoogleButton';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export function LoginPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const errText = useErrorText();
  const [auth, setAuth] = useState<AuthConfig | null>(null);
  const [demoEmail, setDemoEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(location.state?.expired ? t('sess.expired') : null);

  // Sudah masuk? Langsung ke akun.
  useEffect(() => {
    api.getUser().then((u) => { if (u) navigate('/akun', { replace: true }); }).catch(() => {});
    api.authConfig().then(setAuth).catch((e) => setError(errText(e)));
  }, [navigate, errText]);

  const signIn = useCallback(async (input: SignIn) => {
    setBusy(true); setError(null);
    try {
      await api.signIn(input);
      navigate('/akun', { replace: true });
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }, [navigate, errText]);
  const gisFailed = useCallback(() => setError(t('login.googleFailed')), [t]);

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className="overflow-hidden rounded-lg bg-surface shadow-e2">
        <div className="bg-brand-gradient flex items-center justify-between gap-2 px-5 py-4 text-white">
          <div>
            <h1 className="text-2xl font-extrabold text-white">{t('login.title')}</h1>
            <p className="mt-1 text-sm text-on-action-muted">{t('login.lead')}</p>
          </div>
          <div className="hidden min-[400px]:block"><HeroArt compact /></div>
        </div>
        <div className="space-y-4 p-5">
          {!auth && !error && <div className="skeleton h-12 w-full" aria-busy="true" />}

          {auth?.googleClientId && (
            busy ? <p className="text-center text-sm text-muted-foreground">{t('login.entering')}</p>
              : <GoogleSignInButton clientId={auth.googleClientId} lang={lang}
                  onCredential={(credential) => void signIn({ credential })} onError={gisFailed} />
          )}

          {auth?.devLogin && (
            <>
              <Field id="demo-email" label={t('login.demoEmail')} hint={api.mode === 'demo' ? t('login.demoHint') : t('login.devHint')}>
                <input id="demo-email" type="email" inputMode="email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)}
                  className={inputCls} placeholder="nama@gmail.com" autoComplete="email" />
              </Field>
              <GoogleButton label={busy ? t('login.entering') : t('login.google')} busy={busy}
                onClick={() => void signIn({ devEmail: demoEmail })} disabled={!demoEmail.trim()} />
            </>
          )}

          {auth && !auth.googleClientId && !auth.devLogin && <ErrorBox>{t('login.notConfigured')}</ErrorBox>}
          {error && <ErrorBox>{error}</ErrorBox>}
          <p className="text-sm text-muted-foreground">{t('login.privacy')}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('login.help')}</p>
    </div>
  );
}
