import { NextResponse } from "next/server";
import { apiTargets } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hostOf(target: string): string {
  try {
    return new URL(target).host;
  } catch {
    return "invalid";
  }
}

export async function GET() {
  const targets = apiTargets();
  const checks = [] as {
    host: string;
    status?: number;
    ms: number;
    body?: string;
    error?: string;
  }[];

  for (const target of targets) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${target}/api/v1/health/ready`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      checks.push({
        host: hostOf(target),
        status: response.status,
        ms: Date.now() - startedAt,
        body: (await response.text()).slice(0, 300),
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
      checks.push({
        host: hostOf(target),
        ms: Date.now() - startedAt,
        error: cause?.code ?? (error instanceof Error ? error.name : "Error"),
      });
    }
  }

  return NextResponse.json({
    webUrl: process.env.RENDER_EXTERNAL_URL ?? null,
    webServiceName: process.env.RENDER_SERVICE_NAME ?? null,
    apiInternalUrlSet: Boolean(process.env.API_INTERNAL_URL),
    apiPublicUrlSet: Boolean(process.env.API_PUBLIC_URL),
    targets: targets.map(hostOf),
    checks,
  });
}
