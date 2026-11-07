import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import sanitizeHtml from "sanitize-html";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@dlp/shared";
import { getBootstrap, getPublicPage, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { resolveLogo, wordmark } from "@/lib/theme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type PageProps = { params: Promise<{ slug: string }> };

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "hr",
  "code",
  "pre",
];

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
  });
}

function blockHtml(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const html = (content as { html?: unknown }).html;
  return typeof html === "string" ? html : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.title,
    description: `Private Denobelpro ${page.title.toLowerCase()} page.`,
  };
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const [bootstrap, page] = await Promise.all([getBootstrap(), getPublicPage(slug)]);
  if (!page) notFound();

  const t = makeT(bootstrap.content);
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const supportEmail = settingString(bootstrap, "branding.supportEmail", "support@denobelpro.com");

  return (
    <div className="min-h-screen">
      <SiteHeader
        content={bootstrap.content}
        menu={bootstrap.menus.header ?? []}
        wordmark={brandName}
        logoUrl={logoUrl}
        anchorBase="/"
      />

      <main className="container-page py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("staticPage.back")}
        </Link>

        <header className="mt-8 max-w-3xl">
          <p className="eyebrow">{t("home.hero.badge")}</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.03] tracking-[-0.04em]">
            {page.title}
          </h1>
          <p className="mt-4 text-xs text-muted">
            {t("staticPage.updated")} · {formatDate(page.updatedAt)}
          </p>
        </header>

        <article className="card mt-8 max-w-3xl p-7 sm:p-10">
          {page.blocks.map((block) => {
            const html = blockHtml(block.content);
            if (block.type !== "rich_text" || !html) return null;
            return (
              <div
                key={block.id}
                className="prose-dlp"
                dangerouslySetInnerHTML={{ __html: sanitize(html) }}
              />
            );
          })}
        </article>
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
