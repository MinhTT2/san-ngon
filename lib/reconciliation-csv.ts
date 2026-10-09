import { hhmm, ymd } from './format';
import { BOOKING_STATUS_LABELS } from './constants';
export type ReconciliationRow={code:string;court_name:string;customer_name:string|null;customer_phone:string;starts_at:string;ends_at:string;status:string;total_amount:number;deposit_amount:number;paid_at:string|null;refund_status:string|null};
export function csvCell(value:unknown){
 const text=String(value??'');
 const safe=/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'"+text : text;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function reconciliationCsv(rows:ReconciliationRow[]){
 const headers=['Mã đơn','Sân','Tên khách','Điện thoại','Ngày chơi (Việt Nam)','Bắt đầu','Kết thúc','Trạng thái','Tổng tiền sân (VND)','Cọc trên đơn (VND)','Ghi nhận thanh toán (Việt Nam)','Hoàn cọc'];
 const status=BOOKING_STATUS_LABELS as Record<string,string>;
 return '\uFEFF'+[headers,...rows.map(r=>[r.code,r.court_name,r.customer_name,r.customer_phone,ymd(new Date(r.starts_at)),hhmm(r.starts_at),hhmm(r.ends_at),status[r.status]??r.status,r.total_amount,r.deposit_amount,r.paid_at ? ymd(new Date(r.paid_at))+' '+hhmm(r.paid_at) : '',r.refund_status==='done'?'Đã hoàn':r.refund_status==='needed'?'Cần hoàn':''])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
