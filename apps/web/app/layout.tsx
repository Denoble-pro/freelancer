import type { Metadata } from "next";
import { buildThemeStyle, themeDefaultMap } from "@dlp/shared";
import { getBootstrap, settingString } from "@/lib/api";
import { googleFontsHref } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const bootstrap = await getBootstrap();
  const companyName = settingString(bootstrap, "branding.companyName", "Denobelpro");
  const title = `${companyName} Marketplace`;
  const description =
    bootstrap.content["home.hero.subtitle"] ??
    "A private marketplace for staff and the clients they invite.";
  const favicon = bootstrap.theme["brand.faviconUrl"];

  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: {
      default: `${title} — Private workspace`,
      template: `%s · ${companyName}`,
    },
    description,
    applicationName: companyName,
    robots: { index: false, follow: false, nocache: true },
    icons: favicon ? { icon: favicon } : undefined,
    openGraph: {
      title: `${title} — Private workspace`,
      description,
      siteName: companyName,
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bootstrap = await getBootstrap();
  const theme = { ...themeDefaultMap, ...bootstrap.theme };
  const style = buildThemeStyle(theme);
  const fontsHref = googleFontsHref(theme);
  const defaultLanguage =
    bootstrap.languages.find((language) => language.isDefault) ?? bootstrap.languages[0];
  const direction = defaultLanguage?.direction === "rtl" ? "rtl" : "ltr";

  return (
    <html
      lang={defaultLanguage?.code ?? "en"}
      dir={direction}
      className={theme["brand.defaultMode"] === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
        <style id="dlp-theme-tokens" dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
