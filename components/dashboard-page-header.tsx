import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export function DashboardPageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string; title: ReactNode; description: string; actions?: ReactNode;
}) {
  return <header className="flex flex-col items-start justify-between gap-4 border-b border-hairline pb-5 sm:flex-row sm:flex-wrap sm:items-end">
    <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">{eyebrow.split(' / ').map((part, index) => <span key={index} className="inline-flex items-center gap-2">{index > 0 && <span className="text-strong" aria-hidden="true">/</span>}{part}</span>)}</p>
      <h1 className="mt-2 break-words font-display text-2xl font-bold leading-tight tracking-tight text-pitch sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}

export function DashboardLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-strong bg-card px-3 text-xs font-semibold text-pitch hover:border-pitch hover:bg-free-fill">{children}<ArrowUpRight size={15} className="pf-arrow" aria-hidden="true" /></Link>;
}
