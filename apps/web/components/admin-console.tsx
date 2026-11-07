"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookText,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Store,
  ToggleLeft,
  Trash2,
  Type,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { makeT, type Translator } from "@/lib/content";
import { cn } from "@/lib/utils";

type AdminStats = {
  content: number | null;
  settings: number | null;
  theme: number | null;
  audit: number | null;
};

type Tab =
  | "overview"
  | "content"
  | "settings"
  | "theme"
  | "features"
  | "users"
  | "roles"
  | "reviews"
  | "audit";

type ContentItem = {
  id: string;
  key: string;
  group: string;
  label: string;
  defaultValue: string;
  value: string | null;
  effectiveValue: string;
  description: string | null;
  isOverridden: boolean;
  updatedAt: string;
};

type ContentPayload = { items: ContentItem[]; groups: string[] };

type SettingItem = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  group: string;
  type: "string" | "number" | "boolean" | "select" | "json" | "secret";
  value: unknown;
  defaultValue: unknown;
  validation: { options?: { value: string; label: string }[]; [key: string]: unknown } | null;
  isPublic: boolean;
  isSecret: boolean;
  isSet?: boolean;
  maskedValue?: string;
};

type SettingPayload = { items: SettingItem[]; groups: string[] };

type ThemeItem = {
  id: string;
  key: string;
  group: string;
  label: string;
  type: string;
  value: string;
  defaultValue: string;
  isOverridden: boolean;
};

type ThemePayload = { items: ThemeItem[]; groups: string[] };

type FlagItem = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
  isPublic: boolean;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  clientProfile: {
    company: string | null;
    country: string | null;
    blockedAt: string | null;
  } | null;
  staffProfile: { title: string | null; availability: string } | null;
  _count: {
    staffRelationships: number;
    clientRelationships: number;
    ordersAsStaff: number;
    ordersAsClient: number;
  };
};

type UserPayload = {
  items: UserItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

type OneTimeCredentials = {
  name: string;
  email: string;
  temporaryPassword: string;
  mode: "create" | "reset";
};

type StaffMutationResult = {
  item: { id: string; name: string; email: string; role: string; status: string };
  temporaryPassword: string;
  sessionsRevoked?: number;
};

type RolePermission = {
  id: string;
  key: string;
  label: string;
  group: string;
  description: string;
};

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
};

type RolePayload = { roles: RoleItem[]; permissions: RolePermission[] };

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
};

type AuditPayload = {
  items: AuditItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

type AdminReviewItem = {
  id: string;
  quality: number;
  communication: number;
  delivery: number;
  comment: string | null;
  staffReply: string | null;
  visible: boolean;
  createdAt: string;
  order: {
    id: string;
    number: string;
    status: string;
    staff: { id: string; name: string; email: string };
    client: { id: string; name: string; email: string };
  };
};

type AdminReviewPayload = {
  items: AdminReviewItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

class AdminRequestError extends Error {}

async function adminApi<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new AdminRequestError(
      payload?.error?.message ?? "That change could not be saved. Please try again.",
    );
  }
  if (!payload?.data) throw new AdminRequestError("The server returned an empty response.");
  return payload.data;
}

function formatWhen(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return groups;
}

function Notice({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-xs leading-5",
        tone === "success"
          ? "border-success/25 bg-success/[0.06] text-success"
          : "border-danger/25 bg-danger/[0.06] text-danger",
      )}
    >
      {tone === "success" ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {message}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading back office data...
    </div>
  );
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="card p-6">
      <Notice message={message} tone="error" />
      <button type="button" onClick={retry} className="btn btn-secondary btn-sm mt-4">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

const tabs: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "content", label: "Content", icon: Type },
  { key: "settings", label: "Settings", icon: SlidersHorizontal },
  { key: "theme", label: "Theme", icon: Palette },
  { key: "features", label: "Features", icon: ToggleLeft },
  { key: "users", label: "People", icon: Users },
  { key: "roles", label: "Roles", icon: ShieldCheck },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "audit", label: "Audit log", icon: ScrollText },
];

export function AdminConsole({
  stats,
  content,
}: {
  stats: AdminStats;
  content: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const t = makeT(content);

  return (
    <div className="mt-8">
      <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b border-border pb-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-t-md px-3.5 py-2.5 text-xs font-semibold transition-colors",
                tab === item.key
                  ? "bg-surface text-ink shadow-[inset_0_-2px_0_var(--color-primary)]"
                  : "text-muted hover:bg-surface/70 hover:text-ink",
              )}
              aria-current={tab === item.key ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="pt-7">
        {tab === "overview" ? <OverviewPanel stats={stats} onNavigate={setTab} /> : null}
        {tab === "content" ? <ContentPanel /> : null}
        {tab === "settings" ? <SettingsPanel /> : null}
        {tab === "theme" ? <ThemePanel /> : null}
        {tab === "features" ? <FeaturesPanel /> : null}
        {tab === "users" ? <UsersPanel content={content} /> : null}
        {tab === "roles" ? <RolesPanel /> : null}
        {tab === "reviews" ? <ReviewsPanel t={t} /> : null}
        {tab === "audit" ? <AuditPanel /> : null}
      </div>
    </div>
  );
}

