import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = process.env.ACCESS_COOKIE_NAME ?? "dlp_access";
const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "dlp_refresh";

function accessCookieExpired(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1]?.replaceAll("-", "+").replaceAll("_", "/") ?? ""),
    ) as {
      exp?: number;
    };
    return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now() + 5_000;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!accessCookieExpired(access)) return NextResponse.next();

  if (!refresh) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const refreshUrl = new URL("/auth/refresh", request.url);
  refreshUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(refreshUrl);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/workspace/:path*"],
};
