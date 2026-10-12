/** Fixed shapes reserve space without pretending that data has already loaded. */
function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`pf-skeleton rounded-control bg-sunk ${className}`} />;
}

export function ScheduleSkeleton() {
  return <div role="status" aria-label="Đang tải giờ trống" aria-busy="true" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <span className="sr-only">Đang tải giờ trống và giá sân…</span>
    <div className="rounded-card border border-hairline bg-card p-5">
      <Bone className="h-7 w-48 max-w-full" /><Bone className="mt-3 h-4 w-72 max-w-full" />
      <div className="my-5 grid grid-cols-2 gap-4 border-y border-hairline py-4"><Bone className="h-12" /><Bone className="h-12" /></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Bone key={i} className="h-20" />)}</div>
    </div>
    <div className="rounded-card border border-hairline bg-card p-5"><Bone className="h-5 w-36" /><Bone className="mt-4 h-8" /><Bone className="mt-5 h-24" /></div>
  </div>;
}

export function PageSkeleton({ kind }: { kind: 'discovery' | 'venue' | 'dashboard' }) {
  return <main role="status" aria-label="Đang tải nội dung" aria-busy="true" className="mx-auto max-w-7xl px-5 py-8 lg:px-12">
    <span className="sr-only">Đang tải {kind === 'discovery' ? 'danh sách sân' : kind === 'venue' ? 'thông tin và lịch sân' : 'tổng quan sân'}…</span>
    <Bone className="h-4 w-36" /><Bone className="mt-4 h-12 w-96 max-w-full" /><Bone className="mt-4 h-5 w-[28rem] max-w-full" />
    {kind === 'venue' ? <><Bone className="my-6 aspect-[16/7] w-full" /><ScheduleSkeleton /></>
      : kind === 'discovery' ? <div className="mt-8 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-4 rounded-card border border-hairline bg-card p-5 lg:grid-cols-1">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-12" />)}</div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="overflow-hidden rounded-card border border-hairline bg-card"><Bone className="aspect-[16/10] rounded-none" /><div className="p-5"><Bone className="h-6" /><Bone className="mt-4 h-4 w-3/4" /><Bone className="mt-6 h-11" /></div></div>)}</div>
        </div>
      : <><div className="my-8 grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-28" />)}</div><Bone className="h-64 w-full" /><Bone className="mt-6 h-80 w-full" /></>}
  </main>;
}
