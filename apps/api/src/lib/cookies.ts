import type { FastifyReply } from "fastify";
import { env, isProduction } from "../env.js";

const baseOptions = (maxAge: number, httpOnly = true) => ({
  path: "/",
  httpOnly,
  secure: isProduction,
  sameSite: "lax" as const,
  maxAge,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export function setAuthCookies(
  reply: FastifyReply,
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessSeconds: number;
    refreshSeconds: number;
  },
): void {
  reply.setCookie(env.ACCESS_COOKIE_NAME, tokens.accessToken, baseOptions(tokens.accessSeconds));
  reply.setCookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, baseOptions(tokens.refreshSeconds));
}

export function setAccessCookie(
  reply: FastifyReply,
  accessToken: string,
  accessSeconds: number,
): void {
  reply.setCookie(env.ACCESS_COOKIE_NAME, accessToken, baseOptions(accessSeconds));
}

export function setRefreshCookie(
  reply: FastifyReply,
  refreshToken: string,
  refreshSeconds: number,
): void {
  reply.setCookie(env.REFRESH_COOKIE_NAME, refreshToken, baseOptions(refreshSeconds));
}

export function clearAuthCookies(reply: FastifyReply): void {
  const options = {
    path: "/",
    secure: isProduction,
    sameSite: "lax" as const,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
  reply.clearCookie(env.ACCESS_COOKIE_NAME, options);
  reply.clearCookie(env.REFRESH_COOKIE_NAME, options);
}
