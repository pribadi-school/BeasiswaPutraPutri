import type { ReactNode } from 'react';
import { HeroArt } from './HeroArt';

/**
 * Banner sambutan (Beranda akun & admin), tema terang seperti hero beranda publik:
 * label toska, judul biru tua, keterangan, ilustrasi di kanan.
 */
export function WelcomeBanner({ eyebrow, title, subtitle, children }: {
  eyebrow?: string; title: string; subtitle?: string; children?: ReactNode;
}) {
  const text = (
    <div className="relative z-10 min-w-0 flex-1">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-teal">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-extrabold leading-tight text-foreground sm:mt-2 sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-linear-to-br from-surface via-surface-portal to-teal-tint p-5 shadow-e2 sm:p-8">
      <div className="flex items-center gap-4">
        {text}
        <div className="hidden min-[400px]:block sm:hidden"><HeroArt compact light /></div>
        <div className="hidden sm:block"><HeroArt light /></div>
      </div>
    </section>
  );
}
