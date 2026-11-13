import { Link, Outlet } from 'react-router';
import { Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

/** Kerangka halaman publik (beranda, masuk). */
export function Layout() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:p-3">
        {t('app.skip')}
      </a>
      {api.mode === 'demo' && (
        <div className="no-print bg-accent-tint px-4 py-2 text-center text-sm font-medium text-foreground">{t('demo.banner')}</div>
      )}
      <header className="no-print">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface shadow-e2">
              <img src="/pribadi-red.png" alt="" className="size-9 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight text-foreground">{t('app.name')}</span>
              <span className="block truncate text-sm leading-tight text-muted-foreground">{t('app.school')}</span>
            </span>
          </Link>
          <button type="button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label={t('lang.switch')}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-sm font-semibold text-action shadow-e1 hover:bg-action-tint">
            <Languages size={18} aria-hidden />
            <span className="sm:hidden">{lang === 'id' ? 'EN' : 'ID'}</span>
            <span className="hidden sm:inline">{t('lang.switch')}</span>
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8">
        <Outlet />
      </main>
      <footer className="no-print px-4 py-5 text-center text-sm text-muted-foreground">
        <p>{t('footer.privacy')}</p>
        <Link to="/admin" className="mt-1 inline-block min-h-11 py-2 underline">{t('footer.admin')}</Link>
      </footer>
    </div>
  );
}
