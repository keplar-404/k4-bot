import { z } from "zod";

/**
 * When something runs again: a workflow's schedule trigger and a bot's scheduled task share this shape.
 * - every: every N minutes/hours/days/weeks from when it was turned on
 * - once: on `date` at `at`
 * - daily: every day at `at`
 * - weekly: on `days` (0 = Sunday … 6 = Saturday) at `at`
 * - monthly: on `dayOfMonth` at `at` (31 means the last day in shorter months)
 * Times are wall-clock times in `timezone` (an IANA name such as "Europe/Berlin"), so 09:00 stays 09:00 across DST.
 * Old configs ({every, unit, timezone}) parse as mode "every".
 */
export const scheduleConfig = z.object({
  mode: z.enum(["every", "once", "daily", "weekly", "monthly"]).default("every"),
  every: z.number().int().min(1).max(1000).default(1),
  unit: z.enum(["minutes", "hours", "days", "weeks"]).default("hours"),
  at: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7).default([1]),
  dayOfMonth: z.number().int().min(1).max(31).default(1),
  timezone: z.string().max(64).default("UTC"),
});

export type ScheduleConfig = z.infer<typeof scheduleConfig>;
