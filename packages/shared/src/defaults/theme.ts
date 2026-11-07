export type ThemeTokenType = "color" | "font" | "size" | "url" | "select" | "text";

export type ThemeDefinition = {
  key: string;
  group: string;
  label: string;
  type: ThemeTokenType;
  defaultValue: string;
  options?: string[];
};

/**
 * Theme tokens become CSS variables at request time. No rebuild is required
 * when management changes a colour, font, logo or radius.
 */
export const themeDefaults: ThemeDefinition[] = [
  {
    key: "brand.companyNameDisplay",
    group: "Brand",
    label: "Wordmark text",
    type: "text",
    defaultValue: "Denobelpro",
  },
  {
    key: "brand.logoLightUrl",
    group: "Brand",
    label: "Logo — light mode",
    type: "url",
    defaultValue: "",
  },
  {
    key: "brand.logoDarkUrl",
    group: "Brand",
    label: "Logo — dark mode",
    type: "url",
    defaultValue: "",
  },
  {
    key: "brand.faviconUrl",
    group: "Brand",
    label: "Favicon",
    type: "url",
    defaultValue: "",
  },
  {
    key: "brand.defaultMode",
    group: "Brand",
    label: "Default colour mode",
    type: "select",
    defaultValue: "light",
    options: ["light", "dark", "system"],
  },
  {
    key: "color.primary",
    group: "Colours",
    label: "Primary",
    type: "color",
    defaultValue: "#0E7A5F",
  },
  {
    key: "color.primaryHover",
    group: "Colours",
    label: "Primary hover",
    type: "color",
    defaultValue: "#0A5F4A",
  },
  {
    key: "color.secondary",
    group: "Colours",
    label: "Secondary",
    type: "color",
    defaultValue: "#102A22",
  },
  {
    key: "color.accent",
    group: "Colours",
    label: "Accent",
    type: "color",
    defaultValue: "#F2B84B",
  },
  {
    key: "color.background",
    group: "Colours",
    label: "Page background",
    type: "color",
    defaultValue: "#F7F6F1",
  },
  {
    key: "color.surface",
    group: "Colours",
    label: "Card surface",
    type: "color",
    defaultValue: "#FFFFFF",
  },
  {
    key: "color.surfaceMuted",
    group: "Colours",
    label: "Muted surface",
    type: "color",
    defaultValue: "#EFF3EF",
  },
  {
    key: "color.text",
    group: "Colours",
    label: "Body text",
    type: "color",
    defaultValue: "#14201A",
  },
  {
    key: "color.textMuted",
    group: "Colours",
    label: "Muted text",
    type: "color",
    defaultValue: "#5C6B62",
  },
  {
    key: "color.border",
    group: "Colours",
    label: "Borders",
    type: "color",
    defaultValue: "#DDE4DE",
  },
  {
    key: "color.success",
    group: "Colours",
    label: "Success",
    type: "color",
    defaultValue: "#15803D",
  },
  {
    key: "color.warning",
    group: "Colours",
    label: "Warning",
    type: "color",
    defaultValue: "#B45309",
  },
  {
    key: "color.danger",
    group: "Colours",
    label: "Danger",
    type: "color",
    defaultValue: "#B42318",
  },
  {
    key: "font.body",
    group: "Typography",
    label: "Body font",
    type: "font",
    defaultValue: "Inter",
  },
  {
    key: "font.heading",
    group: "Typography",
    label: "Heading font",
    type: "font",
    defaultValue: "Sora",
  },
  {
    key: "font.mono",
    group: "Typography",
    label: "Monospace font",
    type: "font",
    defaultValue: "JetBrains Mono",
  },
  {
    key: "radius.sm",
    group: "Shape",
    label: "Small radius",
    type: "size",
    defaultValue: "8px",
  },
  {
    key: "radius.md",
    group: "Shape",
    label: "Medium radius",
    type: "size",
    defaultValue: "14px",
  },
  {
    key: "radius.lg",
    group: "Shape",
    label: "Large radius",
    type: "size",
    defaultValue: "24px",
  },
  {
    key: "radius.pill",
    group: "Shape",
    label: "Pill radius",
    type: "size",
    defaultValue: "999px",
  },
  {
    key: "button.radius",
    group: "Shape",
    label: "Button radius",
    type: "size",
    defaultValue: "12px",
  },
  {
    key: "button.style",
    group: "Shape",
    label: "Button style",
    type: "select",
    defaultValue: "solid",
    options: ["solid", "soft", "outline"],
  },
  {
    key: "layout.container",
    group: "Layout",
    label: "Content width",
    type: "size",
    defaultValue: "1200px",
  },
  {
    key: "layout.density",
    group: "Layout",
    label: "Spacing density",
    type: "select",
    defaultValue: "comfortable",
    options: ["compact", "comfortable", "spacious"],
  },
];

export const themeDefaultMap: Record<string, string> = Object.fromEntries(
  themeDefaults.map((token) => [token.key, token.defaultValue]),
);

export const themeTokenToCssVar = (key: string): string =>
  `--${key
    .replace(/\./g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()}`;

const safeCssValue = (key: string, value: string): string | null => {
  if (!value) return null;
  if (key.startsWith("color.")) {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ? value : null;
  }
  if (key.startsWith("font.")) {
    return /^[a-zA-Z0-9][a-zA-Z0-9 \-]{0,59}$/.test(value) ? value : null;
  }
  if (key.startsWith("radius.") || key === "button.radius" || key === "layout.container") {
    return /^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)$/.test(value) ? value : null;
  }
  return null;
};

export function buildThemeStyle(tokens: Record<string, string>): string {
  const merged = { ...themeDefaultMap, ...tokens };
  const declarations = Object.entries(merged)
    .map(([key, value]) => {
      const safe = safeCssValue(key, value);
      return safe ? `${themeTokenToCssVar(key)}: ${safe};` : null;
    })
    .filter((declaration): declaration is string => declaration !== null);

  if (merged["brand.defaultMode"] === "dark") {
    declarations.push("color-scheme: dark;");
  }

  return `:root{${declarations.join("")}}`;
}

/**
 * Curated Google Fonts list offered in the branding editor. Custom Google Font
 * names are accepted by the API in a later phase; this keeps Phase 1 focused.
 */
export const curatedFonts = [
  "Inter",
  "Sora",
  "Manrope",
  "DM Sans",
  "Plus Jakarta Sans",
  "Outfit",
  "Space Grotesk",
  "Fraunces",
  "Lora",
  "Source Serif 4",
  "IBM Plex Sans",
  "IBM Plex Mono",
] as const;
