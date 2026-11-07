import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandProps = {
  wordmark: string;
  logoUrl?: string;
  href?: string;
  tone?: "default" | "inverse";
  className?: string;
};

export function Brand({ wordmark, logoUrl, href = "/", tone = "default", className }: BrandProps) {
  const content = logoUrl ? (
    // Admin-managed logos can live on any storage host, so a plain image is intentional here.
    <img src={logoUrl} alt={wordmark} className="h-9 w-auto max-w-[180px] object-contain" />
  ) : (
    <>
      <span
        className={cn(
          "relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px]",
          tone === "inverse" ? "bg-white/12 ring-1 ring-white/15" : "bg-primary",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          <path
            d="M9 24V8h7.2c5 0 8.3 3.1 8.3 8s-3.3 8-8.3 8H9Z"
            stroke="white"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M9 13h6.4" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className={cn(
          "font-display text-[1.13rem] font-semibold tracking-[-0.03em]",
          tone === "inverse" ? "text-white" : "text-ink",
        )}
      >
        {wordmark}
        <span className="text-accent">.</span>
      </span>
    </>
  );

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label={wordmark}
    >
      {content}
    </Link>
  );
}
