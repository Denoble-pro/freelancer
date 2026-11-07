import { themeDefaultMap } from "@dlp/shared";
import type { ThemeToken } from "@dlp/db";
import { db } from "../db.js";
import { badRequest } from "../lib/errors.js";

export async function effectiveTheme(): Promise<Record<string, string>> {
  const tokens = await db.themeToken.findMany({
    select: { key: true, value: true, defaultValue: true },
  });
  const merged = { ...themeDefaultMap };
  for (const token of tokens) {
    merged[token.key] = token.value ?? token.defaultValue;
  }
  return merged;
}

export function validateThemeValue(
  token: Pick<ThemeToken, "key" | "type">,
  input: unknown,
): string {
  if (typeof input !== "string") throw badRequest(`${token.key} must be text.`);
  const value = input.trim();
  if (token.type === "color") {
    if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
      throw badRequest("Colours must use a hex value such as #0E7A5F.");
    }
    return value;
  }
  if (token.type === "size") {
    if (!/^(?:\d+(?:\.\d+)?)(?:px|rem|em|%|vw|vh)$/.test(value)) {
      throw badRequest("Sizes must include a unit, for example 16px or 1.5rem.");
    }
    return value;
  }
  if (token.type === "url") {
    if (value === "") return value;
    if (!/^(?:https?:\/\/|\/|data:image\/)/i.test(value)) {
      throw badRequest("Image URLs must start with https://, http://, / or data:image/.");
    }
    if (value.length > 2000) throw badRequest("That URL is too long.");
    return value;
  }
  if (token.type === "select" && token.key === "brand.defaultMode") {
    if (!["light", "dark", "system"].includes(value))
      throw badRequest("Choose light, dark or system.");
    return value;
  }
  if (token.type === "select" && token.key === "layout.density") {
    if (!["compact", "comfortable", "spacious"].includes(value)) {
      throw badRequest("Choose compact, comfortable or spacious.");
    }
    return value;
  }
  if (token.type === "select" && token.key === "button.style") {
    if (!["solid", "soft", "outline"].includes(value))
      throw badRequest("Choose solid, soft or outline.");
    return value;
  }
  if (value.length > 400) throw badRequest("That value is too long.");
  return value;
}

export function presentThemeToken(token: ThemeToken) {
  return {
    id: token.id,
    key: token.key,
    group: token.group,
    label: token.label,
    type: token.type,
    value: token.value ?? token.defaultValue,
    defaultValue: token.defaultValue,
    isOverridden: token.value !== null && token.value !== undefined,
    updatedAt: token.updatedAt,
    updatedById: token.updatedById,
  };
}
