// Synthetic feedback queue. Proxy other reads to the normal dashboard fixture.
// Run dashboard-fixture-server.mjs on 3210, then this fixture on 3211.
import { createServer } from 'node:http';
const port = Number(process.env.FEEDBACK_FIXTURE_PORT || 3211);
const upstream = `http://127.0.0.1:${process.env.DASHBOARD_FIXTURE_PORT || 3210}`;
const feedback = Array.from({ length: 87 }, (_, i) => ({
  id: `f1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  category: ['bug', 'idea', 'support'][i % 3],
  title: i === 86 ? 'Hỗ trợ chuyển khoản SANABC234' : `Yêu cầu ${String(i + 1).padStart(3, '0')}: ${['Lịch sân chưa cập nhật', 'Đề xuất bộ lọc môn thể thao', 'Cần hỗ trợ tài khoản'][i % 3]}`,
  message: i === 86 ? 'Tôi đã chuyển tiền cho SANABC234 nhưng chưa nhận được xác nhận.\nNhờ kiểm tra chứng từ đính kèm.' : i === 85 ? 'Nội dung riêng cần tìm: chiếc vợt màu xanh.' : 'Tôi gửi yêu cầu này để nhờ quản trị viên kiểm tra và hỗ trợ.\nĐây là dòng thứ hai của nội dung.',
  status: ['new', 'reviewing', 'resolved', 'closed'][i % 4],
  reply: i % 4 > 1 ? 'Đã kiểm tra và xử lý yêu cầu của bạn.' : '',
  created_at: new Date(Date.UTC(2026, 9, 1, 3, i)).toISOString(),
  updated_at: '2026-10-12T03:00:00Z',
  page_path: i === 86 ? '/dat-san/SANABC234' : '/tim-san',
  booking_id: i === 86 ? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' : null,
  receipt_path: i === 86 ? 'private/receipt.webp' : null,
  sender: { full_name: i === 0 ? 'Nguyễn Minh với tên hiển thị dài để kiểm tra bố cục trên điện thoại' : `Người gửi ${i + 1}` },
}));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith('/realtime/')) { res.statusCode = 503; res.end(); return; }
  if (url.pathname !== '/rest/v1/feedback') {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    const response = await fetch(upstream + req.url, { method: req.method, headers: { ...req.headers, host: new URL(upstream).host }, ...(body.length ? { body: Buffer.concat(body) } : {}) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  let claims = {};
  try { claims = JSON.parse(Buffer.from(req.headers.authorization.split('.')[1], 'base64url').toString()); } catch { /* default fixture */ }
  if (claims.fixture_feedback === 'error') { res.statusCode = 503; res.end(JSON.stringify({ message: 'Fixture interrupted' })); return; }
  let rows = claims.fixture_feedback === 'empty' ? [] : [...feedback];
  for (const field of ['status', 'category', 'id']) {
    const filter = url.searchParams.get(field) || '';
    if (filter.startsWith('eq.')) rows = rows.filter(row => row[field] === filter.slice(3));
    if (filter.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[field]));
  }
  const or = url.searchParams.get('or');
  if (or) {
    // Enforce the quoted PostgREST grammar used by this page before matching.
    const match = or.match(/^\(title\.imatch\.("(?:[^"\\]|\\.)*"),message\.imatch\.("(?:[^"\\]|\\.)*")\)$/);
    if (!match || match[1] !== match[2]) { res.statusCode = 400; res.end(JSON.stringify({ message: 'Invalid search grammar' })); return; }
    const pattern = new RegExp(JSON.parse(match[1]), 'i');
    rows = rows.filter(row => pattern.test(row.title) || pattern.test(row.message));
  }
  const descending = url.searchParams.get('order')?.includes('created_at.desc');
  rows.sort((a, b) => descending ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at));
  const count = rows.length;
  const range = req.headers.range?.split('-').map(Number);
  const offset = Number(url.searchParams.get('offset') || range?.[0] || 0);
  const limit = Number(url.searchParams.get('limit') || (range ? range[1] - range[0] + 1 : rows.length));
  rows = rows.slice(offset, offset + limit);
  res.setHeader('Content-Range', `${offset}-${offset + Math.max(0, rows.length - 1)}/${count}`);
  if (req.method === 'HEAD') { res.end(); return; }
  if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) { res.end(JSON.stringify(rows[0] || null)); return; }
  res.end(JSON.stringify(rows));
}).listen(port, '127.0.0.1', () => console.log(`Synthetic feedback fixture on ${port}`));
