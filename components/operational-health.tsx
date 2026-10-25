import { createClient } from '@/lib/supabase/server';
import { QueryError } from '@/components/query-error';
import { hhmm } from '@/lib/format';

type Health = {
  checked_at: string; monitor_active: boolean; monitor_recent: boolean; monitor_last_seen_at: string | null;
  checks: { key: string; title: string; ok: boolean; detail: string; count?: number; last_run_at?: string | null }[];
};
export async function OperationalHealth() {
  const db = await createClient();
  const { data, error } = await db.rpc('get_operational_health');
  if (error || !data) return <QueryError className="mt-5" title="Chưa tải được trạng thái vận hành" />;
  const health = data as unknown as Health;
  return <section aria-labelledby="operational-health-title" className="my-6">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 id="operational-health-title" className="font-display text-xl font-bold text-pitch">Trạng thái hệ thống</h2><p className="text-xs text-ink-secondary">Kiểm tra lúc {hhmm(health.checked_at)}</p></div>
    {(!health.monitor_active || !health.monitor_recent) && <p role="status" className="mb-4 rounded-control border border-hairline bg-card p-4 text-sm leading-6 text-ink-secondary">{health.monitor_active ? 'Chưa ghi nhận lượt giám sát nền trong 12 phút gần đây.' : 'Lịch giám sát nền đang tắt. Trang vẫn kiểm tra khi tải lại.'}</p>}
    <ul className="grid gap-3 md:grid-cols-2">{health.checks.map(check => <li key={check.key} className="min-w-0 rounded-card border border-hairline bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-pitch">{check.title}</h3><span className={`text-xs font-semibold ${check.ok ? 'text-success' : 'text-danger'}`}>{check.ok ? 'Ổn định' : 'Cần kiểm tra'}{typeof check.count === 'number' && check.count > 0 ? ` (${check.count})` : ''}</span></div>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">{check.detail}</p>
      {check.last_run_at && <p className="mt-2 text-xs text-ink-secondary">Lượt gần nhất {hhmm(check.last_run_at)}</p>}
    </li>)}</ul>
    <p className="mt-4 text-xs leading-6 text-ink-secondary">Giám sát mỗi 5 phút; chỉ báo vào hộp thông báo admin khi phát sinh hoặc phục hồi sự cố. Không có giao dịch ngân hàng mới không đồng nghĩa webhook bị lỗi.</p>
  </section>;
}
