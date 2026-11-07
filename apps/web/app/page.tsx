import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Eye,
  FileSignature,
  LayoutTemplate,
  LockKeyhole,
  MessageCircle,
  Plus,
  Quote,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getBootstrap, settingString } from "@/lib/api";
import { makeT } from "@/lib/content";
import { resolveLogo, wordmark } from "@/lib/theme";
import { Avatar } from "@/components/avatar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const featureIcons = [LayoutTemplate, ShieldCheck, FileSignature, Eye];
const featureKeys = ["one", "two", "three", "four"] as const;
const stepKeys = ["stepOne", "stepTwo", "stepThree"] as const;
const stepIcons = [Sparkles, MessageCircle, ShieldCheck];
const faqKeys = ["one", "two", "three", "four", "five"] as const;

export default async function LandingPage() {
  const bootstrap = await getBootstrap();
  const t = makeT(bootstrap.content);
  const menu = bootstrap.menus.header ?? [];
  const footerMenu = bootstrap.menus.footer ?? [];
  const brandName = wordmark(
    bootstrap.theme,
    settingString(bootstrap, "branding.companyName", "Denobelpro"),
  );
  const logoUrl = resolveLogo(bootstrap.theme);
  const previewSeller = t("home.preview.seller");
  const previewClient = t("home.preview.client");

  return (
    <div className="min-h-screen">
      <SiteHeader content={bootstrap.content} menu={menu} wordmark={brandName} logoUrl={logoUrl} />

      <main>
        <section className="relative overflow-hidden">
          <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-40 -top-48 h-[540px] w-[540px] rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="container-page relative grid items-center gap-16 py-16 lg:grid-cols-[1.04fr_0.96fr] lg:py-24">
            <div className="animate-rise">
              <span className="badge badge-primary">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                {t("home.hero.badge")}
              </span>

              <p className="eyebrow mt-7">{t("home.hero.eyebrow")}</p>
              <h1 className="mt-4 max-w-[15ch] text-[clamp(2.7rem,5.6vw,4.7rem)] font-[620] leading-[0.98] tracking-[-0.04em]">
                {t("home.hero.titleLead")}{" "}
                <span className="text-primary">{t("home.hero.titleAccent")}</span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-[1.02rem] leading-8 text-muted">
                {t("home.hero.subtitle")}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn btn-primary btn-lg">
                  {t("home.hero.primaryCta")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="#how-it-works" className="btn btn-secondary btn-lg">
                  {t("home.hero.secondaryCta")}
                </Link>
              </div>

              <p className="mt-6 flex max-w-[34rem] items-start gap-2.5 text-[0.8rem] leading-6 text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {t("home.hero.trustLine")}
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[500px] animate-rise-delayed">
              <div
                className="absolute -inset-8 rounded-[46px] bg-primary/[0.055] blur-2xl"
                aria-hidden="true"
              />
              <div className="card relative overflow-hidden p-0 shadow-lift">
                <div className="flex items-center justify-between border-b border-border bg-surface/90 px-5 py-3.5">
                  <span className="badge badge-primary border-0 py-1.5">
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("home.hero.badge")}
                  </span>
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={previewSeller} size="md" />
                      <div>
                        <p className="text-sm font-semibold text-ink">{previewSeller}</p>
                        <p className="text-[0.7rem] text-muted">{t("home.audience.staff.title")}</p>
                      </div>
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="max-w-[86%]">
                      <p className="mb-1.5 text-[0.68rem] font-medium text-muted">
                        {previewClient}
                      </p>
                      <div className="rounded-2xl rounded-tl-md border border-border bg-surface-muted px-4 py-3 text-[0.84rem] leading-6 text-ink">
                        {t("home.preview.message")}
                      </div>
                    </div>
                    <div className="ml-auto max-w-[88%]">
                      <p className="mb-1.5 text-right text-[0.68rem] font-medium text-muted">
                        {previewSeller}
                      </p>
                      <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-[0.84rem] leading-6 text-white">
                        {t("home.preview.reply")}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-[#8a5a09]">
                          <FileSignature className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-[0.82rem] font-semibold text-ink">
                            {t("home.preview.offerTitle")}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">{t("home.preview.delivery")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-sm font-semibold text-ink">
                          {t("home.preview.price")}
                        </p>
                        <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wide text-primary">
                          {t("home.preview.offerStatus")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-[0.7rem] font-medium text-muted">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      {t("home.preview.escrow")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="animate-float absolute -bottom-7 -left-3 hidden items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success">
                  <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                    {t("home.preview.offerStatus")}
                  </p>
                  <p className="text-xs font-medium text-ink">{t("home.preview.delivery")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="container-page relative pb-14">
            <div className="grid divide-y divide-border border-y border-border bg-background/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {(["one", "two", "three"] as const).map((key) => (
                <div key={key} className="px-6 py-6 first:pl-0 sm:py-7">
                  <p className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
                    {t(`home.stat.${key}.value`)}
                  </p>
                  <p className="mt-1.5 max-w-[16rem] text-[0.8rem] leading-6 text-muted">
                    {t(`home.stat.${key}.label`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="section scroll-mt-20 border-y border-border bg-surface">
          <div className="container-page">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <p className="eyebrow">{t("home.features.eyebrow")}</p>
                <h2 className="section-title mt-4">{t("home.features.title")}</h2>
                <p className="section-lead mt-5">{t("home.features.subtitle")}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {featureKeys.map((key, index) => {
                  const Icon = featureIcons[index] ?? ShieldCheck;
                  return (
                    <article
                      key={key}
                      className="group rounded-lg border border-border bg-background/60 p-6 transition-colors hover:bg-surface"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <h3 className="mt-5 font-display text-[1.02rem] font-semibold tracking-[-0.02em]">
                        {t(`home.features.${key}.title`)}
                      </h3>
                      <p className="mt-2 text-[0.85rem] leading-7 text-muted">
                        {t(`home.features.${key}.body`)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section scroll-mt-20">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-[32px] bg-secondary px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-16">
              <div
                className="grain pointer-events-none absolute inset-0 opacity-30"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="max-w-2xl">
                  <p className="eyebrow text-accent">{t("home.how.eyebrow")}</p>
                  <h2 className="section-title mt-4 text-white">{t("home.how.title")}</h2>
                  <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">
                    {t("home.how.subtitle")}
                  </p>
                </div>

                <div className="mt-12 grid gap-4 lg:grid-cols-3">
                  {stepKeys.map((key, index) => {
                    const Icon = stepIcons[index] ?? Sparkles;
                    return (
                      <article
                        key={key}
                        className="relative rounded-2xl border border-white/10 bg-white/[0.055] p-6 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[0.7rem] font-medium tracking-[0.2em] text-accent">
                            {t(`home.how.${key}.number`)}
                          </span>
                          <Icon className="h-5 w-5 text-white/40" aria-hidden="true" />
                        </div>
                        <h3 className="mt-8 font-display text-[1.08rem] font-semibold text-white">
                          {t(`home.how.${key}.title`)}
                        </h3>
                        <p className="mt-2.5 text-[0.84rem] leading-7 text-white/60">
                          {t(`home.how.${key}.body`)}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7">
                  <p className="max-w-md text-[0.8rem] leading-6 text-white/55">
                    {t("home.audience.subtitle")}
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-accent"
                  >
                    {t("nav.signIn")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="container-page grid gap-6 lg:grid-cols-2">
            <article className="card relative overflow-hidden p-8 sm:p-10">
              <Quote className="h-8 w-8 text-primary/20" aria-hidden="true" />
              <p className="eyebrow mt-5">{t("home.testimonial.eyebrow")}</p>
              <blockquote className="mt-4 font-display text-[1.35rem] font-medium leading-[1.5] tracking-[-0.02em] text-ink sm:text-[1.55rem]">
                “{t("home.testimonial.quote")}”
              </blockquote>
              <footer className="mt-7 flex items-center gap-3">
                <Avatar name={t("home.testimonial.attribution")} size="md" />
                <div>
                  <p className="text-sm font-semibold">{t("home.testimonial.attribution")}</p>
                  <p className="text-xs text-muted">{t("home.testimonial.role")}</p>
                </div>
              </footer>
            </article>

            <article className="card bg-surface-muted p-8 sm:p-10">
              <p className="eyebrow">{t("home.audience.eyebrow")}</p>
              <h2 className="mt-4 font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.03em]">
                {t("home.audience.title")}
              </h2>
              <div className="mt-7 space-y-5">
                <div className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white">
                    <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{t("home.audience.staff.title")}</h3>
                    <p className="mt-1 text-[0.82rem] leading-6 text-muted">
                      {t("home.audience.staff.body")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-white">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{t("home.audience.client.title")}</h3>
                    <p className="mt-1 text-[0.82rem] leading-6 text-muted">
                      {t("home.audience.client.body")}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="faq" className="section scroll-mt-20 border-t border-border bg-surface">
          <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="eyebrow">{t("home.faq.eyebrow")}</p>
              <h2 className="section-title mt-4">{t("home.faq.title")}</h2>
              <p className="section-lead mt-5">{t("home.faq.subtitle")}</p>
            </div>

            <div>
              {faqKeys.map((key) => (
                <details key={key} className="faq-item group">
                  <summary>
                    <span>{t(`home.faq.${key}.question`)}</span>
                    <Plus
                      className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="faq-answer">{t(`home.faq.${key}.answer`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-[32px] bg-primary px-6 py-14 text-white sm:px-12 lg:px-16">
              <div
                className="grain pointer-events-none absolute inset-0 opacity-20"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-accent/25 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/65">
                    {t("home.cta.eyebrow")}
                  </p>
                  <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.3rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                    {t("home.cta.title")}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
                    {t("home.cta.body")}
                  </p>
                  <p className="mt-5 text-xs text-white/50">{t("home.cta.note")}</p>
                </div>
                <Link
                  href="/login"
                  className="btn btn-lg shrink-0 bg-white text-primary hover:bg-white/90"
                >
                  {t("home.cta.button")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter
        content={bootstrap.content}
        menu={footerMenu}
        wordmark={brandName}
        logoUrl={logoUrl}
        supportEmail={settingString(bootstrap, "branding.supportEmail", "support@denobelpro.com")}
      />
    </div>
  );
}
