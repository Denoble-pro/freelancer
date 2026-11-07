import { themeDefaultMap } from "@dlp/shared";

export function googleFontsHref(theme: Record<string, string>): string | null {
  const families = [theme["font.body"], theme["font.heading"], theme["font.mono"]]
    .filter(
      (font): font is string =>
        typeof font === "string" && /^[a-zA-Z0-9][a-zA-Z0-9 \-]{0,59}$/.test(font),
    )
    .map((font) => font.trim());
  const unique = [...new Set(families)];
  if (unique.length === 0) return null;

  const query = unique
    .map((font) => `family=${encodeURIComponent(font).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

export function resolveLogo(
  theme: Record<string, string>,
  mode: "light" | "dark" = "light",
): string {
  const key = mode === "dark" ? "brand.logoDarkUrl" : "brand.logoLightUrl";
  return theme[key] || theme["brand.logoLightUrl"] || "";
}

export function wordmark(theme: Record<string, string>, fallback: string): string {
  return theme["brand.companyNameDisplay"] || fallback;
}

export function resolvedTheme(theme: Record<string, string>): Record<string, string> {
  return { ...themeDefaultMap, ...theme };
}
