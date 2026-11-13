import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, ClipboardList, LogIn, Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatWib } from '../lib/time';
import type { PublicSettings } from '../lib/types';
import { IconTile, SectionHeader } from '../components/ui';
import { WelcomeBanner } from '../components/WelcomeBanner';

export function HomePage() {
  const { t, lang } = useI18n();
  const [s, setS] = useState<PublicSettings | null>(null);
  useEffect(() => { api.getSettings().then(setS).catch(() => setS(null)); }, []);

  const steps = [
    { Icon: LogIn, t: t('home.step1.t'), d: t('home.step1.d') },
    { Icon: ClipboardList, t: t('home.step2.t'), d: t('home.step2.d') },
    { Icon: Megaphone, t: t('home.step3.t'), d: t('home.step3.d') },
  ];
  const notYet = !!s?.regStart && Date.parse(s.regStart) > Date.parse(s.now);
  const info: string[] = !s ? [] : s.released ? [t('home.released')] : [
    ...(notYet ? [t('home.notYet', { date: formatWib(s.regStart, lang) })] : !s.regOpen ? [t('home.closed')] : []),
    ...(s.regStart && s.regDeadline ? [t('home.schedule', { start: formatWib(s.regStart, lang, false), end: formatWib(s.regDeadline, lang) })]
      : s.regDeadline ? [t('home.deadline', { date: formatWib(s.regDeadline, lang) })] : []),
    s.announceAt ? t('home.announceOn', { date: formatWib(s.announceAt, lang) }) : t('home.announceTbd'),
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner eyebrow={t('app.school')} title={t('home.title')} subtitle={t('home.lead')}>
        <Link to="/masuk" className="inline-flex min-h-12 items-center justify-center rounded-full bg-surface px-6 font-semibold text-action shadow-e2 transition hover:bg-action-tint">
          {!s || s.regOpen ? t('home.cta') : t('home.ctaBack')}
        </Link>
      </WelcomeBanner>

      <section>
        <SectionHeader title={t('home.how')} />
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(({ Icon, t: title, d }, i) => (
            <li key={i} className="lift flex gap-3 rounded-lg bg-surface p-4 shadow-e2 sm:flex-col">
              <IconTile Icon={Icon} size="lg" />
              <div>
                <h3 className="font-bold text-foreground"><span className="text-action">{i + 1}.</span> {title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {info.length > 0 && (
        <section className="flex gap-3 rounded-lg bg-surface p-5 shadow-e2">
          <CalendarClock size={22} className="mt-0.5 shrink-0 text-action" aria-hidden />
          <ul className="space-y-1 text-sm text-foreground">{info.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
