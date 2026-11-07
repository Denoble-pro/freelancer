import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Me } from "@/lib/api";
import { makeT } from "@/lib/content";
import { Avatar } from "./avatar";
import { Brand } from "./brand";
import { SignOutButton } from "./sign-out-button";

type AppTopbarProps = {
  me: Me;
  content: Record<string, string>;
  wordmark: string;
  logoUrl?: string;
};

export function AppTopbar({ me, content, wordmark, logoUrl }: AppTopbarProps) {
  const t = makeT(content);
  const isAdmin = me.user.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container-page flex h-[70px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Brand wordmark={wordmark} logoUrl={logoUrl} href="/workspace" />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Workspace">
            <Link href="/workspace" className="text-sm font-medium text-ink">
              {t("nav.workspace")}
            </Link>
            <Link
              href="/account"
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {t("account.profileTitle")}
            </Link>
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("admin.eyebrow")}
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar name={me.user.name} src={me.user.avatarUrl} size="sm" />
            <div className="hidden lg:block">
              <p className="text-xs font-semibold leading-tight text-ink">{me.user.name}</p>
              <p className="text-[0.66rem] capitalize text-muted">{me.user.role}</p>
            </div>
          </div>
          <SignOutButton label={t("account.signOut")} className="btn-sm" />
        </div>
      </div>
    </header>
  );
}
