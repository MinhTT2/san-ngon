export type BookingCalendar = { id: string; code: string; title: string; location: string; starts_at: string; ends_at: string; stamp: string };
const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 folds at 75 octets; iterate code points so Vietnamese is not split.
function fold(line: string) {
  const encoder = new TextEncoder();
  let output = '', size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) { output += '\r\n '; size = 1; }
    output += char; size += bytes;
  }
  return output;
}
export function bookingCalendar(event: BookingCalendar) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//San Ngon//Booking//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${event.id}@san-ngon`, `DTSTAMP:${event.stamp}`, `DTSTART:${event.starts_at}`, `DTEND:${event.ends_at}`,
    `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(event.location)}`,
    `DESCRIPTION:${escape(`Mã đơn: ${event.code}. Kiểm tra trạng thái mới nhất trong Đơn của tôi trước khi ra sân. Lịch đã tải không tự cập nhật khi đơn bị hủy.`)}`,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
