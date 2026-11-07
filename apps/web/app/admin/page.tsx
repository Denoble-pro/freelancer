import { notFound, redirect } from "next/navigation";
import { getAdminStats, getBootstrap, getMe, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { forwardedCookieHeader } from "@/lib/server";
import { resolveLogo, wordmark } from "@/lib/theme";
import { AdminConsole } from "@/components/admin-console";
import { AppTopbar } from "@/components/app-topbar";

export default async function AdminPage() {
  const cookieHeader = await forwardedCookieHeader();
  const me = await getMe(cookieHeader);
  if (!me) redirect("/login?next=/admin");
  if (me.user.mustChangePassword) redirect("/account/password");
  if (me.user.role !== "admin") notFound();

  const [bootstrap, stats] = await Promise.all([getBootstrap(), getAdminStats(cookieHeader)]);
  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);

  return (
    <div className="min-h-screen">
      <AppTopbar me={me} content={bootstrap.content} wordmark={brandName} logoUrl={logoUrl} />

      <main className="container-page py-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{t("admin.eyebrow")}</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              {t("admin.phase.title")}
            </h1>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{t("admin.phase.body")}</p>

        <AdminConsole stats={stats} content={bootstrap.content} />
      </main>
    </div>
  );
}
