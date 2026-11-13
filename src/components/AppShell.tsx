import { NavLink } from 'react-router';
import { Languages, LogOut, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';

export type NavItem = { to: string; label: string; Icon: LucideIcon; end?: boolean; disabled?: boolean };

/** Huruf awal sebagai avatar (foto Google tidak disimpan/ditampilkan demi privasi). */
export function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-lg font-bold text-white ring-2 ring-surface shadow-e1">
      {initial}
    </span>
  );
}

/**
 * Kerangka halaman setelah masuk (pola referensi):
 * - layar besar: sidebar biru di kiri (logo, menu, Keluar di bawah), bar atas dengan pengguna;
 * - HP: bar atas ringkas + menu bawah.
 */
export function AppShell({ nav, userName, userSub, onLogout, children }: {
  nav: NavItem[]; userName: string; userSub?: string; onLogout: () => void; children: ReactNode;
}) {
  const { t, lang, setLang } = useI18n();
  const langBtn = (
    <button type="button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label={t('lang.switch')}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-sm font-semibold text-action shadow-e1 hover:bg-action-tint">
      <Languages size={18} aria-hidden />
      <span className="xl:hidden">{lang === 'id' ? 'EN' : 'ID'}</span>
      <span className="hidden xl:inline">{t('lang.switch')}</span>
    </button>
  );
  const items = nav.filter((n) => !n.disabled);

  return (
    <div className="min-h-dvh lg:flex lg:gap-6 lg:p-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:p-3">
        {t('app.skip')}
      </a>

      {/* Sidebar (layar besar) */}
      <aside className="bg-sidebar-gradient sticky top-6 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 flex-col rounded-lg p-5 text-white shadow-e2 lg:flex">
        <div className="mx-auto flex size-24 items-center justify-center rounded-lg bg-surface shadow-e2">
          <img src="/pribadi-red.png" alt={t('app.school')} className="size-16 object-contain" />
        </div>
        <p className="mt-3 text-center text-sm font-semibold leading-tight">{t('app.name')}</p>
        <nav aria-label="Menu" className="mt-8 flex flex-col gap-1">
          {items.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-full px-4 font-semibold transition ${isActive ? 'bg-surface text-action shadow-e1' : 'text-white hover:bg-white/10'}`}>
              <Icon size={20} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={onLogout} className="mt-auto flex min-h-12 items-center gap-3 rounded-full px-4 font-semibold text-white hover:bg-white/10">
          <LogOut size={20} aria-hidden /> {t('nav.logout')}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {api.mode === 'demo' && (
          <div className="no-print bg-accent-tint px-4 py-2 text-center text-sm font-medium text-foreground lg:mb-4 lg:rounded-sm">{t('demo.banner')}</div>
        )}
        {/* Bar atas */}
        <header className="no-print flex items-center gap-3 px-4 py-3 lg:px-0 lg:pt-0">
          <img src="/pribadi-red.png" alt="" className="size-10 shrink-0 object-contain lg:hidden" />
          <div className="min-w-0 flex-1 lg:hidden">
            <div className="truncate text-sm font-bold leading-tight text-foreground">{t('app.name')}</div>
            <div className="truncate text-xs text-muted-foreground">{t('app.school')}</div>
          </div>
          <div className="hidden flex-1 lg:block" />
          {langBtn}
          <div className="flex items-center gap-3">
            <Avatar name={userName} />
            <div className="hidden min-w-0 sm:block">
              <div className="max-w-48 truncate font-bold leading-tight text-foreground">{userName}</div>
              {userSub && <div className="max-w-48 truncate text-sm text-muted-foreground">{userSub}</div>}
            </div>
          </div>
        </header>

        <main id="main" className="w-full flex-1 px-4 pb-28 lg:px-0 lg:pb-6">{children}</main>
      </div>

      {/* Menu bawah (HP/tablet) */}
      <nav aria-label="Menu" className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-2 pt-1 shadow-e3 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg">
          {items.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end}
                className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-sm text-xs font-semibold ${isActive ? 'text-action' : 'text-muted-foreground'}`}>
                {({ isActive }) => (<>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-action-tint' : ''}`}><Icon size={20} aria-hidden /></span>
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
