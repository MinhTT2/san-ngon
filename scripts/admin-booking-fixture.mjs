// Synthetic records for the read-only admin worklist browser checks.
export function adminBookingFixture(args, bookings, owner, history, refunds) {
  const now=Date.now();
  let rows=bookings.map(b=>({...b,created_at:new Date(now-86400000).toISOString(),expires_at:new Date(now+600000).toISOString(),
    cancelled_at:null,paid_at:b.status==='confirmed' ? new Date(now-3600000).toISOString() : null,
    note:'Khách muốn chơi sân trong nhà.',court_name:b.courts.name,venue_name:b.courts.venues.name,
    owner_id:owner.id,owner_name:owner.full_name,owner_phone:owner.phone}));
  if(refunds) rows=rows.map((b,i)=>i===0 ? {...b,status:'cancelled',refund_status:'needed'} : b);
  if(history) rows.push(...Array.from({length:42},(_,i)=>({...rows[0],id:`admin-history-${i}`,code:i===41 ? 'SANXYZ234' : `SAN${String(i+1).padStart(6,'A')}`,
    starts_at:new Date(now-(i+1)*86400000).toISOString(),ends_at:new Date(now-(i+1)*86400000+3600000).toISOString(),created_at:new Date(now-(i+2)*86400000).toISOString(),
    status:i===41 ? 'cancelled' : 'completed',refund_status:i===41 ? 'needed' : 'none',customer_name:i===41 ? 'Khách lịch sử' : 'Khách đã chơi',customer_phone:i===41 ? '0912345678' : '0901234567'})),
    {...rows[1],id:'expired-pending',code:'SANEXP234',expires_at:new Date(now-60000).toISOString()});
  rows=rows.map(b=>({...b,hold_expired:b.status==='pending'&&Date.parse(b.expires_at)<=now,
    is_pending:b.status==='pending'&&Date.parse(b.expires_at)>now,is_upcoming:b.status==='confirmed'&&Date.parse(b.ends_at)>now,
    is_playing:b.status==='confirmed'&&Date.parse(b.starts_at)<=now&&Date.parse(b.ends_at)>now}));
  const norm=t=>t.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
  const q=norm(args.p_query||'').trim();
  const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
  rows=rows.filter(b=>(!q || norm(`${b.code} ${b.customer_name} ${b.customer_phone} ${b.court_name} ${b.venue_name}`).includes(q))&&(!args.p_from||day(b.starts_at)>=args.p_from)&&(!args.p_to||day(b.starts_at)<=args.p_to));
  const counts={total:rows.length,upcoming:rows.filter(b=>b.is_upcoming).length,pending:rows.filter(b=>b.is_pending).length,refund:rows.filter(b=>b.refund_status==='needed').length,history:rows.filter(b=>!b.is_pending&&!b.is_upcoming).length};
  rows=rows.filter(b=>args.p_filter==='all'||(args.p_filter==='upcoming'&&b.is_upcoming)||(args.p_filter==='pending'&&b.is_pending)||(args.p_filter==='refund'&&b.refund_status==='needed')||(args.p_filter==='history'&&!b.is_pending&&!b.is_upcoming));
  rows.sort((a,b)=>args.p_filter==='upcoming' ? Date.parse(a.starts_at)-Date.parse(b.starts_at) : args.p_filter==='pending' ? Date.parse(a.expires_at)-Date.parse(b.expires_at) : Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id));
  const matched=rows.length,pages=Math.max(1,Math.ceil(matched/30)),page=Math.max(1,Math.min(args.p_page||1,pages));
  return {...counts,matched,page,pages,page_size:30,rows:rows.slice((page-1)*30,page*30)};
}
