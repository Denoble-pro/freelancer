import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, LockKeyhole, Sparkles } from "lucide-react";
import { getBootstrap, getMe, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { forwardedCookieHeader } from "@/lib/server";
import { resolveLogo, wordmark } from "@/lib/theme";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNext(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const bootstrap = await getBootstrap();
  const t = makeT(bootstrap.content);
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const cookieHeader = await forwardedCookieHeader();

  if (cookieHeader) {
    const me = await getMe(cookieHeader);
    if (me) {
      redirect(
        me.user.mustChangePassword
          ? "/account/password"
          : me.user.role === "admin"
            ? "/admin"
            : "/workspace",
      );
    }
  }

  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const supportEmail = settingString(bootstrap, "branding.supportEmail", "support@denobelpro.com");

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden overflow-hidden bg-secondary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grain pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-32 top-1/3 h-[420px] w-[420px] rounded-full bg-primary/35 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-24 h-[360px] w-[360px] rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Brand wordmark={brandName} logoUrl={logoUrl} tone="inverse" href="/" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/70">
            <LockKeyhole className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {t("home.hero.badge")}
          </span>
          <blockquote className="mt-7 font-display text-[1.7rem] font-medium leading-[1.45] tracking-[-0.025em] text-white">
            “{t("home.testimonial.quote")}”
          </blockquote>
          <p className="mt-5 text-xs text-white/45">
            {t("home.testimonial.attribution")} · {t("home.testimonial.role")}
          </p>

          <ul className="mt-10 space-y-3.5">
            {[
              "home.features.one.title",
              "home.features.three.title",
              "home.features.four.title",
            ].map((key) => (
              <li key={key} className="flex items-center gap-3 text-sm text-white/65">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10">
                  <Check className="h-3 w-3 text-accent" aria-hidden="true" />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[0.7rem] text-white/35">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t("footer.secure")}
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
          <div className="w-full max-w-[430px] animate-rise">
            <p className="eyebrow">{t("auth.login.eyebrow")}</p>
            <h1 className="mt-3 font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2.3rem]">
              {t("auth.login.title")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted">{t("auth.login.subtitle")}</p>

            <LoginForm
              content={bootstrap.content}
              supportEmail={supportEmail}
              nextPath={nextPath}
            />

            <div className="mt-8 rounded-lg border border-border bg-surface p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t("auth.login.inviteOnlyTitle")}
              </p>
              <p className="mt-1.5 text-xs leading-6 text-muted">
                {t("auth.login.inviteOnlyBody")}
              </p>
            </div>

            <p className="mt-5 text-center text-[0.68rem] leading-5 text-muted">
              {t("auth.login.securityNote")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
