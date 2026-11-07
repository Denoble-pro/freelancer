import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = process.env.ACCESS_COOKIE_NAME ?? "dlp_access";
const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "dlp_refresh";
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export async function GET(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const nextPath = safeNext(request.nextUrl.searchParams.get("next"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  if (!refresh) return NextResponse.redirect(loginUrl);

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const failed = NextResponse.redirect(loginUrl);
      failed.cookies.delete(ACCESS_COOKIE);
      failed.cookies.delete(REFRESH_COOKIE);
      return failed;
    }

    const redirect = NextResponse.redirect(new URL(nextPath, request.url));
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    for (const cookie of headers.getSetCookie?.() ?? []) {
      redirect.headers.append("set-cookie", cookie);
    }
    return redirect;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}
