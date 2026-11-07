import Link from "next/link";
import { LockKeyhole, Mail } from "lucide-react";
import type { MenuItemData } from "@/lib/api";
import { makeT } from "@/lib/content";
import { Brand } from "./brand";

type SiteFooterProps = {
  content: Record<string, string>;
  menu: MenuItemData[];
  wordmark: string;
  logoUrl?: string;
  supportEmail: string;
};

export function SiteFooter({ content, menu, wordmark, logoUrl, supportEmail }: SiteFooterProps) {
  const t = makeT(content);

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <Brand wordmark={wordmark} logoUrl={logoUrl} />
          <p className="mt-5 text-sm leading-7 text-muted">{t("footer.tagline")}</p>
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-muted">
            <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t("footer.secure")}
          </p>
        </div>

        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">
            {t("nav.menu")}
          </p>
          <nav className="mt-4 flex flex-col gap-3" aria-label="Footer">
            {menu.map((item) => (
              <Link
                key={item.id}
                href={item.url}
                className="text-sm text-ink/80 transition-colors hover:text-primary"
              >
                {item.labelKey ? (content[item.labelKey] ?? item.label) : item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">
            {t("footer.supportTitle")}
          </p>
          <p className="mt-4 text-sm leading-7 text-muted">{t("footer.supportBody")}</p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {supportEmail}
          </a>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {t("footer.rights")}
          </p>
          <p>{t("home.hero.badge")}</p>
        </div>
      </div>
    </footer>
  );
}
