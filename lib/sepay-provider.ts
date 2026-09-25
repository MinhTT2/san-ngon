import { z } from 'zod';

export const ID = z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d*$/)]).transform(String);
export const BankAccount = z.object({
  id: ID, active: z.union([z.boolean(), z.literal(0), z.literal(1)]),
  account_number: z.string().regex(/^\d{6,30}$/), account_holder_name: z.string().trim().min(1),
  bank: z.object({ short_name: z.string().trim().min(1) }),
});
export const Webhook = z.object({ id: ID, bank_account_id: ID, webhook_url: z.string(), active: z.union([z.boolean(), z.literal(0), z.literal(1)]),
  authen_type: z.string(), event_type: z.string(), api_key: z.string().optional(), request_content_type: z.string().optional() });

// Live OAuth API wraps the created ID in data; older documented responses use the root.
export const CreatedWebhook = z.union([z.object({ data: z.object({ id: ID }) }).transform(r => r.data), z.object({ id: ID })]);
// Requests take a list; responses expose a map. Sending the response shape causes HTTP 500.
export const WEBHOOK_RETRY_CONDITIONS = ['non_2xx_status_code'];
