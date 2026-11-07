import { redirect } from "next/navigation";
import { getBootstrap, getMe, settingString } from "@/lib/api";
import { getWorkspace } from "@/lib/workspace";
import { forwardedCookieHeader } from "@/lib/server";
import { resolveLogo, wordmark } from "@/lib/theme";
import { AppTopbar } from "@/components/app-topbar";
import { SessionKeeper } from "@/components/session-keeper";
import { WorkspaceClient } from "@/components/workspace-client";

export default async function WorkspacePage() {
  const cookieHeader = await forwardedCookieHeader();
  const me = await getMe(cookieHeader);
  if (!me) redirect("/login?next=/workspace");
  if (me.user.mustChangePassword) redirect("/account/password");

  const [bootstrap, workspace] = await Promise.all([getBootstrap(), getWorkspace(cookieHeader)]);
  if (!workspace) {
    return (
      <div className="min-h-screen">
        <SessionKeeper />
        <AppTopbar
          me={me}
          content={bootstrap.content}
          wordmark={wordmark(
            bootstrap.theme,
            settingString(bootstrap, "branding.companyName", "Denobelpro"),
          )}
          logoUrl={resolveLogo(bootstrap.theme)}
        />
        <main className="container-page py-20">
          <div className="card mx-auto max-w-xl p-10 text-center">
            <h1 className="font-display text-2xl font-semibold">Workspace unavailable</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              We could not load your workspace just now. Refresh the page to try again.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SessionKeeper />
      <AppTopbar
        me={me}
        content={bootstrap.content}
        wordmark={wordmark(
          bootstrap.theme,
          settingString(bootstrap, "branding.companyName", "Denobelpro"),
        )}
        logoUrl={resolveLogo(bootstrap.theme)}
      />
      <WorkspaceClient
        data={workspace}
        currency={settingString(bootstrap, "branding.currency", "NGN")}
        content={bootstrap.content}
      />
    </div>
  );
}
