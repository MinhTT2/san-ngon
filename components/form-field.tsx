export const fieldClass = 'min-h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-3 py-2 text-sm font-normal focus:border-pitch focus:outline-2 focus:outline-offset-2 focus:outline-pitch';
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">{label}{children}</label>;
}
