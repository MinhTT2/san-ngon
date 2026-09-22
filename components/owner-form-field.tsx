import type { ReactNode } from 'react';

export const OWNER_INPUT = 'h-12 w-full min-w-0 rounded-control border border-hairline bg-page px-3.5 text-[15px] outline-none focus:border-pitch focus:outline-2 focus:outline-pitch aria-invalid:border-danger';
export const OWNER_PRIMARY = 'inline-flex min-h-12 items-center justify-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60';
export const OWNER_SECONDARY = 'inline-flex min-h-12 items-center justify-center rounded-control border border-hairline px-4 py-3 text-sm font-semibold text-pitch disabled:opacity-60';

export function OwnerField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
    {label}{children}
    {error && <span role="alert" className="text-sm font-normal text-danger">{error}</span>}
  </label>;
}
