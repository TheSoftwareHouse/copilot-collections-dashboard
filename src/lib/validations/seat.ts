import { z } from "zod";

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) return val;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(
    z
      .union([
        z.string().max(255, "Must be 255 characters or fewer"),
        z.null(),
      ])
      .optional()
  );

export const updateSeatSchema = z
  .object({
    firstName: nullableString,
    lastName: nullableString,
    department: nullableString,
    departmentId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.department !== undefined ||
      data.departmentId !== undefined,
    {
      message: "At least one field (firstName, lastName, department, or departmentId) must be provided",
    }
  );

export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
