import { z } from "zod";

const seatIdsField = z
  .array(
    z
      .number({ error: "Each seatId must be a number" })
      .int("Each seatId must be an integer")
      .positive("Each seatId must be a positive integer"),
  )
  .min(1, "At least one seatId is required")
  .max(100, "Cannot process more than 100 seats at once");

export const teamMembersSeatIdsSchema = z.object({
  seatIds: seatIdsField,
});

export type TeamMembersSeatIdsInput = z.infer<typeof teamMembersSeatIdsSchema>;

export const teamMembersRemoveSchema = z.object({
  seatIds: seatIdsField,
  mode: z.enum(["retire", "purge"]).default("retire"),
});

export type TeamMembersRemoveInput = z.infer<typeof teamMembersRemoveSchema>;

export const teamMembersBackfillSchema = z
  .object({
    seatIds: seatIdsField,
    startMonth: z.number().int().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
    startYear: z.number().int().min(2020, "Year must be 2020 or later"),
    endMonth: z.number().int().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
    endYear: z.number().int().min(2020, "Year must be 2020 or later"),
  })
  .refine(
    (data) => {
      const startVal = data.startYear * 12 + data.startMonth;
      const endVal = data.endYear * 12 + data.endMonth;
      return endVal >= startVal;
    },
    { message: "Start date must not be after end date", path: ["startMonth"] },
  )
  .refine(
    (data) => {
      const now = new Date();
      const currentMonth = now.getUTCMonth() + 1;
      const currentYear = now.getUTCFullYear();
      const currentVal = currentYear * 12 + currentMonth;
      const endVal = data.endYear * 12 + data.endMonth;
      return endVal <= currentVal;
    },
    { message: "End date must not be in the future", path: ["endMonth"] },
  )
  .refine(
    (data) => {
      const startVal = data.startYear * 12 + data.startMonth;
      const endVal = data.endYear * 12 + data.endMonth;
      return endVal - startVal + 1 <= 24;
    },
    { message: "Date range must not exceed 24 months", path: ["startMonth"] },
  );

export type TeamMembersBackfillInput = z.infer<typeof teamMembersBackfillSchema>;
