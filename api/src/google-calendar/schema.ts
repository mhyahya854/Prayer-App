import { z } from 'zod';

export const googleCalendarSyncBodySchema = z.object({
  calendarId: z.string().trim().min(1).optional(),
  events: z.array(z.object({
    description: z.string().trim().optional(),
    end: z.string().datetime(),
    start: z.string().datetime(),
    summary: z.string().trim().min(1),
  })).min(1).max(50),
});
