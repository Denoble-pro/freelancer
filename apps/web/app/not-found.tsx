import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { getBootstrap, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { resolveLogo, wordmark } from "@/lib/theme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function NotFound() {
  const bootstrap = await getBootstrap();
  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const supportEmail = settingString(bootstrap, "branding.supportEmail", "support@denobelpro.com");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        content={bootstrap.content}
        menu={bootstrap.menus.header ?? []}
        wordmark={brandName}
        logoUrl={logoUrl}
        anchorBase="/"
      />
      <main className="container-page flex flex-1 items-center justify-center py-20">
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6 justify-center">{t("common.phaseBadge")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em]">
            {t("errors.notFound.title")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("errors.notFound.body")}</p>
          <Link href="/" className="btn btn-primary mt-7">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("common.backHome")}
          </Link>
        </div>
      </main>
      <SiteFooter
        content={bootstrap.content}
        menu={bootstrap.menus.footer ?? []}
        wordmark={brandName}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
      />
    </div>
  );
}
