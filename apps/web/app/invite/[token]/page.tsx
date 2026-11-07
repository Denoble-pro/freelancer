import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { getBootstrap, getPublicInvitation, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { resolveLogo, wordmark } from "@/lib/theme";
import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/brand";
import { InviteAcceptForm } from "@/components/invite-accept-form";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

function friendlyExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const [bootstrap, invitation] = await Promise.all([getBootstrap(), getPublicInvitation(token)]);

  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const supportEmail = settingString(bootstrap, "branding.supportEmail", "support@denobelpro.com");

  if (!invitation.ok) {
    return (
      <main className="relative flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Brand wordmark={brandName} logoUrl={logoUrl} />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("common.backHome")}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="card w-full max-w-[520px] animate-rise p-8 text-center sm:p-10">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/[0.08] text-danger">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="eyebrow mt-6">{t("invite.eyebrow")}</p>
            <h1 className="mt-3 font-display text-[1.8rem] font-semibold tracking-[-0.03em]">
              {t("invite.expiredTitle")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted" role="alert">
              {invitation.message}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">{t("invite.expiredHelp")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn btn-primary">
                {t("invite.signIn")}
              </Link>
              <a href={`mailto:${supportEmail}`} className="btn btn-secondary">
                {supportEmail}
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { data } = invitation;
  const firstName = data.staff.name.trim().split(/\s+/)[0] ?? data.staff.name;

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.94fr_1.06fr]">
      <aside className="relative hidden overflow-hidden bg-secondary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grain pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-28 top-1/4 h-[420px] w-[420px] rounded-full bg-primary/35 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-[340px] w-[340px] rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Brand wordmark={brandName} logoUrl={logoUrl} tone="inverse" href="/" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {t("invite.eyebrow")}
          </span>

          <div className="mt-8 flex items-center gap-3">
            <Avatar name={data.staff.name} src={data.staff.avatarUrl} size="lg" />
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.12em] text-white/45">
                {t("invite.from")}
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold">{data.staff.name}</p>
              {data.staff.title ? (
                <p className="text-xs text-white/55">{data.staff.title}</p>
              ) : null}
            </div>
          </div>

          <blockquote className="mt-8 border-l border-white/15 pl-5 font-display text-[1.45rem] font-medium leading-[1.5] tracking-[-0.02em] text-white/90">
            &ldquo;
            {data.message ||
              `I would love to work with you. Accept this invitation and let's start the conversation.`}
            &rdquo;
          </blockquote>

          {data.staff.skills.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {data.staff.skills.slice(0, 5).map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[0.68rem] font-medium text-white/65"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex items-start gap-2.5 text-xs leading-6 text-white/45">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            {t("invite.expiry", { date: friendlyExpiry(data.expiresAt) })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[0.7rem] text-white/35">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t("invite.secure")}
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("common.backHome")}
          </Link>
          <div className="lg:hidden">
            <Brand wordmark={brandName} logoUrl={logoUrl} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[480px] animate-rise">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Avatar name={data.staff.name} src={data.staff.avatarUrl} size="md" />
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted">
                  {t("invite.from")}
                </p>
                <p className="text-sm font-semibold text-ink">
                  {data.staff.name}
                  {data.staff.title ? (
                    <span className="font-normal text-muted"> &middot; {data.staff.title}</span>
                  ) : null}
                </p>
              </div>
            </div>

            <p className="eyebrow">{t("invite.eyebrow")}</p>
            <h1 className="mt-3 font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2.3rem]">
              {t("invite.title")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted">{t("invite.subtitle")}</p>

            {data.message ? (
              <div className="mt-5 rounded-lg border border-border bg-surface-muted px-4 py-3.5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  {t("invite.messageLabel")} &middot; {firstName}
                </p>
                <p className="mt-1.5 text-xs leading-6 text-ink">{data.message}</p>
              </div>
            ) : null}

            <InviteAcceptForm token={token} email={data.email} content={bootstrap.content} />

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-[0.68rem] leading-5 text-muted">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              {t("invite.secure")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
