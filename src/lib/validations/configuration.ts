import { z } from "zod";

export const configurationSchema = z.object({
  apiMode: z.enum(["organisation", "enterprise"], {
    error: "API mode must be either 'organisation' or 'enterprise'",
  }),
  entityName: z
    .string({
      error: "Entity name is required",
    })
    .trim()
    .min(1, "Entity name cannot be empty")
    .max(255, "Entity name must be 255 characters or fewer"),
  premiumRequestsPerSeat: z
    .number({
      error: "Premium requests per seat must be a number",
    })
    .int("Premium requests per seat must be a whole number")
    .min(1, "Premium requests per seat must be at least 1")
    .max(100000, "Premium requests per seat must be 100000 or fewer")
    .optional(),
});

export type ConfigurationInput = z.infer<typeof configurationSchema>;
