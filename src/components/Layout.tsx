import { Link, Outlet } from 'react-router';
import { ArrowRight, Languages, MapPin, Phone } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

/**
 * Kerangka halaman publik (beranda, masuk) — tema "situs sekolah" (referensi UI):
 * header putih dengan menu dan tombol daftar, footer berkolom dengan bar gelap.
 */
export function Layout() {
  const { t, lang, setLang } = useI18n();
  const links = [
    { href: '/#cara', label: t('nav.how') },
    { href: '/#informasi', label: t('nav.info') },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:p-3">
        {t('app.skip')}
      </a>
      {api.mode === 'demo' && (
        <div className="no-print bg-accent-tint px-4 py-2 text-center text-sm font-medium text-foreground">{t('demo.banner')}</div>
      )}

      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <img src="/pribadi-logo.png" width={288} height={80} decoding="sync" alt="" className="h-10 w-auto shrink-0 object-contain" />
            <span className="hidden min-w-0 border-l border-border-strong pl-3 min-[420px]:block">
              <span className="block truncate text-sm font-extrabold leading-tight text-foreground sm:text-base">{t('app.name')}</span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">{t('app.school')}</span>
            </span>
          </Link>

          <nav aria-label="Menu" className="ml-6 hidden flex-1 items-center gap-6 md:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground hover:text-teal">{l.label}</a>
            ))}
            <Link to="/masuk" className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground hover:text-teal">{t('nav.login')}</Link>
          </nav>

          <button type="button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label={t('lang.switch')}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground hover:bg-surface-page">
            <Languages size={18} aria-hidden /> {lang === 'id' ? 'EN' : 'ID'}
          </button>
          <Link to="/masuk" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-teal px-3 text-sm font-semibold text-white hover:bg-teal-hover sm:px-4">
            {t('cta.register')}
          </Link>
        </div>
      </header>

      <main id="main" className="w-full flex-1">
        <Outlet />
      </main>

      <footer className="no-print mt-12 border-t border-border bg-surface-page">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-3">
              <img src="/pribadi-logo.png" width={288} height={80} alt="" className="h-10 w-auto object-contain" />
              <span className="border-l border-border-strong pl-3">
                <span className="block font-extrabold leading-tight text-foreground">{t('app.name')}</span>
                <span className="block text-xs text-muted-foreground">{t('app.school')}</span>
              </span>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">{t('footer.about')}</p>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-foreground">{t('footer.links')}</h2>
            <ul className="space-y-1 text-sm">
              <li><Link to="/" className="inline-flex min-h-9 items-center text-muted-foreground hover:text-teal">{t('nav.home')}</Link></li>
              {links.map((l) => <li key={l.href}><a href={l.href} className="inline-flex min-h-9 items-center text-muted-foreground hover:text-teal">{l.label}</a></li>)}
              <li><Link to="/masuk" className="inline-flex min-h-9 items-center gap-1 font-semibold text-teal">{t('cta.register')} <ArrowRight size={14} aria-hidden /></Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-foreground">{t('footer.contact')}</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />Jl. Margonda Raya No.229, Beji, Depok, Jawa Barat</li>
              <li className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
                <span>{t('footer.admission')}<br />
                  <a href="https://wa.me/6281292900095" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center font-semibold text-foreground hover:text-teal">0812 9290 0095</a>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="bg-foreground px-4 py-3 text-center text-xs text-white">
          © 2026 SMP–SMA Pribadi Depok · {t('app.name')}
        </div>
      </footer>
    </div>
  );
}
