import { z } from "zod";

export const githubAppCallbackSchema = z.object({
  code: z
    .string({
      error: "Code is required",
    })
    .trim()
    .min(1, "Code cannot be empty"),
});

export type GitHubAppCallbackInput = z.infer<typeof githubAppCallbackSchema>;

export const githubAppInstallSchema = z.object({
  installationId: z
    .string({
      error: "Installation ID is required",
    })
    .trim()
    .min(1, "Installation ID cannot be empty")
    .refine((val) => /^\d+$/.test(val) && Number(val) >= 1, {
      message: "Installation ID must be a positive integer",
    })
    .transform((val) => Number(val)),
});

export type GitHubAppInstallInput = z.infer<typeof githubAppInstallSchema>;
