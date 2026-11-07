import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, LockKeyhole, Mail } from "lucide-react";
import { getBootstrap, getMe, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { forwardedCookieHeader } from "@/lib/server";
import { resolveLogo, wordmark } from "@/lib/theme";
import { Brand } from "@/components/brand";
import { ForcePasswordChange } from "@/components/force-password-change";
import { SessionKeeper } from "@/components/session-keeper";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ForcedPasswordPage() {
  const cookieHeader = await forwardedCookieHeader();
  const me = await getMe(cookieHeader);
  if (!me) redirect("/login?next=/account/password");
  if (!me.user.mustChangePassword) {
    redirect(me.user.role === "admin" ? "/admin" : "/workspace");
  }

  const bootstrap = await getBootstrap();
  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const redirectTo = me.user.role === "admin" ? "/admin" : "/workspace";

  return (
    <div className="min-h-screen bg-background">
      <SessionKeeper />
      <div className="container-page flex min-h-screen flex-col">
        <header className="flex items-center justify-between py-6">
          <Brand wordmark={brandName} logoUrl={logoUrl} />
          <span className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
            <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t("footer.secure")}
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-lg animate-rise">
            <div className="card p-7 sm:p-9">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[0.68rem] font-semibold text-primary">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                {t("account.forcePassword.eyebrow")}
              </span>
              <h1 className="mt-5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em]">
                {t("account.forcePassword.title")}
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted">{t("account.forcePassword.body")}</p>

              <div className="mt-5 flex items-center gap-3 rounded-md border border-border bg-surface-muted/60 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{me.user.name}</p>
                  <p className="truncate text-[0.7rem] text-muted">{me.user.email}</p>
                </div>
              </div>

              <ForcePasswordChange content={bootstrap.content} redirectTo={redirectTo} />
            </div>

            <div className="mt-5 flex justify-center">
              <SignOutButton
                label={t("account.forcePassword.signOut")}
                allDevices
                variant="ghost"
                className="btn-sm"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
