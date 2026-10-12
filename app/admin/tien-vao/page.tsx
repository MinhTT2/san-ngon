import { IncomingTransferLedger } from '@/components/incoming-transfer-ledger';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sổ tiền vào · Sân Ngon' };
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <IncomingTransferLedger role='admin' searchParams={searchParams} />;
}
