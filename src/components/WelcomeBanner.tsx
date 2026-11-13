import type { ReactNode } from 'react';
import { HeroArt } from './HeroArt';

/** Banner sambutan bergradasi (pola referensi): tanggal, judul besar, keterangan, ilustrasi di kanan. */
export function WelcomeBanner({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="bg-brand-gradient relative overflow-hidden rounded-lg p-5 text-white shadow-e2 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="relative z-10 min-w-0 flex-1">
          {eyebrow && <p className="text-sm text-on-action-muted">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white sm:mt-3 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-on-action-muted sm:text-base">{subtitle}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        <div className="hidden min-[400px]:block sm:hidden"><HeroArt compact /></div>
        <div className="hidden sm:block"><HeroArt /></div>
      </div>
    </section>
  );
}
