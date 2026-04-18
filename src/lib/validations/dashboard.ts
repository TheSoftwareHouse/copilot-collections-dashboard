import { z } from "zod";

export const dailyDetailQuerySchema = z.object({
  day: z.coerce.number().int().min(1).max(31),
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .default(() => new Date().getUTCMonth() + 1),
  year: z.coerce
    .number()
    .int()
    .min(2020)
    .optional()
    .default(() => new Date().getUTCFullYear()),
});

export type DailyDetailQueryInput = z.infer<typeof dailyDetailQuerySchema>;

export const modelDetailQuerySchema = z.object({
  model: z.string().min(1),
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .default(() => new Date().getUTCMonth() + 1),
  year: z.coerce
    .number()
    .int()
    .min(2020)
    .optional()
    .default(() => new Date().getUTCFullYear()),
  day: z.coerce.number().int().min(1).max(31).optional(),
});

export type ModelDetailQueryInput = z.infer<typeof modelDetailQuerySchema>;
