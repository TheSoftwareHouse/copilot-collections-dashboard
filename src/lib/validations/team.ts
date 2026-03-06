import { z } from "zod";
import { nameFieldSchema } from "@/lib/validations/shared";

export const createTeamSchema = z.object({
  name: nameFieldSchema,
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: nameFieldSchema,
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
