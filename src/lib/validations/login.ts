import { z } from "zod";

export const loginSchema = z.object({
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
});

export type LoginInput = z.infer<typeof loginSchema>;
