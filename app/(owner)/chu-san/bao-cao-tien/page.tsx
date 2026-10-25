import { CashReport } from '@/components/cash-report';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Báo cáo tiền · Sân Ngon' };
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <CashReport {...props}  />; }
