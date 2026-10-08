import { AmbientVideo } from './ambient-video';

/** Original moving court artwork; never used as a photo of a bookable venue. */
export function CourtFilm({ className = '' }: { className?: string }) {
  return <div data-motion-item className={`relative isolate aspect-video min-w-0 overflow-hidden rounded-[20px] border border-free-line/25 bg-pitch ${className}`}>
    <AmbientVideo scene="court" />
  </div>;
}
