import { z } from "zod";
import { UserRole } from "@/entities/enums";

export const createUserSchema = z.object({
  username: z
    .string({
      error: "Username is required",
    })
    .trim()
    .min(1, "Username cannot be empty")
    .max(255, "Username must be 255 characters or fewer"),
  password: z
    .string({
      error: "Password is required",
    })
    .min(1, "Password cannot be empty"),
  role: z.enum([UserRole.ADMIN, UserRole.USER]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, "Username cannot be empty")
      .max(255, "Username must be 255 characters or fewer")
      .optional(),
    password: z.string().min(1, "Password cannot be empty").optional(),
    role: z.enum([UserRole.ADMIN, UserRole.USER]).optional(),
  })
  .refine(
    (data) => data.username !== undefined || data.password !== undefined || data.role !== undefined,
    { message: "At least one field (username, password, or role) must be provided" }
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
