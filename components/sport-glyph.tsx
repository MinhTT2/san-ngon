/** Small, original court-side symbols; decorative, independent of venue photos. */
export function SportGlyph({ sport = '', className = 'size-5' }: { sport?: string; className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {sport === 'badminton' ? <><path d="m9 20 4 4M11 22l-5 5M13 18l-6-9 3-5 12 5 3 5-8 8" /><path d="m7 9 10 13M10 4l7 18M16 7l1 15M22 9l-5 13M11 14l11 4" /></>
      : sport === 'pickleball' ? <><path d="m12 23-4 5-4-4 5-4M12 23c-7-5-7-9-3-15 4-5 10-6 15-2s6 10 2 15c-4 6-8 7-14 2Z" /><circle cx="15" cy="11" r=".6" /><circle cx="21" cy="11" r=".6" /><circle cx="12" cy="16" r=".6" /><circle cx="18" cy="17" r=".6" /><circle cx="23" cy="17" r=".6" /></>
      : sport ? <><circle cx="16" cy="16" r="12" /><path d="m16 10 6 4-2 7h-8l-2-7ZM16 4v6M27 12l-5 2M23 26l-3-5M9 26l3-5M5 12l5 2" /></>
      : <><rect x="5" y="5" width="22" height="22" rx="3" /><path d="M16 5v22M5 11h5v10H5M27 11h-5v10h5" /><circle cx="16" cy="16" r="4" /></>}
  </svg>;
}
