import { createClient } from '@/lib/supabase/server';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import type { TournamentSettlement } from '@/lib/tournaments';
import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';

export async function TournamentSettlementPanel({ id, userId, admin }: { id: string; userId: string; admin: boolean }) {
  const db = await createClient();
  const [{ data, error }, { data: transfers, error: transferError }] = await Promise.all([
    db.rpc('get_tournament_settlement', { p_id: id }),
    db.from('tournament_transfers').select('*').eq('tournament_id', id).order('created_at', { ascending: false }),
  ]);
  if (error || transferError) throw new Error('Chưa tải được sổ quyết toán.');
  const s = data as TournamentSettlement | null;
  if (!s) return null;
  const balance = s.balance ?? 0;
  const payer = balance > 0 ? s.owner_id : s.manager_id;
  const selfOrganized = s.owner_id === s.manager_id;
  return <section id="quyet-toan" className="mt-8 scroll-mt-28 rounded-card border border-strong bg-card p-6">
    <h2 className="font-display text-2xl font-bold text-pitch">{selfOrganized ? 'Tổng thu của giải' : 'Quyết toán với người tổ chức'}</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">{selfOrganized ? 'Bạn tổ chức tại sân của mình, không cần chuyển quyết toán cho bên khác.' : s.pending_transfer ? 'Đã ghi nhận chuyển tiền. Chờ bên nhận kiểm tra và xác nhận bên dưới.' : s.can_settle ? 'Đã đến bước quyết toán. Kiểm tra số dư, chuyển tiền rồi ghi nhận tại đây.' : 'Số tiền tạm tính. Quyết toán sau khi giải kết thúc và đã xử lý các khoản thu, hoàn.'}</p>
    <details open={s.venue_fee === null} className="mt-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-pitch">{selfOrganized ? 'Cách thu & hoàn lệ phí' : 'Thỏa thuận thuê sân & cách quyết toán'}</summary>
    <p className="my-3 text-sm leading-6 text-ink-secondary">Chủ sân nhận cọc và phần lệ phí còn lại. Phần còn lại dùng tiền mặt hoặc nội dung chuyển khoản riêng, không dùng lại mã cọc GIAI. Tiền thu ròng trừ tiền thuê sân là phần của người tổ chức; nếu thiếu, người tổ chức bù cho chủ sân. Chuyển tiền thủ công, bên nhận xác nhận sau khi kiểm tra tài khoản.</p>
    {s.venue_fee === null ? <div className="mt-5 rounded-control bg-peak-fill p-4"><p className="mb-3 text-sm text-peak-ink">Giải cũ chưa có thỏa thuận tiền thuê sân. Admin ghi nhận sau khi chủ sân và người tổ chức thống nhất; chưa thể quyết toán.</p>{admin && <ActionForm payload={{ action: 'terms', id }} label="Chốt thỏa thuận" confirmMessage="Xác nhận chủ sân và người tổ chức đã đồng ý số tiền và nội dung này? Thỏa thuận đã chốt không sửa trực tiếp."><Field label="Tiền thuê sân đã thỏa thuận (đ)"><input className={fieldClass} type="number" name="venue_fee" min={0} max={100000000} required /></Field><Field label="Tiền thuê khi người tổ chức hủy cả giải (đ)"><input className={fieldClass} type="number" name="cancellation_venue_fee" min={0} max={100000000} defaultValue={0} required /></Field><Field label="Nội dung thỏa thuận hai bên"><textarea className={fieldClass} name="terms_note" minLength={10} maxLength={1000} required /></Field></ActionForm>}</div> : <div className="mt-5 rounded-control bg-free-fill p-4 text-sm leading-7"><p className="font-semibold text-pitch">Tiền thuê sân đã chốt: {vnd(s.venue_fee)}</p><p className="whitespace-pre-wrap break-words text-ink-secondary">{s.terms_note}</p><p className="text-xs text-ink-secondary">Người tổ chức/admin hủy cả giải: tiền thuê {vnd(s.cancellation_venue_fee)}; chủ sân hủy: không tính tiền thuê. Người tham gia luôn được hoàn toàn bộ. Hạn đối soát: {dayLabel(new Date(s.due_at))} · {hhmm(s.due_at)}.</p></div>}
    </details>
    <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
      ['Tiền vào qua ngân hàng', vnd(s.bank_received)], ['Phần lệ phí còn lại đã thu', vnd(s.balance_received)],
      ['Cọc còn phải hoàn', vnd(s.refund_due)], ['Lệ phí còn lại phải hoàn', vnd(s.balance_refund_due)],
      ['Suất chưa ghi thu / miễn phần còn lại', String(s.uncollected_count)],
      ...(selfOrganized ? [] : [['Còn phải chuyển quyết toán', s.balance === null ? 'Chưa chốt tiền thuê sân' : `${vnd(Math.abs(balance))}${balance ? balance > 0 ? ' · chủ sân → người tổ chức' : ' · người tổ chức → chủ sân' : ''}`]]),
    ].map(([label, value]) => <div key={label} className="rounded-control border border-hairline p-4"><dt className="text-xs leading-6 text-ink-secondary">{label}</dt><dd className="mt-2 break-words text-sm font-semibold text-pitch">{value}</dd></div>)}</dl>
    <p className="mt-4 text-xs leading-6 text-ink-secondary">Số dư đã trừ các khoản phải hoàn và khoản chuyển đã ghi nhận. Chỉ quyết toán sau khi giải kết thúc/hủy, đã xử lý các khoản thu và hoàn. Chủ sân tự tổ chức thì không cần chuyển giữa hai bên.</p>
    {s.can_settle && balance !== 0 && !s.pending_transfer && (payer === userId || admin) && <div className="mt-5"><ActionForm payload={{ action: 'transfer', id, expected_balance: balance }} label={`Đã chuyển ${vnd(Math.abs(balance))}`} confirmMessage="Chỉ xác nhận sau khi thực sự chuyển tiền qua ngân hàng. Website không tự chuyển tiền."><Field label="Mã giao dịch / chứng từ quyết toán"><input className={fieldClass} name="receipt" minLength={3} maxLength={300} required /></Field></ActionForm></div>}
    {!!transfers?.length && <ul className="mt-5 space-y-3">{transfers.map(x => <li key={x.id} className="rounded-control border border-hairline p-4 text-sm"><p className="font-semibold">{vnd(Math.abs(x.amount))} · {x.amount > 0 ? 'Chủ sân → người tổ chức' : 'Người tổ chức → chủ sân'}</p><p className="my-2 break-words leading-6 text-ink-secondary">{x.receipt} · {x.received_at ? 'Bên nhận đã xác nhận' : 'Chờ bên nhận kiểm tra tiền'}</p>{!x.received_at && ((x.amount > 0 ? s.manager_id : s.owner_id) === userId || admin) && <ActionForm payload={{ action: 'receive_transfer', id: x.id }} label="Tôi đã nhận tiền" confirmMessage="Bạn đã kiểm tra và nhận đủ số tiền này?" />}</li>)}</ul>}
  </section>;
}
