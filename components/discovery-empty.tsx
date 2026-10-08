import Link from 'next/link';
import { PitchThumb } from './pitch-thumb';

export function DiscoveryEmpty({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return <div className="pf-in mt-5 flex flex-col items-center rounded-[20px] border border-hairline bg-free-fill/50 px-6 py-10 text-center">
    <div className="overflow-hidden rounded-control"><PitchThumb width={100} height={72} /></div>
    <h2 className="mt-5 font-display text-2xl font-bold text-pitch">{title}</h2>
    <p className="mt-3 max-w-md text-sm leading-7 text-ink-secondary">{description}</p>
    <Link href={href} className="pf-action mt-5 inline-flex min-h-11 items-center gap-3 rounded-control border border-strong bg-card px-4 text-sm font-semibold text-pitch hover:bg-free-fill">{label} <span aria-hidden="true">→</span></Link>
  </div>;
}
