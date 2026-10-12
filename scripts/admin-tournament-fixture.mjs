// Read-only synthetic fixtures; only the isolated browser suite sets this claim.
export function adminTournamentFixture(url, rows, authorization, court, owner) {
  let mode='';
  try { mode=JSON.parse(Buffer.from((authorization||'').split('.')[1],'base64url').toString()).fixture_tournament_table||''; } catch { /* Default fixture. */ }
  if(mode==='empty') return [];
  const now=Date.now();
  const enrich=t=>({...t,courts:t.court_id ? {name:court.name,venues:{name:'Sân Cầu Giấy',images:[]}} : null,organizer:{full_name:owner.full_name,phone:owner.phone}});
  if(mode==='many') rows=Array.from({length:45},(_,i)=>enrich({...rows[0],id:`e1200000-0000-4000-9000-${String(i+1).padStart(12,'0')}`,
    title:i<25 ? `Giải chờ duyệt ${String(i+1).padStart(2,'0')}` : i<37 ? `Giải công khai ${i-24}` : `Giải lịch sử ${i-36}`,
    sport:i===44 ? 'pickleball' : 'badminton',status:i<25 ? 'pending' : i<37 ? 'published' : i<41 ? 'completed' : i<43 ? 'cancelled' : 'rejected',
    court_id:i===0 ? null : court.id,created_at:new Date(now-i*3600000).toISOString(),starts_at:new Date(now+(i+1)*86400000).toISOString(),ends_at:new Date(now+(i+1)*86400000+7200000).toISOString()}));
  else rows=rows.map(enrich);
  const pattern=url.searchParams.get('title');
  if(pattern?.startsWith('ilike.')) {
    const q=pattern.slice(7,-1).replace(/\\([\\%_])/g,'$1').toLocaleLowerCase('vi');
    rows=rows.filter(t=>t.title.toLocaleLowerCase('vi').includes(q));
  }
  const order=(url.searchParams.get('order')||'').split(',');
  rows.sort((a,b)=>{for(const part of order){const [field,direction]=part.split('.');const cmp=String(a[field]??'').localeCompare(String(b[field]??''));if(cmp)return direction==='desc' ? -cmp : cmp;}return 0;});
  return rows;
}
