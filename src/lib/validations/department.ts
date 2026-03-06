import { z } from "zod";
import { nameFieldSchema } from "@/lib/validations/shared";

export const createDepartmentSchema = z.object({
  name: nameFieldSchema,
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: nameFieldSchema,
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
