import Link from "next/link";
import { ArrowUpRight, LockKeyhole, Menu } from "lucide-react";
import type { MenuItemData } from "@/lib/api";
import { makeT } from "@/lib/content";
import { Brand } from "./brand";

type SiteHeaderProps = {
  content: Record<string, string>;
  menu: MenuItemData[];
  wordmark: string;
  logoUrl?: string;
  anchorBase?: string;
};

function labelFor(item: MenuItemData, content: Record<string, string>): string {
  return item.labelKey ? (content[item.labelKey] ?? item.label) : item.label;
}

function urlFor(item: MenuItemData, anchorBase?: string): string {
  if (anchorBase && item.url.startsWith("#")) return `${anchorBase}${item.url}`;
  return item.url;
}

export function SiteHeader({ content, menu, wordmark, logoUrl, anchorBase }: SiteHeaderProps) {
  const t = makeT(content);
  const cta = menu.find((item) => item.url === "/login");
  const navItems = menu.filter((item) => item.id !== cta?.id);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="container-page flex h-[74px] items-center justify-between gap-6">
        <Brand wordmark={wordmark} logoUrl={logoUrl} />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.id} href={urlFor(item, anchorBase)} className="nav-link">
              {labelFor(item, content)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-muted">
            <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t("home.hero.badge")}
          </span>
          <Link href={cta?.url ?? "/login"} className="btn btn-primary btn-sm">
            {t("nav.signIn")}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <details className="group relative lg:hidden">
          <summary className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-border bg-surface">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{t("nav.menu")}</span>
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-lg border border-border bg-surface p-3 shadow-lift">
            <nav className="flex flex-col" aria-label="Mobile">
              {menu.map((item) => (
                <Link
                  key={item.id}
                  href={urlFor(item, anchorBase)}
                  className="rounded-sm px-3 py-3 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  {labelFor(item, content)}
                </Link>
              ))}
            </nav>
            <Link href="/login" className="btn btn-primary mt-2 w-full">
              {t("nav.signIn")}
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
