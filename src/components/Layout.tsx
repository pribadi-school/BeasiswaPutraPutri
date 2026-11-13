import { Link, Outlet } from 'react-router';
import { Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

export function Layout() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-3">
        {t('app.skip')}
      </a>
      {api.mode === 'demo' && (
        <div className="no-print bg-accent-tint px-4 py-2 text-center text-sm font-medium text-foreground">{t('demo.banner')}</div>
      )}
      <header className="no-print border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
            <img src="/pribadi-red.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight text-foreground">{t('app.name')}</span>
              <span className="block truncate text-sm leading-tight text-muted-foreground">{t('app.school')}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            aria-label={t('lang.switch')}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-border-strong px-3 text-sm font-semibold text-action hover:bg-action-tint"
          >
            <Languages size={18} aria-hidden />
            <span className="sm:hidden">{lang === 'id' ? 'EN' : 'ID'}</span>
            <span className="hidden sm:inline">{t('lang.switch')}</span>
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="no-print border-t border-border px-4 py-4 text-center text-sm text-muted-foreground">
        <p>{t('footer.privacy')}</p>
        <Link to="/admin" className="mt-1 inline-block min-h-11 py-2 underline">{t('footer.admin')}</Link>
      </footer>
    </div>
  );
}
