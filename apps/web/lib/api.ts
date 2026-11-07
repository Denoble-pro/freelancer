import { cache } from "react";
import {
  contentDefaultMap,
  featureFlagDefaults,
  navigationDefaults,
  settingDefaults,
  themeDefaultMap,
} from "@dlp/shared";

export type MenuItemData = {
  id: string;
  label: string;
  labelKey: string | null;
  url: string;
  icon: string | null;
  sortOrder: number;
};

export type Bootstrap = {
  content: Record<string, string>;
  theme: Record<string, string>;
  settings: Record<string, unknown>;
  features: Record<string, boolean>;
  menus: Record<string, MenuItemData[]>;
  languages: { code: string; name: string; direction: string; isDefault: boolean }[];
  degraded?: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  emailVerifiedAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

export type Me = {
  user: SessionUser;
  permissions: string[];
  sessionId: string;
};

export type AccountProfile = SessionUser & {
  phone: string | null;
  clientProfile: { company: string | null; country: string | null } | null;
  staffProfile: {
    title: string | null;
    department: string | null;
    bio: string | null;
    skills: string[];
    availability: string;
  } | null;
};

export type SessionItem = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  device: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

export type PublicPage = {
  slug: string;
  title: string;
  seo: unknown;
  updatedAt: string;
  blocks: { id: string; type: string; sortOrder: number; content: unknown }[];
};

export type PublicInvitation = {
  email: string;
  message: string | null;
  expiresAt: string;
  staff: {
    id: string;
    name: string;
    avatarUrl: string | null;
    title: string | null;
    bio: string | null;
    skills: string[];
  };
};

export type InvitationLookup =
  { ok: true; data: PublicInvitation } | { ok: false; status: number; message: string };

export type AdminStats = {
  content: number | null;
  settings: number | null;
  theme: number | null;
  audit: number | null;
};

const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

function fallbackBootstrap(): Bootstrap {
  const menus: Record<string, MenuItemData[]> = {};
  for (const menu of navigationDefaults) {
    menus[menu.key] = menu.items
      .filter((item) => item.roleVisibility.includes("guest"))
      .map((item, index) => ({
        id: `${menu.key}-${index}`,
        label: item.label,
        labelKey: item.labelKey ?? null,
        url: item.url,
        icon: null,
        sortOrder: item.sortOrder,
      }));
  }

  const settings: Record<string, unknown> = {};
  for (const setting of settingDefaults) {
    if (setting.isPublic && !setting.isSecret) settings[setting.key] = setting.defaultValue;
  }

  const features: Record<string, boolean> = {};
  for (const flag of featureFlagDefaults) {
    if (flag.isPublic) features[flag.key] = flag.defaultEnabled;
  }

  return {
    content: { ...contentDefaultMap },
    theme: { ...themeDefaultMap },
    settings,
    features,
    menus,
    languages: [{ code: "en", name: "English", direction: "ltr", isDefault: true }],
    degraded: true,
  };
}

/**
 * Server-side bootstrap with graceful fallback. The database is authoritative,
 * but the public site still renders sensible copy if the API is restarting.
 */
export const getBootstrap = cache(async (): Promise<Bootstrap> => {
  try {
    const response = await fetch(`${apiBase}/api/v1/public/bootstrap`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return fallbackBootstrap();
    const payload = (await response.json()) as { data: Bootstrap };
    return { ...fallbackBootstrap(), ...payload.data };
  } catch {
    return fallbackBootstrap();
  }
});

async function requestApi<T>(
  path: string,
  options: { cookieHeader?: string; timeoutMs?: number } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error?: string }> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      headers: options.cookieHeader ? { cookie: options.cookieHeader } : {},
      signal: AbortSignal.timeout(options.timeoutMs ?? 6000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const payload = (await response.json()) as { data: T };
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, status: 503 };
  }
}

export async function getMe(cookieHeader: string): Promise<Me | null> {
  const result = await requestApi<Me>("/api/v1/auth/me", { cookieHeader });
  return result.ok ? result.data : null;
}

export async function getAccountProfile(cookieHeader: string): Promise<AccountProfile | null> {
  const result = await requestApi<{ user: AccountProfile }>("/api/v1/account/profile", {
    cookieHeader,
  });
  return result.ok ? result.data.user : null;
}

export async function getSessions(cookieHeader: string): Promise<SessionItem[]> {
  const result = await requestApi<{ items: SessionItem[] }>("/api/v1/auth/sessions", {
    cookieHeader,
  });
  return result.ok ? result.data.items : [];
}

export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const result = await requestApi<PublicPage>(`/api/v1/public/pages/${encodeURIComponent(slug)}`);
  return result.ok ? result.data : null;
}

export async function getPublicInvitation(token: string): Promise<InvitationLookup> {
  try {
    const response = await fetch(
      `${apiBase}/api/v1/public/invitations/${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    const payload = (await response.json().catch(() => null)) as {
      data?: PublicInvitation;
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.data) {
      return {
        ok: false,
        status: response.status,
        message:
          payload?.error?.message ??
          "We could not open this invitation. Ask your contact for a fresh link.",
      };
    }
    return { ok: true, data: payload.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "We could not reach the workspace. Please try again in a moment.",
    };
  }
}

export async function getAdminStats(cookieHeader: string): Promise<AdminStats> {
  const [content, settings, theme, audit] = await Promise.all([
    requestApi<{ items: unknown[] }>("/api/v1/admin/content", { cookieHeader }),
    requestApi<{ items: unknown[] }>("/api/v1/admin/settings", { cookieHeader }),
    requestApi<{ items: unknown[] }>("/api/v1/admin/theme", { cookieHeader }),
    requestApi<{ items: unknown[]; meta: { total: number } }>(
      "/api/v1/admin/audit-logs?pageSize=1",
      {
        cookieHeader,
      },
    ),
  ]);

  return {
    content: content.ok ? content.data.items.length : null,
    settings: settings.ok ? settings.data.items.length : null,
    theme: theme.ok ? theme.data.items.length : null,
    audit: audit.ok ? audit.data.meta.total : null,
  };
}

export function settingString(bootstrap: Bootstrap, key: string, fallback = ""): string {
  const value = bootstrap.settings[key];
  return typeof value === "string" ? value : fallback;
}
