import { z } from 'zod';

export const fanInput = z.discriminatedUnion('action', [
  z.object({ slug: z.string(), action: z.literal('optin') }),
  z.object({
    slug: z.string(),
    action: z.literal('feedback'),
    rating: z.number().int().min(1).max(5),
    quote: z.string().trim().max(280).optional(),
  }),
]);
