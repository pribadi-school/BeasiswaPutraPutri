import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, KeyRound, Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatWib } from '../lib/time';
import type { PublicSettings } from '../lib/types';
import { btnPrimary, btnSecondary, Card } from '../components/ui';

export function HomePage() {
  const { t, lang } = useI18n();
  const [s, setS] = useState<PublicSettings | null>(null);
  useEffect(() => { api.getSettings().then(setS).catch(() => setS(null)); }, []);

  const steps = [
    { Icon: ClipboardList, t: t('home.step1.t'), d: t('home.step1.d') },
    { Icon: KeyRound, t: t('home.step2.t'), d: t('home.step2.d') },
    { Icon: Megaphone, t: t('home.step3.t'), d: t('home.step3.d') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t('home.title')}</h1>
        <p className="mt-2 text-base text-muted-foreground">{t('home.lead')}</p>
      </div>

      <ol className="space-y-3">
        {steps.map(({ Icon, t: title, d }, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-action-tint text-action"><Icon size={22} aria-hidden /></span>
            <div>
              <h2 className="text-base font-bold">{i + 1}. {title}</h2>
              <p className="text-sm text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      {s && (
        <Card className="space-y-1 text-sm">
          {s.released ? <p className="font-semibold text-foreground">{t('home.released')}</p> : (
            <>
              <p className="font-semibold text-foreground">{!s.regOpen ? t('home.closed') : null}</p>
              {s.regDeadline && <p>{t('home.deadline', { date: formatWib(s.regDeadline, lang) })}</p>}
              <p>{s.announceAt ? t('home.announceOn', { date: formatWib(s.announceAt, lang) }) : t('home.announceTbd')}</p>
            </>
          )}
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {(!s || s.regOpen) && <Link to="/daftar" className={`${btnPrimary} sm:flex-1`}>{t('home.cta.register')}</Link>}
        <Link to="/masuk" className={`${s?.regOpen === false || s?.released ? btnPrimary : btnSecondary} sm:flex-1`}>{t('home.cta.login')}</Link>
      </div>
    </div>
  );
}
