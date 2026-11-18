import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, Award, CalendarClock, ClipboardList, GraduationCap, Layers, LogIn, MapPin, Megaphone, MonitorCheck, ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatWib } from '../lib/time';
import type { PublicSettings } from '../lib/types';
import { ScholarshipInfo } from '../components/ScholarshipInfo';

/** Kartu kecil yang "mengambang" di samping foto (pola referensi). */
function FloatCard({ Icon, title, sub, className }: { Icon: LucideIcon; title: string; sub: string; className: string }) {
  return (
    <div className={`absolute z-10 flex items-center gap-2.5 rounded-lg bg-surface/95 p-2.5 shadow-e3 backdrop-blur sm:p-3 ${className}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-tint text-teal sm:size-10"><Icon size={20} aria-hidden /></span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </div>
  );
}

export function HomePage() {
  const { t, lang } = useI18n();
  const [s, setS] = useState<PublicSettings | null>(null);
  useEffect(() => { api.getSettings().then(setS).catch(() => setS(null)); }, []);

  const open = !s || s.regOpen;
  const status: string | null = !s ? null
    : s.released ? t('home.released')
    : !s.regOpen ? t('home.closed')
    : s.regDeadline ? `${t('hero.closes')}: ${formatWib(s.regDeadline, lang)}` : null;

  const steps = [
    { Icon: LogIn, t: t('home.step1.t'), d: t('home.step1.d') },
    { Icon: ClipboardList, t: t('home.step2.t'), d: t('home.step2.d') },
    { Icon: MonitorCheck, t: t('how.s3.t'), d: t('how.s3.d') },
    { Icon: Megaphone, t: t('how.s4.t'), d: t('how.s4.d') },
  ];
  const stats: { Icon: LucideIcon; value: string; label: string }[] = [
    { Icon: Layers, value: '4', label: t('stat.stages') },
    { Icon: GraduationCap, value: lang === 'id' ? 'SMP & SMA' : 'SMP & SMA', label: t('stat.levels') },
    { Icon: MapPin, value: lang === 'id' ? 'Jawa Barat' : 'West Java', label: t('stat.region') },
    { Icon: Award, value: '90', label: t('stat.grade') },
    { Icon: CalendarClock, value: lang === 'id' ? '20 Jan 2027' : '20 Jan 2027', label: t('stat.announce') },
  ];

  return (
    <div>
      {/* ---- Hero: teks di kiri, foto + kartu fakta di kanan ---- */}
      <section className="relative overflow-hidden bg-linear-to-br from-surface via-surface-portal to-teal-tint">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-teal">{t('hero.eyebrow')}</p>
            <h1 className="mt-3 text-[2.6rem] font-extrabold !leading-[0.98] tracking-tight text-foreground sm:text-[3.4rem] lg:text-[4.1rem]">
              {t('hero.line1')}<br />
              <span className="text-gradient-end">{t('hero.line2').replace(/(\p{L})-(\p{L})/gu, '$1‑$2')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">{t('hero.lead')}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/masuk" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-teal px-6 font-semibold text-white shadow-e2 transition hover:bg-teal-hover">
                {open ? t('hero.cta') : t('home.ctaBack')} <ArrowRight size={18} aria-hidden />
              </Link>
              <a href="#informasi" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-action bg-surface px-6 font-semibold text-action transition hover:bg-action-tint">
                <ScrollText size={18} aria-hidden /> {t('hero.cta2')}
              </a>
            </div>
            {status && (
              <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock size={18} className="text-teal" aria-hidden /> {status}
              </p>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-[460px]">
            <div aria-hidden className="bg-brand-gradient absolute inset-x-[8%] bottom-0 top-[14%] rounded-t-full opacity-90" />
            <img src="/siswa-berprestasi.webp" alt={t('home.photoAlt')} width={860} height={1010} fetchPriority="high" decoding="async"
              style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%)' }}
              className="relative block h-auto w-full" />
            <FloatCard Icon={GraduationCap} title={t('hero.f1.t')} sub={t('hero.f1.d')} className="left-0 top-[22%] sm:-left-6" />
            <FloatCard Icon={MapPin} title={t('hero.f2.t')} sub={t('hero.f2.d')} className="right-0 top-[44%] sm:-right-4" />
            <FloatCard Icon={MonitorCheck} title={t('hero.f3.t')} sub={t('hero.f3.d')} className="bottom-[8%] left-[2%] sm:-left-4" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4">
        {/* ---- Cara mendaftar: kartu yang menumpuk di bawah hero ---- */}
        <section id="cara" className="relative z-10 -mt-10 scroll-mt-24 rounded-xl bg-surface p-5 shadow-e3 sm:p-7 md:-mt-16">
          <h2 className="text-center text-xl font-extrabold text-foreground sm:text-2xl">{t('how.title')}</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ Icon, t: title, d }, i) => (
              <li key={title} className="lift flex gap-3 rounded-lg border border-border bg-surface-portal p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface text-action shadow-e1"><Icon size={22} aria-hidden /></span>
                <div>
                  <h3 className="font-bold text-foreground"><span className="text-teal">{i + 1}.</span> {title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Pita statistik (fakta program) ---- */}
        <section aria-label={t('nav.info')} className="bg-brand-gradient grid grid-cols-2 gap-x-3 gap-y-5 rounded-xl px-4 py-6 sm:px-5 text-white shadow-e2 sm:grid-cols-3 lg:grid-cols-5 lg:px-8">
          {stats.map(({ Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={26} strokeWidth={1.6} className="shrink-0 opacity-90 sm:size-[30px]" aria-hidden />
              <div className="leading-tight">
                <div className="text-base font-extrabold whitespace-nowrap sm:text-2xl">{value}</div>
                <div className="text-sm text-on-action-muted">{label}</div>
              </div>
            </div>
          ))}
        </section>

        {/* ---- Informasi lengkap (Juknis) ---- */}
        <div id="informasi" className="scroll-mt-24">
          <ScholarshipInfo />
        </div>

        {/* ---- Ajakan mendaftar ---- */}
        <section className="flex flex-col items-start gap-5 rounded-xl bg-teal px-6 py-7 text-white shadow-e2 md:flex-row md:items-center md:px-10">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-full bg-white/15 md:flex"><GraduationCap size={30} aria-hidden /></span>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-white sm:text-2xl">{t('band.title')}</h2>
            <p className="mt-1 text-sm text-white/90 sm:text-base">{t('band.text')}</p>
          </div>
          <Link to="/masuk" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-surface px-6 font-semibold text-teal shadow-e2 transition hover:bg-teal-tint md:w-auto">
            {open ? t('hero.cta') : t('home.ctaBack')} <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