function OverviewPanel({
  stats,
  onNavigate,
}: {
  stats: AdminStats;
  onNavigate: (tab: Tab) => void;
}) {
  const cards = [
    {
      label: "Editable content strings",
      value: stats.content,
      tab: "content" as Tab,
      icon: BookText,
    },
    {
      label: "Business settings",
      value: stats.settings,
      tab: "settings" as Tab,
      icon: SlidersHorizontal,
    },
    { label: "Theme tokens", value: stats.theme, tab: "theme" as Tab, icon: Palette },
    { label: "Audit events", value: stats.audit, tab: "audit" as Tab, icon: ScrollText },
  ];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.tab)}
              className="card group p-5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
                {card.value === null ? "-" : card.value.toLocaleString("en-NG")}
              </p>
              <p className="mt-1 flex items-center justify-between text-xs text-muted">
                {card.label}
                <ExternalLink className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Store className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-[-0.02em]">
            Marketplace
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Review people, storefronts, conversations and orders from one workspace.
          </p>
          <Link href="/workspace" className="btn btn-secondary btn-sm mt-5">
            Open workspace
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="card p-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Type className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-[-0.02em]">Site copy</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Every page label, button and empty state can be edited with a versioned history.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("content")}
            className="btn btn-secondary btn-sm mt-5"
          >
            Edit content
          </button>
        </div>
        <div className="card p-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-[-0.02em]">Security</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Suspend accounts, revoke sessions and inspect every administrative action.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("audit")}
            className="btn btn-secondary btn-sm mt-5"
          >
            Open audit log
          </button>
        </div>
      </div>
    </div>
  );
}

