import type { ZodTypeAny, z } from "zod";
import { ApiError } from "./errors.js";

export function parseInput<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Please check the information you entered.", {
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export const paginationSchema = {
  page: (value: unknown) => {
    const parsed = Number(value ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  },
  pageSize: (value: unknown, max = 100, fallback = 25) => {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : fallback;
  },
};

export function clientIp(request: {
  ip?: string;
  headers: Record<string, unknown>;
}): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? request.ip ?? null;
  }
  return request.ip ?? null;
}

export function userAgent(request: { headers: Record<string, unknown> }): string | null {
  const header = request.headers["user-agent"];
  return typeof header === "string" ? header.slice(0, 500) : null;
}
