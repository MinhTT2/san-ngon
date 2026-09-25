import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BankAccount, requireSepayOwner, sepayErrorResponse, withSepayConnection } from '@/lib/sepay-oauth';

export async function GET() {
  try {
    const ownerId = await requireSepayOwner();
    const accounts = await withSepayConnection(ownerId, async ({ api }) => {
      const accounts: z.infer<typeof BankAccount>[] = [];
      for (let page = 1; page <= 20; page++) {
        const result = z.object({ data: z.array(BankAccount), meta: z.object({ pagination: z.object({ last_page: z.number().int().min(1).max(20) }) }).optional() })
          .parse(await api(`/bank-accounts?limit=100&page=${page}`));
        accounts.push(...result.data.filter(bank => bank.active));
        if (page >= (result.meta?.pagination.last_page ?? 1)) break;
      }
      return accounts;
    });
    return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return sepayErrorResponse(error); }
}
