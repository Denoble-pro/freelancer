import { NextResponse, type NextRequest } from "next/server";
import { apiTargets } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "x-forwarded-for",
];

const SKIP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await request.arrayBuffer());

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const suffix = `/${path.join("/")}${request.nextUrl.search}`;
  const targets = apiTargets();

  for (const [index, target] of targets.entries()) {
    try {
      const upstream = await fetch(`${target}/api/v1${suffix}`, {
        method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      });

      if ([502, 503, 504].includes(upstream.status) && index < targets.length - 1) {
        await upstream.body?.cancel();
        continue;
      }

      return copyResponse(upstream);
    } catch {
      // Try the next configured target.
    }
  }

  return NextResponse.json(
    {
      error: {
        code: "UPSTREAM_UNREACHABLE",
        message: "The API service could not be reached.",
      },
    },
    { status: 502 },
  );
}

function copyResponse(upstream: Response): Response {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (SKIP_RESPONSE_HEADERS.has(name) || name === "set-cookie") return;
    headers.append(name, value);
  });

  const cookieHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  for (const cookie of cookieHeaders.getSetCookie?.() ?? []) {
    headers.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as OPTIONS,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
