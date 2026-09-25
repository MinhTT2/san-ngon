import { z } from 'zod';

export const VenueSearchParams = z.object({
  q: z.string().trim().max(100).catch(''),
  sport: z.enum(['football5', 'football7', 'football11', 'badminton', 'pickleball', 'tennis']).optional().catch(undefined),
  ngay: z.string().date().refine(value => !value.startsWith('0000')).optional().catch(undefined),
  district: z.string().optional().catch(undefined),
  indoor: z.enum(['0', '1']).optional().catch(undefined),
  available: z.literal('1').optional().catch(undefined),
  sort: z.enum(['name', 'price', 'availability']).catch('name'),
  page: z.coerce.number().int().min(1).max(2147483647).catch(1),
});
