import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Globe2,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  firstName,
  formatDate,
  humanStatus,
  permissions as permissionDefinitions,
  roleDefinitions,
} from "@dlp/shared";
import { getAccountProfile, getBootstrap, getMe, getSessions, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { forwardedCookieHeader } from "@/lib/server";
import { resolveLogo, wordmark } from "@/lib/theme";
import { AccountSettings } from "@/components/account-settings";
import { AppTopbar } from "@/components/app-topbar";
import { Avatar } from "@/components/avatar";
import { SessionKeeper } from "@/components/session-keeper";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AccountPage() {
  const cookieHeader = await forwardedCookieHeader();
  const me = await getMe(cookieHeader);
  if (!me) redirect("/login?next=/account");
  if (me.user.mustChangePassword) redirect("/account/password");

  const [bootstrap, sessions, profile] = await Promise.all([
    getBootstrap(),
    getSessions(cookieHeader),
    getAccountProfile(cookieHeader),
  ]);
  if (!profile) redirect("/login?next=/account");
  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const roleName =
    roleDefinitions.find((role) => role.key === me.user.role)?.name ?? humanStatus(me.user.role);
  const permissionLabels = new Map(
    permissionDefinitions.map((permission) => [permission.key, permission.label]),
  );
  const first = firstName(me.user.name);
  const activeSessions = sessions
    .filter((session) => session.current || sessions.length > 1)
    .slice(0, 4);

  return (
    <div className="min-h-screen">
      <SessionKeeper />
      <AppTopbar me={me} content={bootstrap.content} wordmark={brandName} logoUrl={logoUrl} />

      <main className="container-page py-10 sm:py-12">
        <header className="max-w-3xl">
          <p className="eyebrow">{t("account.eyebrow")}</p>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
            {t("account.title", { first_name: first })}
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted">{t("account.subtitle")}</p>
        </header>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="card-flat flex items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted">
                {t("account.roleLabel")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{roleName}</p>
            </div>
          </div>
          <div className="card-flat flex items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-success/10 text-success">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted">
                {t("account.statusLabel")}
              </p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-ink">
                {humanStatus(me.user.status)}
              </p>
            </div>
          </div>
          <div className="card-flat flex items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-[#8a5a09]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted">
                {t("account.memberSince")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {formatDate(me.user.createdAt, { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        <AccountSettings profile={profile} content={bootstrap.content} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="card overflow-hidden p-0">
            <div className="relative overflow-hidden bg-secondary px-7 py-8 text-white sm:px-9">
              <div
                className="grain pointer-events-none absolute inset-0 opacity-25"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/40 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative">
                <span className="badge border-white/15 bg-white/10 text-white/70">
                  <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {t("common.phaseBadge")}
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em]">
                  {t("account.securityTitle")}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-7 text-white/60">
                  {t("account.permissionsBody")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-7 sm:grid-cols-2 sm:p-9">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[0.82rem] leading-6 text-muted">
                  {t("account.securityPassword")}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[0.82rem] leading-6 text-muted">
                  {t("account.securitySessions")}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[0.82rem] leading-6 text-muted">{t("account.securityAudit")}</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Globe2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[0.82rem] leading-6 text-muted">{t("footer.secure")}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-border px-7 py-5 sm:px-9">
              <Link href="/workspace" className="btn btn-primary btn-sm">
                {t("account.openWorkspace")}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link href="/" className="btn btn-secondary btn-sm">
                {t("account.viewSite")}
              </Link>
              {me.user.role === "admin" ? (
                <Link href="/admin" className="btn btn-secondary btn-sm">
                  {t("account.openAdmin")}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : (
                <p className="self-center text-xs text-muted">{t("account.notAdminYet")}</p>
              )}
            </div>
          </section>

          <section className="card p-7 sm:p-8">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">
              {t("account.profileTitle")}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Avatar name={me.user.name} src={me.user.avatarUrl} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold tracking-[-0.02em]">
                  {me.user.name}
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted">{me.user.email}</p>
              </div>
            </div>

            <dl className="mt-7 space-y-4">
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <dt className="text-xs text-muted">{t("account.roleLabel")}</dt>
                <dd className="text-xs font-semibold capitalize text-ink">{me.user.role}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <dt className="text-xs text-muted">{t("account.emailLabel")}</dt>
                <dd className="max-w-[60%] truncate text-xs font-semibold text-ink">
                  {me.user.email}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <dt className="text-xs text-muted">{t("account.statusLabel")}</dt>
                <dd className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  {humanStatus(me.user.status)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <dt className="text-xs text-muted">{t("account.memberSince")}</dt>
                <dd className="text-xs font-semibold text-ink">{formatDate(me.user.createdAt)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="card p-7 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                  {t("account.sessionsTitle")}
                </h2>
                <p className="mt-1 text-xs leading-6 text-muted">{t("account.sessionsBody")}</p>
              </div>
              <SignOutButton
                label={t("account.signOutAll")}
                allDevices
                variant="secondary"
                className="btn-sm shrink-0"
              />
            </div>

            <div className="mt-4">
              {activeSessions.length === 0 ? (
                <p className="border-t border-border py-5 text-xs text-muted">
                  {t("account.noSessions")}
                </p>
              ) : (
                activeSessions.map((session) => (
                  <div key={session.id} className="session-row">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-muted text-muted">
                        <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink">{session.device}</p>
                        <p className="mt-0.5 text-[0.68rem] text-muted">
                          {formatDate(session.lastUsedAt, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {session.current ? (
                      <span className="badge badge-primary py-1">
                        {t("account.currentSession")}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card p-7 sm:p-8">
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
              {t("account.permissionsTitle")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted">{t("account.permissionsBody")}</p>
            <ul className="mt-5 space-y-2.5">
              {me.permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-2.5 text-[0.82rem] text-muted">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/10">
                    <Check className="h-2.5 w-2.5 text-success" aria-hidden="true" />
                  </span>
                  {permissionLabels.get(permission) ?? humanStatus(permission.replaceAll(".", " "))}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
