import { Link, NavLink } from 'react-router';
import { Languages, LogOut, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

export type NavItem = { to: string; label: string; Icon: LucideIcon; end?: boolean; disabled?: boolean };

/** Huruf awal sebagai avatar (foto Google tidak disimpan/ditampilkan demi privasi). */
export function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal text-base font-bold text-white">
      {initial}
    </span>
  );
}

/**
 * Kerangka halaman setelah masuk — tema sama dengan beranda publik (referensi UI):
 * - layar besar: header putih (logo, menu dengan garis toska di bawah yang aktif,
 *   bahasa, pengguna, Keluar);
 * - HP: header ringkas + menu bawah (mudah dijangkau jempol).
 */
export function AppShell({ nav, userName, userSub, onLogout, children }: {
  nav: NavItem[]; userName: string; userSub?: string; onLogout: () => void; children: ReactNode;
}) {
  const { t, lang, setLang } = useI18n();
  const items = nav.filter((n) => !n.disabled);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:p-3">
        {t('app.skip')}
      </a>
      {api.mode === 'demo' && (
        <div className="no-print bg-accent-tint px-4 py-2 text-center text-sm font-medium text-foreground">{t('demo.banner')}</div>
      )}

      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3 py-3">
            <img src="/pribadi-logo.png" width={288} height={80} decoding="sync" alt={t('app.school')} className="h-10 w-auto shrink-0 object-contain" />
            <span className="hidden min-w-0 border-l border-border-strong pl-3 min-[420px]:block">
              <span className="block truncate text-sm font-extrabold leading-tight text-foreground">{t('app.name')}</span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">{t('app.school')}</span>
            </span>
          </Link>

          {/* Menu (layar besar) */}
          <nav aria-label="Menu" className="ml-6 hidden h-full flex-1 items-stretch gap-6 lg:flex">
            {items.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `inline-flex min-h-16 items-center border-b-[3px] text-sm font-semibold transition ${isActive ? 'border-teal text-teal' : 'border-transparent text-foreground hover:text-teal'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1 lg:hidden" />

          <button type="button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label={t('lang.switch')}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground hover:bg-surface-page">
            <Languages size={18} aria-hidden /> {lang === 'id' ? 'EN' : 'ID'}
          </button>
          <div className="flex items-center gap-2.5">
            <Avatar name={userName} />
            <div className="hidden min-w-0 md:block">
              <div className="max-w-44 truncate text-sm font-bold leading-tight text-foreground">{userName}</div>
              {userSub && <div className="max-w-44 truncate text-xs text-muted-foreground">{userSub}</div>}
            </div>
          </div>
          <button type="button" onClick={onLogout}
            className="hidden min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-semibold text-foreground hover:bg-surface-page lg:inline-flex">
            <LogOut size={16} aria-hidden /> {t('nav.logout')}
          </button>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 lg:pb-10 lg:pt-7">{children}</main>

      <footer className="no-print hidden bg-foreground px-4 py-3 text-center text-xs text-white lg:block">
        © 2026 SMP–SMA Pribadi Depok · {t('app.name')}
      </footer>

      {/* Menu bawah (HP/tablet) */}
      <nav aria-label="Menu" className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-2 pt-1 shadow-e3 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg">
          {items.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end}
                className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-sm text-xs font-semibold ${isActive ? 'text-teal' : 'text-muted-foreground'}`}>
                {({ isActive }) => (<>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-teal-tint' : ''}`}><Icon size={20} aria-hidden /></span>
                  <span className="max-w-full truncate">{label}</span>
                </>)}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button type="button" onClick={onLogout} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground">
              <span className="flex h-7 w-12 items-center justify-center"><LogOut size={20} aria-hidden /></span>
              {t('nav.logout')}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
