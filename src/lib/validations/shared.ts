import { z } from "zod";

/**
 * Shared Zod schema for entity name fields (teams, departments, etc.).
 */
export const nameFieldSchema = z
  .string({
    error: "Name is required",
  })
  .trim()
  .min(1, "Name cannot be empty")
  .max(255, "Name must be 255 characters or fewer");