function ContentPanel() {
  const router = useRouter();
  const [payload, setPayload] = useState<ContentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi<ContentPayload>("/admin/content");
      setPayload(data);
      setSelectedKey((current) => current ?? data.items[0]?.key ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Content could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = payload?.items.find((item) => item.key === selectedKey) ?? null;

  useEffect(() => {
    if (selected) setDraft(selected.effectiveValue);
    setNotice(null);
  }, [selectedKey, selected?.updatedAt]);

  const filtered = useMemo(() => {
    if (!payload) return [];
    const needle = query.trim().toLowerCase();
    return payload.items.filter((item) => {
      if (group !== "All" && item.group !== group) return false;
      if (!needle) return true;
      return (
        item.key.toLowerCase().includes(needle) ||
        item.label.toLowerCase().includes(needle) ||
        item.defaultValue.toLowerCase().includes(needle) ||
        item.effectiveValue.toLowerCase().includes(needle)
      );
    });
  }, [payload, group, query]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await adminApi<{ item: ContentItem }>(
        `/admin/content/${encodeURIComponent(selected.key)}`,
        { method: "PATCH", body: { value: draft } },
      );
      setPayload((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.key === selected.key ? result.item : item)),
            }
          : current,
      );
      setDraft(result.item.effectiveValue);
      setNotice({ message: `Saved "${selected.key}".`, tone: "success" });
      router.refresh();
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Content could not be saved.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await adminApi<{ item: ContentItem }>(
        `/admin/content/${encodeURIComponent(selected.key)}/reset`,
        { method: "POST" },
      );
      setPayload((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.key === selected.key ? result.item : item)),
            }
          : current,
      );
      setDraft(result.item.defaultValue);
      setNotice({ message: "Restored the default copy.", tone: "success" });
      router.refresh();
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "The default could not be restored.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!payload) return null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">Site copy</h2>
          <p className="mt-1 text-sm text-muted">
            {payload.items.length} strings across {payload.groups.length} groups. Changes are
            audited and versioned.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys or copy"
            className="input pl-10"
            aria-label="Search content"
          />
        </div>
      </div>

      <div className="scrollbar-thin mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {["All", ...payload.groups].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setGroup(name)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition-colors",
              group === name
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-ink",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card max-h-[640px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">
              No strings match this filter.
            </p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                className={cn(
                  "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                  item.key === selectedKey ? "bg-primary/[0.08]" : "hover:bg-surface-muted",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-ink">{item.label}</span>
                  {item.isOverridden ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Edited" />
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[0.62rem] text-muted">
                  {item.key}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="card p-5 sm:p-7">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{selected.group}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.02em]">
                    {selected.label}
                  </h3>
                  <p className="mt-1 font-mono text-[0.65rem] text-muted">{selected.key}</p>
                </div>
                {selected.isOverridden ? <span className="badge badge-warning">Edited</span> : null}
              </div>

              {selected.description ? (
                <p className="mt-3 text-xs leading-6 text-muted">{selected.description}</p>
              ) : null}

              <div className="mt-5">
                <label htmlFor="content-value" className="label">
                  Live copy
                </label>
                <textarea
                  id="content-value"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={Math.min(12, Math.max(4, Math.ceil(draft.length / 85)))}
                  className="input min-h-[120px] resize-y font-normal"
                />
                <p className="mt-2 text-[0.68rem] text-muted">
                  {draft.length.toLocaleString("en-NG")} characters
                </p>
              </div>

              <div className="mt-4 rounded-md border border-border bg-surface-muted p-3">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  Default copy
                </p>
                <p className="mt-1 text-xs leading-6 text-muted">{selected.defaultValue}</p>
              </div>

              {notice ? (
                <div className="mt-4">
                  <Notice message={notice.message} tone={notice.tone} />
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || draft === selected.effectiveValue}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Save copy
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(selected.defaultValue)}
                  disabled={saving || draft === selected.defaultValue}
                  className="btn btn-secondary btn-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Use default in editor
                </button>
                <button
                  type="button"
                  onClick={() => void reset()}
                  disabled={saving || !selected.isOverridden}
                  className="btn btn-secondary btn-sm"
                >
                  Reset saved value
                </button>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              Select a content string to edit it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function settingInitialValue(item: SettingItem): string | boolean {
  if (item.type === "boolean") {
    return typeof item.value === "boolean" ? item.value : Boolean(item.defaultValue);
  }
  const value = item.value ?? item.defaultValue;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function SettingRow({
  item,
  onSaved,
}: {
  item: SettingItem;
  onSaved: (item: SettingItem) => void;
}) {
  const [draft, setDraft] = useState<string | boolean>(() => settingInitialValue(item));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const initial = settingInitialValue(item);
  const dirty = draft !== initial;

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const value =
        item.type === "boolean" ? Boolean(draft) : item.type === "number" ? Number(draft) : draft;
      const result = await adminApi<{ item: SettingItem }>(
        `/admin/settings/${encodeURIComponent(item.key)}`,
        { method: "PATCH", body: { value } },
      );
      onSaved(result.item);
      setNotice({ message: "Saved.", tone: "success" });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Setting could not be saved.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setNotice(null);
    try {
      const result = await adminApi<{ item: SettingItem }>(
        `/admin/settings/${encodeURIComponent(item.key)}/reset`,
        { method: "POST" },
      );
      onSaved(result.item);
      setDraft(settingInitialValue(result.item));
      setNotice({ message: "Reset to default.", tone: "success" });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Setting could not be reset.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const options = item.validation?.options ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">{item.label}</p>
          <p className="mt-0.5 truncate font-mono text-[0.62rem] text-muted">{item.key}</p>
          {item.description ? (
            <p className="mt-1.5 text-[0.68rem] leading-5 text-muted">{item.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {item.isSecret ? <span className="badge">Secret</span> : null}
          {item.isPublic ? <span className="badge badge-primary">Public</span> : null}
        </div>
      </div>

      <div className="mt-3">
        {item.type === "boolean" ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={Boolean(draft)}
              onChange={(event) => setDraft(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            {Boolean(draft) ? "Enabled" : "Disabled"}
          </label>
        ) : item.type === "select" ? (
          <select
            value={String(draft)}
            onChange={(event) => setDraft(event.target.value)}
            className="input"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : item.type === "number" ? (
          <input
            type="number"
            value={String(draft)}
            onChange={(event) => setDraft(event.target.value)}
            className="input"
          />
        ) : item.type === "json" || String(draft).length > 100 ? (
          <textarea
            value={String(draft)}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            className="input resize-y font-mono text-[0.7rem]"
            placeholder={item.isSecret ? "Enter a new secret value" : undefined}
          />
        ) : (
          <input
            type={item.isSecret ? "password" : "text"}
            value={String(draft)}
            onChange={(event) => setDraft(event.target.value)}
            className="input"
            placeholder={item.isSecret ? "Enter a new secret value" : undefined}
            autoComplete="off"
          />
        )}
      </div>

      {notice ? (
        <div className="mt-3">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty || (item.isSecret && !String(draft).trim())}
          className="btn btn-primary btn-sm"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={saving || (!item.isSet && item.value === null)}
          className="btn btn-secondary btn-sm"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [payload, setPayload] = useState<SettingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPayload(await adminApi<SettingPayload>("/admin/settings"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!payload) return null;

  const needle = query.trim().toLowerCase();
  const filtered = payload.items.filter(
    (item) =>
      (group === "All" || item.group === group) &&
      (!needle ||
        item.key.toLowerCase().includes(needle) ||
        item.label.toLowerCase().includes(needle)),
  );
  const grouped = groupBy(filtered, (item) => item.group);

  function replace(item: SettingItem) {
    setPayload((current) =>
      current
        ? {
            ...current,
            items: current.items.map((entry) => (entry.key === item.key ? item : entry)),
          }
        : current,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
            Business settings
          </h2>
          <p className="mt-1 text-sm text-muted">
            Commission, timers, invitations and security rules. Secrets are write-only.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            className="input pl-10"
            aria-label="Search settings"
          />
        </div>
      </div>

      <div className="scrollbar-thin mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {["All", ...payload.groups].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setGroup(name)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition-colors",
              group === name
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-ink",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {[...grouped.entries()].map(([name, items]) => (
          <section key={name}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-muted">
              {name}
            </h3>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {items.map((item) => (
                <SettingRow
                  key={`${item.key}-${String(item.value)}`}
                  item={item}
                  onSaved={replace}
                />
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No settings match this filter.</p>
        ) : null}
      </div>
    </div>
  );
}

function ThemePanel() {
  const [payload, setPayload] = useState<ThemePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState("All");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi<ThemePayload>("/admin/theme");
      setPayload(data);
      setDrafts(Object.fromEntries(data.items.map((item) => [item.key, item.value])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Theme could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!payload) return null;

  const filtered = payload.items.filter((item) => group === "All" || item.group === group);
  const grouped = groupBy(filtered, (item) => item.group);

  function replace(item: ThemeItem) {
    setPayload((current) =>
      current
        ? {
            ...current,
            items: current.items.map((entry) => (entry.key === item.key ? item : entry)),
          }
        : current,
    );
    setDrafts((current) => ({ ...current, [item.key]: item.value }));
  }

  async function save(item: ThemeItem) {
    setSavingKey(item.key);
    setNotice(null);
    try {
      const result = await adminApi<{ item: ThemeItem }>(
        `/admin/theme/${encodeURIComponent(item.key)}`,
        { method: "PATCH", body: { value: drafts[item.key] ?? item.value } },
      );
      replace(result.item);
      setNotice({ message: `Saved ${item.label}.`, tone: "success" });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Theme token could not be saved.",
        tone: "error",
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
            Brand and theme
          </h2>
          <p className="mt-1 text-sm text-muted">
            Colours, typography and logo assets applied across the public site and workspace.
          </p>
        </div>
      </div>

      <div className="scrollbar-thin mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {["All", ...payload.groups].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setGroup(name)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition-colors",
              group === name
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-ink",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="mt-4">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}

      <div className="mt-6 space-y-8">
        {[...grouped.entries()].map(([name, items]) => (
          <section key={name}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-muted">
              {name}
            </h3>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {items.map((item) => {
                const draft = drafts[item.key] ?? item.value;
                const dirty = draft !== item.value;
                const isColor = /^#[0-9a-f]{3,8}$/i.test(draft);
                return (
                  <div key={item.key} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-ink">{item.label}</p>
                        <p className="mt-0.5 font-mono text-[0.62rem] text-muted">{item.key}</p>
                      </div>
                      {item.isOverridden ? (
                        <span className="badge badge-warning">Edited</span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {isColor ? (
                        <input
                          type="color"
                          value={draft}
                          onChange={(event) =>
                            setDrafts((current) => ({ ...current, [item.key]: event.target.value }))
                          }
                          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-surface"
                          aria-label={`${item.label} colour picker`}
                        />
                      ) : null}
                      <input
                        value={draft}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [item.key]: event.target.value }))
                        }
                        className="input"
                      />
                    </div>
                    <p className="mt-2 truncate font-mono text-[0.62rem] text-muted">
                      Default: {item.defaultValue}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void save(item)}
                        disabled={!dirty || savingKey === item.key}
                        className="btn btn-primary btn-sm"
                      >
                        {savingKey === item.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((current) => ({ ...current, [item.key]: item.defaultValue }))
                        }
                        disabled={draft === item.defaultValue}
                        className="btn btn-secondary btn-sm"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Default
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FeaturesPanel() {
  const [items, setItems] = useState<FlagItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi<{ items: FlagItem[] }>("/admin/feature-flags");
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Feature flags could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(item: FlagItem) {
    setBusyKey(item.key);
    setNotice(null);
    try {
      const result = await adminApi<{ item: FlagItem }>(
        `/admin/feature-flags/${encodeURIComponent(item.key)}`,
        { method: "PATCH", body: { enabled: !item.enabled } },
      );
      setItems(
        (current) =>
          current?.map((entry) => (entry.key === item.key ? result.item : entry)) ?? current,
      );
      setNotice({
        message: `${item.label} is now ${result.item.enabled ? "on" : "off"}.`,
        tone: "success",
      });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Feature flag could not be changed.",
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!items) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">Feature flags</h2>
      <p className="mt-1 text-sm text-muted">
        Roll features out safely without a deployment. Changes are audited immediately.
      </p>

      {notice ? (
        <div className="mt-4">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4"
          >
            <div>
              <p className="text-xs font-semibold text-ink">{item.label}</p>
              <p className="mt-0.5 font-mono text-[0.62rem] text-muted">{item.key}</p>
              {item.description ? (
                <p className="mt-1.5 text-[0.68rem] leading-5 text-muted">{item.description}</p>
              ) : null}
              <div className="mt-2 flex gap-1">
                {item.isPublic ? <span className="badge badge-primary">Public</span> : null}
                <span className="badge">Default {item.defaultEnabled ? "on" : "off"}</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={item.enabled}
              aria-label={`Toggle ${item.label}`}
              onClick={() => void toggle(item)}
              disabled={busyKey === item.key}
              className={cn(
                "relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors",
                item.enabled ? "bg-primary" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform",
                  item.enabled ? "left-[22px]" : "left-0.5",
                )}
              >
                {busyKey === item.key ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted" aria-hidden="true" />
                ) : null}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user,
  content,
  onChanged,
  onCredentials,
}: {
  user: UserItem;
  content: Record<string, string>;
  onChanged: () => void;
  onCredentials: (credentials: OneTimeCredentials) => void;
}) {
  const t = makeT(content);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      let suspendedReason: string | null | undefined;
      if (status === "suspended" && user.status !== "suspended") {
        suspendedReason = window.prompt("Why is this account being suspended?") ?? "";
        if (!suspendedReason.trim()) {
          setSaving(false);
          setNotice({ message: "A suspension reason is required.", tone: "error" });
          return;
        }
      }
      if (status === "active" && user.status === "suspended") {
        suspendedReason = null;
      }
      await adminApi(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: {
          ...(role !== user.role ? { role } : {}),
          ...(status !== user.status ? { status } : {}),
          ...(suspendedReason !== undefined ? { suspendedReason } : {}),
        },
      });
      setNotice({ message: "Account updated.", tone: "success" });
      onChanged();
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Account could not be updated.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function revokeSessions() {
    setRevoking(true);
    setNotice(null);
    try {
      const result = await adminApi<{ revoked: number }>(
        `/admin/users/${user.id}/revoke-sessions`,
        { method: "POST" },
      );
      setNotice({
        message: `${result.revoked} active session${result.revoked === 1 ? "" : "s"} revoked.`,
        tone: "success",
      });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Sessions could not be revoked.",
        tone: "error",
      });
    } finally {
      setRevoking(false);
    }
  }

  async function resetPassword() {
    if (!window.confirm(t("admin.users.resetConfirm", { name: user.name }))) return;
    setResetting(true);
    setNotice(null);
    try {
      const result = await adminApi<StaffMutationResult>(`/admin/users/${user.id}/reset-password`, {
        method: "POST",
      });
      onCredentials({
        name: result.item.name,
        email: result.item.email,
        temporaryPassword: result.temporaryPassword,
        mode: "reset",
      });
      setNotice({ message: t("admin.users.resetNotice"), tone: "success" });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : t("admin.users.resetError"),
        tone: "error",
      });
    } finally {
      setResetting(false);
    }
  }

  const dirty = role !== user.role || status !== user.status;

  async function deleteUser() {
    if (!window.confirm(t("admin.users.deleteConfirm", { name: user.name }))) return;
    setDeleting(true);
    setNotice(null);
    try {
      await adminApi(`/admin/users/${user.id}`, { method: "DELETE" });
      onChanged();
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : t("admin.users.deleteError"),
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <span className={cn("badge", user.role === "admin" ? "badge-primary" : "")}>
              {user.role}
            </span>
            <span
              className={cn(
                "badge",
                user.status === "active"
                  ? "badge-success"
                  : user.status === "suspended"
                    ? "badge-danger"
                    : "badge-warning",
              )}
            >
              {user.status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
          <p className="mt-1 text-[0.68rem] text-muted">
            {user.clientProfile?.company
              ? `${user.clientProfile.company} · `
              : user.staffProfile?.title
                ? `${user.staffProfile.title} · `
                : ""}
            {user.role === "staff"
              ? `${user._count.staffRelationships} clients · ${user._count.ordersAsStaff} orders`
              : `${user._count.clientRelationships} specialists · ${user._count.ordersAsClient} orders`}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-muted">
            Last sign-in: {formatWhen(user.lastLoginAt)}
          </p>
          {user.suspendedReason ? (
            <p className="mt-1 text-[0.65rem] text-danger">Reason: {user.suspendedReason}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor={`role-${user.id}`}>
            Role
          </label>
          <select
            id={`role-${user.id}`}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="input"
          >
            <option value="client">client</option>
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor={`status-${user.id}`}>
            Status
          </label>
          <select
            id={`status-${user.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="input"
          >
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="suspended">suspended</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 lg:pt-6">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="btn btn-primary btn-sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={() => void revokeSessions()}
            disabled={revoking}
            className="btn btn-secondary btn-sm"
            title="Sign this user out everywhere"
          >
            {revoking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Sessions
          </button>
          {user.role === "staff" || user.role === "client" ? (
            <button
              type="button"
              onClick={() => void resetPassword()}
              disabled={resetting}
              className="btn btn-secondary btn-sm"
            >
              {resetting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {resetting ? t("admin.users.resetting") : t("admin.users.reset")}
            </button>
          ) : null}
          {user.role === "staff" || user.role === "client" ? (
            <button
              type="button"
              onClick={() => void deleteUser()}
              disabled={deleting}
              className="btn btn-secondary btn-sm text-danger"
              title="Delete this account"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {deleting ? t("admin.users.deleting") : t("admin.users.delete")}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="mt-3">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}
    </div>
  );
}

function AddStaffDialog({
  content,
  onClose,
  onIssued,
}: {
  content: Record<string, string>;
  onClose: () => void;
  onIssued: (credentials: OneTimeCredentials) => void;
}) {
  const t = makeT(content);
  const [form, setForm] = useState({ name: "", email: "", title: "", department: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = await adminApi<StaffMutationResult>("/admin/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          ...(form.title.trim() ? { title: form.title.trim() } : {}),
          ...(form.department.trim() ? { department: form.department.trim() } : {}),
        },
      });
      onIssued({
        name: result.item.name,
        email: result.item.email,
        temporaryPassword: result.temporaryPassword,
        mode: "create",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.users.createError"));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-secondary/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="add-staff-title"
              className="font-display text-xl font-semibold tracking-[-0.02em]"
            >
              {t("admin.users.createTitle")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted">{t("admin.users.createBody")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn btn-ghost btn-sm px-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={submit}>
          <label className="text-xs font-semibold">
            {t("admin.users.name")}
            <input
              className="input mt-1.5"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
              minLength={2}
              maxLength={160}
              required
              autoFocus
            />
          </label>
          <label className="text-xs font-semibold">
            {t("admin.users.email")}
            <input
              className="input mt-1.5"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              {t("admin.users.jobTitle")}
              <input
                className="input mt-1.5"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                maxLength={120}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("admin.users.department")}
              <input
                className="input mt-1.5"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                maxLength={120}
              />
            </label>
          </div>

          {error ? <Notice message={error} tone="error" /> : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? t("admin.users.creating") : t("admin.users.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemporaryPasswordDialog({
  credentials,
  content,
  onClose,
}: {
  credentials: OneTimeCredentials;
  content: Record<string, string>;
  onClose: () => void;
}) {
  const t = makeT(content);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-secondary/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-password-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="temp-password-title"
              className="font-display text-xl font-semibold tracking-[-0.02em]"
            >
              {credentials.mode === "create"
                ? t("admin.users.tempTitleCreate")
                : t("admin.users.tempTitleReset")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted">
              {t("admin.users.tempBody", { name: credentials.name })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm px-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-md border border-primary/20 bg-primary/5 p-4">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary">
            {t("admin.users.tempPasswordLabel")}
          </p>
          <p className="mt-2 select-all break-all font-mono text-sm font-semibold text-ink">
            {credentials.temporaryPassword}
          </p>
          <p className="mt-1 text-[0.68rem] text-muted">{credentials.email}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-3"
            onClick={() => void copyPassword()}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? t("admin.users.copied") : t("admin.users.copyPassword")}
          </button>
        </div>

        <p className="mt-4 text-xs leading-6 text-muted">{t("admin.users.tempPolicy")}</p>
        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-800">
          {t("admin.users.shownOnce")}
        </p>

        <div className="mt-5 flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t("admin.users.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersPanel({ content }: { content: Record<string, string> }) {
  const t = makeT(content);
  const [payload, setPayload] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [credentials, setCredentials] = useState<OneTimeCredentials | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (appliedQuery) params.set("search", appliedQuery);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      setPayload(await adminApi<UserPayload>(`/admin/users?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "People could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [appliedQuery, role, status]);

  function handleIssued(next: OneTimeCredentials) {
    setAddStaffOpen(false);
    if (next.mode === "create") {
      setNotice({ message: t("admin.users.createdNotice"), tone: "success" });
      void load();
    }
    setCredentials(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">People</h2>
          <p className="mt-1 text-sm text-muted">
            Staff, clients and administrators. Suspending an account revokes every session.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <form
            className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(query.trim());
            }}
          >
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email"
                className="input pl-10"
                aria-label="Search people"
              />
            </div>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="input w-auto"
            >
              <option value="">All roles</option>
              <option value="staff">Staff</option>
              <option value="client">Clients</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="input w-auto"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </form>
          <button
            type="button"
            onClick={() => setAddStaffOpen(true)}
            className="btn btn-primary btn-sm w-full sm:w-auto"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("admin.users.addStaff")}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}

      {loading ? <Loading /> : null}
      {error ? (
        <div className="mt-5">
          <ErrorPanel message={error} retry={() => void load()} />
        </div>
      ) : null}

      {!loading && !error && payload ? (
        <>
          <p className="mt-4 text-xs text-muted">
            {payload.meta.total.toLocaleString("en-NG")} account
            {payload.meta.total === 1 ? "" : "s"}
          </p>
          <div className="mt-3 space-y-3">
            {payload.items.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                content={content}
                onChanged={() => void load()}
                onCredentials={handleIssued}
              />
            ))}
            {payload.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No accounts match this filter.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {addStaffOpen ? (
        <AddStaffDialog
          content={content}
          onClose={() => setAddStaffOpen(false)}
          onIssued={handleIssued}
        />
      ) : null}
      {credentials ? (
        <TemporaryPasswordDialog
          credentials={credentials}
          content={content}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </div>
  );
}

function RolesPanel() {
  const [payload, setPayload] = useState<RolePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi<RolePayload>("/admin/roles");
      setPayload(data);
      const first = data.roles.find((role) => role.key === selectedKey) ?? data.roles[0] ?? null;
      setSelectedKey(first?.key ?? null);
      setSelected(new Set(first?.permissionKeys ?? []));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Roles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!payload) return null;

  const role = payload.roles.find((entry) => entry.key === selectedKey) ?? null;
  const permissionGroups = groupBy(payload.permissions, (permission) => permission.group);
  const original = new Set(role?.permissionKeys ?? []);
  const dirty = selected.size !== original.size || [...selected].some((key) => !original.has(key));

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!role) return;
    setSaving(true);
    setNotice(null);
    try {
      await adminApi(`/admin/roles/${encodeURIComponent(role.key)}/permissions`, {
        method: "PUT",
        body: { permissions: [...selected] },
      });
      setPayload((current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((entry) =>
                entry.key === role.key ? { ...entry, permissionKeys: [...selected] } : entry,
              ),
            }
          : current,
      );
      setNotice({ message: "Role permissions saved.", tone: "success" });
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "Permissions could not be saved.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
        Roles and permissions
      </h2>
      <p className="mt-1 text-sm text-muted">
        Control exactly what each role can see and change. Management must keep core admin access.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="card p-2">
          {payload.roles.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSelectedKey(item.key);
                setSelected(new Set(item.permissionKeys));
                setNotice(null);
              }}
              className={cn(
                "w-full rounded-md px-3 py-3 text-left transition-colors",
                item.key === selectedKey ? "bg-primary/[0.08]" : "hover:bg-surface-muted",
              )}
            >
              <span className="block text-xs font-semibold text-ink">{item.name}</span>
              <span className="mt-0.5 block text-[0.65rem] text-muted">
                {item.key} · {item.permissionKeys.length} permissions
              </span>
            </button>
          ))}
        </div>

        <div className="card p-5 sm:p-6">
          {role ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">{role.name}</h3>
                  <p className="mt-0.5 text-xs text-muted">{role.description}</p>
                </div>
                <span className="badge">{selected.size} selected</span>
              </div>

              {notice ? (
                <div className="mt-4">
                  <Notice message={notice.message} tone={notice.tone} />
                </div>
              ) : null}

              <div className="mt-5 space-y-6">
                {[...permissionGroups.entries()].map(([name, permissions]) => (
                  <section key={name}>
                    <h4 className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
                      {name}
                    </h4>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {permissions.map((permission) => (
                        <label
                          key={permission.key}
                          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-xs leading-5"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(permission.key)}
                            onChange={() => toggle(permission.key)}
                            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span>
                            <span className="block font-semibold text-ink">{permission.label}</span>
                            <span className="block text-[0.65rem] text-muted">
                              {permission.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="btn btn-primary btn-sm mt-6"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save permissions
              </button>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Select a role.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsPanel({ t }: { t: Translator }) {
  const [payload, setPayload] = useState<AdminReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [visibility, setVisibility] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (appliedQuery) params.set("search", appliedQuery);
      if (visibility) params.set("visible", visibility);
      setPayload(await adminApi<AdminReviewPayload>(`/admin/reviews?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reviews could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [appliedQuery, visibility]);

  async function toggle(review: AdminReviewItem) {
    setBusyId(review.id);
    setNotice(null);
    try {
      await adminApi<{ item: AdminReviewItem }>(`/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: { visible: !review.visible },
      });
      setNotice({
        message: review.visible
          ? t("admin.reviews.hiddenNotice")
          : t("admin.reviews.visibleNotice"),
        tone: "success",
      });
      await load();
    } catch (cause) {
      setNotice({
        message: cause instanceof Error ? cause.message : "The review could not be updated.",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
            {t("admin.reviews.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("admin.reviews.body")}</p>
        </div>
        <form
          className="flex w-full flex-wrap gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
          }}
        >
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("admin.reviews.search")}
              className="input pl-10"
              aria-label={t("admin.reviews.search")}
            />
          </div>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="input w-auto"
            aria-label={t("admin.reviews.filter")}
          >
            <option value="">{t("admin.reviews.filterAll")}</option>
            <option value="true">{t("admin.reviews.visible")}</option>
            <option value="false">{t("admin.reviews.hidden")}</option>
          </select>
        </form>
      </div>

      {notice ? (
        <div className="mt-4">
          <Notice message={notice.message} tone={notice.tone} />
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {error ? (
        <div className="mt-5">
          <ErrorPanel message={error} retry={() => void load()} />
        </div>
      ) : null}

      {!loading && !error && payload ? (
        <>
          <p className="mt-4 text-xs text-muted">
            {payload.meta.total.toLocaleString("en-NG")} review{payload.meta.total === 1 ? "" : "s"}
          </p>
          <div className="mt-3 space-y-3">
            {payload.items.map((review) => (
              <article key={review.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{review.order.number}</h3>
                      <span className="badge py-1">{humanReviewStatus(review.order.status)}</span>
                      <span
                        className={`badge py-1 ${review.visible ? "badge-success" : "badge-danger"}`}
                      >
                        {review.visible ? t("admin.reviews.visible") : t("admin.reviews.hidden")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {review.order.client.name} → {review.order.staff.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-semibold">
                      {((review.quality + review.communication + review.delivery) / 3).toFixed(1)}
                    </p>
                    <p className="text-[0.62rem] uppercase tracking-[0.08em] text-muted">/ 5</p>
                  </div>
                </div>
                {review.comment ? (
                  <p className="mt-3 text-xs leading-6 text-muted">{review.comment}</p>
                ) : null}
                {review.staffReply ? (
                  <div className="mt-3 border-l-2 border-primary/30 pl-3">
                    <p className="text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-primary">
                      {t("workspace.review.staffReply")}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-muted">{review.staffReply}</p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[0.66rem] text-muted">{formatWhen(review.createdAt)}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void toggle(review)}
                    disabled={busyId === review.id}
                  >
                    {busyId === review.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Star className="h-3.5 w-3.5" />
                    )}
                    {review.visible ? t("admin.reviews.hide") : t("admin.reviews.show")}
                  </button>
                </div>
              </article>
            ))}
            {payload.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{t("admin.reviews.empty")}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function humanReviewStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AuditPanel() {
  const [payload, setPayload] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPayload(await adminApi<AuditPayload>(`/admin/audit-logs?page=${page}&pageSize=50`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audit log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">Audit log</h2>
          <p className="mt-1 text-sm text-muted">
            A permanent record of sign-ins, content changes, people management and configuration.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn btn-secondary btn-sm">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? (
        <div className="mt-5">
          <ErrorPanel message={error} retry={() => void load()} />
        </div>
      ) : null}

      {!loading && !error && payload ? (
        <>
          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="hidden grid-cols-[1fr_1fr_1.3fr_0.9fr] gap-3 border-b border-border bg-surface-muted px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted md:grid">
              <span>Action</span>
              <span>Actor</span>
              <span>Entity</span>
              <span>When</span>
            </div>
            {payload.items.map((item) => (
              <details key={item.id} className="group border-b border-border last:border-0">
                <summary className="grid cursor-pointer list-none gap-1 px-4 py-3 text-xs md:grid-cols-[1fr_1fr_1.3fr_0.9fr] md:items-center md:gap-3">
                  <span className="font-semibold text-ink">{item.action}</span>
                  <span className="truncate text-muted">
                    {item.actor ? item.actor.name : "System"}
                    {item.actor ? (
                      <span className="hidden text-[0.65rem] text-muted lg:inline">
                        {" "}
                        · {item.actor.role}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate font-mono text-[0.65rem] text-muted">
                    {item.entityType}
                    {item.entityId ? `/${item.entityId.slice(0, 8)}` : ""}
                  </span>
                  <span className="text-[0.65rem] text-muted">{formatWhen(item.createdAt)}</span>
                </summary>
                <div className="grid gap-3 bg-surface-muted px-4 py-4 text-[0.65rem] md:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-muted">Before</p>
                    <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-surface p-2 font-mono">
                      {item.before ? JSON.stringify(item.before, null, 2) : "None"}
                    </pre>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-muted">After</p>
                    <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-surface p-2 font-mono">
                      {item.after ? JSON.stringify(item.after, null, 2) : "None"}
                    </pre>
                  </div>
                  <p className="text-muted md:col-span-2">
                    IP: {item.ip ?? "unknown"} · Entity ID: {item.entityId ?? "n/a"}
                  </p>
                </div>
              </details>
            ))}
            {payload.items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No audit events yet.</p>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>
              Page {payload.meta.page} of {payload.meta.totalPages || 1} ·{" "}
              {payload.meta.total.toLocaleString("en-NG")} events
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= payload.meta.totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
