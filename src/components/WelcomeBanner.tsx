import type { ReactNode } from 'react';
import { HeroArt } from './HeroArt';

/**
 * Banner sambutan bergradasi (pola referensi): tanggal, judul besar, keterangan,
 * ilustrasi di kanan. `photo` (beranda publik): foto siswa menggantikan ilustrasi —
 * di layar lebar di kanan, menempel ke tepi bawah banner; di HP di bawah teks.
 */
const FADE = 'linear-gradient(to bottom, transparent 0%, #000 22%), linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%)';

export function WelcomeBanner({ eyebrow, title, subtitle, children, photo }: {
  eyebrow?: string; title: string; subtitle?: string; children?: ReactNode;
  photo?: { src: string; alt: string; width: number; height: number };
}) {
  const text = (
    <div className="relative z-10 min-w-0 flex-1">
      {eyebrow && <p className="text-sm text-on-action-muted">{eyebrow}</p>}
      <h1 className={`mt-1 font-extrabold leading-tight text-white sm:mt-3 ${photo ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-on-action-muted sm:text-base">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );

  if (photo) {
    return (
      <section className="bg-brand-gradient relative overflow-hidden rounded-lg px-5 pt-6 text-white shadow-e2 sm:px-8 sm:pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="min-w-0 flex-1 sm:self-center sm:py-10">{text}</div>
          {/* Tepi atas dan samping dipudarkan agar sorot putih foto menyatu dengan banner. */}
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" decoding="async"
            style={{ maskImage: FADE, WebkitMaskImage: FADE, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }}
            className="mx-auto block h-auto w-[92%] max-w-[380px] shrink-0 sm:mx-0 sm:w-[340px] sm:max-w-none lg:w-[400px]" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-brand-gradient relative overflow-hidden rounded-lg p-5 text-white shadow-e2 sm:p-8">
      <div className="flex items-center gap-4">
        {text}
        <div className="hidden min-[400px]:block sm:hidden"><HeroArt compact /></div>
        <div className="hidden sm:block"><HeroArt /></div>
      </div>
    </section>
  );
}
